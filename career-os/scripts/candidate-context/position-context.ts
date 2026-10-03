import { writeFileSync } from "node:fs";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import type { CandidateContextClient } from "./client.ts";
import type { CandidateContextDocumentKey } from "./contracts.ts";
import { assertOutsideRepository } from "./repository-guard.ts";

const MANAGE_COMMAND = "career-os/scripts/candidate-context/manage_candidate_context.ts";

/**
 * 공고 분석의 기준 버전은 `position-preferences` 문서 version 에서 계산한다. ADR-134 를 따른다.
 * 계산식의 소유자는 Backend 이고 이 함수는 `candidate-context.json` 에 적는 표시용 사본이다.
 */
export const positionContextVersion = (version: number) => `position-preferences:v${version}`;

type DocumentReader = Pick<CandidateContextClient, "getDocument">;

/**
 * 수집 전에 두 문서를 읽어 `candidate-context.json` 에 쓴다. 문서가 없으면 쓰지 않고 오류를 던진다.
 * 개인 맥락이므로 저장소 안 경로에는 쓰지 않는다.
 */
export async function prepareCandidateContext(
  paths: { candidateContext: string },
  clients: { context: DocumentReader },
): Promise<{ candidateContextVersion: string }> {
  const output = assertOutsideRepository(paths.candidateContext, "candidate-context.json");

  const keys = ["position-preferences", "application-state"] as const satisfies readonly CandidateContextDocumentKey[];
  const documents: Partial<Record<(typeof keys)[number], { version: number; body: string }>> = {};
  const missing: string[] = [];
  for (const key of keys) {
    try {
      const document = await clients.context.getDocument(key);
      documents[key] = { version: document.version, body: document.body };
    } catch (error) {
      if (error instanceof CareerBackendHttpError && error.status === 404) missing.push(key);
      else throw error;
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `후보자 맥락 문서가 없다: ${missing.join(", ")}. ${MANAGE_COMMAND} put --key <documentKey> --file <markdownPath> --expected-version 0 --note <note> 로 만든 뒤 다시 실행한다.`,
    );
  }
  const preferences = documents["position-preferences"]!;
  const applicationState = documents["application-state"]!;

  const expected = positionContextVersion(preferences.version);
  const content = {
    candidateContextVersion: expected,
    documents: {
      "position-preferences": preferences,
      "application-state": applicationState,
    },
  };
  writeFileSync(output, `${JSON.stringify(content, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return { candidateContextVersion: expected };
}
