import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { config as loadEnv } from "dotenv";
import { validatedImportSchema, type ValidatedImport, type ValidatedTransaction } from "./contracts.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type SubmitConfig = {
  apiBaseUrl: string;
  familyUuid: string;
  refreshToken?: string;
  defaultCategoryName: string;
  excludeFromBudget: boolean;
};

type CandidateSubmission = {
  status: "pending" | "submitting" | "submitted" | "recovered" | "needs_review" | "failed";
  remoteUuid?: string;
  updatedAt: string;
};

type BatchSubmission = {
  status: "pending" | "running" | "completed" | "partial" | "needs_review" | "failed";
  candidates: Record<string, CandidateSubmission>;
  updatedAt: string;
};

type SubmissionState = {
  schemaVersion: 1;
  batches: Record<string, BatchSubmission>;
};

type ApiTransaction = {
  uuid: string;
  amount: number | string;
  description: string | null;
  date: string;
};

type SubmissionItem = {
  day: string;
  transaction: ValidatedTransaction;
  description: string;
  categoryUuid: string;
};

type SubmitOptions = {
  stateDir: string;
  config: SubmitConfig;
  fetchImpl?: FetchLike;
  now?: () => Date;
};

export type SubmitSummary = {
  batchId: string;
  submitted: number;
  recovered: number;
  skipped: number;
};

class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function nowIso(now?: () => Date): string {
  return (now?.() ?? new Date()).toISOString();
}

function readJsonIfExists(path: string): unknown | null {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function atomicPrivateJsonWrite(path: string, value: unknown): void {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, path);
  chmodSync(path, 0o600);
}

function initialState(): SubmissionState {
  return { schemaVersion: 1, batches: {} };
}

function loadSubmissionState(path: string): SubmissionState {
  const raw = readJsonIfExists(path);
  if (!raw) return initialState();
  const state = raw as SubmissionState;
  if (state.schemaVersion !== 1 || typeof state.batches !== "object") {
    throw new Error("INVALID_SUBMISSION_STATE");
  }
  return state;
}

async function apiJson<T>(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetchImpl(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new ApiError(response.status, `ACCOUNTBOOK_API_${response.status}`);
  return await response.json() as T;
}

async function refreshAccessToken(
  config: SubmitConfig,
  stateDir: string,
  fetchImpl: FetchLike,
): Promise<string> {
  const authPath = join(stateDir, "auth.json");
  const saved = readJsonIfExists(authPath) as { refreshToken?: string } | null;
  const refreshToken = saved?.refreshToken ?? config.refreshToken;
  if (!refreshToken) throw new Error("MISSING_REFRESH_TOKEN");

  const response = await apiJson<{
    data?: { accessToken?: string; refreshToken?: string; expiredAt?: string };
  }>(fetchImpl, `${config.apiBaseUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const accessToken = response.data?.accessToken;
  const nextRefreshToken = response.data?.refreshToken;
  if (!accessToken || !nextRefreshToken) throw new Error("INVALID_REFRESH_RESPONSE");

  atomicPrivateJsonWrite(authPath, {
    schemaVersion: 1,
    refreshToken: nextRefreshToken,
    accessTokenExpiresAt: response.data?.expiredAt ?? null,
    updatedAt: new Date().toISOString(),
  });
  return accessToken;
}

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function fetchCategories(
  config: SubmitConfig,
  accessToken: string,
  fetchImpl: FetchLike,
): Promise<Map<string, string>> {
  const response = await apiJson<{ data?: Array<{ uuid?: string; name?: string }> }>(
    fetchImpl,
    `${config.apiBaseUrl}/families/${config.familyUuid}/categories`,
    { method: "GET", headers: authHeaders(accessToken) },
  );
  const categories = new Map<string, string>();
  for (const category of response.data ?? []) {
    if (category.name && category.uuid) categories.set(category.name, category.uuid);
  }
  return categories;
}

async function fetchExistingTransactions(
  type: "expense" | "income",
  date: string,
  config: SubmitConfig,
  accessToken: string,
  fetchImpl: FetchLike,
): Promise<ApiTransaction[]> {
  const collection = type === "expense" ? "expenses" : "incomes";
  const items: ApiTransaction[] = [];
  let page = 0;
  let totalPages = 1;
  do {
    const params = new URLSearchParams({
      page: String(page),
      size: "100",
      startDate: date,
      endDate: date,
    });
    const response = await apiJson<{
      data?: { items?: ApiTransaction[]; totalPages?: number };
    }>(
      fetchImpl,
      `${config.apiBaseUrl}/families/${config.familyUuid}/${collection}?${params}`,
      { method: "GET", headers: authHeaders(accessToken) },
    );
    items.push(...(response.data?.items ?? []));
    totalPages = Math.max(response.data?.totalPages ?? 1, 1);
    page += 1;
  } while (page < totalPages);
  return items;
}

function apiDescription(transaction: ValidatedTransaction): string {
  const description = transaction.paymentMethod
    ? `${transaction.description} | ${transaction.paymentMethod}`
    : transaction.description;
  if (description.length > 1000) throw new Error(`DESCRIPTION_TOO_LONG:${transaction.candidateId}`);
  return description;
}

function exactMatches(existing: ApiTransaction[], item: SubmissionItem): ApiTransaction[] {
  return existing.filter((remote) => (
    Number(remote.amount) === item.transaction.amount
    && (remote.description ?? "") === item.description
    && remote.date.startsWith(item.day)
  ));
}

function prepareItems(batch: ValidatedImport, categories: Map<string, string>, config: SubmitConfig): SubmissionItem[] {
  const items: SubmissionItem[] = [];
  for (const day of batch.days.filter((candidateDay) => candidateDay.selectedForImport)) {
    for (const transaction of day.transactions) {
      const categoryName = transaction.categoryName ?? config.defaultCategoryName;
      const categoryUuid = categories.get(categoryName);
      if (!categoryUuid) throw new Error(`CATEGORY_NOT_FOUND:${categoryName}`);
      items.push({
        day: day.date,
        transaction,
        description: apiDescription(transaction),
        categoryUuid,
      });
    }
  }
  return items;
}

async function createRemoteTransaction(
  item: SubmissionItem,
  config: SubmitConfig,
  accessToken: string,
  fetchImpl: FetchLike,
): Promise<string> {
  const collection = item.transaction.type === "expense" ? "expenses" : "incomes";
  const payload: Record<string, unknown> = {
    categoryUuid: item.categoryUuid,
    amount: item.transaction.amount,
    description: item.description,
    date: `${item.day}T12:00:00`,
  };
  if (item.transaction.type === "expense") {
    payload.excludeFromBudget = config.excludeFromBudget;
  }
  const response = await apiJson<{ data?: { uuid?: string } }>(
    fetchImpl,
    `${config.apiBaseUrl}/families/${config.familyUuid}/${collection}`,
    { method: "POST", headers: authHeaders(accessToken), body: JSON.stringify(payload) },
  );
  if (!response.data?.uuid) throw new Error("INVALID_CREATE_RESPONSE");
  return response.data.uuid;
}

function batchState(state: SubmissionState, batchId: string, timestamp: string): BatchSubmission {
  return state.batches[batchId] ?? {
    status: "pending",
    candidates: {},
    updatedAt: timestamp,
  };
}

function statusCounts(batch: BatchSubmission): Omit<SubmitSummary, "batchId"> {
  const values = Object.values(batch.candidates);
  return {
    submitted: values.filter((candidate) => candidate.status === "submitted").length,
    recovered: values.filter((candidate) => candidate.status === "recovered").length,
    skipped: values.filter((candidate) => candidate.status === "needs_review").length,
  };
}

export async function submitImport(raw: unknown, options: SubmitOptions): Promise<SubmitSummary> {
  const batch = validatedImportSchema.parse(raw);
  if (!batch.validation.submissionReady) throw new Error("IMPORT_NOT_SUBMITTABLE");
  if (batch.reviewStatus !== "approved" || !batch.reviewedAt) throw new Error("IMPORT_NOT_APPROVED");

  const fetchImpl = options.fetchImpl ?? fetch;
  const config: SubmitConfig = {
    ...options.config,
    apiBaseUrl: options.config.apiBaseUrl.replace(/\/+$/, ""),
  };
  mkdirSync(options.stateDir, { recursive: true, mode: 0o700 });
  const lockRoot = join(options.stateDir, "locks");
  mkdirSync(lockRoot, { recursive: true, mode: 0o700 });
  const lockPath = join(lockRoot, `${batch.batchId}.lock`);
  try {
    mkdirSync(lockPath, { mode: 0o700 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error("IMPORT_LOCKED");
    }
    throw error;
  }

  const statePath = join(options.stateDir, "submissions.json");
  try {
    const timestamp = nowIso(options.now);
    const state = loadSubmissionState(statePath);
    const currentBatch = batchState(state, batch.batchId, timestamp);
    state.batches[batch.batchId] = currentBatch;
    currentBatch.status = "running";
    currentBatch.updatedAt = timestamp;
    atomicPrivateJsonWrite(statePath, state);

    const accessToken = await refreshAccessToken(config, options.stateDir, fetchImpl);
    const categories = await fetchCategories(config, accessToken, fetchImpl);
    const items = prepareItems(batch, categories, config);
    const existingByKey = new Map<string, ApiTransaction[]>();

    for (const item of items) {
      const key = `${item.transaction.type}:${item.day}`;
      if (!existingByKey.has(key)) {
        existingByKey.set(
          key,
          await fetchExistingTransactions(item.transaction.type, item.day, config, accessToken, fetchImpl),
        );
      }
    }

    const blocked: string[] = [];
    for (const item of items) {
      const id = item.transaction.candidateId;
      const prior = currentBatch.candidates[id];
      if (prior?.status === "submitted" || prior?.status === "recovered") continue;

      const matches = exactMatches(
        existingByKey.get(`${item.transaction.type}:${item.day}`) ?? [],
        item,
      );
      if (prior?.status === "submitting") {
        if (matches.length === 1) {
          currentBatch.candidates[id] = {
            status: "recovered",
            remoteUuid: matches[0].uuid,
            updatedAt: timestamp,
          };
          continue;
        }
        currentBatch.candidates[id] = { status: "needs_review", updatedAt: timestamp };
        blocked.push(id);
      } else if (matches.length > 0) {
        currentBatch.candidates[id] = { status: "needs_review", updatedAt: timestamp };
        blocked.push(id);
      }
    }

    if (blocked.length > 0) {
      currentBatch.status = "needs_review";
      currentBatch.updatedAt = timestamp;
      atomicPrivateJsonWrite(statePath, state);
      throw new Error(`EXISTING_TRANSACTION_REQUIRES_REVIEW:${blocked.join(",")}`);
    }
    atomicPrivateJsonWrite(statePath, state);

    for (const item of items) {
      const id = item.transaction.candidateId;
      const prior = currentBatch.candidates[id];
      if (prior?.status === "submitted" || prior?.status === "recovered") continue;

      currentBatch.candidates[id] = { status: "submitting", updatedAt: nowIso(options.now) };
      atomicPrivateJsonWrite(statePath, state);
      try {
        const remoteUuid = await createRemoteTransaction(item, config, accessToken, fetchImpl);
        currentBatch.candidates[id] = {
          status: "submitted",
          remoteUuid,
          updatedAt: nowIso(options.now),
        };
        atomicPrivateJsonWrite(statePath, state);
      } catch (error) {
        if (error instanceof ApiError) {
          currentBatch.candidates[id] = { status: "failed", updatedAt: nowIso(options.now) };
        }
        currentBatch.status = "partial";
        currentBatch.updatedAt = nowIso(options.now);
        atomicPrivateJsonWrite(statePath, state);
        throw error;
      }
    }

    currentBatch.status = "completed";
    currentBatch.updatedAt = nowIso(options.now);
    atomicPrivateJsonWrite(statePath, state);
    return { batchId: batch.batchId, ...statusCounts(currentBatch) };
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("INVALID_BOOLEAN:ACCOUNTBOOK_EXCLUDE_FROM_BUDGET");
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_ENV:${name}`);
  return value;
}

function parseArgs(args: string[]): { input: string; stateDir: string; env: string; confirm: string } {
  let input = "";
  let stateDir = "";
  let env = "";
  let confirm = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input") input = args[++index] ?? "";
    else if (arg === "--state-dir") stateDir = args[++index] ?? "";
    else if (arg === "--env") env = args[++index] ?? "";
    else if (arg === "--confirm") confirm = args[++index] ?? "";
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (!input) throw new Error("MISSING_ARGUMENT:--input");
  if (!stateDir) throw new Error("MISSING_ARGUMENT:--state-dir");
  if (!env) throw new Error("MISSING_ARGUMENT:--env");
  if (!confirm) throw new Error("MISSING_ARGUMENT:--confirm");
  return { input, stateDir, env, confirm };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  loadEnv({ path: options.env, quiet: true });
  const raw = JSON.parse(readFileSync(options.input, "utf8"));
  const parsed = validatedImportSchema.parse(raw);
  if (parsed.batchId !== options.confirm) throw new Error("BATCH_CONFIRMATION_MISMATCH");

  const summary = await submitImport(parsed, {
    stateDir: options.stateDir,
    config: {
      apiBaseUrl: requiredEnv("ACCOUNTBOOK_API_BASE_URL"),
      familyUuid: requiredEnv("ACCOUNTBOOK_FAMILY_UUID"),
      refreshToken: process.env.ACCOUNTBOOK_REFRESH_TOKEN?.trim(),
      defaultCategoryName: process.env.ACCOUNTBOOK_DEFAULT_CATEGORY_NAME?.trim() || "미분류",
      excludeFromBudget: parseBoolean(process.env.ACCOUNTBOOK_EXCLUDE_FROM_BUDGET),
    },
  });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`SUBMISSION_FAILED:${message.replace(/[\r\n]+/g, " ")}\n`);
    process.exitCode = 2;
  });
}
