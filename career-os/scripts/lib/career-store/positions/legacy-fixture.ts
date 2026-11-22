import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 커리어 Backend 를 NestJS 로 옮길 때 남긴 HTTP 계약 기록을 저장 모듈에 다시 돌린다.
 * 기록은 고치지 않는다. 기록 뒤에 달라진 계약만 아래 보정으로 반영한다
 * (`services/career-backend/test/support/legacy-contract.ts` 와 같은 규칙).
 */
const capturePath = resolve(
  import.meta.dir,
  "../../../../services/career-backend/test/fixtures/legacy-contract/cases.json",
);

export type LegacyRequest = {
  method: string;
  path: string;
  headers: { idempotencyKey: string | null };
  body?: unknown;
};
export type LegacyGiven =
  | { kind: "sql"; label: string; statement: string }
  | { kind: "request"; label: string; responseStatus: number; request: LegacyRequest };
export type LegacyCase = {
  id: string;
  given: LegacyGiven[];
  request: LegacyRequest;
  response: { status: number; body: unknown; volatileResponsePaths: string[] };
};

export const legacyCases = (JSON.parse(readFileSync(capturePath, "utf8")) as { cases: LegacyCase[] }).cases;

export function legacyCase(id: string): LegacyCase {
  const found = legacyCases.find((entry) => entry.id === id);
  if (!found) throw new Error(`기록에 case 가 없다: ${id}`);
  return found;
}

export const PREFIX = "/api/positions/v1";
export const ANALYSIS_POLICY_PATH = `${PREFIX}/analysis-policy`;

/** 기록 뒤에 달라진 요청 계약을 반영한다. 정책의 기준 버전 칸을 빼고 회사 근거에 id 를 채운다. */
export function materializeBody(path: string, body: unknown): unknown {
  if (typeof body !== "object" || body === null) return body;
  const copy = structuredClone(body) as Record<string, unknown>;
  if (path === ANALYSIS_POLICY_PATH) delete copy.candidateContextVersion;
  for (const result of (copy.results as Array<Record<string, unknown>> | undefined) ?? []) {
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

