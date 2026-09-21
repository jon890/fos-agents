# Phase 03. 정책과 회사와 수집 실행을 질의 단위로 옮긴다

**Execution profile**: deep

## 목표

포지션 도메인의 앞쪽 절반을 NestJS와 Prisma 위로 옮긴다.
분석 정책, 회사 선호, 수집 실행 저장, 회사 tier 평가 반영이다.

이 phase가 끝나면 endpoint 다섯 개가 기존과 같은 응답을 준다.

| method | 경로 | 기존 메서드 |
| --- | --- | --- |
| PUT | `/api/positions/v1/analysis-policy` | `configurePolicy` |
| GET | `/api/positions/v1/company-preferences` | `listCompanyPreferences` |
| PUT | `/api/positions/v1/company-preferences/{key}` | `updateCompanyPreference` |
| POST | `/api/positions/v1/collection-runs` | `saveCollection` |
| POST | `/api/positions/v1/company-tier-runs/{id}/results` | `saveCompanyTierResults` |

**범위 외**: 공고 분석 실행과 추천 실행. Phase 04와 05가 가진다.
`MemoryPositionRepository`와 `SqlPositionRepository`를 이 phase에서 지우지 않는다.
Phase 05까지 기존 코드가 남아 있어야 아직 옮기지 않은 endpoint가 돈다.

## 컨텍스트

**지금 구조가 왜 문제인지 알고 시작한다.**
`SqlPositionRepository`는 `MemoryPositionRepository`를 상속한다.
기동할 때 `fos_career` 전체를 Map 열 개로 읽고, 쓰기마다 상태 전체를 다시 쓴다.
이 phase가 옮기는 것은 그 구조를 버리고 필요한 행만 읽고 바뀐 행만 쓰는 것이다.

옮길 원본은 `position/service.ts`의 다음 줄이다.

| 메서드 | 줄 |
| --- | --- |
| `configurePolicy` | 257 |
| `listCompanyPreferences` | 264 |
| `updateCompanyPreference` | 271 |
| `saveCollection` | 288 |
| `selectCompanies` | 423 |
| `preparationResponse` | 499 |
| `companyTierQueueResponse` | 552 |
| `saveCompanyTierResults` | 774 |
| `companyTierResultsResponse` | 896 |

`position/schema.ts`와 `position/hash.ts`와 `position/queue.ts`와 `position/tier-provenance.ts`는
순수 함수와 zod schema라 그대로 옮긴다. 안을 고치지 않는다.

**근거 문서**: `docs/adr/ADR-122-추천-상태는-질의-단위로-읽고-쓴다.md`,
`docs/data-schema.md`의 「회사 tier 평가 이력」 절,
`docs/adr/ADR-120-회사-tier는-사람-override와-모델-평가를-분리해-저장한다.md`

## 의도 메모

**쓰기 트랜잭션은 자기 실행 행을 먼저 잠근다.**
지금은 `transactionTail`이 프로세스 안의 모든 쓰기를 순서대로 세워 동시성 문제를 덮고 있다.
그 잠금이 사라지므로 행 잠금이 그 자리를 대신해야 한다.
`saveCollection`은 수집 실행 행을, `saveCompanyTierResults`는 회사 tier 실행 행을,
`configurePolicy`는 정책 행을 잠근다.

멱등 키가 같으면 Phase 02의 interceptor가 먼저 막는다.
행 잠금이 막는 것은 **멱등 키가 다른 두 요청이 같은 실행에 동시에 오는 경우**다.

**회사 tier 큐 선택의 순서를 SQL로 옮긴다.**
지금은 `selectCompanyTierQueue`가 메모리에서 정렬한다.
유효한 평가가 없는 회사를 활성 공고 수 순으로 먼저 고르고,
남은 자리는 만료된 이전 Tier 1, 2, 3 순으로 채운다.
다른 실행이 처리 중인 회사는 건너뛰고, 2시간이 지난 처리 중 표시는 `lease_expired`로 회수한다.
이 순서를 `ORDER BY`로 표현한다. `queue.ts`의 순수 함수는 남기고 단위 테스트로 계속 확인한다.

**완료된 회사 tier 실행에 대한 409 판정을 그대로 옮긴다.**
끝난 실행에 같은 본문을 다시 보내면 멱등 응답을 준다.
다만 그 실행이 고르지 않은 회사가 결과에 섞여 있으면 `409 VERSION_CONFLICT`로 거절한다.
멱등 키가 다르면 Phase 02의 interceptor를 지나쳐 여기까지 오기 때문이다.
이 판정을 빠뜨리면 실행에 속하지 않은 회사의 평가가 저장된다.

**`company_tier_source`가 `model`일 때만 평가 ID를 붙인다.**
`manual`과 `default`는 평가 ID가 `null`이어야 한다. DB의 `CHECK` 제약이 이것을 강제한다.
`tier-provenance.ts`가 이 규칙을 소유하므로 그 함수를 그대로 쓴다.

**tier 해결 순서는 `manual`, `model`, `default`다.** `exclude`는 값을 해결하기 전에 제거한다.

## 작업 항목

### 1. 순수 모듈 넷을 옮긴다

`position/schema.ts`, `position/hash.ts`, `position/queue.ts`, `position/tier-provenance.ts`를
`src/positions/` 아래로 옮긴다. import 경로만 고친다.

`schema.ts`가 읽는 `scripts/position-recommender/live-postings/contracts.ts`는
모노레포의 Bun 쪽에 남아 있다. 상대 경로로 계속 가리킨다.
이 파일은 두 실행 환경이 공유하는 유일한 계약 파일이다.

기존 `position/hash.test.ts`와 `position/queue.test.ts`를 Vitest로 옮긴다.
이 둘은 순수 함수 테스트라 DB가 필요 없다.

### 2. `src/positions/repository/` 신규

Prisma 질의를 담는다. 메서드를 도메인이 실제로 요구하는 단위로 만든다.
`load`나 `snapshot` 같은 전체 상태 메서드를 만들지 않는다.

이 phase가 필요한 것이다.

- `findPolicy()`와 `upsertPolicy(policy, tx)`
- `lockPolicy(tx)` — `SELECT ... FOR UPDATE`
- `listPreferences()`와 `upsertPreference(key, value, tx)`
- `findCollectionRun(collectionRunId)`와 `lockCollectionRun(id, tx)`
- `upsertPositions(candidates, tx)` — 바뀐 공고만 쓴다
- `insertPositionVersionIfNew(positionId, contentHash, snapshot, tx)`
- `findCompanyTierRunByCollectionRun(collectionRunId)`
- `lockCompanyTierRun(id, tx)`
- `selectCompanyTierQueue(limit, staleAfterDays, leaseCutoff, tx)` — 순서를 `ORDER BY`로
- `insertCompanyTierAssessments(rows, tx)`
- `updateCompanyTierRunItems(rows, tx)`

**행을 지우지 않는다.** 평가는 추가만 하고 과거 행을 갱신하지 않는다.

### 3. `src/positions/positions.service.ts` 신규

위 다섯 메서드를 옮긴다. `state` Map 조작을 repository 호출로 바꾼다.
응답 조립 함수 `preparationResponse`, `companyTierQueueResponse`, `companyTierResultsResponse`는
형태를 그대로 유지한다. 필드 하나라도 달라지면 client가 깨진다.

`POLICY_NOT_CONFIGURED` 판정을 유지한다.
정책을 설정하지 않은 상태의 수집 요청은 기본값을 추정하지 않고 409로 거절한다.

### 4. `src/positions/positions.controller.ts` 신규

이 phase의 endpoint 다섯 개만 등록한다.
쓰기 넷에는 Phase 02의 멱등 interceptor가 걸린다.
본문 검증은 zod pipe로 하고 schema는 `src/positions/schema.ts`의 것을 쓴다.

응답 상태 코드를 정확히 맞춘다.
`POST /collection-runs`는 201, 나머지 넷은 200이다.

### 5. 이 phase를 검증하는 `test/positions-collection.e2e.test.ts`

실제 MySQL을 쓴다. `CAREER_RECOMMENDATION_TEST_DATABASE_URL`이 없으면 실패한다.

`position/service.test.ts` 895줄 중 이 phase가 옮긴 메서드를 다루는 것을 여기로 가져온다.
메모리 저장소 대신 실제 DB를 쓰도록 준비 절차를 바꾼다.

새로 더할 것이다.

- 정책을 설정하지 않은 상태의 수집 요청이 `409 POLICY_NOT_CONFIGURED`
- 같은 `collectionRunId`로 두 번 저장하면 두 번째가 첫 응답과 같다
- 회사 tier 큐가 비면 회사 tier 실행이 만들어지는 즉시 `completed`
- 끝난 회사 tier 실행에 그 실행이 고르지 않은 회사를 보내면 `409 VERSION_CONFLICT`
- `company_tier_source`가 `manual`이나 `default`인 행의 `company_tier_assessment_id`가 `null`
- 처리 중 표시가 2시간을 넘긴 회사가 `lease_expired`로 회수되어 다시 선택된다
- **행 잠금 확인**: 멱등 키가 다른 두 요청을 같은 회사 tier 실행에 동시에 보내면
  하나만 반영되고 다른 하나는 거절되거나 같은 결과를 본다. 두 요청이 뒤섞인 상태가 남지 않는다

마지막 항목이 이 phase의 핵심 위험이다.
**이 테스트가 잠금을 끄면 실패하는지 확인한다.** 실패하지 않으면 그 테스트는 아무것도 막지 않는다.

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
- Phase 01과 02의 테스트가 계속 통과
- 이 phase의 테스트가 모두 통과
- 출력에 `skipped`가 없다

**잠금 테스트가 회귀를 실제로 잡는지 확인한다.**
`lockCompanyTierRun`의 `FOR UPDATE`를 잠시 없애고 테스트를 돌린다.
그 테스트만 실패해야 한다. 확인한 뒤 되돌린다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/src/positions/schema.ts` | 이동 |
| `career-os/services/recommendation-api/src/positions/hash.ts` | 이동 |
| `career-os/services/recommendation-api/src/positions/queue.ts` | 이동 |
| `career-os/services/recommendation-api/src/positions/tier-provenance.ts` | 이동 |
| `career-os/services/recommendation-api/src/positions/repository/` | 신규 |
| `career-os/services/recommendation-api/src/positions/positions.service.ts` | 신규 |
| `career-os/services/recommendation-api/src/positions/positions.controller.ts` | 신규 |
| `career-os/services/recommendation-api/src/positions/positions.module.ts` | 신규 |
| `career-os/services/recommendation-api/test/positions-collection.e2e.test.ts` | 신규 |
| `career-os/services/recommendation-api/src/positions/hash.test.ts` | 이동 |
| `career-os/services/recommendation-api/src/positions/queue.test.ts` | 이동 |
