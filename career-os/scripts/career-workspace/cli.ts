import { cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CAREER_WORKSPACE_MANAGED_ROOTS,
  CareerWorkspaceReleaseManifestSchema,
  CAREER_WORKSPACE_NAME,
  CAREER_WORKSPACE_SCHEMA_VERSION,
  type CareerWorkspaceFileEntry,
  type CareerWorkspaceProducer,
  type RemoteErrorResult,
} from "./contracts.ts";
import { buildWorkspaceDraft, compareCodeUnits, digestWorkspaceFiles, sortWorkspaceFiles } from "./manifest.ts";
import {
  careerWorkspaceSyncStateSchema,
  prepareJournalSchema,
  type CareerWorkspaceSyncState,
  type PrepareJournal,
} from "./local-state.ts";
import { LocalCareerWorkspaceTransport } from "./local-transport.ts";
import { SshCareerWorkspaceTransport } from "./ssh-transport.ts";
import { makeRemoteError, TransportError, type CareerWorkspaceTransport } from "./transport.ts";
import { copyManifestFiles, createTarFromDirectory, extractTarToDirectory, listRelativeFiles, safeRemove, validateTarTopLevel } from "./tar-utils.ts";

export interface CliContext {
  root: string;
  transport: CareerWorkspaceTransport;
  producer: CareerWorkspaceProducer;
}

export async function runCareerWorkspaceCli(args: string[], context = createDefaultContext()): Promise<unknown> {
  const command = args[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    return {
      schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
      action: "help",
      ok: true,
      commands: ["check --json", "prepare", "diff", "publish"],
    };
  }
  if (command === "check") {
    return checkWorkspace(context);
  }
  if (command === "prepare") {
    return prepareWorkspace(context);
  }
  if (command === "diff") {
    return diffWorkspace(context);
  }
  if (command === "publish") {
    return publishWorkspace(context);
  }
  throw new TransportError(makeRemoteError("check", "INVALID_MANIFEST"));
}

export async function checkWorkspace(context: CliContext) {
  const syncState = await readSyncState(context.root);
  const local = syncState.kind === "invalid"
    ? { status: "invalid", revision: null, contentDigest: null, fileCount: 0 }
    : await inspectLocal(context, syncState.state);
  const remote = await context.transport.status();
  return {
    schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
    action: "check",
    ok: true,
    workspace: CAREER_WORKSPACE_NAME,
    local,
    remote,
  };
}

export async function prepareWorkspace(context: CliContext) {
  await restoreIncompleteJournal(context.root);
  const syncState = await readSyncState(context.root);
  if (syncState.kind === "invalid") {
    throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
  }
  const local = await inspectLocal(context, syncState.state);
  if (local.status === "dirty") {
    throw new TransportError(makeRemoteError("prepare", "WORKSPACE_DIRTY"));
  }
  if (local.status === "invalid") {
    throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
  }
  if (local.status === "uninitialized" && local.fileCount > 0) {
    throw new TransportError(makeRemoteError("prepare", "WORKSPACE_DIRTY"));
  }

  const remote = await context.transport.status();
  if (!remote.current) {
    throw new TransportError(makeRemoteError("prepare", "REMOTE_UNINITIALIZED"));
  }

  const syncDir = syncDirectory(context.root);
  const stagingDir = path.join(syncDir, "staging");
  const backupDir = path.join(syncDir, "backup");
  await safeRemove(stagingDir);
  await safeRemove(backupDir);
  await mkdir(syncDir, { recursive: true });

  const journal = makeJournal(remote.current.revision);
  await writeJournal(context.root, journal);

  const archive = await context.transport.export(remote.current.revision);
  await validateTarTopLevel(archive, ["workspace-manifest.json", ...CAREER_WORKSPACE_MANAGED_ROOTS], "prepare");
  await extractTarToDirectory(archive, stagingDir, ["workspace-manifest.json", ...CAREER_WORKSPACE_MANAGED_ROOTS], "prepare");
  journal.status = "staged";
  await writeJournal(context.root, journal);

  const manifest = await validateExtractedRelease(stagingDir);
  let syncStateCommitted = false;
  try {
    await mkdir(backupDir, { recursive: true });
    for (const managedRoot of CAREER_WORKSPACE_MANAGED_ROOTS) {
      const source = path.join(context.root, managedRoot);
      const backup = path.join(backupDir, managedRoot);
      if (await exists(source)) {
        await rename(source, backup);
        journal.roots[managedRoot].hadOriginal = true;
      }
      journal.roots[managedRoot].backupDone = true;
      await writeJournal(context.root, journal);
    }
    journal.status = "backed_up";
    await writeJournal(context.root, journal);

    for (const managedRoot of CAREER_WORKSPACE_MANAGED_ROOTS) {
      await rename(path.join(stagingDir, managedRoot), path.join(context.root, managedRoot));
      journal.roots[managedRoot].applyDone = true;
      await writeJournal(context.root, journal);
    }
    journal.status = "applied";
    await writeJournal(context.root, journal);

    const after = await buildWorkspaceDraft(context.root, manifest.producer, { parentRevision: manifest.revision });
    if (after.manifest.contentDigest !== manifest.contentDigest) {
      throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
    }
    await writeSyncState(context.root, {
      schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
      workspace: CAREER_WORKSPACE_NAME,
      revision: manifest.revision,
      contentDigest: manifest.contentDigest,
      files: manifest.files,
    });
    syncStateCommitted = true;
    journal.status = "completed";
    await writeJournal(context.root, journal);
    await cleanupCompletedJournal(context.root);
  } catch (error) {
    if (!syncStateCommitted) {
      await rollbackJournal(context.root, journal);
    }
    throw error;
  }

  return {
    schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
    action: "prepare",
    ok: true,
    revision: manifest.revision,
    contentDigest: manifest.contentDigest,
    fileCount: manifest.files.length,
  };
}

export async function diffWorkspace(context: CliContext) {
  const syncState = await readSyncState(context.root);
  if (syncState.kind === "invalid") {
    throw new TransportError(makeRemoteError("diff", "RESTORE_REQUIRED"));
  }
  if (!syncState.state) {
    throw new TransportError(makeRemoteError("diff", "REMOTE_UNINITIALIZED"));
  }
  const draft = await buildWorkspaceDraft(context.root, context.producer, { parentRevision: syncState.state.revision });
  const before = new Map(syncState.state.files.map((file) => [file.path, file]));
  const after = new Map(draft.manifest.files.map((file) => [file.path, file]));
  return {
    schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
    action: "diff",
    ok: true,
    added: [...after.keys()].filter((file) => !before.has(file)).sort(),
    modified: [...after.entries()].filter(([file, entry]) => before.has(file) && before.get(file)?.sha256 !== entry.sha256).map(([file]) => file).sort(),
    deleted: [...before.keys()].filter((file) => !after.has(file)).sort(),
  };
}

export async function publishWorkspace(context: CliContext) {
  const syncState = await readSyncState(context.root);
  if (syncState.kind === "invalid") {
    throw new TransportError(makeRemoteError("publish", "RESTORE_REQUIRED"));
  }
  const local = await inspectLocal(context, syncState.state);
  if (local.status === "invalid") {
    throw new TransportError(makeRemoteError("publish", "RESTORE_REQUIRED"));
  }

  const parentRevision = syncState.state?.revision ?? null;
  const draft = await buildWorkspaceDraft(context.root, context.producer, { parentRevision });
  const tempDir = path.join(syncDirectory(context.root), "publish");
  await safeRemove(tempDir);
  await mkdir(tempDir, { recursive: true });
  try {
    await copyManifestFiles(context.root, tempDir, draft.manifest.files);
    await writeFile(path.join(tempDir, "workspace-draft.json"), `${JSON.stringify(draft.manifest, null, 2)}\n`);
    const archive = await createTarFromDirectory(tempDir, ["workspace-draft.json", ...CAREER_WORKSPACE_MANAGED_ROOTS]);
    const result = await context.transport.publish(archive);
    if (result.contentDigest !== draft.manifest.contentDigest) {
      throw new TransportError(makeRemoteError("publish", "INVALID_MANIFEST"));
    }
    await writeSyncState(context.root, {
      schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
      workspace: CAREER_WORKSPACE_NAME,
      revision: result.revision,
      contentDigest: result.contentDigest,
      files: draft.manifest.files,
    });
    return result;
  } finally {
    await safeRemove(tempDir);
  }
}

async function validateExtractedRelease(stagingDir: string) {
  try {
    const manifest = CareerWorkspaceReleaseManifestSchema.parse(JSON.parse(
      await readFile(path.join(stagingDir, "workspace-manifest.json"), "utf8"),
    ));
    const draft = await buildWorkspaceDraft(stagingDir, manifest.producer, { parentRevision: manifest.parentRevision });
    const actualFiles = JSON.stringify(sortWorkspaceFiles(draft.manifest.files));
    const expectedFiles = JSON.stringify(sortWorkspaceFiles(manifest.files));
    const extractedFiles = (await listRelativeFiles(stagingDir))
      .filter((file) => file !== "workspace-manifest.json")
      .toSorted(compareCodeUnits);
    const expectedExtractedFiles = manifest.files.map((file) => file.path).toSorted(compareCodeUnits);
    if (
      draft.manifest.contentDigest !== manifest.contentDigest
      || actualFiles !== expectedFiles
      || JSON.stringify(extractedFiles) !== JSON.stringify(expectedExtractedFiles)
    ) {
      throw new TransportError(makeRemoteError("prepare", "INVALID_MANIFEST"));
    }
    return manifest;
  } catch (error) {
    if (error instanceof TransportError) {
      throw error;
    }
    throw new TransportError(makeRemoteError("prepare", "INVALID_MANIFEST"));
  }
}

async function restoreIncompleteJournal(root: string): Promise<void> {
  const file = journalPath(root);
  if (!await exists(file)) {
    return;
  }
  let parsed;
  try {
    parsed = prepareJournalSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
  } catch {
    throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
  }
  if (!parsed.success) {
    throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
  }
  if (parsed.data.status === "restored") {
    await cleanupCompletedJournal(root);
    return;
  }
  if (parsed.data.status === "completed" || await matchesCommittedWorkspace(root, parsed.data)) {
    await cleanupCompletedJournal(root);
    return;
  }
  const journal = parsed.data;
  journal.status = "restoring";
  await writeJournal(root, journal);
  await rollbackJournal(root, journal);
  journal.status = "restored";
  await writeJournal(root, journal);
  await safeRemove(path.join(syncDirectory(root), "staging"));
  await safeRemove(path.join(syncDirectory(root), "backup"));
  await rm(file, { force: true });
}

async function matchesCommittedWorkspace(root: string, journal: PrepareJournal): Promise<boolean> {
  if (!journal.revision) {
    return false;
  }
  const syncState = await readSyncState(root);
  if (syncState.kind !== "valid" || syncState.state.revision !== journal.revision) {
    return false;
  }
  try {
    const draft = await buildWorkspaceDraft(root, { skill: "career-workspace", mode: "interactive" }, {
      parentRevision: journal.revision,
    });
    return draft.manifest.contentDigest === syncState.state.contentDigest;
  } catch {
    return false;
  }
}

async function inspectLocal(context: CliContext, syncState: CareerWorkspaceSyncState | null) {
  const draft = await buildWorkspaceDraft(context.root, context.producer, { parentRevision: syncState?.revision ?? null }).catch(() => null);
  if (!draft) {
    return { status: "invalid", revision: syncState?.revision ?? null, contentDigest: null, fileCount: 0 };
  }
  if (!syncState) {
    return { status: "uninitialized", revision: null, contentDigest: draft.manifest.contentDigest, fileCount: draft.manifest.files.length };
  }
  const recalculated = digestWorkspaceFiles(sortWorkspaceFiles(syncState.files));
  if (recalculated !== syncState.contentDigest) {
    return { status: "invalid", revision: syncState.revision, contentDigest: null, fileCount: 0 };
  }
  return {
    status: draft.manifest.contentDigest === syncState.contentDigest ? "clean" : "dirty",
    revision: syncState.revision,
    contentDigest: draft.manifest.contentDigest,
    fileCount: draft.manifest.files.length,
  };
}

async function readSyncState(root: string): Promise<
  | { kind: "missing"; state: null }
  | { kind: "valid"; state: CareerWorkspaceSyncState }
  | { kind: "invalid"; state: null }
> {
  if (!await exists(syncStatePath(root))) {
    return { kind: "missing", state: null };
  }
  try {
    const state = careerWorkspaceSyncStateSchema.parse(JSON.parse(await readFile(syncStatePath(root), "utf8")));
    const recalculated = digestWorkspaceFiles(sortWorkspaceFiles(state.files));
    if (recalculated !== state.contentDigest) {
      return { kind: "invalid", state: null };
    }
    return { kind: "valid", state };
  } catch {
    return { kind: "invalid", state: null };
  }
}

async function writeSyncState(root: string, state: CareerWorkspaceSyncState): Promise<void> {
  await mkdir(syncDirectory(root), { recursive: true });
  await writeAtomicJson(syncStatePath(root), careerWorkspaceSyncStateSchema.parse(state));
}

function makeJournal(revision: string): PrepareJournal {
  return {
    schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
    workspace: CAREER_WORKSPACE_NAME,
    transactionId: `prepare-${Date.now()}`,
    revision,
    status: "started",
    roots: {
      applications: { hadOriginal: false, backupDone: false, applyDone: false },
      private: { hadOriginal: false, backupDone: false, applyDone: false },
      state: { hadOriginal: false, backupDone: false, applyDone: false },
    },
  };
}

async function writeJournal(root: string, journal: PrepareJournal): Promise<void> {
  await mkdir(syncDirectory(root), { recursive: true });
  await writeAtomicJson(journalPath(root), prepareJournalSchema.parse(journal));
}

function createDefaultContext(): CliContext {
  const env = process.env;
  const root = path.resolve(env.CAREER_WORKSPACE_ROOT || "career-os");
  const localRoot = env.CAREER_WORKSPACE_LOCAL_TRANSPORT_ROOT;
  const transport = localRoot
    ? new LocalCareerWorkspaceTransport(localRoot)
    : new SshCareerWorkspaceTransport({
        sshTarget: env.CAREER_WORKSPACE_SSH_TARGET || "",
        remoteCommand: env.CAREER_WORKSPACE_REMOTE_COMMAND || "career-storage",
        sshArgs: env.CAREER_WORKSPACE_SSH_ARGS?.split(" ").filter(Boolean),
      });
  return {
    root,
    transport,
    producer: {
      skill: env.CAREER_WORKSPACE_PRODUCER_SKILL || "career-workspace",
      mode: env.CAREER_WORKSPACE_PRODUCER_MODE === "automation" ? "automation" : "interactive",
    },
  };
}

function syncDirectory(root: string): string {
  return path.join(root, ".career-sync");
}

function syncStatePath(root: string): string {
  return path.join(syncDirectory(root), "sync-state.json");
}

function journalPath(root: string): string {
  return path.join(syncDirectory(root), "prepare-journal.json");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function rollbackJournal(root: string, journal: PrepareJournal): Promise<void> {
  for (const managedRoot of CAREER_WORKSPACE_MANAGED_ROOTS) {
    const rootState = journal.roots[managedRoot];
    const target = path.join(root, managedRoot);
    const backup = path.join(syncDirectory(root), "backup", managedRoot);
    const backupExists = await exists(backup);
    const targetExists = await exists(target);
    if (isContradictoryJournalEvidence(rootState, backupExists, targetExists)) {
      throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
    }
    const shouldRemoveTarget = rootState.applyDone
      || (backupExists && targetExists)
      || (rootState.backupDone && !rootState.hadOriginal && targetExists);
    if (shouldRemoveTarget) {
      await safeRemove(target);
    }
    if (rootState.hadOriginal || backupExists) {
      if (!backupExists) {
        throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
      }
      await cp(backup, target, { recursive: true, force: true, errorOnExist: false });
    }
  }
  await safeRemove(path.join(syncDirectory(root), "staging"));
}

function isContradictoryJournalEvidence(
  rootState: PrepareJournal["roots"][typeof CAREER_WORKSPACE_MANAGED_ROOTS[number]],
  backupExists: boolean,
  targetExists: boolean,
): boolean {
  if (backupExists && !rootState.backupDone) {
    return targetExists;
  }
  if (backupExists && !rootState.hadOriginal) {
    return rootState.backupDone;
  }
  if (rootState.hadOriginal && !backupExists) {
    return true;
  }
  return false;
}

async function cleanupCompletedJournal(root: string): Promise<void> {
  const syncStateResult = await readSyncState(root);
  if (syncStateResult.kind !== "valid") {
    throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
  }
  const draft = await buildWorkspaceDraft(root, { skill: "career-workspace", mode: "interactive" }, {
    parentRevision: syncStateResult.state.revision,
  });
  if (draft.manifest.contentDigest !== syncStateResult.state.contentDigest) {
    throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
  }
  await safeRemove(path.join(syncDirectory(root), "staging"));
  await safeRemove(path.join(syncDirectory(root), "backup"));
  await rm(journalPath(root), { force: true });
}

async function writeAtomicJson(target: string, value: unknown): Promise<void> {
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, target);
}

if (import.meta.main) {
  try {
    const result = await runCareerWorkspaceCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const action = commandAction(process.argv[2]);
    const result: RemoteErrorResult = error instanceof TransportError
      ? error.result
      : makeRemoteError(action, "TRANSPORT_UNAVAILABLE");
    process.stderr.write(`${JSON.stringify(result)}\n`);
    process.exit(1);
  }
}

function commandAction(command: string | undefined): RemoteErrorResult["action"] {
  if (command === "prepare" || command === "diff" || command === "publish" || command === "check") {
    return command;
  }
  return "check";
}
