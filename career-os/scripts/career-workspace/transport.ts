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

/**
 * `detail` 은 사용자가 바로 다음 행동을 고르도록 돕는 한국어 설명이다.
 * 오류 코드만으로는 원인을 찾는 데 여러 번의 확인이 필요했던 자리에 붙인다.
 * 환경 변수 값과 파일 본문은 담지 않는다.
 */
export function makeRemoteError(
  action: RemoteErrorResult["action"],
  code: RemoteErrorResult["code"],
  detail?: string,
): RemoteErrorResult {
  return remoteErrorResultSchema.parse({
    schemaVersion: 1,
    action,
    ok: false,
    code,
    ...(detail ? { detail } : {}),
  });
}
