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
/** 정책 행의 기준 버전 칸은 포착 뒤에 지웠다(ADR-134). 없는 열을 읽지 않도록 비교 목록에서 뺀다. */
export const legacyComparedColumns: LegacyComparedColumns = Object.fromEntries(
  Object.entries(capture.comparedColumns).map(([table, spec]) => [
    table,
    table === "position_analysis_policy"
      ? { ...spec, columns: spec.columns.filter((column) => column !== "candidate_context_version") }
      : spec,
  ]),
);

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
    const copy = withoutPolicyContextVersion(structuredClone(body)) as
      | { results?: Array<Record<string, unknown>> }
      | undefined;
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

/**
 * 최상위의 `candidateContextVersion` 을 지운 사본을 돌려준다.
 *
 * 포착 뒤 분석 정책은 기준 버전을 받지도 돌려주지도 않는다(ADR-134).
 * 포착 파일에서 최상위에 이 키를 가진 본문은 분석 정책의 요청과 응답뿐이다.
 * 정책 스키마가 `.strict()` 라 지우지 않고 보내면 `400` 이 된다.
 */
function withoutPolicyContextVersion(body: unknown): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return body;
  if (!("candidateContextVersion" in body)) return body;
  const { candidateContextVersion: _removed, ...rest } = body as Record<string, unknown>;
  return rest;
}

/** 포착한 응답 본문을 지금 계약이 돌려줄 본문으로 바꾼다. 분석 정책 응답의 기준 버전을 뺀다. */
export function expectedLegacyResponseBody(body: unknown): unknown {
  return withoutPolicyContextVersion(structuredClone(body));
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

/**
 * 서버가 position-preferences 문서 version 1 에서 계산하는 기준 버전.
 * 포착 뒤 공고 분석의 기준 버전을 정책 행 대신 이 문서에서 계산하게 됐다(ADR-134).
 */
export const legacyContextVersion = "position-preferences:v1";

/** 실행 행에 기준 버전을 기록하는 table. 정책 table 은 그 칸이 없어져 따로 다룬다. */
const contextVersionTables = new Set([
  "company_tier_assessment_runs",
  "company_tier_assessments",
  "position_analysis_runs",
  "position_analyses",
]);

/**
 * 포착값의 `candidate_context_version` 을 문서에서 계산하는 값으로 바꾼 사본을 돌려준다.
 * 정책 행은 그 칸을 지웠으므로 키를 뺀 사본을 돌려준다.
 */
export function expectedLegacyRow(
  table: string,
  row: Record<string, unknown>,
): Record<string, unknown> {
  if (table === "position_analysis_policy") {
    const { candidate_context_version: _removed, ...rest } = row;
    return rest;
  }
  if (!contextVersionTables.has(table) || !("candidate_context_version" in row)) return row;
  return { ...row, candidate_context_version: legacyContextVersion };
}
