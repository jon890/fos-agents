import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  constructor(private readonly storageRoot: string) {}

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
    revisionSchema.parse(revision);
    const releaseDir = path.join(this.storageRoot, "releases", revision);
    try {
      return await createTarFromDirectory(releaseDir, ["workspace-manifest.json", ...CAREER_WORKSPACE_MANAGED_ROOTS]);
    } catch {
      throw new TransportError(makeRemoteError("export", "REMOTE_UNINITIALIZED"));
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
      const current = await this.readCurrentManifest();
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
      const revision = `rev-${Date.now()}`;
      const releaseManifest = CareerWorkspaceReleaseManifestSchema.parse({
        ...draft,
        revision,
        createdAt,
      });
      const releaseDir = path.join(this.storageRoot, "releases", revision);
      await mkdir(releaseDir, { recursive: true });
      await copyManagedRoots(tempRoot, releaseDir);
      await writeFile(path.join(releaseDir, "workspace-manifest.json"), `${JSON.stringify(releaseManifest, null, 2)}\n`);
      await mkdir(this.storageRoot, { recursive: true });
      await writeFile(path.join(this.storageRoot, "current"), revision);

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
    } finally {
      await safeRemove(tempRoot);
    }
  }

  private async readCurrentManifest(): Promise<CareerWorkspaceReleaseManifest | null> {
    try {
      const revision = (await readFile(path.join(this.storageRoot, "current"), "utf8")).trim();
      return CareerWorkspaceReleaseManifestSchema.parse(JSON.parse(
        await readFile(path.join(this.storageRoot, "releases", revision, "workspace-manifest.json"), "utf8"),
      ));
    } catch {
      return null;
    }
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
