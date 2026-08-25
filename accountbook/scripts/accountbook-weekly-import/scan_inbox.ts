import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  inboxSidecarManifestSchema,
  type InboxSidecarManifest,
  type WeeklyState,
  type WeeklyStateItem,
  weeklyStateSchema,
  type WeeklyTerminalStatus,
  type WeeklyWorkItem,
} from "./contracts.ts";

const STATE_FILE = "weekly-import.json";
const LOCK_FILE = "weekly-import.lock";
const LOCK_LEASE_MS = 24 * 60 * 60 * 1000;

const lockFileSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().trim().min(1),
  lockedAt: z.string().datetime({ offset: true }),
});

type LockFile = z.infer<typeof lockFileSchema>;

export type ScanInboxOptions = {
  privateRoot: string;
  runId?: string;
  now?: Date;
  recoverProcessing?: boolean;
};

export type WeeklyRunLock = {
  lockPath: string;
  runId: string;
  release: () => void;
};

export type AcquireWeeklyRunLockHooks = {
  onStaleLockQuarantined?: () => void;
};

type InboxDirectory = "new" | "processing" | "processed" | "needs-review" | "failed";

type InboxPair = {
  base: string;
  imagePath: string;
  manifestPath: string;
  manifestFile: string;
  manifest: InboxSidecarManifest;
  directory: InboxDirectory;
};

type MaybePair = {
  base: string;
  imagePath: string | null;
  manifestPath: string | null;
  manifestFile: string | null;
};

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function nowMillis(now?: Date): number {
  return (now ?? new Date()).getTime();
}

function directoryLayout(privateRoot: string) {
  const root = resolve(privateRoot);
  const inbox = join(root, "inbox");
  return {
    root,
    inbox,
    newDir: join(inbox, "new"),
    processingDir: join(inbox, "processing"),
    processedDir: join(inbox, "processed"),
    needsReviewDir: join(inbox, "needs-review"),
    failedDir: join(inbox, "failed"),
    stateDir: join(root, "state"),
    locksDir: join(root, "state", "locks"),
    statePath: join(root, "state", STATE_FILE),
  };
}

export function ensureWeeklyPrivateLayout(privateRoot: string): ReturnType<typeof directoryLayout> {
  const layout = directoryLayout(privateRoot);
  for (const directory of [
    layout.root,
    layout.inbox,
    layout.newDir,
    layout.processingDir,
    layout.processedDir,
    layout.needsReviewDir,
    layout.failedDir,
    layout.stateDir,
    layout.locksDir,
  ]) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
  }
  return layout;
}

export function computeSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function loadWeeklyState(privateRoot: string): WeeklyState {
  const { statePath } = ensureWeeklyPrivateLayout(privateRoot);
  if (!existsSync(statePath)) {
    return { schemaVersion: 1, policyVersion: "weekly-safe-v1", items: {} };
  }
  return weeklyStateSchema.parse(JSON.parse(readFileSync(statePath, "utf8")));
}

export function writeWeeklyState(privateRoot: string, state: WeeklyState): void {
  const { statePath, stateDir } = ensureWeeklyPrivateLayout(privateRoot);
  const parsed = weeklyStateSchema.parse(state);
  const tempPath = join(stateDir, `.weekly-import.${process.pid}.${Date.now()}.tmp`);
  writeJsonFile0600(tempPath, parsed);
  safeRename(tempPath, statePath, true);
  chmodSync(statePath, 0o600);
}

function writeJsonFile0600(path: string, value: unknown, replace = true): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: replace ? "w" : "wx" });
  chmodSync(path, 0o600);
}

function safeRename(source: string, target: string, replace = false): void {
  if (!replace && existsSync(target)) throw new Error("TARGET_ALREADY_EXISTS");
  renameSync(source, target);
}

function readManifest(manifestPath: string): InboxSidecarManifest {
  return inboxSidecarManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
}

function directoryPath(privateRoot: string, directory: InboxDirectory): string {
  const layout = ensureWeeklyPrivateLayout(privateRoot);
  if (directory === "new") return layout.newDir;
  if (directory === "processing") return layout.processingDir;
  if (directory === "processed") return layout.processedDir;
  if (directory === "needs-review") return layout.needsReviewDir;
  return layout.failedDir;
}

function terminalStatusForDirectory(directory: InboxDirectory): WeeklyTerminalStatus | null {
  if (directory === "processed") return "submitted";
  if (directory === "needs-review") return "needs_review";
  if (directory === "failed") return "failed";
  return null;
}

function terminalDirectoryForStatus(privateRoot: string, status: WeeklyTerminalStatus): string {
  const layout = ensureWeeklyPrivateLayout(privateRoot);
  if (status === "submitted") return layout.processedDir;
  if (status === "needs_review") return layout.needsReviewDir;
  return layout.failedDir;
}

function listMaybePairs(directory: string): MaybePair[] {
  if (!existsSync(directory)) return [];
  const pairs = new Map<string, MaybePair>();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const extension = extname(entry.name).toLowerCase();
    if (extension !== ".png" && extension !== ".json") continue;
    const base = parse(entry.name).name;
    const pair = pairs.get(base) ?? { base, imagePath: null, manifestPath: null, manifestFile: null };
    if (extension === ".png") pair.imagePath = join(directory, entry.name);
    else {
      pair.manifestPath = join(directory, entry.name);
      pair.manifestFile = entry.name;
    }
    pairs.set(base, pair);
  }
  return [...pairs.values()].sort((left, right) => left.base.localeCompare(right.base));
}

function listCompletePairs(privateRoot: string, directory: InboxDirectory): InboxPair[] {
  const path = directoryPath(privateRoot, directory);
  const pairs: InboxPair[] = [];
  for (const pair of listMaybePairs(path)) {
    if (!pair.imagePath || !pair.manifestPath || !pair.manifestFile) continue;
    const manifest = readManifest(pair.manifestPath);
    if (manifest.imageFile !== basename(pair.imagePath)) throw new Error("MANIFEST_IMAGE_FILE_MISMATCH");
    pairs.push({
      base: pair.base,
      imagePath: pair.imagePath,
      manifestPath: pair.manifestPath,
      manifestFile: pair.manifestFile,
      manifest,
      directory,
    });
  }
  return pairs;
}

function movePair(pair: InboxPair, targetDirectory: string): InboxPair {
  const targetImagePath = join(targetDirectory, basename(pair.imagePath));
  const targetManifestPath = join(targetDirectory, basename(pair.manifestPath));
  if (existsSync(targetImagePath) || existsSync(targetManifestPath)) throw new Error("TARGET_ALREADY_EXISTS");
  safeRename(pair.imagePath, targetImagePath);
  safeRename(pair.manifestPath, targetManifestPath);
  chmodSync(targetImagePath, 0o600);
  chmodSync(targetManifestPath, 0o600);
  return {
    ...pair,
    imagePath: targetImagePath,
    manifestPath: targetManifestPath,
    directory: basename(targetDirectory) as InboxDirectory,
  };
}

function toWorkItem(pair: InboxPair, imageSha256: string, state: WeeklyStateItem): WeeklyWorkItem {
  return {
    imageSha256,
    imageFile: basename(pair.imagePath),
    manifestFile: pair.manifestFile,
    imagePath: pair.imagePath,
    manifestPath: pair.manifestPath,
    manifest: pair.manifest,
    state,
  };
}

function newProcessingStateItem(attempts: number, now?: Date): WeeklyStateItem {
  return {
    status: "processing",
    batchId: null,
    attempts,
    lastErrorCode: null,
    selectedDates: [],
    updatedAt: nowIso(now),
  };
}

function mergeSplitPairs(privateRoot: string): void {
  const layout = ensureWeeklyPrivateLayout(privateRoot);
  const newPairs = new Map(listMaybePairs(layout.newDir).map((pair) => [pair.base, pair]));
  const processingPairs = new Map(listMaybePairs(layout.processingDir).map((pair) => [pair.base, pair]));
  for (const [base, newPair] of newPairs.entries()) {
    const processingPair = processingPairs.get(base);
    if (!processingPair) continue;
    const hasOneImage = Boolean(newPair.imagePath) !== Boolean(processingPair.imagePath);
    const hasOneManifest = Boolean(newPair.manifestPath) !== Boolean(processingPair.manifestPath);
    if (!hasOneImage && !hasOneManifest) continue;
    if (!processingPair.imagePath && newPair.imagePath) {
      const target = join(layout.processingDir, basename(newPair.imagePath));
      safeRename(newPair.imagePath, target);
      chmodSync(target, 0o600);
    }
    if (!processingPair.manifestPath && newPair.manifestPath) {
      const target = join(layout.processingDir, basename(newPair.manifestPath));
      safeRename(newPair.manifestPath, target);
      chmodSync(target, 0o600);
    }
  }
}

function moveMaybePairToFailed(privateRoot: string, pair: MaybePair): void {
  const { failedDir } = ensureWeeklyPrivateLayout(privateRoot);
  const targetImagePath = pair.imagePath ? join(failedDir, basename(pair.imagePath)) : null;
  const targetManifestPath = pair.manifestPath ? join(failedDir, basename(pair.manifestPath)) : null;
  if ((targetImagePath && existsSync(targetImagePath)) || (targetManifestPath && existsSync(targetManifestPath))) {
    throw new Error("TARGET_ALREADY_EXISTS");
  }
  if (pair.imagePath && targetImagePath) {
    safeRename(pair.imagePath, targetImagePath);
    chmodSync(targetImagePath, 0o600);
  }
  if (pair.manifestPath && targetManifestPath) {
    safeRename(pair.manifestPath, targetManifestPath);
    chmodSync(targetManifestPath, 0o600);
  }
}

function quarantineInvalidPairs(privateRoot: string, state: WeeklyState, now?: Date): boolean {
  let changed = false;
  for (const directory of ["new", "processing"] as const) {
    const directoryFullPath = directoryPath(privateRoot, directory);
    for (const pair of listMaybePairs(directoryFullPath)) {
      if (!pair.imagePath || !pair.manifestPath) continue;
      try {
        const manifest = readManifest(pair.manifestPath);
        if (manifest.imageFile !== basename(pair.imagePath)) throw new Error("MANIFEST_IMAGE_FILE_MISMATCH");
      } catch {
        const imageSha256 = computeSha256(pair.imagePath);
        moveMaybePairToFailed(privateRoot, pair);
        const previous = state.items[imageSha256];
        state.items[imageSha256] = {
          status: "failed",
          batchId: previous?.batchId ?? null,
          attempts: previous?.attempts ?? 0,
          lastErrorCode: "INVALID_INBOX_MANIFEST",
          selectedDates: previous?.selectedDates ?? [],
          updatedAt: nowIso(now),
        };
        changed = true;
      }
    }
  }
  return changed;
}

function reconcileTerminalPairs(privateRoot: string, state: WeeklyState, now?: Date): boolean {
  let changed = false;
  for (const directory of ["processed", "needs-review", "failed"] as const) {
    const status = terminalStatusForDirectory(directory);
    if (!status) continue;
    for (const pair of listMaybePairs(directoryPath(privateRoot, directory))) {
      if (!pair.imagePath || !pair.manifestPath) continue;
      const imageSha256 = computeSha256(pair.imagePath);
      const item = state.items[imageSha256];
      if (item?.status !== "processing") continue;
      item.status = status;
      item.lastErrorCode = status === "submitted" ? null : `RECOVERED_${status.toUpperCase()}_PAIR`;
      item.updatedAt = nowIso(now);
      changed = true;
    }
  }
  return changed;
}

function reconcileTerminalSplitPairs(privateRoot: string, state: WeeklyState): void {
  const layout = ensureWeeklyPrivateLayout(privateRoot);
  const processingPairs = new Map(listMaybePairs(layout.processingDir).map((pair) => [pair.base, pair]));
  for (const directory of ["processed", "needs-review", "failed"] as const) {
    const targetDirectory = directoryPath(privateRoot, directory);
    for (const terminalPair of listMaybePairs(targetDirectory)) {
      if (!terminalPair.imagePath || terminalPair.manifestPath) continue;
      const status = terminalStatusForDirectory(directory);
      if (!status) continue;
      const imageSha256 = computeSha256(terminalPair.imagePath);
      if (state.items[imageSha256]?.status !== status) continue;
      const processingPair = processingPairs.get(terminalPair.base);
      if (!processingPair?.manifestPath) continue;
      const targetManifestPath = join(targetDirectory, basename(processingPair.manifestPath));
      if (existsSync(targetManifestPath)) throw new Error("TARGET_ALREADY_EXISTS");
      safeRename(processingPair.manifestPath, targetManifestPath);
      chmodSync(targetManifestPath, 0o600);
    }
  }
}

function reconcileProcessingPairs(privateRoot: string, state: WeeklyState, now?: Date): boolean {
  let changed = false;
  for (const pair of listCompletePairs(privateRoot, "processing")) {
    const imageSha256 = computeSha256(pair.imagePath);
    const item = state.items[imageSha256];
    if (!item) {
      state.items[imageSha256] = newProcessingStateItem(1, now);
      changed = true;
      continue;
    }
    if (item.status !== "submitted" && item.status !== "needs_review" && item.status !== "failed") continue;
    movePair(pair, terminalDirectoryForStatus(privateRoot, item.status));
  }
  return changed;
}

export function reconcileWeeklyInbox(privateRoot: string, now?: Date): WeeklyState {
  ensureWeeklyPrivateLayout(privateRoot);
  mergeSplitPairs(privateRoot);
  const state = loadWeeklyState(privateRoot);
  const quarantineChanged = quarantineInvalidPairs(privateRoot, state, now);
  const terminalChanged = reconcileTerminalPairs(privateRoot, state, now);
  reconcileTerminalSplitPairs(privateRoot, state);
  const processingChanged = reconcileProcessingPairs(privateRoot, state, now);
  if (quarantineChanged || terminalChanged || processingChanged) writeWeeklyState(privateRoot, state);
  return state;
}

function createLockFile(lockPath: string, payload: LockFile): boolean {
  let fd = -1;
  try {
    fd = openSync(lockPath, "wx", 0o600);
    writeFileSync(fd, `${JSON.stringify(payload, null, 2)}\n`);
    closeSync(fd);
    fd = -1;
    chmodSync(lockPath, 0o600);
    return true;
  } catch (error) {
    if (fd >= 0) closeSync(fd);
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") return false;
    throw error;
  }
}

export function acquireWeeklyRunLock(
  privateRoot: string,
  runId: string,
  now?: Date,
  hooks: AcquireWeeklyRunLockHooks = {},
): WeeklyRunLock {
  const { locksDir } = ensureWeeklyPrivateLayout(privateRoot);
  const lockPath = join(locksDir, LOCK_FILE);
  const lockPayload: LockFile = {
    schemaVersion: 1,
    runId,
    lockedAt: nowIso(now),
  };
  try {
    if (!createLockFile(lockPath, lockPayload)) throw new Error("LOCK_ALREADY_EXISTS");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "LOCK_ALREADY_EXISTS") throw error;
    const existing = lockFileSchema.parse(JSON.parse(readFileSync(lockPath, "utf8")));
    if (existing.runId === runId) {
      chmodSync(lockPath, 0o600);
    } else if (nowMillis(now) - Date.parse(existing.lockedAt) >= LOCK_LEASE_MS) {
      const stalePath = join(locksDir, `.weekly-import.lock.stale.${Date.now()}.${process.pid}.${Math.random().toString(16).slice(2)}`);
      try {
        renameSync(lockPath, stalePath);
        chmodSync(stalePath, 0o600);
      } catch (renameError) {
        if (renameError && typeof renameError === "object" && "code" in renameError && renameError.code === "ENOENT") {
          throw new Error("WEEKLY_IMPORT_LOCKED");
        }
        throw renameError;
      }
      try {
        hooks.onStaleLockQuarantined?.();
        if (!createLockFile(lockPath, lockPayload)) throw new Error("WEEKLY_IMPORT_LOCKED");
      } catch (takeoverError) {
        if (takeoverError instanceof Error && takeoverError.message === "WEEKLY_IMPORT_LOCKED") throw takeoverError;
        throw takeoverError;
      } finally {
        if (existsSync(stalePath)) unlinkSync(stalePath);
      }
    } else {
      throw new Error("WEEKLY_IMPORT_LOCKED");
    }
  }
  return {
    lockPath,
    runId,
    release: () => releaseWeeklyRunLock(privateRoot, runId),
  };
}

export function releaseWeeklyRunLock(privateRoot: string, runId: string): void {
  const { locksDir } = ensureWeeklyPrivateLayout(privateRoot);
  const lockPath = join(locksDir, LOCK_FILE);
  if (!existsSync(lockPath)) return;
  const existing = lockFileSchema.parse(JSON.parse(readFileSync(lockPath, "utf8")));
  if (existing.runId !== runId) throw new Error("WEEKLY_IMPORT_LOCK_OWNER_MISMATCH");
  unlinkSync(lockPath);
}

function processingItems(privateRoot: string, state: WeeklyState): WeeklyWorkItem[] {
  const items: WeeklyWorkItem[] = [];
  for (const pair of listCompletePairs(privateRoot, "processing")) {
    const imageSha256 = computeSha256(pair.imagePath);
    const stateItem = state.items[imageSha256];
    if (stateItem?.status !== "processing") continue;
    items.push(toWorkItem(pair, imageSha256, stateItem));
  }
  return items;
}

export function scanAndClaimInbox(options: ScanInboxOptions): WeeklyWorkItem[] {
  const layout = ensureWeeklyPrivateLayout(options.privateRoot);
  const state = reconcileWeeklyInbox(options.privateRoot, options.now);
  const claimed: WeeklyWorkItem[] = options.recoverProcessing === false
    ? []
    : processingItems(options.privateRoot, state);

  for (const pair of listCompletePairs(options.privateRoot, "new")) {
    const imageSha256 = computeSha256(pair.imagePath);
    if (state.items[imageSha256]) continue;

    const moved = movePair(pair, layout.processingDir);
    const stateItem = newProcessingStateItem(1, options.now);
    state.items[imageSha256] = stateItem;
    claimed.push(toWorkItem(moved, imageSha256, stateItem));
  }

  if (claimed.length > 0) writeWeeklyState(options.privateRoot, state);
  return claimed;
}

function parseArgs(args: string[]): { privateRoot: string; runId: string; output: string } {
  let privateRoot = "";
  let runId = "";
  let output = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--private-root") privateRoot = args[++index] ?? "";
    else if (arg === "--run-id") runId = args[++index] ?? "";
    else if (arg === "--output") output = args[++index] ?? "";
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (!privateRoot) throw new Error("MISSING_ARGUMENT:--private-root");
  if (!runId) throw new Error("MISSING_ARGUMENT:--run-id");
  if (!output) throw new Error("MISSING_ARGUMENT:--output");
  return { privateRoot, runId, output };
}

export function main(args = process.argv.slice(2)): void {
  const options = parseArgs(args);
  if (existsSync(options.output)) throw new Error("TARGET_ALREADY_EXISTS");
  acquireWeeklyRunLock(options.privateRoot, options.runId);
  const items = scanAndClaimInbox({ privateRoot: options.privateRoot, runId: options.runId });
  writeJsonFile0600(options.output, {
    schemaVersion: 1,
    runId: options.runId,
    generatedAt: nowIso(),
    items,
  }, false);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`WEEKLY_INBOX_SCAN_FAILED:${message}\n`);
    process.exitCode = 2;
  }
}
