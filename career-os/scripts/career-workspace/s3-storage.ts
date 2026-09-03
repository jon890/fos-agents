import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  type CareerWorkspaceDraftManifest,
  type CareerWorkspaceReleaseManifest,
  type RemoteErrorResult,
} from "./contracts.ts";
import { buildWorkspaceDraft, compareCodeUnits } from "./manifest.ts";
import { S3ObjectStoreError, type S3ObjectStore } from "./s3-object-store.ts";
import {
  CareerStoragePointerSchema,
  CareerStorageReleaseDescriptorSchema,
  type CareerStoragePointer,
  type CareerStorageReleaseDescriptor,
} from "./s3-storage-contracts.ts";
import {
  createTarFromDirectory,
  extractTarToDirectory,
  listRelativeFiles,
  safeRemove,
  validateCareerWorkspaceReleaseArchive,
  validateTarTopLevel,
} from "./tar-utils.ts";
import { makeRemoteError, TransportError, type CareerWorkspaceTransport } from "./transport.ts";

const CURRENT_POINTER_KEY = "pointers/current.json";
const JSON_CONTENT_TYPE = "application/json";
const TAR_CONTENT_TYPE = "application/x-tar";

type S3TransportAction = "status" | "export" | "publish";
type StorageFailureCode = Extract<RemoteErrorResult["code"], "REMOTE_UNINITIALIZED" | "INVALID_MANIFEST" | "TRANSFER_FAILED">;

export interface S3CareerWorkspaceTransportOptions {
  revisionFactory?: () => string;
  createdAtFactory?: () => string;
}

interface CurrentRelease {
  pointer: CareerStoragePointer;
  descriptor: CareerStorageReleaseDescriptor;
  manifest: CareerWorkspaceReleaseManifest;
}

export class S3CareerWorkspaceTransport implements CareerWorkspaceTransport {
  constructor(
    private readonly objectStore: S3ObjectStore,
    private readonly options: S3CareerWorkspaceTransportOptions = {},
  ) {}

  async status() {
    try {
      const current = await this.readCurrentRelease("status");
      return remoteStatusResultSchema.parse({
        schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
        action: "status" as const,
        ok: true as const,
        workspace: CAREER_WORKSPACE_NAME,
        current: current
          ? releaseSummary(current.pointer)
          : null,
      });
    } catch (error) {
      throw normalizeUnexpectedError("status", error);
    }
  }

  async export(revision: string): Promise<Uint8Array> {
    if (!revisionSchema.safeParse(revision).success) {
      throw invalidManifest("export");
    }

    try {
      const descriptorKey = releaseObjectKey(revision, "release.json");
      const descriptorBody = await this.readRequiredObject("export", descriptorKey, "REMOTE_UNINITIALIZED");
      const descriptor = parseReleaseDescriptor(descriptorBody, "export");
      if (descriptor.revision !== revision) {
        throw invalidManifest("export");
      }

      const manifestBody = await this.readRequiredObject("export", descriptor.manifestKey, "INVALID_MANIFEST");
      if (sha256(manifestBody) !== descriptor.manifestSha256) {
        throw invalidManifest("export");
      }
      const manifest = parseReleaseManifest(manifestBody, "export");
      assertManifestMatchesDescriptor(manifest, descriptor, "export");

      const archive = await this.readRequiredObject("export", descriptor.archiveKey, "INVALID_MANIFEST");
      if (sha256(archive) !== descriptor.archiveSha256) {
        throw invalidManifest("export");
      }
      await validateCareerWorkspaceReleaseArchive(archive, manifest, "export");
      return archive;
    } catch (error) {
      throw normalizeUnexpectedError("export", error);
    }
  }

  async publish(archive: Uint8Array) {
    let tempRoot: string | undefined;
    try {
      tempRoot = await mkdtemp(path.join(os.tmpdir(), "career-s3-publish-"));
      await validateTarTopLevel(archive, ["workspace-draft.json", ...CAREER_WORKSPACE_MANAGED_ROOTS], "publish");
      await extractTarToDirectory(
        archive,
        tempRoot,
        ["workspace-draft.json", ...CAREER_WORKSPACE_MANAGED_ROOTS],
        "publish",
      );

      const draft = await readDraftManifest(tempRoot);
      await assertDraftMatchesExtractedFiles(tempRoot, draft);

      const current = await this.readCurrentRelease("publish");
      if ((current?.pointer.revision ?? null) !== draft.parentRevision) {
        throw new TransportError(makeRemoteError("publish", "REVISION_CONFLICT"));
      }
      if (current?.pointer.contentDigest === draft.contentDigest) {
        return remotePublishResultSchema.parse({
          schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
          action: "publish" as const,
          ok: true as const,
          ...releaseSummary(current.pointer),
          noChange: true,
        });
      }

      const revision = this.options.revisionFactory?.() ?? `rev-${Date.now()}-${randomUUID().slice(0, 12)}`;
      const createdAt = this.options.createdAtFactory?.() ?? new Date().toISOString();
      const releaseManifest = parseGeneratedReleaseManifest({ ...draft, revision, createdAt });
      const manifestBody = jsonBytes(releaseManifest);
      await writeFile(path.join(tempRoot, "workspace-manifest.json"), manifestBody);
      const releaseArchive = await createTarFromDirectory(
        tempRoot,
        ["workspace-manifest.json", ...CAREER_WORKSPACE_MANAGED_ROOTS],
      );
      await validateCareerWorkspaceReleaseArchive(releaseArchive, releaseManifest, "publish");

      const archiveKey = releaseObjectKey(revision, "workspace.tar");
      const manifestKey = releaseObjectKey(revision, "workspace-manifest.json");
      const descriptorKey = releaseObjectKey(revision, "release.json");
      for (const key of [archiveKey, manifestKey, descriptorKey]) {
        if (await this.objectExists("publish", key)) {
          throw new TransportError(makeRemoteError("publish", "REVISION_CONFLICT"));
        }
      }

      const descriptor = CareerStorageReleaseDescriptorSchema.parse({
        schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
        workspace: CAREER_WORKSPACE_NAME,
        ...releaseSummary(releaseManifest),
        archiveKey,
        archiveSha256: sha256(releaseArchive),
        manifestKey,
        manifestSha256: sha256(manifestBody),
      });
      const descriptorBody = jsonBytes(descriptor);

      await this.writeObject("publish", archiveKey, releaseArchive, TAR_CONTENT_TYPE);
      await this.writeObject("publish", manifestKey, manifestBody, JSON_CONTENT_TYPE);
      await this.writeObject("publish", descriptorKey, descriptorBody, JSON_CONTENT_TYPE);

      const uploadedArchive = await this.readRequiredObject("publish", archiveKey, "TRANSFER_FAILED");
      const uploadedManifestBody = await this.readRequiredObject("publish", manifestKey, "TRANSFER_FAILED");
      const uploadedDescriptorBody = await this.readRequiredObject("publish", descriptorKey, "TRANSFER_FAILED");
      const uploadedDescriptor = parseReleaseDescriptor(uploadedDescriptorBody, "publish", "TRANSFER_FAILED");
      if (
        sha256(uploadedArchive) !== uploadedDescriptor.archiveSha256
        || sha256(uploadedManifestBody) !== uploadedDescriptor.manifestSha256
        || !sameJson(uploadedDescriptor, descriptor)
      ) {
        throw new TransportError(makeRemoteError("publish", "TRANSFER_FAILED"));
      }
      const uploadedManifest = parseReleaseManifest(uploadedManifestBody, "publish", "TRANSFER_FAILED");
      assertManifestMatchesDescriptor(uploadedManifest, uploadedDescriptor, "publish", "TRANSFER_FAILED");
      await validateCareerWorkspaceReleaseArchive(uploadedArchive, uploadedManifest, "publish");

      const pointer = CareerStoragePointerSchema.parse({
        schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
        workspace: CAREER_WORKSPACE_NAME,
        ...releaseSummary(uploadedDescriptor),
        descriptorKey,
        descriptorSha256: sha256(uploadedDescriptorBody),
      });
      await this.writeObject("publish", CURRENT_POINTER_KEY, jsonBytes(pointer), JSON_CONTENT_TYPE);

      return remotePublishResultSchema.parse({
        schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
        action: "publish" as const,
        ok: true as const,
        ...releaseSummary(pointer),
        noChange: false,
      });
    } catch (error) {
      throw normalizeUnexpectedError("publish", error);
    } finally {
      if (tempRoot !== undefined) {
        await safeRemove(tempRoot);
      }
    }
  }

  private async readCurrentRelease(action: "status" | "publish"): Promise<CurrentRelease | null> {
    if (!await this.objectExists(action, CURRENT_POINTER_KEY)) {
      return null;
    }

    const pointerBody = await this.readRequiredObject(action, CURRENT_POINTER_KEY, "INVALID_MANIFEST");
    const pointer = parsePointer(pointerBody, action);
    const descriptorBody = await this.readRequiredObject(action, pointer.descriptorKey, "INVALID_MANIFEST");
    if (sha256(descriptorBody) !== pointer.descriptorSha256) {
      throw invalidManifest(action);
    }
    const descriptor = parseReleaseDescriptor(descriptorBody, action);
    assertSummaryMatches(pointer, descriptor, action);

    const manifestBody = await this.readRequiredObject(action, descriptor.manifestKey, "INVALID_MANIFEST");
    if (sha256(manifestBody) !== descriptor.manifestSha256) {
      throw invalidManifest(action);
    }
    const manifest = parseReleaseManifest(manifestBody, action);
    assertManifestMatchesDescriptor(manifest, descriptor, action);
    return { pointer, descriptor, manifest };
  }

  private async readRequiredObject(
    action: S3TransportAction,
    key: string,
    missingCode: StorageFailureCode,
  ): Promise<Uint8Array> {
    if (!await this.objectExists(action, key)) {
      throw new TransportError(makeRemoteError(action, missingCode));
    }
    try {
      return await this.objectStore.read(key);
    } catch (error) {
      throw objectStoreTransportError(action, error);
    }
  }

  private async writeObject(
    action: "publish",
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    try {
      await this.objectStore.write(key, body, contentType);
    } catch (error) {
      throw objectStoreTransportError(action, error);
    }
  }

  private async objectExists(action: S3TransportAction, key: string): Promise<boolean> {
    try {
      return await this.objectStore.exists(key);
    } catch (error) {
      throw objectStoreTransportError(action, error);
    }
  }
}

async function readDraftManifest(root: string): Promise<CareerWorkspaceDraftManifest> {
  try {
    return CareerWorkspaceDraftManifestSchema.parse(JSON.parse(
      await readFile(path.join(root, "workspace-draft.json"), "utf8"),
    ));
  } catch {
    throw invalidManifest("publish");
  }
}

async function assertDraftMatchesExtractedFiles(
  root: string,
  draft: CareerWorkspaceDraftManifest,
): Promise<void> {
  const actualDraft = await buildWorkspaceDraft(root, draft.producer, { parentRevision: draft.parentRevision });
  const extractedFiles = (await listRelativeFiles(root))
    .filter((file) => file !== "workspace-draft.json")
    .toSorted(compareCodeUnits);
  const expectedFiles = draft.files.map((file) => file.path).toSorted(compareCodeUnits);
  if (!sameJson(actualDraft.manifest, draft) || !sameJson(extractedFiles, expectedFiles)) {
    throw invalidManifest("publish");
  }
}

function parseGeneratedReleaseManifest(value: unknown): CareerWorkspaceReleaseManifest {
  try {
    return CareerWorkspaceReleaseManifestSchema.parse(value);
  } catch {
    throw new TransportError(makeRemoteError("publish", "TRANSPORT_UNAVAILABLE"));
  }
}

function parsePointer(body: Uint8Array, action: "status" | "publish"): CareerStoragePointer {
  try {
    return CareerStoragePointerSchema.parse(parseJsonBytes(body));
  } catch {
    throw invalidManifest(action);
  }
}

function parseReleaseDescriptor(
  body: Uint8Array,
  action: S3TransportAction,
  failureCode: Extract<StorageFailureCode, "INVALID_MANIFEST" | "TRANSFER_FAILED"> = "INVALID_MANIFEST",
): CareerStorageReleaseDescriptor {
  try {
    return CareerStorageReleaseDescriptorSchema.parse(parseJsonBytes(body));
  } catch {
    throw new TransportError(makeRemoteError(action, failureCode));
  }
}

function parseReleaseManifest(
  body: Uint8Array,
  action: S3TransportAction,
  failureCode: Extract<StorageFailureCode, "INVALID_MANIFEST" | "TRANSFER_FAILED"> = "INVALID_MANIFEST",
): CareerWorkspaceReleaseManifest {
  try {
    return CareerWorkspaceReleaseManifestSchema.parse(parseJsonBytes(body));
  } catch {
    throw new TransportError(makeRemoteError(action, failureCode));
  }
}

function assertSummaryMatches(
  pointer: CareerStoragePointer,
  descriptor: CareerStorageReleaseDescriptor,
  action: "status" | "publish",
): void {
  if (!sameJson(releaseSummary(pointer), releaseSummary(descriptor))) {
    throw invalidManifest(action);
  }
}

function assertManifestMatchesDescriptor(
  manifest: CareerWorkspaceReleaseManifest,
  descriptor: CareerStorageReleaseDescriptor,
  action: S3TransportAction,
  failureCode: Extract<StorageFailureCode, "INVALID_MANIFEST" | "TRANSFER_FAILED"> = "INVALID_MANIFEST",
): void {
  if (!sameJson(releaseSummary(manifest), releaseSummary(descriptor))) {
    throw new TransportError(makeRemoteError(action, failureCode));
  }
}

function releaseSummary(value: {
  revision: string;
  contentDigest: string;
  createdAt: string;
  fileCount?: number;
  files?: readonly unknown[];
}) {
  return {
    revision: value.revision,
    contentDigest: value.contentDigest,
    createdAt: value.createdAt,
    fileCount: value.fileCount ?? value.files?.length ?? 0,
  };
}

function releaseObjectKey(revision: string, fileName: "workspace.tar" | "workspace-manifest.json" | "release.json"): string {
  return `releases/${revision}/${fileName}`;
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function parseJsonBytes(body: Uint8Array): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function invalidManifest(action: S3TransportAction): TransportError {
  return new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
}

function objectStoreTransportError(action: S3TransportAction, error: unknown): TransportError {
  const code = error instanceof S3ObjectStoreError && error.kind === "unavailable"
    ? "TRANSPORT_UNAVAILABLE"
    : "TRANSFER_FAILED";
  return new TransportError(makeRemoteError(action, code));
}

function normalizeUnexpectedError(action: S3TransportAction, error: unknown): TransportError {
  if (error instanceof TransportError) {
    return error;
  }
  if (error instanceof S3ObjectStoreError) {
    return objectStoreTransportError(action, error);
  }
  return new TransportError(makeRemoteError(action, "TRANSPORT_UNAVAILABLE"));
}
