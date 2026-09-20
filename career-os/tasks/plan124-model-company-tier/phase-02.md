# Phase 02. 회사 tier 평가 API와 2단계 우선순위 큐

**Execution profile**: deep

## 목표

수집 run에서 평가할 회사만 모델에 넘기고,
새 평가를 반영한 회사 tier로 공고 분석 큐를 만든다.

**범위 외**: `position-recommender` 스킬 지시, 임시 JSON 생성과 HTML 표시는 Phase 03이 담당한다.

## 컨텍스트

현재 `POST /api/positions/v1/collection-runs`는 수집 저장과 공고 분석 run 생성을 한 번에 한다.
회사 tier를 공고 선택 전에 적용하려면 수집 저장, 회사 tier 반영, 공고 분석 run 생성을 세 단계로 나눠야 한다.
각 쓰기는 기존 `Idempotency-Key`와 `request_receipts`를 재사용한다.

**근거 문서**: `docs/flow.md`의 「포지션 추천」,
`docs/code-architecture.md`의 「공고 추천」과 「추천 상태 Backend」,
`docs/data-schema.md`의 「포지션 분석 정책」과 「공고별 분석 이력」

## 의도 메모

- 모델 tier는 유효하면 승인 대기 없이 cron에 자동 적용한다.
- 우선순위는 `manual > model > default`다. `exclude`는 값 해결 전에 후보에서 제거한다.
- 모델 평가가 실패해도 전체 추천을 실패시키지 않는다. 이전 유효 평가나 기본 tier로 계속한다.
- 직무 적합도는 기존 공고 분석이 담당한다. 회사 tier 큐에 공고 본문을 넣지 않는다.
- 성장 범위, 보상 상승, 팀 성장 세 축은 정확한 점수가 아닌 근거 신호로 기록한다.

## 작업 항목

### 1. 회사 tier 요청·응답 계약을 추가한다

`position/schema.ts`에 다음 Zod schema와 type을 추가한다.

- `companyTierQueueResponseSchema`
- `companyTierResultSchema`
- `companyTierFailureSchema`
- `companyTierResultsRequestSchema`
- `companyTierResultsResponseSchema`
- `positionPreparationResponseSchema`

큐 항목은 `companyKey`, `companyName`, `assessmentStatus`, `activePositionCount`,
`representativePostingUrls` 최대 3개와 만료된 이전 평가의 tier·이유·만료일만 가진다.
`assessmentStatus`는 `new` 또는 `stale`이다.

결과는 Tier 1부터 3, 신뢰도, 종합 이유, 세 기회 축의 신호,
HTTPS 근거, 발행·확인 시각, 선택적 `validUntil`과 판정에 영향을 준 가정을 가진다.
세 축은 각각 한 번씩만 등장해야 하고 `unknown`은 확인하지 못한 사실로 채우지 않는다.

### 2. 수집 저장이 회사 tier run을 만들게 바꾼다

`POST /api/positions/v1/collection-runs`의 요청에 `companyTierContractVersion`을 추가하고,
수집 저장과 회사 tier run 생성만 한 transaction에서 처리한다.
기존처럼 공고 분석 run을 바로 만들지 않는다.

회사 tier 큐는 수동 tier나 `exclude`가 있는 회사를 빼고 정책 상한까지 고른다.

1. 유효한 평가가 없는 회사를 활성 공고 수 내림차순, 첫 관측 시각, `companyKey` 순으로 고른다.
2. 나머지 자리는 만료된 이전 Tier 1, 2, 3, 오래전 만료일, `companyKey` 순으로 고른다.
3. 다른 run에서 처리 중인 회사는 건너뛰고, 2시간을 넘긴 항목은 `lease_expired`로 종료한 뒤 다시 고른다.

큐가 빈 run은 바로 `completed`다.

### 3. 회사 tier 결과 반영 endpoint를 추가한다

`POST /api/positions/v1/company-tier-runs/:id/results`를 추가한다.
요청은 아직 끝나지 않은 항목을 `results`와 `failures`에 한 번씩 나눠 담아야 한다.
Backend는 수신 시각과 정책 만료 기한, 각 근거의 만료일 중 가장 빠른 날로 `valid_until`을 정한다.

동일 run에 같은 본문을 다시 보내면 멱등 응답을 재사용한다.
다른 본문을 보내거나 선택하지 않은 회사, 2시간 임차권이 끝난 항목을 보내면 `409`를 반환한다.

### 4. 회사 tier를 해결한 뒤에만 공고 분석 run을 만든다

`POST /api/positions/v1/collection-runs/:id/analysis-runs`를 추가한다.
회사 tier run이 `pending`이면 `409 COMPANY_TIER_RUN_PENDING`을 반환한다.
`completed` 또는 `partial`이면 회사별로 `manual`, `model`, `default` 순서로 tier를 해결하고,
기존 `selectAnalysisQueue`에 넘긴다.

공고 분석 run 항목은 선택 당시 tier, 출처와 모델 평가 ID를 스냅샷한다.
수집 run당 공고 분석 run은 하나만 만들고 재시도는 저장한 응답을 돌려준다.

### 5. 추천 run에 tier 출처를 남긴다

추천을 조립할 때 현재 유효한 tier를 다시 해결하고,
`position_recommendation_items`에 tier, 출처와 모델 평가 ID를 스냅샷한다.
이전 공고 분석을 재사용해도 추천 run이 사용한 현재 tier 출처를 알 수 있어야 한다.

### 6. 정상·실패·빈 큐·동시 실행을 테스트한다

`position/service.test.ts`, `position/sql-repository.test.ts`와 `app.test.ts`에서 다음을 검증한다.

- 수동 override와 `exclude`가 모델 평가보다 우선한다.
- 유효한 모델 평가는 큐에 다시 실리지 않고 공고 우선순위에 재사용된다.
- 만료된 이전 Tier 1을 Tier 2와 3보다 먼저 재평가한다.
- 평가 실패는 run에 남지만 기본 tier로 공고 분석을 계속한다.
- 다른 run의 유효한 임차권은 중복 평가를 막고 2시간이 지나면 회수된다.
- 빈 회사 큐는 run을 바로 완료하고 공고 분석 큐를 반환한다.
- 신호 축 누락·중복, HTTP URL 근거와 티어 범위 이탈을 400으로 거부한다.

## 검증

```bash
bun test career-os/services/recommendation-api/position \
  career-os/services/recommendation-api/routes \
  career-os/services/recommendation-api/app.test.ts
bunx tsc --noEmit
```

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/recommendation-api/position/schema.ts` | 수정 |
| `services/recommendation-api/position/service.ts` | 수정 |
| `services/recommendation-api/position/queue.ts` | 수정 |
| `services/recommendation-api/routes/positions.ts` | 수정 |
| `services/recommendation-api/position/service.test.ts` | 수정 |
| `services/recommendation-api/position/sql-repository.test.ts` | 수정 |
| `services/recommendation-api/app.test.ts` | 수정 |
