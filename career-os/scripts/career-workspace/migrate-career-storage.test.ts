import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, readdir, readlink, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CareerWorkspaceProducer } from "./contracts.ts";
import { writeFixtureRelease } from "./fixtures/filesystem-storage.ts";
import { migrateCareerStorage, runMigrateCareerStorage } from "./migrate-career-storage.ts";
import { S3ObjectStoreError, type S3ObjectStore } from "./s3-object-store.ts";
import { S3CareerWorkspaceTransport } from "./s3-storage.ts";

const producer: CareerWorkspaceProducer = {
  skill: "migration-test",
  mode: "automation",
};
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("career storage migration", () => {
  test("현재 파일 release를 검증해 revision과 생성 시각을 보존하고 pointer를 마지막에 쓴다", async () => {
    const sourceRoot = await createSource("rev-legacy", {
      "applications/acme/resume.md": "검증된 이력서\n",
      "library/profile.md": "프로필\n",
    });
    const sourceBefore = await snapshotTree(sourceRoot);
    const store = new MemoryS3ObjectStore();

    const result = await runMigrateCareerStorage(["--source", sourceRoot], { objectStore: store });

    expect(result).toMatchObject({
      schemaVersion: 1,
      action: "migrate",
      ok: true,
      revision: "rev-legacy",
      fileCount: 2,
      noChange: false,
      pointerWritten: true,
    });
    expect(result.destinationArchiveSha256).toBe(result.sourceArchiveSha256);
    expect(store.successfulWrites.map((write) => write.key)).toEqual([
      "releases/rev-legacy/workspace.tar",
      "releases/rev-legacy/workspace-manifest.json",
      "releases/rev-legacy/release.json",
      "pointers/current.json",
    ]);
    expect((await new S3CareerWorkspaceTransport(store).status()).current).toMatchObject({
      revision: "rev-legacy",
      createdAt: "2026-08-28T00:00:00.000Z",
      fileCount: 2,
    });
    expect(await snapshotTree(sourceRoot)).toEqual(sourceBefore);
  });

  test("같은 release 재실행은 객체와 pointer를 다시 쓰지 않는다", async () => {
    const sourceRoot = await createSource("rev-repeat", { "state/progress.json": "{}\n" });
    const sourceBefore = await snapshotTree(sourceRoot);
    const store = new MemoryS3ObjectStore();
    await migrateCareerStorage(sourceRoot, store);
    const writesBefore = store.successfulWrites.length;

    const result = await migrateCareerStorage(sourceRoot, store);

    expect(result).toMatchObject({
      revision: "rev-repeat",
      noChange: true,
      pointerWritten: false,
    });
    expect(store.successfulWrites).toHaveLength(writesBefore);
    expect(await snapshotTree(sourceRoot)).toEqual(sourceBefore);
  });

  test("다른 current pointer가 있으면 source와 target을 변경하지 않는다", async () => {
    const existingRoot = await createSource("rev-existing", { "state/existing.json": "1\n" });
    const incomingRoot = await createSource("rev-incoming", { "state/incoming.json": "2\n" });
    const sourceBefore = await snapshotTree(incomingRoot);
    const store = new MemoryS3ObjectStore();
    await migrateCareerStorage(existingRoot, store);
    const targetBefore = store.snapshot();

    await expect(migrateCareerStorage(incomingRoot, store)).rejects.toMatchObject({
      result: { action: "migrate", code: "REVISION_CONFLICT" },
    });
    expect(store.snapshot()).toEqual(targetBefore);
    expect(await snapshotTree(incomingRoot)).toEqual(sourceBefore);
  });

  test("같은 current pointer라도 immutable 객체가 빠졌으면 복구 쓰기 없이 충돌한다", async () => {
    const sourceRoot = await createSource("rev-incomplete", { "state/progress.json": "{}\n" });
    const store = new MemoryS3ObjectStore();
    await migrateCareerStorage(sourceRoot, store);
    store.remove("releases/rev-incomplete/workspace.tar");
    const targetBefore = store.snapshot();
    const writesBefore = store.successfulWrites.length;

    await expect(migrateCareerStorage(sourceRoot, store)).rejects.toMatchObject({
      result: { action: "migrate", code: "REVISION_CONFLICT" },
    });
    expect(store.snapshot()).toEqual(targetBefore);
    expect(store.successfulWrites).toHaveLength(writesBefore);
  });

  test("같은 immutable key에 다른 byte가 있으면 덮어쓰지 않는다", async () => {
    const sourceRoot = await createSource("rev-collision", { "applications/acme/resume.md": "source\n" });
    const sourceBefore = await snapshotTree(sourceRoot);
    const store = new MemoryS3ObjectStore();
    const collision = new TextEncoder().encode("different");
    await store.write("releases/rev-collision/workspace.tar", collision, "application/x-tar");
    const writesBefore = store.successfulWrites.length;

    await expect(migrateCareerStorage(sourceRoot, store)).rejects.toMatchObject({
      result: { action: "migrate", code: "REVISION_CONFLICT" },
    });
    expect(store.successfulWrites).toHaveLength(writesBefore);
    expect(store.get("releases/rev-collision/workspace.tar")).toEqual(collision);
    expect(await snapshotTree(sourceRoot)).toEqual(sourceBefore);
  });

  test("pointer 쓰기 실패 뒤 immutable 객체를 보존하고 재실행으로 pointer만 쓴다", async () => {
    const sourceRoot = await createSource("rev-recover", { "library/profile.md": "recover\n" });
    const sourceBefore = await snapshotTree(sourceRoot);
    const store = new MemoryS3ObjectStore();
    store.failWriteAt(4);

    await expect(migrateCareerStorage(sourceRoot, store)).rejects.toMatchObject({
      result: { action: "migrate", code: "TRANSFER_FAILED" },
    });
    expect(store.has("releases/rev-recover/workspace.tar")).toBe(true);
    expect(store.has("releases/rev-recover/workspace-manifest.json")).toBe(true);
    expect(store.has("releases/rev-recover/release.json")).toBe(true);
    expect(store.has("pointers/current.json")).toBe(false);

    store.stopFailingWrites();
    const result = await migrateCareerStorage(sourceRoot, store);
    expect(result).toMatchObject({ noChange: true, pointerWritten: true });
    expect(store.successfulWrites.at(-1)?.key).toBe("pointers/current.json");
    expect(await snapshotTree(sourceRoot)).toEqual(sourceBefore);
  });

  test("손상된 원본 manifest를 거부하고 target을 비운 채 원본을 보존한다", async () => {
    const sourceRoot = await createSource("rev-invalid", { "state/progress.json": "{}\n" });
    await writeFile(
      path.join(sourceRoot, "releases", "rev-invalid", "workspace-manifest.json"),
      "{\"invalid\":true}\n",
    );
    const sourceBefore = await snapshotTree(sourceRoot);
    const store = new MemoryS3ObjectStore();

    await expect(migrateCareerStorage(sourceRoot, store)).rejects.toMatchObject({
      result: { action: "migrate", code: "INVALID_MANIFEST" },
    });
    expect(store.snapshot()).toEqual([]);
    expect(await snapshotTree(sourceRoot)).toEqual(sourceBefore);
  });

  test("source 인자가 없으면 구조화한 migrate 오류를 반환한다", async () => {
    await expect(runMigrateCareerStorage([], { objectStore: new MemoryS3ObjectStore() })).rejects.toMatchObject({
      result: { action: "migrate", code: "INVALID_MANIFEST" },
    });
  });

  test("명령 프로세스는 오류 JSON을 stderr에만 기록한다", async () => {
    const proc = Bun.spawn(["bun", path.join(import.meta.dir, "migrate-career-storage.ts")], {
      env: { PATH: process.env.PATH },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(JSON.parse(stderr)).toEqual({
      schemaVersion: 1,
      action: "migrate",
      ok: false,
      code: "INVALID_MANIFEST",
    });
  });
});

class MemoryS3ObjectStore implements S3ObjectStore {
  readonly successfulWrites: Array<{ key: string; contentType: string }> = [];
  private readonly objects = new Map<string, Uint8Array>();
  private writeAttempts = 0;
  private failingWriteAttempt: number | undefined;

  async read(key: string): Promise<Uint8Array> {
    const body = this.objects.get(key);
    if (body === undefined) {
      throw new S3ObjectStoreError("transfer");
    }
    return body.slice();
  }

  async write(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.writeAttempts += 1;
    if (this.writeAttempts === this.failingWriteAttempt) {
      throw new S3ObjectStoreError("transfer");
    }
    this.objects.set(key, body.slice());
    this.successfulWrites.push({ key, contentType });
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  failWriteAt(attempt: number): void {
    this.failingWriteAttempt = attempt;
  }

  stopFailingWrites(): void {
    this.failingWriteAttempt = undefined;
  }

  get(key: string): Uint8Array {
    const body = this.objects.get(key);
    if (body === undefined) {
      throw new Error("missing fixture object");
    }
    return body.slice();
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }

  remove(key: string): void {
    this.objects.delete(key);
  }

  snapshot(): Array<[string, string]> {
    return [...this.objects.entries()]
      .map(([key, body]) => [key, sha256(body)] as [string, string])
      .toSorted(([left], [right]) => left.localeCompare(right));
  }
}

async function createSource(revision: string, files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "career-migration-source-"));
  temporaryRoots.push(root);
  await writeFixtureRelease(root, revision, producer, files);
  return root;
}

async function snapshotTree(root: string, relative = ""): Promise<Array<[string, string, string]>> {
  const absolute = path.join(root, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  const snapshot: Array<[string, string, string]> = [];
  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const entryRelative = relative ? path.join(relative, entry.name) : entry.name;
    const entryAbsolute = path.join(root, entryRelative);
    const entryStat = await lstat(entryAbsolute);
    const normalized = entryRelative.split(path.sep).join("/");
    if (entryStat.isSymbolicLink()) {
      snapshot.push([normalized, "symlink", await readlink(entryAbsolute)]);
    } else if (entryStat.isDirectory()) {
      snapshot.push([normalized, "directory", ""]);
      snapshot.push(...await snapshotTree(root, entryRelative));
    } else if (entryStat.isFile()) {
      snapshot.push([normalized, "file", sha256(new Uint8Array(await readFile(entryAbsolute)))]);
    }
  }
  return snapshot;
}

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}
