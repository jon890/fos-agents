# Phase 02. 추천 조립과 수집 상태 표시

**Execution profile**: deep

## 목표

유효한 공고 분석만 결정적으로 순위화하고 분석 대기 공고와 수집 실패를 추천 JSON과 HTML에 표시한다.

**범위 외**: Hermes 세션 분리, 다른 저장소 수정, MySQL과 외부 queue 도입은 수행하지 않는다.

## 컨텍스트

기존 `recommendation/schema.ts` 버전 9는 모든 후보를 순위 배열에 넣도록 요구하고,
`validate_recommendation.ts`도 후보풀과 순위 수가 같아야 통과시킨다.
`render/recommendation-html.ts`는 `sourceDiagnosticsHtml`에 빈 문자열을 전달해 부분 실패를 사용자에게 보여주지 않는다.

**근거 문서**: `docs/data-schema.md`의 「실행 중 생성되는 포지션 추천 데이터」, `docs/flow.md`의 「포지션 추천」, `docs/code-architecture.md`의 「공고 추천」, `docs/adr/ADR-117-포지션-분석은-우선순위-큐와-버전-이력으로-재사용한다.md`

## 의도 메모

- 분석하지 않은 공고에 임의의 점수와 보류 사유를 만들지 않는다.
- 회사 티어는 분석 순서에 사용하며 높은 티어만으로 추천 결론을 만들지 않는다.
- 원본 오류 URL과 비공개 제외 사유는 공개 HTML에 넣지 않는다.
- 부분 실패는 성공으로 숨기지 않고 소스, 상태와 실패 건수를 표시한다.

## 작업 항목

### 1. 추천 스키마와 후보풀 대조 변경

`recommendation/schema.ts`의 버전을 올리고 `ranking`, `pendingCandidates`, `analysisSummary`와 `collectionHealth` 계약을 추가한다.
`ranking`은 현재 활성 후보 중 유효한 분석이 있는 공고만 담고,
`pendingCandidates`는 `new`, `changed`, `stale` 상태와 회사 티어를 담는다.
`analysisSummary`는 이번 실행 분석, 재사용, 대기와 전체 활성 공고 수를 담는다.
개인 제외 건수는 후보풀의 별도 집계를 그대로 사용한다.
`collectionHealth`는 후보 수, 설정 소스 수와 `partial` 또는 `failed` 소스의 공개 가능한 실패 요약을 담는다.

`validate_recommendation.ts`는 분석 순위와 대기 목록의 합집합이 개인 제외 후 후보풀 전체와 정확히 일치하는지 검사한다.
두 목록 사이의 중복, 원문 회사명·공고명·URL 불일치, 잘못된 집계와 누락된 소스 경고는 실패시킨다.

### 2. 결정적 추천 최종화 명령 추가

`finalize_position_recommendation.ts`는 현재 후보풀과 저장 분석을 읽고 `recommendation.json`과 HTML을 한 번에 만든다.
분석 순위는 `recommend`, `consider`, `hold`, `fitScore` 내림차순, 회사 티어, 마감 긴급도와 공고 ID 순서로 만든다.
상세 추천은 `recommend`와 `consider`만 사용하며 정해진 개수를 채우지 않는다.
최종화가 성공하면 현재 순위의 `collectionRunId`, 생성 시각, 순위와 결론을 공고별 `recommendationHistory`에 중복 없이 추가한다.

명령은 추천 JSON 대조, HTML 생성과 공개 계약 검사를 순서대로 실행한다.
중간 단계가 실패하면 성공 메시지를 내지 않고 기존 출력 파일을 덮어쓰지 않는다.
후보 상세 본문을 stdout에 출력하지 않고 집계와 생성 경로만 반환한다.

### 3. 분석 대기와 수집 경고 렌더링

`render/candidate-preview-html.ts`와 템플릿에 추천, 분석한 전체 순위와 분석 대기 목록을 구분해 표시한다.
대기 목록에는 회사, 공고명, 원문 링크, 회사 티어와 `미분석`, `공고 변경`, `분석 만료`만 표시한다.

`render/recommendation-html.ts`와 `render/validate-report-html.ts`는 수집 경고를 표시하고 검사한다.
예를 들어 쿠팡 상세 62건이 HTTP 429로 실패했다면 소스명, `partial`, 실패 62건과 후보 누락 가능성을 HTML에서 확인할 수 있어야 한다.
원본 오류 메시지와 URL 목록은 표시하지 않는다.

### 4. 최종화와 렌더 회귀 테스트

분석 순위와 대기 목록의 완전 분할, 유효기간이 지난 분석의 대기 전환, 결정적 정렬과 상세 추천 필터를 테스트한다.
수집 성공, 부분 실패, 전체 실패와 분석할 공고가 없는 빈 큐 HTML도 fixture로 검사한다.
추천 JSON 생성 또는 HTML 검증 실패 시 출력 보존과 종료 코드 1을 확인한다.

## 검증

저장소 루트에서 다음 명령을 실행한다.

```bash
# cwd: 저장소 루트
bun test career-os/scripts/position-recommender/recommendation/*.test.ts career-os/scripts/position-recommender/render/*.test.ts career-os/scripts/position-recommender/finalize_position_recommendation.test.ts
bunx tsc --noEmit
bun run format:position-recommender:check
git diff --check
```

부분 실패 fixture의 HTML에는 소스명과 실패 건수가 있고 전체 후보 본문이나 비공개 제외 사유가 없어야 한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `scripts/position-recommender/recommendation/schema.ts` | 수정 |
| `scripts/position-recommender/validate_recommendation.ts` | 수정 |
| `scripts/position-recommender/finalize_position_recommendation.ts` | 신규 |
| `scripts/position-recommender/render/candidate-preview-html.ts` | 수정 |
| `scripts/position-recommender/render/recommendation-html.ts` | 수정 |
| `scripts/position-recommender/render/validate-report-html.ts` | 수정 |
| `scripts/position-recommender/render/templates/*` | 수정 |
| `scripts/position-recommender/recommendation/*.test.ts` | 수정 |
| `scripts/position-recommender/render/*.test.ts` | 수정 |
| `scripts/position-recommender/finalize_position_recommendation.test.ts` | 신규 |
