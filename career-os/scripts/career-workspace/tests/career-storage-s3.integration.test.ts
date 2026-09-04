import { describe, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { S3Client } from "bun";
import { CareerStorageS3EnvironmentSchema } from "../s3-storage-contracts.ts";

const REQUIRED_ENVIRONMENT = [
  "CAREER_STORAGE_S3_ENDPOINT",
  "CAREER_STORAGE_S3_BUCKET",
  "CAREER_STORAGE_S3_ACCESS_KEY",
  "CAREER_STORAGE_S3_SECRET_KEY",
] as const;
const integrationEnabled = REQUIRED_ENVIRONMENT.every((name) => Boolean(process.env[name]));

describe("career storage actual S3", () => {
  test.skipIf(!integrationEnabled)("전용 prefix의 전송 무결성과 bucket 인증 경계를 확인한다", async () => {
    const environment = CareerStorageS3EnvironmentSchema.parse({
      CAREER_STORAGE_S3_ENDPOINT: process.env.CAREER_STORAGE_S3_ENDPOINT,
      CAREER_STORAGE_S3_BUCKET: process.env.CAREER_STORAGE_S3_BUCKET,
      CAREER_STORAGE_S3_ACCESS_KEY: process.env.CAREER_STORAGE_S3_ACCESS_KEY,
      CAREER_STORAGE_S3_SECRET_KEY: process.env.CAREER_STORAGE_S3_SECRET_KEY,
    });
    const options = {
      endpoint: environment.CAREER_STORAGE_S3_ENDPOINT,
      bucket: environment.CAREER_STORAGE_S3_BUCKET,
      accessKeyId: environment.CAREER_STORAGE_S3_ACCESS_KEY,
      secretAccessKey: environment.CAREER_STORAGE_S3_SECRET_KEY,
      virtualHostedStyle: false,
    } as const;
    const client = new S3Client(options);
    const key = `integration-tests/${randomUUID()}/probe.bin`;
    const body = crypto.getRandomValues(new Uint8Array(256));
    let wroteProbe = false;

    try {
      const written = await client.write(key, body, { type: "application/octet-stream" });
      wroteProbe = true;
      if (written !== body.byteLength) {
        throw new Error("authenticated S3 write length mismatch");
      }
      const downloaded = new Uint8Array(await client.file(key).arrayBuffer());
      if (sha256(downloaded) !== sha256(body)) {
        throw new Error("authenticated S3 byte hash mismatch");
      }

      const anonymousResponse = await fetch(pathStyleObjectUrl(options.endpoint, options.bucket, key));
      if (anonymousResponse.status !== 401 && anonymousResponse.status !== 403) {
        throw new Error("anonymous S3 request was not denied");
      }

      const otherBucket = new S3Client({
        ...options,
        bucket: `career-storage-denied-${randomUUID()}`,
      });
      let otherBucketDenied = false;
      try {
        await otherBucket.write(key, body, { type: "application/octet-stream" });
        await otherBucket.unlink(key).catch(() => undefined);
      } catch (error) {
        otherBucketDenied = isAccessDenied(error);
      }
      if (!otherBucketDenied) {
        throw new Error("credential could write another S3 bucket");
      }

      await client.unlink(key);
      wroteProbe = false;
      if (await client.exists(key)) {
        throw new Error("S3 probe object remained after delete");
      }
    } catch (error) {
      throw new Error(safeFailureMessage(error));
    } finally {
      if (wroteProbe) {
        await client.unlink(key).catch(() => undefined);
      }
    }
  }, 30_000);
});

function pathStyleObjectUrl(endpoint: string, bucket: string, key: string): URL {
  const url = new URL(endpoint);
  const basePath = url.pathname.replace(/\/$/, "");
  const keyPath = key.split("/").map(encodeURIComponent).join("/");
  url.pathname = `${basePath}/${encodeURIComponent(bucket)}/${keyPath}`;
  url.search = "";
  url.hash = "";
  return url;
}

function sha256(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function isAccessDenied(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const status = Reflect.get(error, "statusCode") ?? Reflect.get(error, "status");
  const code = Reflect.get(error, "code");
  return status === 401
    || status === 403
    || (typeof code === "string" && code.toUpperCase() === "ACCESSDENIED");
}

function safeFailureMessage(error: unknown): string {
  if (error instanceof Error && [
    "authenticated S3 write length mismatch",
    "authenticated S3 byte hash mismatch",
    "anonymous S3 request was not denied",
    "credential could write another S3 bucket",
    "S3 probe object remained after delete",
  ].includes(error.message)) {
    return error.message;
  }
  return "actual S3 integration request failed";
}
