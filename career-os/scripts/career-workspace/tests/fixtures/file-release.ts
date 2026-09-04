import { lstat, readFile, readlink } from "node:fs/promises";
import path from "node:path";
import {
  CAREER_WORKSPACE_MANAGED_ROOTS,
  CareerWorkspaceReleaseManifestSchema,
  revisionSchema,
  type RemoteErrorResult,
  type CareerWorkspaceReleaseManifest,
} from "../../contracts.ts";
import { createTarFromDirectory, validateCareerWorkspaceReleaseArchive } from "../../tar-utils.ts";
import { makeRemoteError, TransportError } from "../../transport.ts";

export interface FileReleaseSnapshot {
  revision: string;
  manifest: CareerWorkspaceReleaseManifest;
  manifestBody: Uint8Array;
  archive: Uint8Array;
}

export interface CurrentFileReleaseManifest {
  revision: string;
  manifest: CareerWorkspaceReleaseManifest;
  manifestBody: Uint8Array;
}

type FileReleaseAction = Extract<RemoteErrorResult["action"], "status" | "publish" | "migrate">;

export async function readCurrentFileRelease(storageRoot: string): Promise<FileReleaseSnapshot> {
  try {
    const current = await readCurrentFileReleaseManifest(storageRoot, "migrate");
    if (current === null) {
      throw invalidManifest("migrate");
    }
    const releaseRoot = path.join(storageRoot, "releases", current.revision);
    const releaseStat = await lstat(releaseRoot);
    if (!releaseStat.isDirectory() || releaseStat.isSymbolicLink()) {
      throw invalidManifest("migrate");
    }

    const archive = await createTarFromDirectory(
      releaseRoot,
      ["workspace-manifest.json", ...CAREER_WORKSPACE_MANAGED_ROOTS],
    );
    await validateCareerWorkspaceReleaseArchive(archive, current.manifest, "migrate");
    const verifiedCurrent = await readCurrentFileReleaseManifest(storageRoot, "migrate");
    if (
      verifiedCurrent === null
      || verifiedCurrent.revision !== current.revision
      || !sameBytes(verifiedCurrent.manifestBody, current.manifestBody)
    ) {
      throw invalidManifest("migrate");
    }

    return {
      revision: current.revision,
      manifest: current.manifest,
      manifestBody: current.manifestBody,
      archive,
    };
  } catch (error) {
    if (error instanceof TransportError) {
      throw error;
    }
    throw invalidManifest("migrate");
  }
}

export async function readCurrentFileReleaseManifest(
  storageRoot: string,
  action: FileReleaseAction,
): Promise<CurrentFileReleaseManifest | null> {
  const currentPath = path.join(storageRoot, "current");
  let currentStat;
  try {
    currentStat = await lstat(currentPath);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw invalidManifest(action);
  }

  try {
    if (!currentStat.isSymbolicLink()) {
      throw invalidManifest(action);
    }
    const target = await readlink(currentPath);
    const normalized = target.split(path.sep).join("/");
    const match = /^releases\/([^/]+)$/.exec(normalized);
    if (!match || !revisionSchema.safeParse(match[1]).success) {
      throw invalidManifest(action);
    }
    const revision = match[1];
    const manifestBody = new Uint8Array(await readFile(
      path.join(storageRoot, "releases", revision, "workspace-manifest.json"),
    ));
    const manifest = parseManifest(manifestBody, action);
    if (manifest.revision !== revision) {
      throw invalidManifest(action);
    }
    return { revision, manifest, manifestBody };
  } catch (error) {
    if (error instanceof TransportError) {
      throw error;
    }
    throw invalidManifest(action);
  }
}

function parseManifest(body: Uint8Array, action: FileReleaseAction): CareerWorkspaceReleaseManifest {
  try {
    return CareerWorkspaceReleaseManifestSchema.parse(JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(body),
    ));
  } catch {
    throw invalidManifest(action);
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function invalidManifest(action: FileReleaseAction): TransportError {
  return new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
}
