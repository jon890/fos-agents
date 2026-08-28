import { randomUUID } from "node:crypto";
import { lstat, mkdtemp, mkdir, readFile, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  CAREER_WORKSPACE_MANAGED_ROOTS,
  CAREER_WORKSPACE_NAME,
  CAREER_WORKSPACE_SCHEMA_VERSION,
  CareerWorkspaceDraftManifestSchema,
  CareerWorkspaceReleaseManifestSchema,
  remotePublishResultSchema,
  remoteStatusResultSchema,
  revisionSchema,
  type CareerWorkspaceReleaseManifest,
} from "./contracts.ts";
import { makeRemoteError, TransportError, type CareerWorkspaceTransport } from "./transport.ts";
import { copyManagedRoots, createTarFromDirectory, extractTarToDirectory, safeRemove, validateTarTopLevel } from "./tar-utils.ts";
import { buildWorkspaceDraft } from "./manifest.ts";

export class LocalCareerWorkspaceTransport implements CareerWorkspaceTransport {
  constructor(
    private readonly storageRoot: string,
    private readonly options: { revisionFactory?: () => string } = {},
  ) {}

  async status() {
    const current = await this.readCurrentManifest();
    return remoteStatusResultSchema.parse({
      schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
      action: "status" as const,
      ok: true as const,
      workspace: CAREER_WORKSPACE_NAME,
      current: current
        ? {
            revision: current.revision,
            contentDigest: current.contentDigest,
            createdAt: current.createdAt,
            fileCount: current.files.length,
          }
        : null,
    });
  }

  async export(revision: string): Promise<Uint8Array> {
    if (!revisionSchema.safeParse(revision).success) {
      throw new TransportError(makeRemoteError("export", "INVALID_MANIFEST"));
    }
    const releaseDir = path.join(this.storageRoot, "releases", revision);
    if (!await exists(releaseDir)) {
      throw new TransportError(makeRemoteError("export", "REMOTE_UNINITIALIZED"));
    }
    try {
      return await createTarFromDirectory(releaseDir, ["workspace-manifest.json", ...CAREER_WORKSPACE_MANAGED_ROOTS]);
    } catch {
      throw new TransportError(makeRemoteError("export", "TRANSFER_FAILED"));
    }
  }

  async publish(archive: Uint8Array) {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "career-storage-publish-"));
    try {
      await validateTarTopLevel(archive, ["workspace-draft.json", ...CAREER_WORKSPACE_MANAGED_ROOTS], "publish");
      await extractTarToDirectory(archive, tempRoot, ["workspace-draft.json", ...CAREER_WORKSPACE_MANAGED_ROOTS], "publish");
      const draft = await readDraftManifest(tempRoot);
      const actualDraft = await buildWorkspaceDraft(tempRoot, draft.producer, { parentRevision: draft.parentRevision });
      if (actualDraft.manifest.contentDigest !== draft.contentDigest) {
        throw new TransportError(makeRemoteError("publish", "INVALID_MANIFEST"));
      }
      const current = await this.readCurrentManifest("publish");
      if ((current?.revision ?? null) !== draft.parentRevision) {
        throw new TransportError(makeRemoteError("publish", "REVISION_CONFLICT"));
      }
      if (current?.contentDigest === draft.contentDigest) {
        return remotePublishResultSchema.parse({
          schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
          action: "publish" as const,
          ok: true as const,
          revision: current.revision,
          contentDigest: current.contentDigest,
          createdAt: current.createdAt,
          fileCount: current.files.length,
          noChange: true,
        });
      }

      const createdAt = new Date().toISOString();
      const revision = this.options.revisionFactory?.() ?? `rev-${Date.now()}-${randomUUID().slice(0, 12)}`;
      const releaseManifest = CareerWorkspaceReleaseManifestSchema.parse({
        ...draft,
        revision,
        createdAt,
      });
      const releaseDir = path.join(this.storageRoot, "releases", revision);
      if (await exists(releaseDir)) {
        throw new TransportError(makeRemoteError("publish", "REVISION_CONFLICT"));
      }
      await mkdir(releaseDir, { recursive: true });
      await copyManagedRoots(tempRoot, releaseDir);
      await writeFile(path.join(releaseDir, "workspace-manifest.json"), `${JSON.stringify(releaseManifest, null, 2)}\n`);
      await mkdir(this.storageRoot, { recursive: true });
      await switchCurrentSymlink(this.storageRoot, revision);

      return remotePublishResultSchema.parse({
        schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
        action: "publish" as const,
        ok: true as const,
        revision,
        contentDigest: releaseManifest.contentDigest,
        createdAt,
        fileCount: releaseManifest.files.length,
        noChange: false,
      });
    } catch (error) {
      if (error instanceof TransportError) {
        throw error;
      }
      throw new TransportError(makeRemoteError("publish", "TRANSPORT_UNAVAILABLE"));
    } finally {
      await safeRemove(tempRoot);
    }
  }

  private async readCurrentManifest(action: "status" | "publish" = "status"): Promise<CareerWorkspaceReleaseManifest | null> {
    const currentPath = path.join(this.storageRoot, "current");
    let current;
    try {
      current = await lstat(currentPath);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw invalidCurrent(action);
    }

    try {
      if (!current.isSymbolicLink()) {
        throw invalidCurrent(action);
      }
      const target = await readlink(currentPath);
      const revision = path.basename(target);
      if (target !== `releases/${revision}`) {
        throw invalidCurrent(action);
      }
      revisionSchema.parse(revision);
      const rawManifest = await readFile(path.join(this.storageRoot, "releases", revision, "workspace-manifest.json"), "utf8");
      const manifest = CareerWorkspaceReleaseManifestSchema.parse(JSON.parse(rawManifest));
      if (manifest.revision !== revision) {
        throw invalidCurrent(action);
      }
      return manifest;
    } catch (error) {
      if (error instanceof TransportError) {
        throw error;
      }
      throw invalidCurrent(action);
    }
  }
}

function invalidCurrent(action: "status" | "publish"): TransportError {
  return new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export async function switchCurrentSymlink(storageRoot: string, revision: string): Promise<void> {
  revisionSchema.parse(revision);
  await mkdir(storageRoot, { recursive: true });
  const tempLink = path.join(storageRoot, `current.${process.pid}.${randomUUID()}.tmp`);
  try {
    await symlink(path.join("releases", revision), tempLink);
    await rename(tempLink, path.join(storageRoot, "current"));
  } catch (error) {
    await rm(tempLink, { force: true });
    throw error;
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch {
    return false;
  }
}

async function readDraftManifest(root: string) {
  try {
    return CareerWorkspaceDraftManifestSchema.parse(JSON.parse(
      await readFile(path.join(root, "workspace-draft.json"), "utf8"),
    ));
  } catch {
    throw new TransportError(makeRemoteError("publish", "INVALID_MANIFEST"));
  }
}
