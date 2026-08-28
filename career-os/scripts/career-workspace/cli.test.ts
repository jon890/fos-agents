import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  CAREER_WORKSPACE_MANAGED_ROOTS,
  CareerWorkspaceReleaseManifestSchema,
  type RemoteStatusResult,
} from "./contracts.ts";
import { buildWorkspaceDraft } from "./manifest.ts";
import { LocalCareerWorkspaceTransport } from "./local-transport.ts";
import { checkWorkspace, diffWorkspace, prepareWorkspace, publishWorkspace, type CliContext } from "./cli.ts";
import { createTarFromDirectory } from "./tar-utils.ts";
import { TransportError, type CareerWorkspaceTransport } from "./transport.ts";

const producer = { skill: "test", mode: "interactive" } as const;

interface Fixture {
  tempRoot: string;
  workspaceRoot: string;
  storageRoot: string;
}

describe("career workspace cli", () => {
  test("check는 local과 remote 상태를 구조화한다", async () => withFixture(async (fixture) => {
    const result = await checkWorkspace(makeContext(fixture));

    expect(result).toMatchObject({
      action: "check",
      ok: true,
      workspace: "career-os",
      local: { status: "uninitialized" },
      remote: { action: "status", current: null },
    });
  }));

  test("prepare는 정상 release를 검증한 뒤 로컬 root와 sync-state를 갱신한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/toss/resume.md": "resume", "state/drill-progress.json": "{}" });

    const result = await prepareWorkspace(makeContext(fixture));

    expect(result).toMatchObject({ action: "prepare", ok: true, revision: "rev-1", fileCount: 2 });
    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "toss", "resume.md"), "utf8")).toBe("resume");
    const syncState = JSON.parse(await readFile(path.join(fixture.workspaceRoot, ".career-sync", "sync-state.json"), "utf8"));
    expect(syncState).toMatchObject({ revision: "rev-1", workspace: "career-os" });
    expect(await Bun.file(path.join(fixture.workspaceRoot, ".career-sync", "prepare-journal.json")).exists()).toBe(false);
  }));

  test("prepare는 sync-state 없는 로컬 파일을 dirty로 보고 보존한다", async () => withFixture(async (fixture) => {
    await writeFile(path.join(fixture.workspaceRoot, "applications", "local.md"), "local");
    await createRemoteRelease(fixture, "rev-1", { "applications/remote.md": "remote" });

    await expect(prepareWorkspace(makeContext(fixture))).rejects.toMatchObject({
      result: { code: "WORKSPACE_DIRTY" },
    });
    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "local.md"), "utf8")).toBe("local");
  }));

  test("prepare는 손상 tar를 거부하고 기존 파일을 보존한다", async () => withFixture(async (fixture) => {
    const archive = await createTarFromDirectory(fixture.workspaceRoot, ["applications"]);
    const context = makeContext(fixture, new BadExportTransport(archive));

    await expect(prepareWorkspace(context)).rejects.toMatchObject({
      result: { code: "INVALID_MANIFEST" },
    });
    expect(await exists(path.join(fixture.workspaceRoot, "applications"))).toBe(true);
  }));

  test("prepare는 release manifest와 파일 hash가 다르면 거부한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/resume.md": "before" });
    await prepareWorkspace(makeContext(fixture));
    await createRemoteRelease(fixture, "rev-2", { "applications/resume.md": "after" }, { corruptDigest: true });

    await expect(prepareWorkspace(makeContext(fixture))).rejects.toMatchObject({
      result: { code: "INVALID_MANIFEST" },
    });
    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "resume.md"), "utf8")).toBe("before");
  }));

  test("prepare는 손상된 sync-state를 RESTORE_REQUIRED로 중단한다", async () => withFixture(async (fixture) => {
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync"), { recursive: true });
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "sync-state.json"), "{ broken");
    await createRemoteRelease(fixture, "rev-1", { "applications/resume.md": "remote" });

    await expect(prepareWorkspace(makeContext(fixture))).rejects.toMatchObject({
      result: { code: "RESTORE_REQUIRED" },
    });
  }));

  test("prepare는 미완 journal을 발견하면 backup을 복구한 뒤 새 release를 적용한다", async () => withFixture(async (fixture) => {
    await writeFile(path.join(fixture.workspaceRoot, "applications", "old.md"), "old");
    const oldDraft = await buildWorkspaceDraft(fixture.workspaceRoot, producer, { parentRevision: "rev-old" });
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync"), { recursive: true });
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "sync-state.json"), JSON.stringify({
      schemaVersion: 1,
      workspace: "career-os",
      revision: "rev-old",
      contentDigest: oldDraft.manifest.contentDigest,
      files: oldDraft.manifest.files,
    }));
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync", "backup"), { recursive: true });
    await rename(
      path.join(fixture.workspaceRoot, "applications"),
      path.join(fixture.workspaceRoot, ".career-sync", "backup", "applications"),
    );
    await createManagedRoots(fixture.workspaceRoot);
    await writeFile(path.join(fixture.workspaceRoot, "applications", "new-partial.md"), "partial");
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "prepare-journal.json"), JSON.stringify({
      schemaVersion: 1,
      workspace: "career-os",
      transactionId: "tx-1",
      revision: "rev-old",
      status: "applied",
      roots: {
        applications: { hadOriginal: true, backupDone: true, applyDone: true },
        private: { hadOriginal: false, backupDone: false, applyDone: false },
        state: { hadOriginal: false, backupDone: false, applyDone: false },
      },
    }));
    await createRemoteRelease(fixture, "rev-1", { "applications/remote.md": "remote" });

    await prepareWorkspace(makeContext(fixture));

    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "remote.md"), "utf8")).toBe("remote");
    expect(await exists(path.join(fixture.workspaceRoot, "applications", "new-partial.md"))).toBe(false);
  }));

  test("prepare는 새 target과 backup이 함께 남은 crash-window를 복구한다", async () => withFixture(async (fixture) => {
    await writeFile(path.join(fixture.workspaceRoot, "applications", "old.md"), "old");
    const oldDraft = await buildWorkspaceDraft(fixture.workspaceRoot, producer, { parentRevision: "rev-old" });
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync"), { recursive: true });
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "sync-state.json"), JSON.stringify({
      schemaVersion: 1,
      workspace: "career-os",
      revision: "rev-old",
      contentDigest: oldDraft.manifest.contentDigest,
      files: oldDraft.manifest.files,
    }));
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync", "backup"), { recursive: true });
    await rename(
      path.join(fixture.workspaceRoot, "applications"),
      path.join(fixture.workspaceRoot, ".career-sync", "backup", "applications"),
    );
    await mkdir(path.join(fixture.workspaceRoot, "applications"), { recursive: true });
    await writeFile(path.join(fixture.workspaceRoot, "applications", "new.md"), "new");
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "prepare-journal.json"), JSON.stringify({
      schemaVersion: 1,
      workspace: "career-os",
      transactionId: "tx-crash-after-rename",
      revision: "rev-old",
      status: "backed_up",
      roots: {
        applications: { hadOriginal: true, backupDone: true, applyDone: false },
        private: { hadOriginal: false, backupDone: false, applyDone: false },
        state: { hadOriginal: false, backupDone: false, applyDone: false },
      },
    }));
    await createRemoteRelease(fixture, "rev-1", { "applications/remote.md": "remote" });

    await prepareWorkspace(makeContext(fixture));

    expect(await exists(path.join(fixture.workspaceRoot, "applications", "new.md"))).toBe(false);
    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "remote.md"), "utf8")).toBe("remote");
  }));

  test("prepare는 원본이 없던 root의 새 target이 남은 crash-window를 제거한다", async () => withFixture(async (fixture) => {
    await rm(path.join(fixture.workspaceRoot, "private"), { recursive: true, force: true });
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync"), { recursive: true });
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "sync-state.json"), JSON.stringify({
      schemaVersion: 1,
      workspace: "career-os",
      revision: "rev-old",
      contentDigest: (await buildWorkspaceDraft(fixture.workspaceRoot, producer)).manifest.contentDigest,
      files: (await buildWorkspaceDraft(fixture.workspaceRoot, producer)).manifest.files,
    }));
    await mkdir(path.join(fixture.workspaceRoot, "private"), { recursive: true });
    await writeFile(path.join(fixture.workspaceRoot, "private", "new.md"), "new");
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "prepare-journal.json"), JSON.stringify({
      schemaVersion: 1,
      workspace: "career-os",
      transactionId: "tx-new-root-crash",
      revision: "rev-old",
      status: "backed_up",
      roots: {
        applications: { hadOriginal: true, backupDone: true, applyDone: true },
        private: { hadOriginal: false, backupDone: true, applyDone: false },
        state: { hadOriginal: true, backupDone: true, applyDone: true },
      },
    }));
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync", "backup", "applications"), { recursive: true });
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync", "backup", "state"), { recursive: true });
    await createRemoteRelease(fixture, "rev-1", { "applications/remote.md": "remote" });

    await prepareWorkspace(makeContext(fixture));

    expect(await exists(path.join(fixture.workspaceRoot, "private", "new.md"))).toBe(false);
  }));

  test("prepare 교체 중 실패하면 즉시 rollback해 기존 root를 보존한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/old.md": "old" });
    await prepareWorkspace(makeContext(fixture));
    const brokenArchive = await createReleaseArchiveWithoutState(fixture, "rev-2", { "applications/new.md": "new" });
    await writeFile(path.join(fixture.storageRoot, "current"), "rev-2");

    await expect(prepareWorkspace(makeContext(fixture, new BadExportTransport(brokenArchive, "rev-2")))).rejects.toBeTruthy();

    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "old.md"), "utf8")).toBe("old");
    expect(await exists(path.join(fixture.workspaceRoot, "applications", "new.md"))).toBe(false);
  }));

  test("failed export는 local roots를 보존한다", async () => withFixture(async (fixture) => {
    await writeFile(path.join(fixture.workspaceRoot, "applications", "local.md"), "local");
    const syncStateDraft = await buildWorkspaceDraft(fixture.workspaceRoot, producer);
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync"), { recursive: true });
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "sync-state.json"), JSON.stringify({
      schemaVersion: 1,
      workspace: "career-os",
      revision: "rev-1",
      contentDigest: syncStateDraft.manifest.contentDigest,
      files: syncStateDraft.manifest.files,
    }));

    await expect(prepareWorkspace(makeContext(fixture, new FailingExportTransport()))).rejects.toMatchObject({
      result: { code: "TRANSFER_FAILED" },
    });
    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "local.md"), "utf8")).toBe("local");
  }));

  test("completed journal은 현재 hash가 sync-state와 맞으면 cleanup한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/resume.md": "resume" });
    await prepareWorkspace(makeContext(fixture));
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync", "staging"), { recursive: true });
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync", "backup"), { recursive: true });
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "prepare-journal.json"), JSON.stringify({
      schemaVersion: 1,
      workspace: "career-os",
      transactionId: "tx-completed",
      revision: "rev-1",
      status: "completed",
      roots: {
        applications: { hadOriginal: true, backupDone: true, applyDone: true },
        private: { hadOriginal: true, backupDone: true, applyDone: true },
        state: { hadOriginal: true, backupDone: true, applyDone: true },
      },
    }));

    await prepareWorkspace(makeContext(fixture));

    expect(await exists(path.join(fixture.workspaceRoot, ".career-sync", "prepare-journal.json"))).toBe(false);
  }));

  test("diff는 마지막 prepare 기준의 추가, 수정, 삭제를 요약한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", {
      "applications/delete.md": "delete",
      "applications/modify.md": "before",
    });
    await prepareWorkspace(makeContext(fixture));
    await rm(path.join(fixture.workspaceRoot, "applications", "delete.md"));
    await writeFile(path.join(fixture.workspaceRoot, "applications", "modify.md"), "after");
    await writeFile(path.join(fixture.workspaceRoot, "applications", "add.md"), "add");

    const result = await diffWorkspace(makeContext(fixture));

    expect(result).toMatchObject({
      added: ["applications/add.md"],
      modified: ["applications/modify.md"],
      deleted: ["applications/delete.md"],
    });
  }));

  test("publish는 원격 revision 충돌을 전달하고 로컬 결과를 보존한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/resume.md": "before" });
    await prepareWorkspace(makeContext(fixture));
    await createRemoteRelease(fixture, "rev-2", { "applications/resume.md": "remote" });
    await writeFile(path.join(fixture.workspaceRoot, "applications", "resume.md"), "local");

    await expect(publishWorkspace(makeContext(fixture))).rejects.toMatchObject({
      result: { code: "REVISION_CONFLICT" },
    });
    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "resume.md"), "utf8")).toBe("local");
  }));

  test("publish는 성공하면 sync-state를 새 revision으로 갱신한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/resume.md": "before" });
    await prepareWorkspace(makeContext(fixture));
    await writeFile(path.join(fixture.workspaceRoot, "applications", "resume.md"), "after");

    const result = await publishWorkspace(makeContext(fixture));

    expect(result).toMatchObject({ action: "publish", ok: true, noChange: false });
    const syncState = JSON.parse(await readFile(path.join(fixture.workspaceRoot, ".career-sync", "sync-state.json"), "utf8"));
    expect(syncState.revision).toBe(result.revision);
    expect(syncState.contentDigest).toBe(result.contentDigest);
  }));

  test("publish는 missing managed root를 빈 directory로 패키징한다", async () => withFixture(async (fixture) => {
    await rm(path.join(fixture.workspaceRoot, "private"), { recursive: true, force: true });
    await rm(path.join(fixture.workspaceRoot, "state"), { recursive: true, force: true });
    await writeFile(path.join(fixture.workspaceRoot, "applications", "resume.md"), "resume");

    const result = await publishWorkspace(makeContext(fixture));

    expect(result).toMatchObject({ action: "publish", ok: true });
  }));

  test("local publish의 잘못된 tar는 publish action 오류로 반환한다", async () => withFixture(async (fixture) => {
    const transport = new LocalCareerWorkspaceTransport(fixture.storageRoot);
    const archive = await createTarFromDirectory(fixture.workspaceRoot, ["applications"]);

    await expect(transport.publish(archive)).rejects.toMatchObject({
      result: { action: "publish", code: "INVALID_MANIFEST" },
    });
  }));

  test("CLI 프로세스는 성공 JSON을 stdout에, 오류 JSON을 stderr에만 쓴다", async () => withFixture(async (fixture) => {
    const cliPath = path.join(import.meta.dir, "cli.ts");
    const commonEnv = {
      ...process.env,
      CAREER_WORKSPACE_ROOT: fixture.workspaceRoot,
      CAREER_WORKSPACE_LOCAL_TRANSPORT_ROOT: fixture.storageRoot,
    };
    const ok = Bun.spawn(["bun", cliPath, "check"], {
      cwd: path.resolve(import.meta.dir, "../../.."),
      env: commonEnv,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [okStdout, okStderr, okExit] = await Promise.all([
      new Response(ok.stdout).text(),
      new Response(ok.stderr).text(),
      ok.exited,
    ]);
    expect(okExit).toBe(0);
    expect(JSON.parse(okStdout)).toMatchObject({ action: "check", ok: true });
    expect(okStderr).toBe("");

    const fail = Bun.spawn(["bun", cliPath, "prepare"], {
      cwd: path.resolve(import.meta.dir, "../../.."),
      env: commonEnv,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [failStdout, failStderr, failExit] = await Promise.all([
      new Response(fail.stdout).text(),
      new Response(fail.stderr).text(),
      fail.exited,
    ]);
    expect(failExit).toBe(1);
    expect(failStdout).toBe("");
    expect(JSON.parse(failStderr)).toMatchObject({ ok: false, code: "REMOTE_UNINITIALIZED" });
  }));

  test("테스트 fixture는 repo root의 storage/workspace 디렉터리에 누출되지 않는다", async () => {
    const repoRoot = path.resolve(import.meta.dir, "../../..");

    expect(await exists(path.join(repoRoot, "storage"))).toBe(false);
    expect(await exists(path.join(repoRoot, "workspace"))).toBe(false);
  });
});

class BadExportTransport implements CareerWorkspaceTransport {
  constructor(private readonly archive: Uint8Array, private readonly revision = "bad-rev") {}

  async status(): Promise<RemoteStatusResult> {
    return {
      schemaVersion: 1,
      action: "status",
      ok: true,
      workspace: "career-os",
      current: {
        revision: this.revision,
        contentDigest: "0".repeat(64),
        createdAt: "2026-08-28T00:00:00.000Z",
        fileCount: 0,
      },
    };
  }

  async export(): Promise<Uint8Array> {
    return this.archive;
  }

  async publish(): Promise<never> {
    throw new Error("not used");
  }
}

class FailingExportTransport implements CareerWorkspaceTransport {
  async status(): Promise<RemoteStatusResult> {
    return {
      schemaVersion: 1,
      action: "status",
      ok: true,
      workspace: "career-os",
      current: {
        revision: "rev-1",
        contentDigest: "0".repeat(64),
        createdAt: "2026-08-28T00:00:00.000Z",
        fileCount: 0,
      },
    };
  }

  async export(): Promise<never> {
    throw new TransportError({
      schemaVersion: 1,
      action: "export",
      ok: false,
      code: "TRANSFER_FAILED",
    });
  }

  async publish(): Promise<never> {
    throw new Error("not used");
  }
}

async function withFixture(run: (fixture: Fixture) => Promise<void>): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "career-cli-"));
  const fixture = {
    tempRoot,
    workspaceRoot: path.join(tempRoot, "workspace"),
    storageRoot: path.join(tempRoot, "storage"),
  };
  await createManagedRoots(fixture.workspaceRoot);
  try {
    await run(fixture);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function makeContext(
  fixture: Fixture,
  transport: CareerWorkspaceTransport = new LocalCareerWorkspaceTransport(fixture.storageRoot),
): CliContext {
  return { root: fixture.workspaceRoot, transport, producer };
}

async function createRemoteRelease(
  fixture: Fixture,
  revision: string,
  files: Record<string, string>,
  options: { corruptDigest?: boolean } = {},
) {
  const releaseRoot = path.join(fixture.storageRoot, "releases", revision);
  await createManagedRoots(releaseRoot);
  for (const [relativePath, body] of Object.entries(files)) {
    const target = path.join(releaseRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
  const draft = await buildWorkspaceDraft(releaseRoot, producer, { parentRevision: null });
  const manifest = CareerWorkspaceReleaseManifestSchema.parse({
    ...draft.manifest,
    revision,
    createdAt: "2026-08-28T00:00:00.000Z",
    contentDigest: options.corruptDigest ? "f".repeat(64) : draft.manifest.contentDigest,
  });
  await writeFile(path.join(releaseRoot, "workspace-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await mkdir(fixture.storageRoot, { recursive: true });
  await writeFile(path.join(fixture.storageRoot, "current"), revision);
}

async function createReleaseArchiveWithoutState(
  fixture: Fixture,
  revision: string,
  files: Record<string, string>,
): Promise<Uint8Array> {
  const releaseRoot = path.join(fixture.tempRoot, "broken-release");
  await mkdir(path.join(releaseRoot, "applications"), { recursive: true });
  await mkdir(path.join(releaseRoot, "private"), { recursive: true });
  for (const [relativePath, body] of Object.entries(files)) {
    const target = path.join(releaseRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
  const draft = await buildWorkspaceDraft(releaseRoot, producer, { parentRevision: null });
  const manifest = CareerWorkspaceReleaseManifestSchema.parse({
    ...draft.manifest,
    revision,
    createdAt: "2026-08-28T00:00:00.000Z",
  });
  await writeFile(path.join(releaseRoot, "workspace-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return createTarFromDirectory(releaseRoot, ["workspace-manifest.json", "applications", "private"]);
}

async function createManagedRoots(root: string) {
  for (const managedRoot of CAREER_WORKSPACE_MANAGED_ROOTS) {
    await mkdir(path.join(root, managedRoot), { recursive: true });
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}
