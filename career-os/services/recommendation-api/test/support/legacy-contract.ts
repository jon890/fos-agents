import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** 전환 전 구현이 실제로 낸 값을 담은 포착 파일. 이 파일을 고쳐 테스트를 통과시키지 않는다. */
const capturePath = fileURLToPath(
  new URL("../fixtures/legacy-contract/cases.json", import.meta.url),
);

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
  if (!isGeneratedBody(body)) {
    const copy = structuredClone(body) as { results?: Array<Record<string, unknown>> } | undefined;
    for (const result of copy?.results ?? []) {
      if (!Array.isArray(result.signals) || !Array.isArray(result.evidence)) continue;
      const evidence = result.evidence as Array<Record<string, unknown>>;
      evidence.forEach((item, index) => {
        item.id ??= `legacy-evidence-${index + 1}`;
      });
      for (const signal of result.signals as Array<Record<string, unknown>>) {
        signal.evidenceIds ??= signal.level === "unknown" ? [] : evidence.map((item) => item.id);
      }
    }
    return copy;
  }
  const { totalBytes, padField } = body.generated;
  const overhead = JSON.stringify({ [padField]: "" }).length;
  return { [padField]: "a".repeat(totalBytes - overhead) };
}

/** 과거 포착값은 그대로 두고, 달라진 저장 계약만 비교 시점에 반영한다. */
export function expectedLegacyAssessment(row: Record<string, unknown>): Record<string, unknown> {
  const copy = structuredClone(row);
  const evidence = copy.evidence_json as Array<Record<string, unknown>> | undefined;
  const signals = copy.signals_json as Record<string, string> | undefined;
  if (!evidence || !signals) return copy;
  evidence.forEach((item, index) => {
    item.id ??= `legacy-evidence-${index + 1}`;
  });
  copy.signals_json = Object.fromEntries(
    Object.entries(signals).map(([axis, level]) => [
      axis,
      { level, evidenceIds: level === "unknown" ? [] : evidence.map((item) => item.id) },
    ]),
  );
  return copy;
}
