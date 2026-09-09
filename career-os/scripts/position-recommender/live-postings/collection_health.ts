// 수집 실행 전체가 추천 입력으로 쓸 만한지 판정한다.
//
// 소스 하나가 실패해도 수집기는 남은 소스의 결과로 후보풀을 만든다.
// 그 자체는 의도한 동작이지만, 실패 개수를 판정하지 않으면 소스 대부분이
// 실패한 실행과 전부 성공한 실행이 같은 종료 코드로 끝난다.
//
// 실측으로 16개 소스 중 9개가 실패한 실행이 종료 코드 0 으로 끝나고
// 후보 122건을 정상 산출물로 남겼다. 전부 성공했을 때는 195건이었다.
// 빠진 73건에 그날 지원 대상이던 회사 셋이 모두 들어 있었다.

import type { SourceDiagnostic } from "./contracts.ts";

/** 실패 소스가 이 개수를 넘으면 실행 전체를 실패로 판정한다. */
export const DEFAULT_MAX_FAILED_SOURCES = 2;

export interface CollectionHealth {
  ok: boolean;
  configuredCount: number;
  failedSources: string[];
  maxFailedSources: number;
  /** 실행을 실패로 만든 사유. 통과했으면 빈 배열이다. */
  reasons: string[];
  /** 실행을 막지는 않지만 사람이 알아야 하는 것. */
  warnings: string[];
}

/**
 * 어댑터가 스스로 `failed` 로 보고하지 않아도 실패로 세는 경우가 있다.
 * 하나도 수집하지 못한 채 오류만 낸 소스다.
 *
 * 실측으로 연결이 전부 끊긴 실행에서 16개 중 6개가 이 형태로 `partial` 을 보고했다.
 * 정상 실행에서 결과가 0건인 소스는 오류 없이 `ok` 로 끝나므로 이 조건에 걸리지 않는다.
 *
 * `collectedCount` 의 뜻은 `contracts.ts` 의 `sourceDiagnosticSchema` 가 소유한다.
 */
function isFailedSource(diagnostic: SourceDiagnostic): boolean {
  if (diagnostic.status === "failed") return true;
  return diagnostic.collectedCount === 0 && diagnostic.failedCount > 0;
}

export function judgeCollectionHealth(
  diagnostics: SourceDiagnostic[],
  maxFailedSources: number,
  candidateCount: number,
): CollectionHealth {
  const failedSources = diagnostics.filter(isFailedSource).map((diagnostic) => diagnostic.source);
  const configuredCount = diagnostics.length;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (failedSources.length > maxFailedSources) {
    reasons.push(
      `소스 ${configuredCount}개 중 ${failedSources.length}개가 실패했다.` +
        ` 허용 개수는 ${maxFailedSources}개다. 실패한 소스: ${failedSources.join(", ")}`,
    );
  }

  // 후보가 0건이면 실패 소스가 허용 범위 안이어도 추천을 만들 수 없다.
  // 날마다 달라지는 개수의 하한이 아니라 실행 불가 상태다.
  if (candidateCount === 0) {
    reasons.push("후보가 0건이라 추천 입력으로 쓸 수 없다");
  }

  if (configuredCount > 0 && maxFailedSources >= configuredCount) {
    warnings.push(
      `허용 개수가 ${maxFailedSources}이고 소스 수가 ${configuredCount}여서 실패 판정이 동작하지 않는다`,
    );
  }
  // 실패 소스가 허용 범위 안에 있어도 사람은 그 이름을 알아야 한다.
  // 지원 대상 회사의 소스가 그 안에 있으면 결과가 조용히 줄어든 실행이다.
  if (failedSources.length > 0 && failedSources.length <= maxFailedSources) {
    warnings.push(`허용 범위 안에서 실패한 소스: ${failedSources.join(", ")}`);
  }

  return {
    ok: reasons.length === 0,
    configuredCount,
    failedSources,
    maxFailedSources,
    reasons,
    warnings,
  };
}
