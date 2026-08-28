import { describe, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, readlink, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CareerWorkspaceReleaseManifestSchema, type RemoteStatusResult } from "./contracts.ts";
import { createManagedRoots, writeFixtureRelease } from "./fixtures/filesystem-storage.ts";
import { buildWorkspaceDraft } from "./manifest.ts";
import { LocalCareerWorkspaceTransport } from "./local-transport.ts";
import { switchCurrentSymlink } from "./local-transport.ts";
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

  test("fixture storage는 immutable release와 상대 current symlink를 사용한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/resume.md": "resume" });

    const currentPath = path.join(fixture.storageRoot, "current");
    expect((await lstat(currentPath)).isSymbolicLink()).toBe(true);
    expect(await readlink(currentPath)).toBe("releases/rev-1");
  }));

  test.each(["plain-file", "broken-link", "revision-mismatch"] as const)(
    "fixture storage는 잘못된 current(%s)를 초기화 전 상태로 숨기지 않는다",
    async (variant) => withFixture(async (fixture) => {
      await mkdir(fixture.storageRoot, { recursive: true });
      if (variant === "plain-file") {
        await writeFile(path.join(fixture.storageRoot, "current"), "rev-1");
      } else if (variant === "broken-link") {
        await symlink("releases/missing", path.join(fixture.storageRoot, "current"));
      } else {
        await createRemoteRelease(fixture, "rev-1", { "applications/resume.md": "resume" });
        const manifestPath = path.join(fixture.storageRoot, "releases", "rev-1", "workspace-manifest.json");
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        await writeFile(manifestPath, JSON.stringify({ ...manifest, revision: "rev-other" }));
      }

      await expect(new LocalCareerWorkspaceTransport(fixture.storageRoot).status()).rejects.toMatchObject({
        result: { action: "status", code: "INVALID_MANIFEST" },
      });
    }),
  );

  test("두 독립 client가 HTML/PDF 포함 같은 revision, manifest, 전체 hash를 재현한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", {
      "applications/toss/application-package.html": "<html><body>review</body></html>",
      "applications/toss/submission.pdf": "%PDF-1.4\n",
      "private/toss/evidence.md": "evidence",
      "state/drill-progress.json": "{}",
    });
    const first = { ...fixture, workspaceRoot: path.join(fixture.tempRoot, "client-a") };
    const second = { ...fixture, workspaceRoot: path.join(fixture.tempRoot, "client-b") };
    await createManagedRoots(first.workspaceRoot);
    await createManagedRoots(second.workspaceRoot);

    const firstResult = await prepareWorkspace(makeContext(first));
    const secondResult = await prepareWorkspace(makeContext(second));
    const firstDraft = await buildWorkspaceDraft(first.workspaceRoot, producer, { parentRevision: firstResult.revision });
    const secondDraft = await buildWorkspaceDraft(second.workspaceRoot, producer, { parentRevision: secondResult.revision });

    expect(firstResult.revision).toBe("rev-1");
    expect(secondResult.revision).toBe("rev-1");
    expect(secondDraft.manifest.contentDigest).toBe(firstDraft.manifest.contentDigest);
    expect(secondDraft.manifest.files).toEqual(firstDraft.manifest.files);
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

  test("prepare는 계약 top-level root가 빠진 tar를 거부하고 기존 파일을 보존한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/local.md": "local" });
    await prepareWorkspace(makeContext(fixture));
    const archive = await createReleaseArchiveWithoutState(fixture, "rev-2", { "applications/remote.md": "remote" });

    await expect(prepareWorkspace(makeContext(fixture, new BadExportTransport(archive, "rev-2")))).rejects.toMatchObject({
      result: { action: "prepare", code: "INVALID_MANIFEST" },
    });
    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "local.md"), "utf8")).toBe("local");
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

  test.each(["started", "staged", "restoring"] as const)(
    "prepare는 %s journal 재실행을 정리하고 새 release를 적용한다",
    async (status) => withFixture(async (fixture) => {
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
      if (status === "staged") {
        await mkdir(path.join(fixture.workspaceRoot, ".career-sync", "staging", "applications"), { recursive: true });
      }
      await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "prepare-journal.json"), JSON.stringify({
        schemaVersion: 1,
        workspace: "career-os",
        transactionId: `tx-${status}`,
        revision: "rev-old",
        status,
        roots: {
          applications: { hadOriginal: false, backupDone: false, applyDone: false },
          private: { hadOriginal: false, backupDone: false, applyDone: false },
          state: { hadOriginal: false, backupDone: false, applyDone: false },
        },
      }));
      await createRemoteRelease(fixture, "rev-1", { "applications/remote.md": "remote" });

      await prepareWorkspace(makeContext(fixture));

      expect(await readFile(path.join(fixture.workspaceRoot, "applications", "remote.md"), "utf8")).toBe("remote");
      expect(await exists(path.join(fixture.workspaceRoot, ".career-sync", "prepare-journal.json"))).toBe(false);
    }),
  );

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
    await switchCurrentSymlink(fixture.storageRoot, "rev-2");

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

  test("truncated export는 local roots와 remote current를 보존한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/local.md": "local" });
    await prepareWorkspace(makeContext(fixture));
    const beforeCurrent = await readlink(path.join(fixture.storageRoot, "current"));
    const marker = `TRUNCATE-MARKER-${"x".repeat(4096)}`;
    await createRemoteRelease(fixture, "rev-2", { "state/large.txt": marker });
    const fullArchive = await new LocalCareerWorkspaceTransport(fixture.storageRoot).export("rev-2");
    await switchCurrentSymlink(fixture.storageRoot, "rev-1");
    const markerOffset = findBytes(fullArchive, new TextEncoder().encode("TRUNCATE-MARKER-"));
    expect(markerOffset).toBeGreaterThan(0);
    const truncated = fullArchive.subarray(0, markerOffset + 64);

    await expect(prepareWorkspace(makeContext(fixture, new BadExportTransport(truncated, "rev-2")))).rejects.toMatchObject({
      result: { action: "prepare", code: "TRANSFER_FAILED" },
    });

    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "local.md"), "utf8")).toBe("local");
    expect(await readlink(path.join(fixture.storageRoot, "current"))).toBe(beforeCurrent);
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

  test("sync-state 반영 뒤 남은 applied journal은 새 작업본을 rollback하지 않고 cleanup한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/new.md": "new" });
    await prepareWorkspace(makeContext(fixture));
    await mkdir(path.join(fixture.workspaceRoot, ".career-sync", "backup", "applications"), { recursive: true });
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "backup", "applications", "old.md"), "old");
    await writeFile(path.join(fixture.workspaceRoot, ".career-sync", "prepare-journal.json"), JSON.stringify({
      schemaVersion: 1,
      workspace: "career-os",
      transactionId: "tx-sync-state-committed",
      revision: "rev-1",
      status: "applied",
      roots: {
        applications: { hadOriginal: true, backupDone: true, applyDone: true },
        private: { hadOriginal: true, backupDone: true, applyDone: true },
        state: { hadOriginal: true, backupDone: true, applyDone: true },
      },
    }));

    await prepareWorkspace(makeContext(fixture));

    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "new.md"), "utf8")).toBe("new");
    expect(await exists(path.join(fixture.workspaceRoot, "applications", "old.md"))).toBe(false);
    expect(await exists(path.join(fixture.workspaceRoot, ".career-sync", "backup"))).toBe(false);
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

  test("publish revision collision은 기존 release와 current를 보존한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/resume.md": "before" });
    await prepareWorkspace(makeContext(fixture));
    await writeFile(path.join(fixture.workspaceRoot, "applications", "resume.md"), "after");
    const transport = new LocalCareerWorkspaceTransport(fixture.storageRoot, { revisionFactory: () => "rev-1" });

    await expect(publishWorkspace(makeContext(fixture, transport))).rejects.toMatchObject({
      result: { code: "REVISION_CONFLICT" },
    });
    expect(await readFile(path.join(fixture.storageRoot, "releases", "rev-1", "applications", "resume.md"), "utf8")).toBe("before");
    expect(await readlink(path.join(fixture.storageRoot, "current"))).toBe("releases/rev-1");
  }));

  test("publish 전송 실패는 로컬 변경과 remote current를 보존한다", async () => withFixture(async (fixture) => {
    await createRemoteRelease(fixture, "rev-1", { "applications/resume.md": "before" });
    await prepareWorkspace(makeContext(fixture));
    await writeFile(path.join(fixture.workspaceRoot, "applications", "resume.md"), "local-change");
    const beforeCurrent = await readlink(path.join(fixture.storageRoot, "current"));
    const transport = new FailingPublishTransport(new LocalCareerWorkspaceTransport(fixture.storageRoot));

    await expect(publishWorkspace(makeContext(fixture, transport))).rejects.toMatchObject({
      result: { action: "publish", code: "TRANSFER_FAILED" },
    });

    expect(await readFile(path.join(fixture.workspaceRoot, "applications", "resume.md"), "utf8")).toBe("local-change");
    expect(await readlink(path.join(fixture.storageRoot, "current"))).toBe(beforeCurrent);
    const syncState = JSON.parse(await readFile(path.join(fixture.workspaceRoot, ".career-sync", "sync-state.json"), "utf8"));
    expect(syncState.revision).toBe("rev-1");
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

  test("CLI help와 error는 환경 host/account/key path와 파일 본문을 노출하지 않는다", async () => withFixture(async (fixture) => {
    const cliPath = path.join(import.meta.dir, "cli.ts");
    await writeFile(path.join(fixture.workspaceRoot, "applications", "secret-body.md"), "file-body-secret");
    const secretEnv = {
      ...process.env,
      CAREER_WORKSPACE_ROOT: fixture.workspaceRoot,
      CAREER_WORKSPACE_SSH_TARGET: "account@example.internal",
      CAREER_WORKSPACE_SSH_ARGS: "-i /private/key/path",
      CAREER_WORKSPACE_REMOTE_COMMAND: "career-storage",
    };
    const help = Bun.spawn(["bun", cliPath, "help"], {
      cwd: path.resolve(import.meta.dir, "../../.."),
      env: secretEnv,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [helpStdout, helpStderr] = await Promise.all([
      new Response(help.stdout).text(),
      new Response(help.stderr).text(),
      help.exited,
    ]);
    const helpOutput = `${helpStdout}${helpStderr}`;
    expect(helpOutput).not.toContain("example.internal");
    expect(helpOutput).not.toContain("/private/key/path");
    expect(helpOutput).not.toContain("file-body-secret");

    const error = Bun.spawn(["bun", cliPath, "unknown"], {
      cwd: path.resolve(import.meta.dir, "../../.."),
      env: secretEnv,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [errorStdout, errorStderr] = await Promise.all([
      new Response(error.stdout).text(),
      new Response(error.stderr).text(),
      error.exited,
    ]);
    const errorOutput = `${errorStdout}${errorStderr}`;
    expect(errorOutput).not.toContain("example.internal");
    expect(errorOutput).not.toContain("/private/key/path");
    expect(errorOutput).not.toContain("file-body-secret");
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

class FailingPublishTransport implements CareerWorkspaceTransport {
  constructor(private readonly delegate: CareerWorkspaceTransport) {}

  status() {
    return this.delegate.status();
  }

  export(revision: string) {
    return this.delegate.export(revision);
  }

  async publish(): Promise<never> {
    throw new TransportError({
      schemaVersion: 1,
      action: "publish",
      ok: false,
      code: "TRANSFER_FAILED",
    });
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
  if (!options.corruptDigest) {
    await writeFixtureRelease(fixture.storageRoot, revision, producer, files);
    return;
  }
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
  await switchCurrentSymlink(fixture.storageRoot, revision);
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

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function findBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let offset = 0; offset <= haystack.byteLength - needle.byteLength; offset += 1) {
    for (let index = 0; index < needle.byteLength; index += 1) {
      if (haystack[offset + index] !== needle[index]) {
        continue outer;
      }
    }
    return offset;
  }
  return -1;
}
