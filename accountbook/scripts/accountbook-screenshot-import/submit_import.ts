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

import { AccountbookClient, AccountbookError, namedItemsSchema, recordIdentitySchema, responseData, transactionPageSchema } from "../../plugin/src/client.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const SAFE_ERROR_CODES = new Set([
  "ACCOUNTBOOK_BAD_REQUEST",
  "ACCOUNTBOOK_CONFIG",
  "ACCOUNTBOOK_FORBIDDEN",
  "ACCOUNTBOOK_INVALID_RESPONSE",
  "ACCOUNTBOOK_NETWORK",
  "ACCOUNTBOOK_NOT_FOUND",
  "ACCOUNTBOOK_UNAVAILABLE",
  "ACCOUNTBOOK_UNAUTHORIZED",
  "BATCH_CONFIRMATION_MISMATCH",
  "CATEGORY_NOT_FOUND",
  "DESCRIPTION_TOO_LONG",
  "EXISTING_TRANSACTION_REQUIRES_REVIEW",
  "IMPORT_LOCKED",
  "IMPORT_NOT_APPROVED",
  "IMPORT_NOT_SUBMITTABLE",
  "INVALID_APPROVAL_SOURCE_POLICY_COMBINATION",
  "INVALID_BOOLEAN",
  "INVALID_SUBMISSION_STATE",
  "MISSING_ARGUMENT",
  "MISSING_ENV",
  "UNKNOWN_ARGUMENT",
  "RUN_PLAN_ITEM_NOT_PROCESSING",
  "RUN_PLAN_DUPLICATE_HASH",
  "RUN_PLAN_NOT_FOUND",
  "RUN_PLAN_PATH_OUTSIDE_PRIVATE_ROOT",
  "RUN_PLAN_QUEUE_HASH_MISMATCH",
  "RUN_PLAN_QUEUE_RUN_ID_MISMATCH",
  "RUN_PLAN_VALIDATED_SHA_MISMATCH",
  "RUN_QUEUE_ITEM_NOT_PROCESSING",
  "RUN_QUEUE_DUPLICATE_HASH",
  "RUN_QUEUE_STATE_HASH_MISMATCH",
  "WEEKLY_IMPORT_LOCK_MISSING",
  "WEEKLY_IMPORT_LOCK_OWNER_MISMATCH",
  "WEEKLY_POLICY_APPROVAL_REQUIRED",
]);

export function safeSubmissionErrorCode(error: unknown): string {
  if (error instanceof AccountbookError) return error.code;
  if (!(error instanceof Error)) return "SUBMISSION_ERROR";
  const code = error.message.split(":", 1)[0];
  return SAFE_ERROR_CODES.has(code) ? code : "SUBMISSION_ERROR";
}

export type SubmitConfig = {
  apiBaseUrl: string;
  familyUuid: string;
  apiToken: string;
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
  requireWeeklyPolicyApproval?: boolean;
};

export type SubmitSummary = {
  batchId: string;
  submitted: number;
  recovered: number;
  skipped: number;
};

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

async function fetchCategories(
  config: SubmitConfig,
  client: AccountbookClient,
): Promise<Map<string, string>> {
  const categoriesResponse = responseData(await client.request(
    `/families/${config.familyUuid}/categories`,
  ), namedItemsSchema);
  const categories = new Map<string, string>();
  for (const category of categoriesResponse) {
    if (category.name && category.uuid) categories.set(category.name, category.uuid);
  }
  return categories;
}

async function fetchExistingTransactions(
  type: "expense" | "income",
  date: string,
  config: SubmitConfig,
  client: AccountbookClient,
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
    const response = responseData(await client.request(
      `/families/${config.familyUuid}/${collection}?${params}`,
    ), transactionPageSchema);
    items.push(...response.items);
    totalPages = Math.max(response.totalPages, 1);
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
  client: AccountbookClient,
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
  const response = responseData(await client.request(
    `/families/${config.familyUuid}/${collection}`,
    "POST", payload,
  ), recordIdentitySchema);
  return response.uuid;
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

function assertValidApprovalCombination(batch: ValidatedImport): void {
  const approvalSource = batch.approvalSource ?? "user";
  const approvalPolicyVersion = batch.approvalPolicyVersion ?? null;
  if (approvalSource === "user" && approvalPolicyVersion === null) return;
  if (approvalSource === "weekly-policy" && approvalPolicyVersion === "weekly-safe-v1") return;
  throw new Error("INVALID_APPROVAL_SOURCE_POLICY_COMBINATION");
}

function assertWeeklyPolicyApproval(batch: ValidatedImport): void {
  if (batch.approvalSource !== "weekly-policy" || batch.approvalPolicyVersion !== "weekly-safe-v1") {
    throw new Error("WEEKLY_POLICY_APPROVAL_REQUIRED");
  }
}

export async function submitImport(raw: unknown, options: SubmitOptions): Promise<SubmitSummary> {
  const batch = validatedImportSchema.parse(raw);
  if (!batch.validation.submissionReady) throw new Error("IMPORT_NOT_SUBMITTABLE");
  if (batch.reviewStatus !== "approved" || !batch.reviewedAt) throw new Error("IMPORT_NOT_APPROVED");
  assertValidApprovalCombination(batch);
  if (options.requireWeeklyPolicyApproval) assertWeeklyPolicyApproval(batch);

  const config: SubmitConfig = {
    ...options.config,
    apiBaseUrl: options.config.apiBaseUrl.replace(/\/+$/, ""),
  };
  const client = new AccountbookClient(config, options.fetchImpl ?? fetch);
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

    const categories = await fetchCategories(config, client);
    const items = prepareItems(batch, categories, config);
    const existingByKey = new Map<string, ApiTransaction[]>();

    for (const item of items) {
      const key = `${item.transaction.type}:${item.day}`;
      if (!existingByKey.has(key)) {
        existingByKey.set(
          key,
          await fetchExistingTransactions(item.transaction.type, item.day, config, client),
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
        const remoteUuid = await createRemoteTransaction(item, config, client);
        currentBatch.candidates[id] = {
          status: "submitted",
          remoteUuid,
          updatedAt: nowIso(options.now),
        };
        atomicPrivateJsonWrite(statePath, state);
      } catch (error) {
        if (error instanceof AccountbookError && typeof error.status === "number" && error.status >= 400 && error.status < 500) {
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
      apiToken: requiredEnv("ACCOUNTBOOK_API_TOKEN"),
      defaultCategoryName: process.env.ACCOUNTBOOK_DEFAULT_CATEGORY_NAME?.trim() || "미분류",
      excludeFromBudget: parseBoolean(process.env.ACCOUNTBOOK_EXCLUDE_FROM_BUDGET),
    },
  });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`SUBMISSION_FAILED:${safeSubmissionErrorCode(error)}\n`);
    process.exitCode = 2;
  });
}
