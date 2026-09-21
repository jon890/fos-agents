import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** 전환 전 구현이 실제로 낸 값을 담은 포착 파일. 이 파일을 고쳐 테스트를 통과시키지 않는다. */
const capturePath = fileURLToPath(new URL("../fixtures/legacy-contract/cases.json", import.meta.url));

export type LegacyRequest = {
  method: string;
  path: string;
  headers: { authorization?: boolean; idempotencyKey: string | null };
  body?: unknown;
};

/** 그 case 가 요구하는 선행 상태를 만드는 단계. 요청이거나 직접 실행한 SQL 이다. */
export type LegacyGiven =
  | { kind: "sql"; label: string; statement: string }
  | { kind: "request"; label: string; responseStatus: number; request: LegacyRequest };

export type LegacyCase = {
  id: string;
  given: LegacyGiven[];
  request: LegacyRequest;
  response: {
    status: number;
    cacheControl: string;
    hasRequestId: boolean;
    body: unknown;
    volatileResponsePaths: string[];
  };
  database?: { note?: string; tables: Record<string, Array<Record<string, unknown>>> };
};

/** table 마다 어느 열을 어떤 순서로 읽어 비교했는지. */
export type LegacyComparedColumns = Record<string, { columns: string[]; orderBy: string }>;

type Capture = {
  apiToken: string;
  maxBodyBytes: number;
  comparedColumns: LegacyComparedColumns;
  cases: LegacyCase[];
};

const capture = JSON.parse(readFileSync(capturePath, "utf8")) as Capture;

export const legacyApiToken = capture.apiToken;
export const legacyMaxBodyBytes = capture.maxBodyBytes;
export const legacyComparedColumns = capture.comparedColumns;

export function legacyCase(id: string): LegacyCase {
  const found = capture.cases.find((entry) => entry.id === id);
  if (!found) throw new Error(`포착 파일에 case 가 없다: ${id}`);
  return found;
}

export type LegacyErrorBody = { error: { code: string; message: string; requestId: string } };
