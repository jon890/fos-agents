import {
  remoteErrorResultSchema,
  remotePublishResultSchema,
  remoteStatusResultSchema,
  type RemoteErrorResult,
  type RemotePublishResult,
  type RemoteStatusResult,
} from "./contracts.ts";

export interface CareerWorkspaceTransport {
  status(): Promise<RemoteStatusResult>;
  export(revision: string): Promise<Uint8Array>;
  publish(archive: Uint8Array): Promise<RemotePublishResult>;
}

export class TransportError extends Error {
  constructor(readonly result: RemoteErrorResult) {
    super(result.code);
    this.name = "TransportError";
  }
}

export function parseRemoteStatus(stdout: string): RemoteStatusResult {
  return remoteStatusResultSchema.parse(JSON.parse(stdout));
}

export function parseRemotePublish(stdout: string): RemotePublishResult {
  return remotePublishResultSchema.parse(JSON.parse(stdout));
}

export function parseRemoteError(action: RemoteErrorResult["action"], stderr: string): RemoteErrorResult {
  const parsed = remoteErrorResultSchema.parse(JSON.parse(stderr));
  if (parsed.action !== action) {
    throw new Error("remote error action mismatch");
  }
  return parsed;
}

export function makeRemoteError(action: RemoteErrorResult["action"], code: RemoteErrorResult["code"]): RemoteErrorResult {
  return remoteErrorResultSchema.parse({
    schemaVersion: 1,
    action,
    ok: false,
    code,
  });
}
