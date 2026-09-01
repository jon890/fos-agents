import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildWorkspaceDraft } from "./manifest.ts";
import { createTarFromDirectory, extractTarToDirectory } from "./tar-utils.ts";

const script = path.join(import.meta.dir, "career-storage.py");
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("career-storage", () => {
  test("빈 저장소 status와 최초 publish, export를 같은 계약으로 제공한다", async () => {
    const fixture = await createFixture();
    const status = await runStorage(fixture.storageRoot, ["status"]);
    expect(status.exitCode).toBe(0);
    expect(JSON.parse(status.stdout)).toEqual({
      schemaVersion: 1,
      action: "status",
      ok: true,
      workspace: "career-os",
      current: null,
    });

    const draft = await buildWorkspaceDraft(
      fixture.workspaceRoot,
      { skill: "career-storage-test", mode: "interactive" },
      { parentRevision: null },
    );
    await writeFile(path.join(fixture.workspaceRoot, "workspace-draft.json"), `${JSON.stringify(draft.manifest, null, 2)}\n`);
    const archive = await createTarFromDirectory(fixture.workspaceRoot, ["workspace-draft.json", "applications", "library", "state"]);
    const published = await runStorage(fixture.storageRoot, ["publish"], archive);
    expect(published.exitCode).toBe(0);
    const result = JSON.parse(published.stdout);
    expect(result).toMatchObject({
      schemaVersion: 1,
      action: "publish",
      ok: true,
      contentDigest: draft.manifest.contentDigest,
      fileCount: 2,
      noChange: false,
    });

    const exportResult = await runStorage(fixture.storageRoot, ["export", "--revision", result.revision]);
    expect(exportResult.exitCode).toBe(0);
    const restored = await createTemporaryRoot("career-storage-restored-");
    await extractTarToDirectory(
      new Uint8Array(exportResult.stdoutBytes),
      restored,
      ["workspace-manifest.json", "applications", "library", "state"],
      "prepare",
    );
    expect(await readFile(path.join(restored, "applications/acme/role/resume.md"), "utf8")).toBe("검증된 이력서\n");
    expect(await readFile(path.join(restored, "state/drill-progress.json"), "utf8")).toBe("{}\n");
  });

  test("같은 digest는 새 release를 만들지 않고 오래된 parent는 거절한다", async () => {
    const fixture = await createFixture();
    const first = await publishWorkspace(fixture, null);
    const currentRevision = JSON.parse(first.stdout).revision as string;
    const noChange = await publishWorkspace(fixture, currentRevision);
    expect(JSON.parse(noChange.stdout)).toMatchObject({ revision: currentRevision, noChange: true });

    await writeFile(path.join(fixture.workspaceRoot, "state/drill-progress.json"), "{\"attempts\":1}\n");
    const conflict = await publishWorkspace(fixture, null);
    expect(conflict.exitCode).toBe(1);
    expect(JSON.parse(conflict.stderr)).toEqual({
      schemaVersion: 1,
      action: "publish",
      ok: false,
      code: "REVISION_CONFLICT",
    });
  });

  test("manifest와 다른 파일을 포함한 archive를 거절한다", async () => {
    const fixture = await createFixture();
    const draft = await buildWorkspaceDraft(fixture.workspaceRoot, { skill: "test", mode: "interactive" });
    await writeFile(path.join(fixture.workspaceRoot, "workspace-draft.json"), `${JSON.stringify(draft.manifest)}\n`);
    await writeFile(path.join(fixture.workspaceRoot, "library/unlisted.md"), "manifest 이후 추가\n");
    const archive = await createTarFromDirectory(fixture.workspaceRoot, ["workspace-draft.json", "applications", "library", "state"]);
    const result = await runStorage(fixture.storageRoot, ["publish"], archive);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr).code).toBe("INVALID_MANIFEST");
  });
});

interface Fixture {
  storageRoot: string;
  workspaceRoot: string;
}

async function createFixture(): Promise<Fixture> {
  const storageRoot = await createTemporaryRoot("career-storage-remote-");
  const workspaceRoot = await createTemporaryRoot("career-storage-workspace-");
  await mkdir(path.join(workspaceRoot, "applications/acme/role"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "library"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "state"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "applications/acme/role/resume.md"), "검증된 이력서\n");
  await writeFile(path.join(workspaceRoot, "state/drill-progress.json"), "{}\n");
  return { storageRoot, workspaceRoot };
}

async function publishWorkspace(fixture: Fixture, parentRevision: string | null) {
  const draft = await buildWorkspaceDraft(
    fixture.workspaceRoot,
    { skill: "career-storage-test", mode: "interactive" },
    { parentRevision },
  );
  await writeFile(path.join(fixture.workspaceRoot, "workspace-draft.json"), `${JSON.stringify(draft.manifest, null, 2)}\n`);
  const archive = await createTarFromDirectory(fixture.workspaceRoot, ["workspace-draft.json", "applications", "library", "state"]);
  return runStorage(fixture.storageRoot, ["publish"], archive);
}

async function runStorage(storageRoot: string, args: string[], stdin?: Uint8Array) {
  const process = Bun.spawn(["python3", script, ...args], {
    env: { ...Bun.env, CAREER_STORAGE_ROOT: storageRoot },
    stdin: stdin ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (stdin && process.stdin) {
    process.stdin.write(stdin);
    process.stdin.end();
  }
  const [stdoutBytes, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).arrayBuffer(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  return {
    exitCode,
    stdout: new TextDecoder().decode(stdoutBytes),
    stdoutBytes,
    stderr,
  };
}

async function createTemporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}
