import { S3Client } from "bun";
import {
  CareerStorageS3EnvironmentSchema,
  type CareerStorageS3Environment,
} from "./s3-storage-contracts.ts";

export interface S3ObjectStore {
  read(key: string): Promise<Uint8Array>;
  write(key: string, body: Uint8Array, contentType: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export type S3ObjectStoreFailureKind = "unavailable" | "transfer";

export class S3ObjectStoreError extends Error {
  constructor(readonly kind: S3ObjectStoreFailureKind) {
    super(kind === "unavailable" ? "S3 object store unavailable" : "S3 object transfer failed");
    this.name = "S3ObjectStoreError";
  }
}

export interface BunS3ObjectStoreOptions {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class BunS3ObjectStore implements S3ObjectStore {
  private readonly client: S3Client;

  constructor(options: BunS3ObjectStoreOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      bucket: options.bucket,
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      virtualHostedStyle: false,
    });
  }

  async read(key: string): Promise<Uint8Array> {
    try {
      return new Uint8Array(await this.client.file(key).arrayBuffer());
    } catch (error) {
      throw asObjectStoreError(error);
    }
  }

  async write(key: string, body: Uint8Array, contentType: string): Promise<void> {
    try {
      const written = await this.client.write(key, body, { type: contentType });
      if (written !== body.byteLength) {
        throw new S3ObjectStoreError("transfer");
      }
    } catch (error) {
      throw asObjectStoreError(error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return await this.client.exists(key);
    } catch (error) {
      throw asObjectStoreError(error);
    }
  }
}

export function createS3ObjectStoreFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): S3ObjectStore {
  let parsed: CareerStorageS3Environment;
  try {
    parsed = CareerStorageS3EnvironmentSchema.parse({
      CAREER_STORAGE_S3_ENDPOINT: environment.CAREER_STORAGE_S3_ENDPOINT,
      CAREER_STORAGE_S3_BUCKET: environment.CAREER_STORAGE_S3_BUCKET,
      CAREER_STORAGE_S3_ACCESS_KEY: environment.CAREER_STORAGE_S3_ACCESS_KEY,
      CAREER_STORAGE_S3_SECRET_KEY: environment.CAREER_STORAGE_S3_SECRET_KEY,
    });
  } catch {
    throw new S3ObjectStoreError("unavailable");
  }

  return new BunS3ObjectStore({
    endpoint: parsed.CAREER_STORAGE_S3_ENDPOINT,
    bucket: parsed.CAREER_STORAGE_S3_BUCKET,
    accessKeyId: parsed.CAREER_STORAGE_S3_ACCESS_KEY,
    secretAccessKey: parsed.CAREER_STORAGE_S3_SECRET_KEY,
  });
}

function asObjectStoreError(error: unknown): S3ObjectStoreError {
  if (error instanceof S3ObjectStoreError) {
    return error;
  }
  return new S3ObjectStoreError(isUnavailableError(error) ? "unavailable" : "transfer");
}

function isUnavailableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const status = numericProperty(error, "statusCode") ?? numericProperty(error, "status");
  if (status === 401 || status === 403 || (status !== undefined && status >= 500)) {
    return true;
  }

  const code = stringProperty(error, "code").toUpperCase();
  return [
    "ACCESSDENIED",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "ECONNRESET",
    "ENETUNREACH",
    "ENOTFOUND",
    "ETIMEDOUT",
    "INVALIDACCESSKEYID",
    "SIGNATUREDOESNOTMATCH",
  ].includes(code);
}

function numericProperty(value: object, property: string): number | undefined {
  const candidate = Reflect.get(value, property);
  return typeof candidate === "number" ? candidate : undefined;
}

function stringProperty(value: object, property: string): string {
  const candidate = Reflect.get(value, property);
  return typeof candidate === "string" ? candidate : "";
}
