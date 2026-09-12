import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import {
  CAREER_WORKSPACE_MANAGED_ROOTS,
  CareerWorkspaceReleaseManifestSchema,
  CAREER_WORKSPACE_NAME,
  CAREER_WORKSPACE_SCHEMA_VERSION,
  type CareerWorkspaceFileEntry,
  type CareerWorkspaceProducer,
  type ExcludedWorkspacePath,
  type RemoteErrorResult,
} from "./contracts.ts";
import { buildWorkspaceDraft, compareCodeUnits, digestWorkspaceFiles, sortWorkspaceFiles } from "./manifest.ts";
import {
  careerWorkspaceSyncStateSchema,
  prepareJournalSchema,
  type CareerWorkspaceSyncState,
  type PrepareJournal,
} from "./local-state.ts";
import { CommandCareerWorkspaceTransport } from "./command-transport.ts";
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
      commands: [
        "check --json",
        "prepare",
        "diff",
        "publish",
        "skill begin <skill> --json",
        "skill finish <skill> --json",
      ],
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
  if (command === "skill" && args[1] === "begin") {
    return beginSkillWorkspace(context, args[2]);
  }
  if (command === "skill" && args[1] === "finish") {
    return finishSkillWorkspace(context, args[2]);
  }
  throw new TransportError(makeRemoteError("check", "INVALID_MANIFEST"));
}

const managedSkills = new Set([
  "application-package-writer",
  "position-recommender",
  "resume-preparer",
  "interview-practice",
  "study-topic-recommender",
  "sync-profile",
]);

export async function beginSkillWorkspace(context: CliContext, skill: string | undefined) {
  validateManagedSkill(skill);
  if (await exists(skillSessionPath(context.root))) {
    const open = await readSkillSession(context.root);
    throw new TransportError(makeRemoteError("check", "RESTORE_REQUIRED", open
      ? `이미 ${open.skill} 세션이 열려 있습니다. \`skill finish ${open.skill}\` 로 마무리한 뒤 새 세션을 시작하세요.`
      : "읽을 수 없는 세션 기록이 남아 있습니다. `.career-sync/skill-session.json` 을 지운 뒤 다시 시작하세요."));
  }
  const checked = await checkWorkspace({ ...context, producer: { ...context.producer, skill } });
  if (
    checked.local.status === "clean"
    && checked.remote.current
    && checked.local.revision === checked.remote.current.revision
  ) {
    const result = {
      schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
      action: "skill-begin",
      ok: true,
      skill,
      revision: checked.remote.current.revision,
      noChange: true,
    };
    await writeSkillSession(context.root, skill, checked.remote.current.revision);
    return result;
  }
  const prepared = await prepareWorkspace({ ...context, producer: { ...context.producer, skill } });
  await writeSkillSession(context.root, skill, prepared.revision);
  return { ...prepared, action: "skill-begin", skill, noChange: false };
}

export async function finishSkillWorkspace(context: CliContext, skill: string | undefined) {
  validateManagedSkill(skill);
  const skillContext = { ...context, producer: { ...context.producer, skill } };
  const session = await readSkillSession(context.root);
  const syncState = await readSyncState(context.root);
  const mismatch = describeSkillSessionMismatch(skill, session, syncState);
  if (mismatch) {
    throw new TransportError(makeRemoteError("check", "RESTORE_REQUIRED", mismatch));
  }
  const difference = await diffWorkspace(skillContext);
  if (difference.added.length === 0 && difference.modified.length === 0 && difference.deleted.length === 0) {
    const checked = await checkWorkspace(skillContext);
    const result = {
      schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
      action: "skill-finish",
      ok: true,
      skill,
      revision: checked.local.revision,
      noChange: true,
    };
    await rm(skillSessionPath(context.root), { force: true });
    return result;
  }
  const published = await publishWorkspace(skillContext);
  await rm(skillSessionPath(context.root), { force: true });
  return { ...published, action: "skill-finish", skill };
}

/**
 * `skill finish` 가 거절되는 이유는 넷이고 되돌리는 방법이 각각 다르다.
 * 세션 기록 없이 `prepare` 로 작업을 시작했거나, 세션 도중 다른 실행이
 * 작업본을 바꿨을 때 어긋남이 한참 뒤에 드러나므로 다음 명령까지 같이 낸다.
 * 어긋나지 않았으면 undefined 를 돌려준다.
 */
export function describeSkillSessionMismatch(
  skill: string,
  session: { skill: string; revision: string } | null,
  syncState: { kind: "missing" | "valid" | "invalid"; state: CareerWorkspaceSyncState | null },
): string | undefined {
  if (!session) {
    return `\`skill begin ${skill}\` 로 시작한 세션 기록이 없습니다. 지금 변경을 그대로 올리려면 \`publish\` 를 실행하고, 세션으로 다시 시작하려면 변경이 없는 상태에서 \`skill begin ${skill}\` 을 실행하세요.`;
  }
  if (session.skill !== skill) {
    return `열려 있는 세션의 skill 은 ${session.skill} 입니다. \`skill finish ${session.skill}\` 로 마무리한 뒤 ${skill} 세션을 시작하세요.`;
  }
  if (syncState.kind !== "valid") {
    return "작업본의 sync-state 를 읽을 수 없습니다. `prepare` 로 작업본을 다시 받은 뒤 세션을 시작하세요.";
  }
  if (syncState.state.revision !== session.revision) {
    return `세션을 시작한 revision 은 ${session.revision} 이고 지금 작업본은 ${syncState.state.revision} 입니다. 세션 도중 다른 prepare 나 publish 가 있었습니다. \`diff\` 로 남은 변경을 확인하고 \`publish\` 로 올린 뒤 \`.career-sync/skill-session.json\` 을 지우세요.`;
  }
  return undefined;
}

function validateManagedSkill(skill: string | undefined): asserts skill is string {
  if (!skill || !managedSkills.has(skill)) {
    throw new TransportError(makeRemoteError("check", "INVALID_MANIFEST"));
  }
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
  const journal = parsed.data;
  if (journal.status === "restored") {
    await cleanupCompletedJournal(root);
    return;
  }
  if (journal.status === "completed") {
    if (!hasCompletedJournalShape(journal)) {
      throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
    }
    await cleanupCompletedJournal(root);
    return;
  }
  await assertJournalEvidenceConsistent(root, journal);
  if (await matchesCommittedWorkspace(root, journal)) {
    await cleanupCompletedJournal(root);
    return;
  }
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
  if (draft.excluded.some((entry) => isPrepareBlockingExclusion(entry.code))) {
    return {
      status: "dirty",
      revision: syncState?.revision ?? null,
      contentDigest: draft.manifest.contentDigest,
      fileCount: draft.manifest.files.length,
    };
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
      library: { hadOriginal: false, backupDone: false, applyDone: false },
      state: { hadOriginal: false, backupDone: false, applyDone: false },
    },
  };
}

async function writeJournal(root: string, journal: PrepareJournal): Promise<void> {
  await mkdir(syncDirectory(root), { recursive: true });
  await writeAtomicJson(journalPath(root), prepareJournalSchema.parse(journal));
}

function createDefaultContext(): CliContext {
  const environmentFile = loadWorkspaceEnvironment();
  const env = process.env;
  const root = path.resolve(env.CAREER_WORKSPACE_ROOT || "career-os");
  return {
    root,
    transport: createCareerWorkspaceTransport(env, environmentFile),
    producer: {
      skill: env.CAREER_WORKSPACE_PRODUCER_SKILL || "career-workspace",
      mode: env.CAREER_WORKSPACE_PRODUCER_MODE === "automation" ? "automation" : "interactive",
    },
  };
}

export interface WorkspaceEnvironmentFile {
  path: string;
  present: boolean;
}

export function createCareerWorkspaceTransport(
  environment: Readonly<Record<string, string | undefined>>,
  environmentFile?: WorkspaceEnvironmentFile,
): CareerWorkspaceTransport {
  if (environment.CAREER_WORKSPACE_COMMAND) {
    return new CommandCareerWorkspaceTransport({ command: environment.CAREER_WORKSPACE_COMMAND });
  }
  if (!environment.CAREER_WORKSPACE_SSH_TARGET) {
    return new UnconfiguredCareerWorkspaceTransport(describeMissingTransportSetting(environmentFile));
  }
  return new SshCareerWorkspaceTransport({
    sshTarget: environment.CAREER_WORKSPACE_SSH_TARGET,
    remoteCommand: environment.CAREER_WORKSPACE_REMOTE_COMMAND || "career-storage",
    sshArgs: environment.CAREER_WORKSPACE_SSH_ARGS?.split(" ").filter(Boolean),
  });
}

/**
 * `.env` 는 git 추적 대상이 아니라 새 워크트리에 따라오지 않는다.
 * 이때 원격 연결 설정이 비어 있어 첫 `check` 가 `TRANSPORT_UNAVAILABLE` 로 끝나는데,
 * 코드만으로는 연결 실패와 설정 누락을 나눌 수 없어 원인을 찾는 데 확인이 여러 번 들었다.
 * 어느 파일이 비었는지와 가져올 곳을 함께 낸다. 환경 변수 값 자체는 담지 않는다.
 */
export function describeMissingTransportSetting(environmentFile?: WorkspaceEnvironmentFile): string {
  const file = environmentFile?.path ?? path.join("career-os", ".env");
  if (environmentFile && !environmentFile.present) {
    return `${file} 파일이 없어 원격 저장소 설정을 읽지 못했습니다. 원본 체크아웃의 같은 파일을 이 작업본으로 복사한 뒤 다시 실행하세요.`;
  }
  return `${file} 의 CAREER_WORKSPACE_COMMAND 와 CAREER_WORKSPACE_SSH_TARGET 이 모두 비어 있습니다. 원본 체크아웃의 같은 파일에서 두 값을 가져온 뒤 다시 실행하세요.`;
}

/** 원격 연결 설정이 없을 때 쓰는 transport 다. 호출하는 자리마다 같은 설명을 낸다. */
class UnconfiguredCareerWorkspaceTransport implements CareerWorkspaceTransport {
  constructor(private readonly detail: string) {}

  async status(): Promise<never> {
    throw this.unavailable("status");
  }

  async export(): Promise<never> {
    throw this.unavailable("export");
  }

  async publish(): Promise<never> {
    throw this.unavailable("publish");
  }

  private unavailable(action: "status" | "export" | "publish"): TransportError {
    return new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE", this.detail));
  }
}

function loadWorkspaceEnvironment(): WorkspaceEnvironmentFile {
  const configured = process.env.CAREER_WORKSPACE_ENV_FILE;
  const defaultFile = path.basename(process.cwd()) === "career-os" ? ".env" : path.join("career-os", ".env");
  const file = configured || defaultFile;
  loadEnv({ path: file, quiet: true });
  return { path: file, present: existsSync(file) };
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

function skillSessionPath(root: string): string {
  return path.join(syncDirectory(root), "skill-session.json");
}

async function writeSkillSession(root: string, skill: string, revision: string): Promise<void> {
  await mkdir(syncDirectory(root), { recursive: true });
  await writeAtomicJson(skillSessionPath(root), {
    schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
    workspace: CAREER_WORKSPACE_NAME,
    skill,
    revision,
    startedAt: new Date().toISOString(),
  });
}

async function readSkillSession(root: string): Promise<{ skill: string; revision: string } | null> {
  if (!await exists(skillSessionPath(root))) return null;
  try {
    const value = JSON.parse(await readFile(skillSessionPath(root), "utf8")) as Record<string, unknown>;
    if (
      value.schemaVersion !== CAREER_WORKSPACE_SCHEMA_VERSION
      || value.workspace !== CAREER_WORKSPACE_NAME
      || typeof value.skill !== "string"
      || !managedSkills.has(value.skill)
      || typeof value.revision !== "string"
      || typeof value.startedAt !== "string"
    ) {
      return null;
    }
    return { skill: value.skill, revision: value.revision };
  } catch {
    return null;
  }
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
    return true;
  }
  if (backupExists && !rootState.hadOriginal) {
    return rootState.backupDone;
  }
  if (rootState.hadOriginal && !backupExists) {
    return true;
  }
  return false;
}

async function assertJournalEvidenceConsistent(root: string, journal: PrepareJournal): Promise<void> {
  for (const managedRoot of CAREER_WORKSPACE_MANAGED_ROOTS) {
    const rootState = journal.roots[managedRoot];
    const backupExists = await exists(path.join(syncDirectory(root), "backup", managedRoot));
    const targetExists = await exists(path.join(root, managedRoot));
    if (isContradictoryJournalEvidence(rootState, backupExists, targetExists)) {
      throw new TransportError(makeRemoteError("prepare", "RESTORE_REQUIRED"));
    }
  }
}

function hasCompletedJournalShape(journal: PrepareJournal): boolean {
  return CAREER_WORKSPACE_MANAGED_ROOTS.every((managedRoot) => {
    const rootState = journal.roots[managedRoot];
    return rootState.backupDone && rootState.applyDone;
  });
}

/**
 * `.omc` 는 저장소가 재생성 가능한 운영 산출물로 선언한 디렉터리라
 * 동기화에서만 제외하고 `prepare` 를 막지 않는다. 비밀 값을 담는 `.env` 와
 * 그 밖의 숨김 파일은 그대로 막아 사용자가 직접 정리하게 한다.
 */
function isPrepareBlockingExclusion(code: ExcludedWorkspacePath["code"]): boolean {
  return code === "excluded-env" || code === "excluded-hidden";
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
