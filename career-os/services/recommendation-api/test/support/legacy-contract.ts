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

/** 포착 파일이 담은 case ID 전부. 어느 검사도 쓰지 않는 case 가 생기는 것을 막는 데 쓴다. */
export const legacyCaseIds: string[] = capture.cases.map((entry) => entry.id);

export function legacyCase(id: string): LegacyCase {
  const found = capture.cases.find((entry) => entry.id === id);
  if (!found) throw new Error(`포착 파일에 case 가 없다: ${id}`);
  return found;
}

export type LegacyErrorBody = { error: { code: string; message: string; requestId: string } };

/** 포착 파일이 본문을 값 대신 만드는 방법으로 적은 형태. 본문이 너무 커서 그대로 담지 않았다. */
type GeneratedBody = {
  generated: { kind: "padded-json"; totalBytes: number; padField: string };
};

function isGeneratedBody(body: unknown): body is GeneratedBody {
  const generated = (body as GeneratedBody | undefined)?.generated;
  return generated?.kind === "padded-json";
}

/**
 * 포착 파일의 요청 본문을 실제로 보낼 값으로 바꾼다.
 *
 * 대부분은 적힌 값이 곧 본문이다. 본문 상한 case 하나만 `generated` 로 만드는 방법을 적었고,
 * 그것을 알아보지 못하면 설명 객체를 그대로 보내 상한에 걸리지 않는다.
 */
export function materializeLegacyBody(body: unknown): unknown {
  if (!isGeneratedBody(body)) return body;
  const { totalBytes, padField } = body.generated;
  const overhead = JSON.stringify({ [padField]: "" }).length;
  return { [padField]: "a".repeat(totalBytes - overhead) };
}
