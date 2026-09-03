import {
  revisionSchema,
  type RemoteErrorResult,
  type RemotePublishResult,
  type RemoteStatusResult,
} from "./contracts.ts";
import { createS3ObjectStoreFromEnvironment, S3ObjectStoreError } from "./s3-object-store.ts";
import { S3CareerWorkspaceTransport } from "./s3-storage.ts";
import { makeRemoteError, TransportError, type CareerWorkspaceTransport } from "./transport.ts";

const DEFAULT_MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;

type StorageAction = "status" | "export" | "publish";

export interface CareerStorageS3Options {
  environment?: Readonly<Record<string, string | undefined>>;
  input?: ReadableStream<Uint8Array>;
  transport?: CareerWorkspaceTransport;
}

export async function runCareerStorageS3(
  args: readonly string[],
  options: CareerStorageS3Options = {},
): Promise<RemoteStatusResult | RemotePublishResult | Uint8Array> {
  const parsed = parseStorageArguments(args);
  const environment = options.environment ?? process.env;
  const archive = parsed.action === "publish"
    ? await readArchiveWithLimit(
        options.input ?? Bun.stdin.stream(),
        parseMaxArchiveBytes(environment.CAREER_STORAGE_MAX_ARCHIVE_BYTES),
      )
    : undefined;
  const transport = options.transport
    ?? new S3CareerWorkspaceTransport(createS3ObjectStoreFromEnvironment(environment));

  if (parsed.action === "status") {
    return transport.status();
  }
  if (parsed.action === "export") {
    return transport.export(parsed.revision);
  }
  return transport.publish(archive as Uint8Array);
}

export async function readArchiveWithLimit(
  input: ReadableStream<Uint8Array>,
  maxArchiveBytes: number,
): Promise<Uint8Array> {
  const reader = input.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > maxArchiveBytes) {
        await reader.cancel();
        throw new TransportError(makeRemoteError("publish", "TRANSFER_FAILED"));
      }
      chunks.push(value.slice());
    }
  } catch (error) {
    if (error instanceof TransportError) {
      throw error;
    }
    throw new TransportError(makeRemoteError("publish", "TRANSFER_FAILED"));
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    throw new TransportError(makeRemoteError("publish", "TRANSFER_FAILED"));
  }
  const archive = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    archive.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return archive;
}

function parseStorageArguments(args: readonly string[]):
  | { action: "status" }
  | { action: "export"; revision: string }
  | { action: "publish" } {
  if (args.length === 1 && args[0] === "status") {
    return { action: "status" };
  }
  if (
    args.length === 3
    && args[0] === "export"
    && args[1] === "--revision"
    && revisionSchema.safeParse(args[2]).success
  ) {
    return { action: "export", revision: args[2] };
  }
  if (args.length === 1 && args[0] === "publish") {
    return { action: "publish" };
  }
  throw new TransportError(makeRemoteError(storageAction(args[0]), "INVALID_MANIFEST"));
}

function parseMaxArchiveBytes(value: string | undefined): number {
  if (value === undefined || value === "") {
    return DEFAULT_MAX_ARCHIVE_BYTES;
  }
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new TransportError(makeRemoteError("publish", "TRANSPORT_UNAVAILABLE"));
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new TransportError(makeRemoteError("publish", "TRANSPORT_UNAVAILABLE"));
  }
  return parsed;
}

function storageAction(command: string | undefined): StorageAction {
  return command === "export" || command === "publish" ? command : "status";
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  try {
    const result = await runCareerStorageS3(args);
    if (result instanceof Uint8Array) {
      process.stdout.write(result);
    } else {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    }
  } catch (error) {
    const action = storageAction(args[0]);
    const result: RemoteErrorResult = error instanceof TransportError
      ? error.result
      : makeRemoteError(
          action,
          error instanceof S3ObjectStoreError && error.kind === "transfer"
            ? "TRANSFER_FAILED"
            : "TRANSPORT_UNAVAILABLE",
        );
    process.stderr.write(`${JSON.stringify(result)}\n`);
    process.exit(1);
  }
}
