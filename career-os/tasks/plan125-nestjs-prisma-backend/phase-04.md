# Phase 04. 공고 분석 실행과 반영을 옮긴다

**Execution profile**: deep

## 목표

포지션 도메인의 뒤쪽 절반 중 분석 부분을 옮긴다.

| method | 경로 | 기존 메서드 |
| --- | --- | --- |
| POST | `/api/positions/v1/collection-runs/{id}/analysis-runs` | `createPositionAnalysisRun` |
| POST | `/api/positions/v1/analysis-runs/{id}/results` | `saveAnalysisResults` |

**범위 외**: 추천 실행과 실행 조회. Phase 05가 가진다.

## 컨텍스트

옮길 원본은 `position/service.ts`의 다음 줄이다.

| 메서드 | 줄 |
| --- | --- |
| `createPositionAnalysisRun` | 914 |
| `saveAnalysisResults` | 683 |
| `analysisSummary` | 514 |
| `queueResponse` | 629 |
| `resultsResponse` | 759 |

Phase 03이 만든 `src/positions/repository/`에 질의를 더한다. 새 디렉터리를 만들지 않는다.

**근거 문서**: `docs/adr/ADR-117-포지션-분석은-우선순위-큐와-버전-이력으로-재사용한다.md`,
`docs/adr/ADR-119-분석-실행의-처리-결과와-분석의-생성-출처를-분리해-저장한다.md`,
`docs/data-schema.md`의 「공고별 분석 이력」 절

## 의도 메모

**분석 큐 선택의 순서를 SQL로 옮긴다.**
지금은 `selectAnalysisQueue`가 메모리에서 정렬한다.
회사 tier, 분석 상태, 마감 긴급도, 대기 시작 시각 순으로 고른다.
우선 슬롯과 오래 기다린 공고 보장 슬롯이 따로 있고,
한쪽의 후보가 부족하면 다른 쪽이 남은 자리를 쓴다.
이 규칙을 `ORDER BY`와 두 번의 조회로 표현한다.
`queue.ts`의 순수 함수는 남기고 단위 테스트로 계속 확인한다.

**같은 사실이 두 자리에 있다. 둘 다 써야 한다.**
`position_analysis_run_items.result_status`와
`position_analyses.created_by_analysis_run_id`가 그것이다.
ADR-119가 이 중복을 의도한 것으로 기록했고 정합성 조회로 확인하는 구조다.
한쪽만 쓰면 감사 조회가 어긋난다.

**회사 tier 실행이 끝나지 않았으면 분석 실행을 만들지 않는다.**
`409 COMPANY_TIER_RUN_PENDING`으로 거절한다.
회사 tier 실행 자체가 없으면 `409 COMPANY_TIER_RUN_MISSING`이다. 두 코드가 다르다.

**분석 반영은 아직 끝나지 않은 항목 전체와 일치할 때만 성공한다.**
일부만 보내면 `409 VERSION_CONFLICT`다.
실패한 공고가 남으면 실행은 `partial`로 남고 client가 남은 항목만 다시 보낸다.

**`company_tier_source`와 `company_tier_assessment_id`를 분석 항목에 남긴다.**
tier를 해결한 시점의 출처를 보존하는 것이 목적이다. 나중에 다시 계산하지 않는다.

## 작업 항목

### 1. `src/positions/repository/`에 질의를 더한다

- `lockAnalysisRun(id, tx)` — `SELECT ... FOR UPDATE`
- `findAnalysisRunWithItems(id)`
- `findCompanyTierRunStatus(collectionRunId)`
- `resolveCompanyTiers(companyKeys, staleAfterDays)` — `manual`, `model`, `default` 순서를 질의로
- `selectAnalysisQueue(prioritySlots, agingSlots, staleAfterDays, tx)`
- `findFreshAnalyses(positionVersionIds, candidateContextVersion)`
- `insertAnalysisRun(run, items, tx)`
- `insertAnalyses(rows, tx)`
- `updateAnalysisRunItems(rows, tx)`
- `updateAnalysisRunStatus(id, status, tx)`

### 2. `src/positions/positions.service.ts`에 두 메서드를 더한다

`createPositionAnalysisRun`과 `saveAnalysisResults`를 옮긴다.
응답 조립 함수 `analysisSummary`, `queueResponse`, `resultsResponse`의 형태를 그대로 유지한다.

### 3. `src/positions/positions.controller.ts`에 endpoint 둘을 더한다

`POST /collection-runs/{id}/analysis-runs`는 201.
`POST /analysis-runs/{id}/results`는 200.

경로 변수는 `decodeURIComponent`를 거친다. 기존 라우터가 그렇게 한다.

### 4. 이 phase를 검증하는 `test/positions-analysis.e2e.test.ts`

실제 MySQL을 쓴다. `CAREER_RECOMMENDATION_TEST_DATABASE_URL`이 없으면 실패한다.

`position/service.test.ts`에서 이 phase가 옮긴 메서드를 다루는 것을 가져온다.

확인할 것이다.

- 회사 tier 실행이 `pending`이면 `409 COMPANY_TIER_RUN_PENDING`
- 회사 tier 실행이 없으면 `409 COMPANY_TIER_RUN_MISSING`
- tier 해결 순서가 `manual`, `model`, `default`다.
  세 출처를 모두 가진 회사가 `manual`로 해결된다
- `exclude`인 회사는 tier를 해결하기 전에 제거된다
- `fresh` 분석이 재사용되어 큐에 들어가지 않는다
- 우선 슬롯의 후보가 부족하면 보장 슬롯이 남은 자리를 쓴다
- 아직 끝나지 않은 항목 일부만 보내면 `409 VERSION_CONFLICT`
- 실패한 공고가 남으면 실행이 `partial`이고, 남은 항목만 다시 보내면 반영된다
- `position_analysis_run_items.result_status`와
  `position_analyses.created_by_analysis_run_id`가 서로 어긋나지 않는다.
  ADR-119의 정합성 조회를 SQL로 직접 돌려 0행인 것을 확인한다
- 분석 항목의 `company_tier_source`가 해결 시점의 값으로 남는다
- **행 잠금 확인**: 멱등 키가 다른 두 요청을 같은 분석 실행에 동시에 보내면
  하나만 반영되고 항목이 뒤섞이지 않는다

## 검증

Phase 01의 container를 쓴다.

```bash
# cwd: 저장소 루트
cd career-os/services/recommendation-api
npm run typecheck
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

기대값이다.

- `typecheck`가 종료 코드 0
- Phase 01에서 03까지의 테스트가 계속 통과
- 이 phase의 테스트가 모두 통과
- 출력에 `skipped`가 없다

**잠금 테스트가 회귀를 잡는지 확인한다.**
`lockAnalysisRun`의 `FOR UPDATE`를 잠시 없애고 그 테스트만 실패하는 것을 본 뒤 되돌린다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/src/positions/repository/` | 수정 |
| `career-os/services/recommendation-api/src/positions/positions.service.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/positions.controller.ts` | 수정 |
| `career-os/services/recommendation-api/test/positions-analysis.e2e.test.ts` | 신규 |
