import { createHash } from "node:crypto";
import path from "node:path";
import {
  CAREER_WORKSPACE_NAME,
  CAREER_WORKSPACE_SCHEMA_VERSION,
  careerStorageMigrationResultSchema,
  type CareerStorageMigrationResult,
  type RemoteErrorResult,
} from "./contracts.ts";
import { readCurrentFileRelease } from "./file-release.ts";
import { createS3ObjectStoreFromEnvironment, S3ObjectStoreError, type S3ObjectStore } from "./s3-object-store.ts";
import {
  CareerStoragePointerSchema,
  CareerStorageReleaseDescriptorSchema,
  type CareerStorageReleaseDescriptor,
} from "./s3-storage-contracts.ts";
import { S3CareerWorkspaceTransport } from "./s3-storage.ts";
import { makeRemoteError, TransportError } from "./transport.ts";

const CURRENT_POINTER_KEY = "pointers/current.json";
const JSON_CONTENT_TYPE = "application/json";
const TAR_CONTENT_TYPE = "application/x-tar";

export interface MigrateCareerStorageOptions {
  objectStore?: S3ObjectStore;
  environment?: Readonly<Record<string, string | undefined>>;
}

export async function runMigrateCareerStorage(
  args: readonly string[],
  options: MigrateCareerStorageOptions = {},
): Promise<CareerStorageMigrationResult> {
  const source = parseSource(args);
  const objectStore = options.objectStore ?? createS3ObjectStoreFromEnvironment(options.environment ?? process.env);
  return migrateCareerStorage(source, objectStore);
}

export async function migrateCareerStorage(
  sourceRoot: string,
  objectStore: S3ObjectStore,
): Promise<CareerStorageMigrationResult> {
  try {
    const source = await readCurrentFileRelease(sourceRoot);
    const transport = new S3CareerWorkspaceTransport(objectStore);
    const current = (await transport.status()).current;
    if (
      current !== null
      && (current.revision !== source.revision || current.contentDigest !== source.manifest.contentDigest)
    ) {
      throw conflict();
    }

    const archiveKey = releaseObjectKey(source.revision, "workspace.tar");
    const manifestKey = releaseObjectKey(source.revision, "workspace-manifest.json");
    const descriptorKey = releaseObjectKey(source.revision, "release.json");
    const descriptor = CareerStorageReleaseDescriptorSchema.parse({
      schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
      workspace: CAREER_WORKSPACE_NAME,
      revision: source.revision,
      contentDigest: source.manifest.contentDigest,
      createdAt: source.manifest.createdAt,
      fileCount: source.manifest.files.length,
      archiveKey,
      archiveSha256: sha256(source.archive),
      manifestKey,
      manifestSha256: sha256(source.manifestBody),
    });
    const descriptorBody = jsonBytes(descriptor);

    const candidates = [
      { key: archiveKey, body: source.archive, contentType: TAR_CONTENT_TYPE },
      { key: manifestKey, body: source.manifestBody, contentType: JSON_CONTENT_TYPE },
      { key: descriptorKey, body: descriptorBody, contentType: JSON_CONTENT_TYPE },
    ] as const;
    const missing: typeof candidates[number][] = [];
    for (const candidate of candidates) {
      if (!await objectExists(objectStore, candidate.key)) {
        if (current !== null) {
          throw conflict();
        }
        missing.push(candidate);
        continue;
      }
      if (!sameBytes(await readObject(objectStore, candidate.key), candidate.body)) {
        throw conflict();
      }
    }
    for (const candidate of missing) {
      await writeObject(objectStore, candidate.key, candidate.body, candidate.contentType);
    }

    await verifyDescriptor(objectStore, descriptorKey, descriptorBody, descriptor);
    const destinationArchive = await transport.export(source.revision);
    const destinationArchiveSha256 = sha256(destinationArchive);
    const sourceArchiveSha256 = sha256(source.archive);
    if (destinationArchiveSha256 !== sourceArchiveSha256 || !sameBytes(destinationArchive, source.archive)) {
      throw transferFailed();
    }

    let pointerWritten = false;
    if (current === null) {
      const pointer = CareerStoragePointerSchema.parse({
        schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
        workspace: CAREER_WORKSPACE_NAME,
        revision: descriptor.revision,
        contentDigest: descriptor.contentDigest,
        createdAt: descriptor.createdAt,
        fileCount: descriptor.fileCount,
        descriptorKey,
        descriptorSha256: sha256(descriptorBody),
      });
      await writeObject(objectStore, CURRENT_POINTER_KEY, jsonBytes(pointer), JSON_CONTENT_TYPE);
      pointerWritten = true;
    }

    const verifiedCurrent = (await transport.status()).current;
    if (
      verifiedCurrent === null
      || verifiedCurrent.revision !== descriptor.revision
      || verifiedCurrent.contentDigest !== descriptor.contentDigest
      || verifiedCurrent.createdAt !== descriptor.createdAt
      || verifiedCurrent.fileCount !== descriptor.fileCount
    ) {
      throw transferFailed();
    }

    return careerStorageMigrationResultSchema.parse({
      schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
      action: "migrate",
      ok: true,
      revision: descriptor.revision,
      contentDigest: descriptor.contentDigest,
      fileCount: descriptor.fileCount,
      sourceArchiveSha256,
      destinationArchiveSha256,
      noChange: missing.length === 0,
      pointerWritten,
    });
  } catch (error) {
    throw normalizeMigrationError(error);
  }
}

function parseSource(args: readonly string[]): string {
  if (args.length !== 2 || args[0] !== "--source" || !args[1]) {
    throw new TransportError(makeRemoteError("migrate", "INVALID_MANIFEST"));
  }
  return path.resolve(args[1]);
}

async function verifyDescriptor(
  objectStore: S3ObjectStore,
  descriptorKey: string,
  expectedBody: Uint8Array,
  expected: CareerStorageReleaseDescriptor,
): Promise<void> {
  const actualBody = await readObject(objectStore, descriptorKey);
  if (!sameBytes(actualBody, expectedBody)) {
    throw transferFailed();
  }
  try {
    const actual = CareerStorageReleaseDescriptorSchema.parse(JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(actualBody),
    ));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw transferFailed();
    }
  } catch (error) {
    if (error instanceof TransportError) {
      throw error;
    }
    throw transferFailed();
  }
}

async function objectExists(objectStore: S3ObjectStore, key: string): Promise<boolean> {
  try {
    return await objectStore.exists(key);
  } catch (error) {
    throw objectStoreError(error);
  }
}

async function readObject(objectStore: S3ObjectStore, key: string): Promise<Uint8Array> {
  try {
    return await objectStore.read(key);
  } catch (error) {
    throw objectStoreError(error);
  }
}

async function writeObject(
  objectStore: S3ObjectStore,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  try {
    await objectStore.write(key, body, contentType);
  } catch (error) {
    throw objectStoreError(error);
  }
}

function releaseObjectKey(
  revision: string,
  fileName: "workspace.tar" | "workspace-manifest.json" | "release.json",
): string {
  return `releases/${revision}/${fileName}`;
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function conflict(): TransportError {
  return new TransportError(makeRemoteError("migrate", "REVISION_CONFLICT"));
}

function transferFailed(): TransportError {
  return new TransportError(makeRemoteError("migrate", "TRANSFER_FAILED"));
}

function objectStoreError(error: unknown): TransportError {
  return new TransportError(makeRemoteError(
    "migrate",
    error instanceof S3ObjectStoreError && error.kind === "unavailable"
      ? "TRANSPORT_UNAVAILABLE"
      : "TRANSFER_FAILED",
  ));
}

function normalizeMigrationError(error: unknown): TransportError {
  if (error instanceof TransportError) {
    if (error.result.action === "migrate") {
      return error;
    }
    return new TransportError(makeRemoteError("migrate", error.result.code));
  }
  if (error instanceof S3ObjectStoreError) {
    return objectStoreError(error);
  }
  return new TransportError(makeRemoteError("migrate", "TRANSPORT_UNAVAILABLE"));
}

if (import.meta.main) {
  try {
    const result = await runMigrateCareerStorage(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const result: RemoteErrorResult = error instanceof TransportError
      ? error.result
      : makeRemoteError("migrate", "TRANSPORT_UNAVAILABLE");
    process.stderr.write(`${JSON.stringify(result)}\n`);
    process.exit(1);
  }
}
