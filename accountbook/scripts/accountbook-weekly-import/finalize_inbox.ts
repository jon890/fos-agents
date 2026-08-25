import { chmodSync, existsSync, readdirSync, renameSync } from "node:fs";
import { basename, extname, join, parse } from "node:path";
import { pathToFileURL } from "node:url";
import {
  isoDateSchema,
  weeklyTerminalStatusSchema,
  type WeeklyTerminalStatus,
  weeklyStateSchema,
} from "./contracts.ts";
import {
  computeSha256,
  ensureWeeklyPrivateLayout,
  loadWeeklyState,
  releaseWeeklyRunLock,
  writeWeeklyState,
} from "./scan_inbox.ts";

export type RecordValidatedDatesOptions = {
  privateRoot: string;
  imageSha256: string;
  selectedDates: string[];
  now?: Date;
};

export type FinalizeInboxItemOptions = {
  privateRoot: string;
  imageSha256: string;
  status: WeeklyTerminalStatus;
  batchId?: string | null;
  lastErrorCode?: string | null;
  now?: Date;
};

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function normalizeSelectedDates(selectedDates: string[]): string[] {
  return [...new Set(selectedDates.map((date) => isoDateSchema.parse(date)))].sort();
}

export function recordValidatedDates(options: RecordValidatedDatesOptions): void {
  const state = loadWeeklyState(options.privateRoot);
  const item = state.items[options.imageSha256];
  if (!item) throw new Error("WEEKLY_IMPORT_ITEM_NOT_FOUND");

  item.selectedDates = normalizeSelectedDates(options.selectedDates);
  item.updatedAt = nowIso(options.now);
  writeWeeklyState(options.privateRoot, state);
}

function findProcessingPair(privateRoot: string, imageSha256: string): { imagePath: string; manifestPath: string } {
  const { processingDir } = ensureWeeklyPrivateLayout(privateRoot);
  for (const entry of readdirSync(processingDir, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== ".png") continue;
    const imagePath = join(processingDir, entry.name);
    if (computeSha256(imagePath) !== imageSha256) continue;
    const manifestPath = join(processingDir, `${parse(entry.name).name}.json`);
    if (!existsSync(manifestPath)) throw new Error("PROCESSING_MANIFEST_NOT_FOUND");
    return { imagePath, manifestPath };
  }
  throw new Error("PROCESSING_IMAGE_NOT_FOUND");
}

export function finalizeInboxItem(options: FinalizeInboxItemOptions): void {
  const status = weeklyTerminalStatusSchema.parse(options.status);
  const layout = ensureWeeklyPrivateLayout(options.privateRoot);
  const state = loadWeeklyState(options.privateRoot);
  const item = state.items[options.imageSha256];
  if (!item) throw new Error("WEEKLY_IMPORT_ITEM_NOT_FOUND");

  const pair = findProcessingPair(options.privateRoot, options.imageSha256);
  const nextItem = {
    ...item,
    status,
    batchId: options.batchId ?? item.batchId,
    lastErrorCode: options.lastErrorCode ?? null,
    updatedAt: nowIso(options.now),
  };
  const nextState = weeklyStateSchema.parse({
    ...state,
    items: {
      ...state.items,
      [options.imageSha256]: nextItem,
    },
  });

  const targetDir = status === "submitted"
    ? layout.processedDir
    : status === "needs_review"
      ? layout.needsReviewDir
      : layout.failedDir;

  const targetImagePath = join(targetDir, basename(pair.imagePath));
  const targetManifestPath = join(targetDir, basename(pair.manifestPath));
  if (existsSync(targetImagePath) || existsSync(targetManifestPath)) throw new Error("TARGET_ALREADY_EXISTS");

  writeWeeklyState(options.privateRoot, nextState);
  renameSync(pair.imagePath, targetImagePath);
  renameSync(pair.manifestPath, targetManifestPath);
  chmodSync(targetImagePath, 0o600);
  chmodSync(targetManifestPath, 0o600);
}

type FinalizeCliOptions = {
  action: "record-dates" | "finalize" | "release-lock" | "";
  privateRoot: string;
  imageSha256: string;
  selectedDates: string[];
  status: WeeklyTerminalStatus | "";
  batchId: string | null;
  lastErrorCode: string | null;
  runId: string;
};

function parseArgs(args: string[]): FinalizeCliOptions {
  const options: FinalizeCliOptions = {
    action: "",
    privateRoot: "",
    imageSha256: "",
    selectedDates: [],
    status: "",
    batchId: null,
    lastErrorCode: null,
    runId: "",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "record-dates" || arg === "finalize" || arg === "release-lock") options.action = arg;
    else if (arg === "--private-root") options.privateRoot = args[++index] ?? "";
    else if (arg === "--image-sha256") options.imageSha256 = args[++index] ?? "";
    else if (arg === "--selected-dates") options.selectedDates = (args[++index] ?? "").split(",").filter(Boolean);
    else if (arg === "--status") options.status = weeklyTerminalStatusSchema.parse(args[++index] ?? "");
    else if (arg === "--batch-id") options.batchId = args[++index] ?? "";
    else if (arg === "--last-error-code") options.lastErrorCode = args[++index] ?? "";
    else if (arg === "--run-id") options.runId = args[++index] ?? "";
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (!options.action) throw new Error("MISSING_ACTION");
  if (!options.privateRoot) throw new Error("MISSING_ARGUMENT:--private-root");
  if (options.action === "release-lock") {
    if (!options.runId) throw new Error("MISSING_ARGUMENT:--run-id");
    return options;
  }
  if (!options.imageSha256) throw new Error("MISSING_ARGUMENT:--image-sha256");
  if (options.action === "finalize" && !options.status) throw new Error("MISSING_ARGUMENT:--status");
  return options;
}

export function main(args = process.argv.slice(2)): void {
  const options = parseArgs(args);
  if (options.action === "record-dates") {
    recordValidatedDates({
      privateRoot: options.privateRoot,
      imageSha256: options.imageSha256,
      selectedDates: options.selectedDates,
    });
  } else if (options.action === "finalize") {
    const status = weeklyTerminalStatusSchema.parse(options.status);
    finalizeInboxItem({
      privateRoot: options.privateRoot,
      imageSha256: options.imageSha256,
      status,
      batchId: options.batchId,
      lastErrorCode: options.lastErrorCode,
    });
  } else {
    releaseWeeklyRunLock(options.privateRoot, options.runId);
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`WEEKLY_INBOX_FINALIZE_FAILED:${message}\n`);
    process.exitCode = 2;
  }
}
