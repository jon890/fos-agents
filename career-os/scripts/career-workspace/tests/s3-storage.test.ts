import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  CAREER_WORKSPACE_MANAGED_ROOTS,
  type CareerWorkspaceProducer,
} from "../contracts.ts";
import { buildWorkspaceDraft } from "../manifest.ts";
import {
  createS3ObjectStoreFromEnvironment,
  S3ObjectStoreError,
  type S3ObjectStore,
} from "../s3-object-store.ts";
import {
  CareerStoragePointerSchema,
  CareerStorageReleaseDescriptorSchema,
} from "../s3-storage-contracts.ts";
import { S3CareerWorkspaceTransport } from "../s3-storage.ts";
import { createTarFromDirectory, safeRemove } from "../tar-utils.ts";

const producer: CareerWorkspaceProducer = {
  skill: "application-package-writer",
  mode: "interactive",
};

describe("S3 career workspace storage", () => {
  test("빈 bucket status는 current null을 반환한다", async () => {
    const transport = createTransport(new MemoryS3ObjectStore(), ["rev-1"]);

    expect(await transport.status()).toEqual({
      schemaVersion: 1,
      action: "status",
      ok: true,
      workspace: "career-os",
      current: null,
    });
  });

  test("첫 publish는 불변 객체를 순서대로 검증한 뒤 current pointer를 쓴다", async () => {
    const store = new MemoryS3ObjectStore();
    const transport = createTransport(store, ["rev-1"]);
    const draft = await makeDraftArchive(null, { "applications/acme/resume.md": "first" });
    try {
      const result = await transport.publish(draft.archive);

      expect(result).toEqual({
        schemaVersion: 1,
        action: "publish",
        ok: true,
        revision: "rev-1",
        contentDigest: draft.contentDigest,
        createdAt: "2026-09-03T00:00:00.000Z",
        fileCount: 1,
        noChange: false,
      });
      expect(store.successfulWrites.map((write) => [write.key, write.contentType])).toEqual([
        ["releases/rev-1/workspace.tar", "application/x-tar"],
        ["releases/rev-1/workspace-manifest.json", "application/json"],
        ["releases/rev-1/release.json", "application/json"],
        ["pointers/current.json", "application/json"],
      ]);
      expect((await transport.status()).current).toEqual({
        revision: "rev-1",
        contentDigest: draft.contentDigest,
        createdAt: "2026-09-03T00:00:00.000Z",
        fileCount: 1,
      });
      expect(await transport.export("rev-1")).toEqual(store.get("releases/rev-1/workspace.tar"));
    } finally {
      await draft.cleanup();
    }
  });

  test("현재 revision을 부모로 한 같은 contentDigest publish는 새 객체를 만들지 않는다", async () => {
    const store = new MemoryS3ObjectStore();
    const transport = createTransport(store, ["rev-1", "rev-2"]);
    const first = await makeDraftArchive(null, { "library/profile.md": "same" });
    const unchanged = await makeDraftArchive("rev-1", { "library/profile.md": "same" });
    try {
      await transport.publish(first.archive);
      const writesBefore = store.successfulWrites.length;

      expect(await transport.publish(unchanged.archive)).toEqual({
        schemaVersion: 1,
        action: "publish",
        ok: true,
        revision: "rev-1",
        contentDigest: first.contentDigest,
        createdAt: "2026-09-03T00:00:00.000Z",
        fileCount: 1,
        noChange: true,
      });
      expect(store.successfulWrites).toHaveLength(writesBefore);
      expect(store.has("releases/rev-2/release.json")).toBe(false);
    } finally {
      await first.cleanup();
      await unchanged.cleanup();
    }
  });

  test("부모 revision이 current와 다르면 contentDigest가 같아도 충돌한다", async () => {
    const store = new MemoryS3ObjectStore();
    const transport = createTransport(store, ["rev-1", "rev-2"]);
    const first = await makeDraftArchive(null, { "state/drill.json": "same" });
    const stale = await makeDraftArchive(null, { "state/drill.json": "same" });
    try {
      await transport.publish(first.archive);

      await expect(transport.publish(stale.archive)).rejects.toMatchObject({
        result: { action: "publish", code: "REVISION_CONFLICT" },
      });
      expect(store.has("releases/rev-2/release.json")).toBe(false);
    } finally {
      await first.cleanup();
      await stale.cleanup();
    }
  });

  test("손상된 pointer와 descriptor-manifest 불일치를 INVALID_MANIFEST로 거부한다", async () => {
    const pointerStore = new MemoryS3ObjectStore();
    const pointerTransport = createTransport(pointerStore, ["rev-pointer"]);
    const pointerDraft = await makeDraftArchive(null, { "applications/a.md": "a" });
    const manifestStore = new MemoryS3ObjectStore();
    const manifestTransport = createTransport(manifestStore, ["rev-manifest"]);
    const manifestDraft = await makeDraftArchive(null, { "applications/b.md": "b" });
    try {
      await pointerTransport.publish(pointerDraft.archive);
      pointerStore.overwrite("pointers/current.json", jsonBytes({ bad: true }));
      await expect(pointerTransport.status()).rejects.toMatchObject({
        result: { action: "status", code: "INVALID_MANIFEST" },
      });

      await manifestTransport.publish(manifestDraft.archive);
      manifestStore.overwrite("releases/rev-manifest/workspace-manifest.json", jsonBytes({ bad: true }));
      await expect(manifestTransport.status()).rejects.toMatchObject({
        result: { action: "status", code: "INVALID_MANIFEST" },
      });
    } finally {
      await pointerDraft.cleanup();
      await manifestDraft.cleanup();
    }
  });

  test("손상된 archive는 descriptor hash 검증에서 거부한다", async () => {
    const store = new MemoryS3ObjectStore();
    const transport = createTransport(store, ["rev-1"]);
    const draft = await makeDraftArchive(null, { "applications/acme/resume.md": "original" });
    try {
      await transport.publish(draft.archive);
      store.overwrite("releases/rev-1/workspace.tar", new TextEncoder().encode("corrupt"));

      await expect(transport.export("rev-1")).rejects.toMatchObject({
        result: { action: "export", code: "INVALID_MANIFEST" },
      });
    } finally {
      await draft.cleanup();
    }
  });

  test("descriptor hash가 맞아도 archive 내부 파일 hash가 다르면 export를 거부한다", async () => {
    const store = new MemoryS3ObjectStore();
    const transport = createTransport(store, ["rev-1"]);
    const draft = await makeDraftArchive(null, { "applications/acme/resume.md": "original" });
    let corruptArchiveRoot: string | undefined;
    try {
      await transport.publish(draft.archive);
      const corruptRelease = await makeReleaseArchive(
        store.get("releases/rev-1/workspace-manifest.json"),
        { "applications/acme/resume.md": "changed" },
      );
      corruptArchiveRoot = corruptRelease.root;
      const descriptor = JSON.parse(new TextDecoder().decode(store.get("releases/rev-1/release.json")));
      store.overwrite("releases/rev-1/workspace.tar", corruptRelease.archive);
      store.overwrite("releases/rev-1/release.json", jsonBytes({
        ...descriptor,
        archiveSha256: sha256(corruptRelease.archive),
      }));

      await expect(transport.export("rev-1")).rejects.toMatchObject({
        result: { action: "export", code: "INVALID_MANIFEST" },
      });
    } finally {
      await draft.cleanup();
      if (corruptArchiveRoot !== undefined) {
        await safeRemove(corruptArchiveRoot);
      }
    }
  });

  test("이미 존재하는 revision의 release 객체를 덮어쓰지 않는다", async () => {
    const store = new MemoryS3ObjectStore();
    const transport = createTransport(store, ["rev-1", "rev-1"]);
    const first = await makeDraftArchive(null, { "state/one.json": "one" });
    const second = await makeDraftArchive("rev-1", { "state/two.json": "two" });
    try {
      await transport.publish(first.archive);
      const originalDescriptor = store.get("releases/rev-1/release.json");

      await expect(transport.publish(second.archive)).rejects.toMatchObject({
        result: { action: "publish", code: "REVISION_CONFLICT" },
      });
      expect(store.get("releases/rev-1/release.json")).toEqual(originalDescriptor);
      expect((await transport.status()).current?.contentDigest).toBe(first.contentDigest);
    } finally {
      await first.cleanup();
      await second.cleanup();
    }
  });

  test("pointer 쓰기 실패는 이전 status를 유지하고 이미 쓴 release를 export할 수 있다", async () => {
    const store = new MemoryS3ObjectStore();
    const transport = createTransport(store, ["rev-1", "rev-2"]);
    const first = await makeDraftArchive(null, { "library/profile.md": "first" });
    const second = await makeDraftArchive("rev-1", { "library/profile.md": "second" });
    try {
      await transport.publish(first.archive);
      store.failWriteAt(store.writeAttempts.length + 4);

      await expect(transport.publish(second.archive)).rejects.toMatchObject({
        result: { action: "publish", code: "TRANSFER_FAILED" },
      });
      expect(store.writeAttempts.at(-1)).toBe("pointers/current.json");
      expect(store.has("releases/rev-2/workspace.tar")).toBe(true);
      expect(store.has("releases/rev-2/workspace-manifest.json")).toBe(true);
      expect(store.has("releases/rev-2/release.json")).toBe(true);
      expect((await transport.status()).current?.revision).toBe("rev-1");
      expect(await transport.export("rev-2")).toEqual(store.get("releases/rev-2/workspace.tar"));
    } finally {
      await first.cleanup();
      await second.cleanup();
    }
  });

  test("export는 current pointer와 무관하게 지정한 immutable release를 읽는다", async () => {
    const store = new MemoryS3ObjectStore();
    const transport = createTransport(store, ["rev-1", "rev-2"]);
    const first = await makeDraftArchive(null, { "applications/one.md": "one" });
    const second = await makeDraftArchive("rev-1", { "applications/two.md": "two" });
    try {
      await transport.publish(first.archive);
      const rev1Archive = store.get("releases/rev-1/workspace.tar");
      await transport.publish(second.archive);

      expect((await transport.status()).current?.revision).toBe("rev-2");
      expect(await transport.export("rev-1")).toEqual(rev1Archive);
    } finally {
      await first.cleanup();
      await second.cleanup();
    }
  });

  test("S3 연결 오류는 TRANSPORT_UNAVAILABLE로 바꾸고 credential을 오류에 노출하지 않는다", async () => {
    const unavailable: S3ObjectStore = {
      read: async () => { throw new S3ObjectStoreError("unavailable"); },
      write: async () => { throw new S3ObjectStoreError("unavailable"); },
      exists: async () => { throw new S3ObjectStoreError("unavailable"); },
    };
    await expect(createTransport(unavailable, ["rev-1"]).status()).rejects.toMatchObject({
      result: { action: "status", code: "TRANSPORT_UNAVAILABLE" },
    });

    const accessKey = "visible-access-key";
    const secretKey = "visible-secret-key";
    try {
      createS3ObjectStoreFromEnvironment({
        CAREER_STORAGE_S3_ENDPOINT: "not-a-url",
        CAREER_STORAGE_S3_BUCKET: "career-os",
        CAREER_STORAGE_S3_ACCESS_KEY: accessKey,
        CAREER_STORAGE_S3_SECRET_KEY: secretKey,
      });
      throw new Error("expected S3 configuration failure");
    } catch (error) {
      expect(String(error)).not.toContain(accessKey);
      expect(String(error)).not.toContain(secretKey);
    }
  });

  test("descriptor와 pointer는 자기 revision의 정해진 key만 허용한다", () => {
    const summary = {
      schemaVersion: 1 as const,
      workspace: "career-os" as const,
      revision: "rev-1",
      contentDigest: "a".repeat(64),
      createdAt: "2026-09-03T00:00:00.000Z",
      fileCount: 1,
    };
    expect(CareerStorageReleaseDescriptorSchema.safeParse({
      ...summary,
      archiveKey: "releases/rev-2/workspace.tar",
      archiveSha256: "b".repeat(64),
      manifestKey: "releases/rev-1/workspace-manifest.json",
      manifestSha256: "c".repeat(64),
    }).success).toBe(false);
    expect(CareerStoragePointerSchema.safeParse({
      ...summary,
      descriptorKey: "releases/rev-2/release.json",
      descriptorSha256: "d".repeat(64),
    }).success).toBe(false);
  });
});

class MemoryS3ObjectStore implements S3ObjectStore {
  readonly writeAttempts: string[] = [];
  readonly successfulWrites: Array<{ key: string; contentType: string }> = [];
  private readonly objects = new Map<string, Uint8Array>();
  private failingWriteAttempt: number | undefined;

  async read(key: string): Promise<Uint8Array> {
    const body = this.objects.get(key);
    if (body === undefined) {
      throw new S3ObjectStoreError("transfer");
    }
    return body.slice();
  }

  async write(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.writeAttempts.push(key);
    if (this.writeAttempts.length === this.failingWriteAttempt) {
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

  get(key: string): Uint8Array {
    const body = this.objects.get(key);
    if (body === undefined) {
      throw new Error(`missing fixture object: ${key}`);
    }
    return body.slice();
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }

  overwrite(key: string, body: Uint8Array): void {
    if (!this.objects.has(key)) {
      throw new Error(`missing fixture object: ${key}`);
    }
    this.objects.set(key, body.slice());
  }
}

function createTransport(objectStore: S3ObjectStore, revisions: string[]): S3CareerWorkspaceTransport {
  let revisionIndex = 0;
  return new S3CareerWorkspaceTransport(objectStore, {
    revisionFactory: () => revisions[revisionIndex++] ?? "unexpected-revision",
    createdAtFactory: () => "2026-09-03T00:00:00.000Z",
  });
}

async function makeDraftArchive(
  parentRevision: string | null,
  files: Readonly<Record<string, string>>,
): Promise<{ archive: Uint8Array; contentDigest: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "career-s3-draft-"));
  for (const managedRoot of CAREER_WORKSPACE_MANAGED_ROOTS) {
    await mkdir(path.join(root, managedRoot), { recursive: true });
  }
  for (const [relativePath, body] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
  const draft = await buildWorkspaceDraft(root, producer, { parentRevision });
  await writeFile(path.join(root, "workspace-draft.json"), jsonBytes(draft.manifest));
  const archive = await createTarFromDirectory(root, ["workspace-draft.json", ...CAREER_WORKSPACE_MANAGED_ROOTS]);
  return {
    archive,
    contentDigest: draft.manifest.contentDigest,
    cleanup: () => safeRemove(root),
  };
}

async function makeReleaseArchive(
  manifestBody: Uint8Array,
  files: Readonly<Record<string, string>>,
): Promise<{ root: string; archive: Uint8Array }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "career-s3-release-"));
  for (const managedRoot of CAREER_WORKSPACE_MANAGED_ROOTS) {
    await mkdir(path.join(root, managedRoot), { recursive: true });
  }
  for (const [relativePath, body] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
  await writeFile(path.join(root, "workspace-manifest.json"), manifestBody);
  return {
    root,
    archive: await createTarFromDirectory(root, ["workspace-manifest.json", ...CAREER_WORKSPACE_MANAGED_ROOTS]),
  };
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}
