# Phase 02. 실패 보고와 재시도 상태 전이

**Execution profile**: deep

## 목표

선택한 공고 하나가 분석되지 않아도 실행 전체가 막히지 않도록 실패를 기록하고,
남은 항목만 다시 제출해 이어서 처리하는 상태 전이와 HTTP 계약을 만든다.

**범위 외**: client 스크립트와 `position-recommender` 스킬 문구, 실제 MySQL 통합 확인과
배포 선행 조건은 Phase 03이 담당한다.
추천 JSON과 HTML의 항목별 표시는 이 plan의 범위 밖이다.

## 컨텍스트

Phase 01이 `position_analysis_run_items`에 `result_status`, `analysis_id`, `failure_code`,
`attempt_count`, `completed_at`을 두었고 `position_analysis_runs.status`에 `partial`을 열어 뒀다.
이 phase는 그 열을 실제로 쓰는 쪽을 만든다.

지금 `services/recommendation-api/position/service.ts`의 `saveAnalysisResults`는
선택한 모든 공고의 분석이 한 번씩 오지 않으면 409를 반환한다.
분석하지 못한 공고가 하나라도 있으면 제출 자체가 불가능하므로 실행은 `pending`에 머물고
`createRecommendation`이 409를 반환해 그날 추천이 만들어지지 않는다.

같은 경로에 두 가지 결함이 더 있다.

- `createRecommendation`의 `reusedCount`는 `ranked.length - run.analyzedNowCount`로 계산한다.
  분석을 반영한 뒤 추천을 만들기 전에 새 수집 실행이 같은 공고의 본문 hash를 바꾸면
  방금 만든 분석이 `fresh`에서 빠져 순위가 줄어든다.
  그러면 `analyzedNowCount`가 순위에 든 수보다 커져 값이 음수가 되고,
  `recommendationResponseSchema`가 음수를 받지 않으므로 응답 생성이 실패한다.
- `saveAnalysisResults`가 이미 완료된 실행에 대해 돌려주는 `reused: true`는
  분석 재사용이 아니라 「이 제출을 처리하지 않았다」는 뜻이다. 이름이 실제 뜻과 다르다.

멱등은 두 층으로 지킨다.
HTTP 층은 `http/idempotency.ts`와 `request_receipts`가 담당하며
같은 키에 같은 본문이면 저장한 응답을, 다른 본문이면 409를 반환한다.
저장 층은 `position_analyses`의
`UNIQUE (position_version_id, candidate_context_version, contract_version)`가 담당한다.

**근거 문서**: `docs/flow.md`의 「포지션 추천」,
`docs/code-architecture.md`의 「추천 상태 Backend」,
`docs/data-schema.md`의 「공고별 분석 이력」

## 의도 메모

- 실패한 공고는 분석 행을 만들지 않는다. 점수가 없는 분석을 남기면 재사용 판정이 오염된다.
- 실패한 공고는 추천의 분석 대기 목록에 그대로 남는다.
  `freshAnalysis`가 없으므로 별도 코드 없이 그렇게 된다.
- 부분 실패에도 추천을 만든다. 공고 하나를 분석하지 못한 것이 그날 추천 전체를 막을 이유가 되지 않는다.
- 재시도는 아직 끝나지 않은 항목만 대상으로 한다.
  이미 `created`나 `reused`인 항목을 다시 제출해도 새 분석을 만들지 않는다.
- 실행이 스스로 재시도하지 않는다. 다시 부르는 쪽은 client다.
  Backend는 언제 다시 불러도 되는 상태만 정확히 알려 준다.
- `failure_code`는 닫힌 목록으로 둔다. 자유 문자열을 받으면 집계할 수 없고 외부 오류 원문이 섞여 들어온다.

## 작업 항목

### 1. `position/schema.ts`의 계약 변경

실패 사유를 닫힌 목록으로 정의한다.

```ts
export const analysisFailureCodeSchema = z.enum([
  "posting_body_missing",
  "model_unavailable",
  "contract_rejected",
  "internal_error",
]);
```

| 값 | 쓰는 상황 |
| --- | --- |
| `posting_body_missing` | 공고 본문이 비어 있거나 판단할 내용이 없다 |
| `model_unavailable` | 모델 호출이 실패했거나 응답을 받지 못했다 |
| `contract_rejected` | 모델 응답이 분석 계약을 만족하지 못했다 |
| `internal_error` | 위 셋에 해당하지 않는 client 내부 오류다 |

`analysisResultsRequestSchema`를 아래로 바꾼다.

```ts
export const analysisFailureSchema = z
  .object({
    positionId: nonEmpty,
    failureCode: analysisFailureCodeSchema,
  })
  .strict();

export const analysisResultsRequestSchema = z
  .object({
    schemaVersion: z.literal(2),
    collectionRunId: nonEmpty,
    results: z.array(analysisUpdateSchema).default([]),
    failures: z.array(analysisFailureSchema).default([]),
  })
  .strict();
```

결과 응답 계약을 새로 정의한다. 지금은 `routes`와 client가 각각 인라인으로 들고 있다.

```ts
export const analysisResultsResponseSchema = z
  .object({
    analysisRunId: nonEmpty,
    status: z.enum(["pending", "partial", "completed"]),
    createdCount: z.number().int().nonnegative(),
    reusedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    remainingCount: z.number().int().nonnegative(),
    applied: z.boolean(),
  })
  .strict();
```

`applied`는 이번 요청이 상태를 바꿨는지를 알려 준다.
이미 완료된 실행에 다시 제출하면 `false`가 되며 기존 `reused: true`를 대체한다.
`remainingCount`는 아직 `created`나 `reused`가 아닌 항목 수다.

`analysisQueueCandidateSchema`에 `resultStatus`를 더한다.

```ts
resultStatus: z.enum(["pending", "created", "reused", "failed"]),
```

`analysisQueueResponseSchema`의 `schemaVersion`을 2로 올리고 `summary`에 두 값을 더한다.

```ts
completedCount: z.number().int().nonnegative(),
failedCount: z.number().int().nonnegative(),
```

`completedCount`는 선택 항목 중 `created`와 `reused`의 합이고 `failedCount`는 `failed` 수다.
선택 목록 자체는 줄이지 않는다. 실행이 무엇을 골랐는지가 응답에 그대로 남아야 감사에 쓸 수 있다.
분석 대상을 고르는 일은 목록을 받는 쪽이 `resultStatus`로 한다.

`collectionRequestSchema`의 `schemaVersion`도 2로 올린다.
큐 응답 형태가 달라지므로 이전 형식으로 저장된 `analysis-queue.json`을 그대로 쓰면 안 된다.

`recommendationResponseSchema`는 필드를 바꾸지 않는다.

### 2. `position/service.ts`의 결과 반영 규칙 변경

`saveAnalysisResults(analysisRunId, value, now)`를 아래 순서로 고친다.

1. 실행을 찾고 `collectionRunId`가 요청과 같은지 확인한다. 다르면 409를 반환한다.
2. `run.status === "completed"`면 상태를 바꾸지 않고 현재 집계와 `applied: false`를 반환한다.
3. 아직 끝나지 않은 항목을 모은다. `resultStatus`가 `pending` 또는 `failed`인 항목이다.
4. 요청의 `results`와 `failures`가 가리키는 `positionId`의 합집합이
   3의 집합과 정확히 같아야 한다. 중복이 있거나 집합이 다르면 409를 반환한다.
   메시지는 「아직 끝나지 않은 모든 공고의 결과가 한 번씩 필요합니다.」로 한다.
5. `results`의 각 항목을 반영한다.
   같은 공고 version과 기준 버전과 계약 버전의 분석이 이미 있으면 그것을 쓰고 `reused`로 기록한다.
   없으면 분석을 만들고 `createdByAnalysisRunId`를 이 실행으로 채운 뒤 `created`로 기록한다.
   두 경우 모두 `completedAt`을 `now`로, `failureCode`를 `null`로 두고 `attemptCount`를 1 올린다.
   해당 공고의 `pendingSince`는 `null`로 만든다.
6. `failures`의 각 항목을 반영한다.
   `resultStatus`를 `failed`로, `failureCode`를 요청 값으로, `completedAt`을 `now`로 두고
   `analysisId`는 `null`로 유지하며 `attemptCount`를 1 올린다.
   해당 공고의 `pendingSince`는 그대로 둔다. 아직 분석을 기다리는 공고이기 때문이다.
7. `run.analyzedNowCount`를 `created` 항목 수로 다시 계산한다.
8. `failed` 항목이 남으면 `run.status`를 `partial`로, 아니면 `completed`로 둔다.
   두 경우 모두 `run.completedAt`을 `now`로 둔다. 이 값은 마지막 제출을 처리한 시각이다.
9. 집계와 `applied: true`를 반환한다.

전이표는 아래와 같다.

| 항목의 현재 상태 | 들어온 것 | 다음 상태 | 함께 바뀌는 것 |
| --- | --- | --- | --- |
| 없음 | 큐 생성 시 선택 | `pending` | `analysisId`와 `completedAt`과 `failureCode`가 `null`, `attemptCount`는 0 |
| `pending` | 분석 결과, 같은 조건의 분석 없음 | `created` | 새 분석 ID, `completedAt` 갱신, `attemptCount` 1 증가 |
| `pending` | 분석 결과, 같은 조건의 분석 있음 | `reused` | 기존 분석 ID, `completedAt` 갱신, `attemptCount` 1 증가 |
| `pending` | 실패 보고 | `failed` | `failureCode` 기록, `completedAt` 갱신, `attemptCount` 1 증가 |
| `failed` | 분석 결과 | `created` 또는 `reused` | `failureCode`를 `null`로, `attemptCount` 1 증가 |
| `failed` | 실패 보고 | `failed` | `failureCode` 갱신, `attemptCount` 1 증가 |
| `created` 또는 `reused` | 무엇이든 | 바뀌지 않음 | 요청 4에서 집합이 달라 409가 된다 |

실행 상태 전이는 아래와 같다.

| 현재 | 조건 | 다음 |
| --- | --- | --- |
| 없음 | 선택 항목이 0건 | `completed`, `completedAt`은 생성 시각 |
| 없음 | 선택 항목이 1건 이상 | `pending` |
| `pending` | 제출 처리 뒤 `failed`가 없음 | `completed` |
| `pending` | 제출 처리 뒤 `failed`가 있음 | `partial` |
| `partial` | 재제출 뒤 `failed`가 없음 | `completed` |
| `partial` | 재제출 뒤에도 `failed`가 있음 | `partial` |
| `completed` | 어떤 제출이든 | `completed`, 상태를 바꾸지 않음 |

### 3. 추천 생성 조건과 집계 수정

`createRecommendation`에서 다음을 고친다.

- 선행 조건을 `run.completedAt`이 있는지에서 `run.status !== "pending"`으로 바꾼다.
  `partial`이면 추천을 만든다. 실패한 공고는 `pendingCandidates`에 남는다.
- `analysisSummary`의 두 값을 순위 기준으로 다시 정의한다.

  ```ts
  analyzedNowCount: ranked.filter(
    ({ analysis }) => analysis.createdByAnalysisRunId === run.analysisRunId,
  ).length,
  reusedCount: ranked.length - analyzedNowCount,
  ```

  둘의 합은 항상 순위 길이와 같으므로 음수가 생기지 않는다.

`position_analysis_runs.analyzed_now_count`는 이 실행이 만든 분석 수를 그대로 유지한다.
추천 응답의 `analyzedNowCount`는 그중 순위에 든 수다.
두 값은 보통 같지만 분석을 만든 뒤 같은 요청 안에서 공고가 순위에서 빠지면 달라질 수 있다.
이 차이를 `docs/data-schema.md`에 한 문장으로 적는다.

### 4. `queueResponse`에 결과 상태 반영

`candidates`의 각 항목에 `resultStatus`를 넣고 `summary`에 `completedCount`와 `failedCount`를 더한다.
`reusedCount`, `pendingCount`, `newCount`, `changedCount`, `staleCount`의 뜻은 바꾸지 않는다.
이 값들은 활성 공고 전체를 기준으로 하고 `completedCount`와 `failedCount`는 선택 항목을 기준으로 한다.
두 기준이 다르다는 것을 `docs/data-schema.md`의 큐 응답 설명에 적는다.

### 5. `routes/positions.ts`의 응답 계약 적용

결과 반영 endpoint가 `analysisResultsResponseSchema`로 응답을 검증하도록 한다.
경로와 method는 바꾸지 않는다.
`Idempotency-Key` 요구도 그대로 둔다.

### 6. 책임 문서 갱신

`docs/flow.md`의 「포지션 추천」에서 다음을 고친다.

- 9번 항목을 「client가 분석 결과와 분석하지 못한 공고를 실행 ID와 함께 보낸다.
  Backend는 아직 끝나지 않은 항목 전체와 대조하고 한 트랜잭션으로 반영한다」로 바꾼다.
- 10번 앞에 「실패한 공고가 남으면 실행은 `partial`로 남고 client는 남은 항목만 다시 보낸다」를 더한다.
- mermaid 흐름도의 `N[분석 결과를 Backend에 원자 반영]` 뒤에 실패 분기를 더한다.
  `partial`이면 재제출로 돌아가거나 그대로 추천 조립으로 진행할 수 있어야 한다.
- 절 끝의 「분석 반영은 Backend가 선택한 항목 전체와 일치할 때만 성공한다」를
  「분석 반영은 아직 끝나지 않은 항목 전체와 일치할 때만 성공한다」로 바꾼다.

`docs/code-architecture.md`의 「추천 상태 Backend」에
결과 반영이 성공과 실패를 함께 받고 실행 상태를 `pending`, `partial`, `completed`로 돌려준다는 문장을 더한다.

`docs/data-schema.md`에 작업 항목 3과 4에서 정한 두 문장을 더하고,
큐 응답과 분석 갱신 파일의 `schemaVersion`이 2라는 것을 반영한다.

### 7. 이 phase를 검증하는 테스트

`position/service.test.ts`에 다음을 더한다.

- 선택 2건 중 1건은 분석 결과, 1건은 실패 보고로 제출하면
  실행 상태가 `partial`이고 응답이 `createdCount: 1`, `failedCount: 1`, `remainingCount: 1`이다.
- 그 상태에서 추천을 만들면 성공하고 실패한 공고가 `pendingCandidates`에 있다.
- 남은 1건을 분석 결과로 다시 제출하면 상태가 `completed`가 되고
  그 항목의 `attemptCount`가 2, `failureCode`가 `null`이다.
- 완료된 실행에 다시 제출하면 `applied: false`를 반환하고 분석 수가 늘지 않는다.
- 이미 끝난 항목까지 포함해 제출하면 409를 반환한다.
- 같은 공고 version과 기준 버전의 분석이 이미 있는 항목을 제출하면 `reused`가 되고
  그 분석의 `createdByAnalysisRunId`는 처음 만든 실행으로 남는다.
- 순위에 든 분석이 모두 과거 실행이 만든 것이면
  추천 응답의 `analyzedNowCount`가 0이고 `reusedCount`가 순위 길이와 같다.

`app.test.ts`에 결과 반영 endpoint가 새 응답 계약을 지키는지 확인하는 항목을 더한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/services/recommendation-api
bunx tsc --noEmit
python3 ~/.claude/scripts/korean-style-check.py career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md
python3 ~/.claude/scripts/check-readability.py career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md
git diff --check
```

이 시점에서 `career-os/scripts/position-recommender`의 테스트는 실패한다.
client가 아직 `schemaVersion: 1`을 보내기 때문이며 Phase 03이 그것을 고친다.
Phase 02를 끝낼 때 그 실패 목록을 확인해 Phase 03에서 모두 사라지는지 대조한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/recommendation-api/position/schema.ts` | 수정 |
| `services/recommendation-api/position/service.ts` | 수정 |
| `services/recommendation-api/routes/positions.ts` | 수정 |
| `services/recommendation-api/position/service.test.ts` | 수정 |
| `services/recommendation-api/app.test.ts` | 수정 |
| `docs/flow.md` | 수정 |
| `docs/code-architecture.md` | 수정 |
| `docs/data-schema.md` | 수정 |
