import { writeFileSync } from "node:fs";
import { assertOutsideRepository } from "../candidate-context/repository-guard.ts";
import {
  contextDocumentPath,
  readContextDocument,
  type ContextDocument,
} from "../lib/career-store/context.ts";
import { CareerStoreError } from "../lib/career-store/errors.ts";

const REQUIRED_DOCUMENTS = ["position-preferences", "application-state"] as const;

/**
 * 수집 전에 작업 폴더 `context/` 의 두 맥락 문서를 읽어 실행 폴더의 `candidate-context.json` 에 쓴다.
 * 문서가 없으면 쓰지 않고 던진다. 빈 기준으로 수집과 분석을 이어 가지 않는다.
 *
 * 공고 분석의 기준 버전은 `position-preferences` 본문에서 계산한다(ADR-146).
 * 개인 맥락이므로 저장소 안 경로에는 쓰지 않는다.
 */
export function prepareCandidateContext(
  paths: { candidateContext: string },
  workspaceRoot: string,
): { candidateContextVersion: string } {
  const output = assertOutsideRepository(paths.candidateContext, "candidate-context.json");

  const documents = new Map<(typeof REQUIRED_DOCUMENTS)[number], ContextDocument>();
  const missing: string[] = [];
  for (const key of REQUIRED_DOCUMENTS) {
    try {
      documents.set(key, readContextDocument(workspaceRoot, key));
    } catch (error) {
      if (error instanceof CareerStoreError && error.code === "CANDIDATE_CONTEXT_MISSING") {
        missing.push(key);
      } else throw error;
    }
  }
  if (missing.length > 0) {
    const targets = missing
      .map((key) => contextDocumentPath(workspaceRoot, key as ContextDocument["key"]))
      .join(", ");
    throw new Error(
      `후보자 맥락 문서가 없다: ${missing.join(", ")}. 문서 본문을 ${targets} 에 쓴 뒤 다시 실행한다. 문서 자체가 아직 없으면 먼저 사용자와 문서를 쓴다.`,
    );
  }

  const preferences = documents.get("position-preferences")!;
  const content = {
    candidateContextVersion: preferences.version,
    documents: {
      "position-preferences": { body: preferences.body },
      "application-state": { body: documents.get("application-state")!.body },
    },
  };
  writeFileSync(output, `${JSON.stringify(content, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return { candidateContextVersion: preferences.version };
}
