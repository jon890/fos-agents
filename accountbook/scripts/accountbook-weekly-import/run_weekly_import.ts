import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";
import {
  validatedImportSchema,
  type ValidatedImport,
} from "../accountbook-screenshot-import/contracts.ts";
import {
  submitImport,
  type SubmitConfig,
} from "../accountbook-screenshot-import/submit_import.ts";
import {
  inboxSidecarManifestSchema,
  type InboxSidecarManifest,
  type WeeklyLastErrorCode,
  weeklyQueueSchema,
  type WeeklyRunPlan,
  weeklyRunPlanSchema,
} from "./contracts.ts";
import { finalizeInboxItem, recordValidatedDates } from "./finalize_inbox.ts";
import { writeWeeklyPolicyFiles } from "./evaluate_policy.ts";
import {
  ensureWeeklyPrivateLayout,
  loadWeeklyState,
  releaseWeeklyRunLock,
} from "./scan_inbox.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type WeeklyRunSummary = {
  runId: string;
  submitted: number;
  needsReview: number;
  failed: number;
  leftProcessing: number;
};

export type RunWeeklyImportOptions = {
  privateRoot: string;
  plan: unknown;
  config: SubmitConfig;
  fetchImpl?: FetchLike;
  now?: () => Date;
};

type ReadyItem = {
  imageSha256: string;
  validatedPath: string;
  manifestPath: string;
  validated: ValidatedImport;
  manifest: InboxSidecarManifest;
  selectedDates: string[];
};

function nowDate(now?: () => Date): Date {
  return now?.() ?? new Date();
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function realPathUnderPrivateRoot(privateRoot: string, path: string): string {
  const root = realpathSync(privateRoot);
  const lexicalPath = resolve(path);
  const lexicalRelativePath = relative(resolve(privateRoot), lexicalPath);
  if (lexicalRelativePath === "" || lexicalRelativePath.startsWith("..") || isAbsolute(lexicalRelativePath)) {
    throw new Error("RUN_PLAN_PATH_OUTSIDE_PRIVATE_ROOT");
  }
  const resolved = realpathSync(path);
  const relativePath = relative(root, resolved);
  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("RUN_PLAN_PATH_OUTSIDE_PRIVATE_ROOT");
  }
  return resolved;
}

function selectedDates(batch: ValidatedImport): string[] {
  return [...new Set(
    batch.days
      .filter((day) => day.selectedForImport)
      .map((day) => day.date),
  )].sort();
}

function findConflictingDates(items: ReadyItem[]): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const date of item.selectedDates) counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([date]) => date));
}

function submitClassification(error: unknown): { status: "failed" | "needs_review" | "processing"; code: WeeklyLastErrorCode | null } {
  const message = error instanceof Error ? error.message : String(error);
  if (/^ACCOUNTBOOK_API_4\d\d$/.test(message)) return { status: "failed", code: "ACCOUNTBOOK_API_4XX" };
  if (message.startsWith("EXISTING_TRANSACTION_REQUIRES_REVIEW")) {
    return { status: "needs_review", code: "EXISTING_TRANSACTION_REQUIRES_REVIEW" };
  }
  return { status: "needs_review", code: "SUBMIT_REQUIRES_REVIEW" };
}

const lockFileSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().trim().min(1),
  lockedAt: z.string().datetime({ offset: true }),
});

function lockPath(privateRoot: string): string {
  return join(resolve(privateRoot), "state", "locks", "weekly-import.lock");
}

function ownsWeeklyLock(privateRoot: string, runId: string): boolean {
  if (!existsSync(lockPath(privateRoot))) return false;
  try {
    return lockFileSchema.parse(readJson(lockPath(privateRoot))).runId === runId;
  } catch {
    return false;
  }
}

function assertOwnWeeklyLock(privateRoot: string, runId: string): void {
  if (!existsSync(lockPath(privateRoot))) throw new Error("WEEKLY_IMPORT_LOCK_MISSING");
  const lock = lockFileSchema.parse(readJson(lockPath(privateRoot)));
  if (lock.runId !== runId) throw new Error("WEEKLY_IMPORT_LOCK_OWNER_MISMATCH");
}

function assertNoDuplicates(hashes: string[], code: string): void {
  if (new Set(hashes).size !== hashes.length) throw new Error(code);
}

function assertSameHashSet(left: Set<string>, right: Set<string>, code: string): void {
  if (left.size !== right.size) throw new Error(code);
  for (const hash of left) {
    if (!right.has(hash)) throw new Error(code);
  }
}

function hasSubmittingCandidate(privateRoot: string, batchId: string): boolean {
  const submissionsPath = join(resolve(privateRoot), "state", "submissions.json");
  if (!existsSync(submissionsPath)) return false;
  const raw = readJson(submissionsPath) as {
    batches?: Record<string, { candidates?: Record<string, { status?: string }> }>;
  };
  return Object.values(raw.batches?.[batchId]?.candidates ?? {})
    .some((candidate) => candidate.status === "submitting");
}

function loadPlanItems(options: RunWeeklyImportOptions, plan: WeeklyRunPlan): ReadyItem[] {
  const queuePath = realPathUnderPrivateRoot(options.privateRoot, plan.queuePath);
  const queue = weeklyQueueSchema.parse(readJson(queuePath));
  if (queue.runId !== plan.runId) throw new Error("RUN_PLAN_QUEUE_RUN_ID_MISMATCH");

  const state = loadWeeklyState(options.privateRoot);
  const planHashes = plan.items.map((item) => item.imageSha256);
  const queueProcessingItems = queue.items.filter((item) => state.items[item.imageSha256]?.status === "processing");
  const queueProcessingHashes = queueProcessingItems.map((item) => item.imageSha256);
  assertNoDuplicates(planHashes, "RUN_PLAN_DUPLICATE_HASH");
  assertNoDuplicates(queueProcessingHashes, "RUN_QUEUE_DUPLICATE_HASH");
  assertSameHashSet(new Set(planHashes), new Set(queueProcessingHashes), "RUN_PLAN_QUEUE_HASH_MISMATCH");

  const stateProcessingHashes = new Set(
    Object.entries(state.items)
      .filter(([, item]) => item.status === "processing")
      .map(([hash]) => hash),
  );
  assertSameHashSet(new Set(queueProcessingHashes), stateProcessingHashes, "RUN_QUEUE_STATE_HASH_MISMATCH");
  return plan.items.map((item): ReadyItem => {
    const stateItem = state.items[item.imageSha256];
    if (stateItem?.status !== "processing") throw new Error("RUN_PLAN_ITEM_NOT_PROCESSING");
    const queueItem = queueProcessingItems.find((candidate) => candidate.imageSha256 === item.imageSha256);
    if (!queueItem) throw new Error("RUN_PLAN_QUEUE_HASH_MISMATCH");
    if (queueItem.state.status !== "processing") throw new Error("RUN_QUEUE_ITEM_NOT_PROCESSING");

    const validatedPath = realPathUnderPrivateRoot(options.privateRoot, item.validatedPath);
    const manifestPath = realPathUnderPrivateRoot(options.privateRoot, queueItem.manifestPath);
    const validated = validatedImportSchema.parse(readJson(validatedPath));
    const manifest = inboxSidecarManifestSchema.parse(readJson(manifestPath));
    if (validated.sourceImage.sha256 !== item.imageSha256) throw new Error("RUN_PLAN_VALIDATED_SHA_MISMATCH");

    return {
      imageSha256: item.imageSha256,
      validatedPath,
      manifestPath,
      validated,
      manifest,
      selectedDates: selectedDates(validated),
    };
  });
}

export async function runWeeklyImport(options: RunWeeklyImportOptions): Promise<WeeklyRunSummary> {
  ensureWeeklyPrivateLayout(options.privateRoot);
  const knownRunId = z.object({ runId: z.string().trim().min(1) }).safeParse(options.plan).data?.runId;

  try {
    const plan = weeklyRunPlanSchema.parse(options.plan);
    const summary: WeeklyRunSummary = {
      runId: plan.runId,
      submitted: 0,
      needsReview: 0,
      failed: 0,
      leftProcessing: 0,
    };
    assertOwnWeeklyLock(options.privateRoot, plan.runId);
    const items = loadPlanItems(options, plan);

    for (const item of items) {
      recordValidatedDates({
        privateRoot: options.privateRoot,
        imageSha256: item.imageSha256,
        selectedDates: item.selectedDates,
        now: nowDate(options.now),
      });
    }

    const conflictingDates = findConflictingDates(items);
    const activeItems = [];
    for (const item of items) {
      const hasConflict = item.selectedDates.some((date) => conflictingDates.has(date));
      if (hasConflict) {
        finalizeInboxItem({
          privateRoot: options.privateRoot,
          imageSha256: item.imageSha256,
          status: "needs_review",
          batchId: item.validated.batchId,
          lastErrorCode: "WEEKLY_DATE_CONFLICT",
          now: nowDate(options.now),
        });
        summary.needsReview += 1;
      } else {
        activeItems.push(item);
      }
    }

    for (const item of activeItems) {
      const runDir = dirname(item.validatedPath);
      mkdirSync(runDir, { recursive: true, mode: 0o700 });
      const policyOutput = join(runDir, "weekly-policy.json");
      const approvedOutput = join(runDir, "approved.json");
      let decision;
      try {
        decision = writeWeeklyPolicyFiles({
          validated: item.validated,
          manifest: item.manifest,
          policyOutput,
          approvedOutput,
          now: nowDate(options.now),
        });
      } catch {
        finalizeInboxItem({
          privateRoot: options.privateRoot,
          imageSha256: item.imageSha256,
          status: "failed",
          batchId: item.validated.batchId,
          lastErrorCode: "WEEKLY_INPUT_INVALID",
          now: nowDate(options.now),
        });
        summary.failed += 1;
        continue;
      }
      if (!decision.eligible) {
        finalizeInboxItem({
          privateRoot: options.privateRoot,
          imageSha256: item.imageSha256,
          status: "needs_review",
          batchId: item.validated.batchId,
          lastErrorCode: "WEEKLY_POLICY_REJECTED",
          now: nowDate(options.now),
        });
        summary.needsReview += 1;
        continue;
      }

      try {
        await submitImport(readJson(approvedOutput), {
          stateDir: join(resolve(options.privateRoot), "state"),
          config: options.config,
          fetchImpl: options.fetchImpl,
          now: options.now,
          requireWeeklyPolicyApproval: true,
        });
        finalizeInboxItem({
          privateRoot: options.privateRoot,
          imageSha256: item.imageSha256,
          status: "submitted",
          batchId: item.validated.batchId,
          now: nowDate(options.now),
        });
        summary.submitted += 1;
      } catch (error) {
        const classification = hasSubmittingCandidate(options.privateRoot, item.validated.batchId)
          ? { status: "processing" as const, code: null }
          : submitClassification(error);
        if (classification.status === "processing") {
          summary.leftProcessing += 1;
          continue;
        }
        finalizeInboxItem({
          privateRoot: options.privateRoot,
          imageSha256: item.imageSha256,
          status: classification.status,
          batchId: item.validated.batchId,
          lastErrorCode: classification.code,
          now: nowDate(options.now),
        });
        if (classification.status === "failed") summary.failed += 1;
        else summary.needsReview += 1;
      }
    }

    return summary;
  } finally {
    if (knownRunId && ownsWeeklyLock(options.privateRoot, knownRunId)) {
      releaseWeeklyRunLock(options.privateRoot, knownRunId);
    }
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

function parseArgs(args: string[]): { privateRoot: string; planPath: string; env: string } {
  let privateRoot = "";
  let planPath = "";
  let env = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--private-root") privateRoot = args[++index] ?? "";
    else if (arg === "--plan") planPath = args[++index] ?? "";
    else if (arg === "--env") env = args[++index] ?? "";
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (!privateRoot) throw new Error("MISSING_ARGUMENT:--private-root");
  if (!planPath) throw new Error("MISSING_ARGUMENT:--plan");
  if (!env) throw new Error("MISSING_ARGUMENT:--env");
  return { privateRoot, planPath, env };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  const planPath = realPathUnderPrivateRoot(options.privateRoot, options.planPath);
  if (!existsSync(planPath)) throw new Error("RUN_PLAN_NOT_FOUND");
  const plan = readJson(planPath);
  const knownRunId = z.object({ runId: z.string().trim().min(1) }).safeParse(plan).data?.runId;
  try {
    loadEnv({ path: options.env, quiet: true });
    const summary = await runWeeklyImport({
      privateRoot: options.privateRoot,
      plan,
      config: {
        apiBaseUrl: requiredEnv("ACCOUNTBOOK_API_BASE_URL"),
        familyUuid: requiredEnv("ACCOUNTBOOK_FAMILY_UUID"),
        refreshToken: process.env.ACCOUNTBOOK_REFRESH_TOKEN?.trim(),
        defaultCategoryName: process.env.ACCOUNTBOOK_DEFAULT_CATEGORY_NAME?.trim() || "미분류",
        excludeFromBudget: parseBoolean(process.env.ACCOUNTBOOK_EXCLUDE_FROM_BUDGET),
      },
    });
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } finally {
    if (knownRunId && ownsWeeklyLock(options.privateRoot, knownRunId)) {
      releaseWeeklyRunLock(options.privateRoot, knownRunId);
    }
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`WEEKLY_IMPORT_RUN_FAILED:${message.replace(/[\r\n]+/g, " ")}\n`);
    process.exitCode = 2;
  });
}
