import { writeFileSync } from "node:fs";
import type { CareerBackendClient } from "../position-recommender/career-backend/client.ts";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { hashKey, type CandidateContextClient } from "./client.ts";
import type { CandidateContextDocumentKey } from "./contracts.ts";
import { assertOutsideRepository } from "./repository-guard.ts";

export const SYNC_POSITION_POLICY_COMMAND = "career-os/scripts/candidate-context/manage_candidate_context.ts sync-position-policy";
const MANAGE_COMMAND = "career-os/scripts/candidate-context/manage_candidate_context.ts";
const CONFIGURE_POLICY_COMMAND = "career-os/scripts/position-recommender/configure_position_analysis_policy.ts --input <정책 JSON>";

/** 분석 정책의 기준 버전은 `position-preferences` 문서 version 에서 계산한다. ADR-132 를 따른다. */
export const positionContextVersion = (version: number) => `position-preferences:v${version}`;

type PolicyReader = Pick<CareerBackendClient, "getAnalysisPolicy">;
type PolicyClient = Pick<CareerBackendClient, "getAnalysisPolicy" | "configureAnalysisPolicy">;
type DocumentReader = Pick<CandidateContextClient, "getDocument">;

/** 정책이 아직 없으면 먼저 만드는 명령을 알린다. 그 밖의 오류는 그대로 둔다. */
function explainPolicyError(error: unknown): unknown {
  if (error instanceof CareerBackendHttpError && error.code === "POLICY_NOT_CONFIGURED") {
    return new Error(
      `포지션 분석 정책이 없다. ${CONFIGURE_POLICY_COMMAND} 로 정책을 먼저 만든 뒤 ${SYNC_POSITION_POLICY_COMMAND} 를 실행한다.`,
      { cause: error },
    );
  }
  return error;
}

async function readPolicy(positions: PolicyReader) {
  try {
    return await positions.getAnalysisPolicy();
  } catch (error) {
    throw explainPolicyError(error);
  }
}

/**
 * 정책을 읽어 `candidateContextVersion` 만 바꿔 보낸다. 이미 같으면 보내지 않는다.
 * 멱등 키는 읽은 정책 전체와 목표 version 의 hash 다. version 만으로 키를 만들면 정책의 다른 칸이
 * 바뀐 뒤 같은 키로 보냈을 때 충돌하거나 저장된 응답이 재생된다.
 * 재생된 응답은 DB 를 바꾸지 않았을 수 있어, 보낸 뒤 다시 읽어 목표 값인지 확인한다.
 */
export async function syncPositionPolicy(input: {
  positions: PolicyClient;
  version: number;
}): Promise<{ candidateContextVersion: string; changed: boolean }> {
  const target = positionContextVersion(input.version);
  const current = await readPolicy(input.positions);
  if (current.candidateContextVersion === target) return { candidateContextVersion: target, changed: false };

  await input.positions.configureAnalysisPolicy(
    { ...current, candidateContextVersion: target },
    hashKey("analysis-policy-sync", { policy: current, candidateContextVersion: target }),
  );
  const confirmed = await readPolicy(input.positions);
  if (confirmed.candidateContextVersion !== target) {
    throw new Error(
      `정책 갱신 뒤 다시 읽은 candidateContextVersion 이 ${confirmed.candidateContextVersion} 이다. 목표는 ${target} 이다. 정책을 확인한 뒤 ${SYNC_POSITION_POLICY_COMMAND} 를 다시 실행한다.`,
    );
  }
  return { candidateContextVersion: target, changed: true };
}

/**
 * 수집 전에 `position-preferences` 문서 version 과 정책 기준 버전이 같은지 확인하고,
 * 같으면 두 문서를 `candidate-context.json` 에 쓴다. 다르거나 문서가 없으면 쓰지 않고 오류를 던진다.
 * 개인 맥락이므로 저장소 안 경로에는 쓰지 않는다.
 */
export async function prepareCandidateContext(
  paths: { candidateContext: string },
  clients: { positions: PolicyReader; context: DocumentReader },
): Promise<{ candidateContextVersion: string }> {
  const output = assertOutsideRepository(paths.candidateContext, "candidate-context.json 경로");

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
  const policy = await readPolicy(clients.positions);
  if (policy.candidateContextVersion !== expected) {
    throw new Error(
      `분석 정책의 candidateContextVersion 이 ${policy.candidateContextVersion} 인데 position-preferences 문서 기준은 ${expected} 이다. ${SYNC_POSITION_POLICY_COMMAND} 로 맞춘 뒤 다시 실행한다.`,
    );
  }

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
