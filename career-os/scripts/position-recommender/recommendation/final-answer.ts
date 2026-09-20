/**
 * 사용자가 받는 최종 답변에 넣을 수집 경고 줄을 만든다.
 *
 * 수집 소스가 부분 실패해도 공개 HTML과 Backend 응답에만 남고
 * 최종 답변에는 전달되지 않는 일이 있었다. cron job 지시문이 정한 답변 형식에
 * 수집 경고 자리가 없었기 때문이다.
 * 답변 문구를 지시문 대신 이 함수가 만들어 cron 실행과 수동 실행이 같은 줄을 쓴다.
 *
 * ## 공개 경계
 *
 * 줄은 소스명, 상태와 실패 건수로만 만들고 마지막에 고정 문장 하나를 붙인다.
 * Backend가 채운 `reason`은 쓰지 않는다. 그 필드는 스키마가 임의의 문자열을 허용하므로
 * 원본 오류 문구나 URL이 들어오면 그대로 최종 답변까지 나간다.
 */
import type { RecommendationRunType } from "./schema.ts";

/** 실패한 소스가 있을 때 마지막에 붙이는 문장. */
export const COLLECTION_WARNING_NOTE = "일부 공고를 확인하지 못해 후보가 누락됐을 수 있습니다.";

/**
 * 소스별 경고 줄 뒤에 `COLLECTION_WARNING_NOTE`를 붙여 돌려준다.
 * 경고가 없으면 빈 배열이다. 호출하는 쪽은 빈 배열에 줄을 만들지 않는다.
 */
export function collectionWarningLines(run: RecommendationRunType): string[] {
  const warnings = run.collectionHealth.warningSources;
  if (warnings.length === 0) return [];
  return [
    ...warnings.map(
      (warning) => `${warning.source} · ${warning.status} · 실패 ${warning.failedCount}건`,
    ),
    COLLECTION_WARNING_NOTE,
  ];
}
