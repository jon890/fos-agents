# Phase 03. 추천과 제외 판정을 저장한다

**Execution profile**: deep

## 목표

추천 주제와 자료, 고르지 않은 후보의 판정을 한 번에 저장하는 경로와 게시 이력 경로를 만든다.

이 phase 가 끝나면 `POST /api/study/v1/recommendation-runs` 와 `POST /api/study/v1/publications` 가 동작한다.

**범위 외**: client 가 판정을 보내게 바꾸는 것은 Phase 04 다.

## 컨텍스트

client 가 보내는 추천 본문은 `career-os/scripts/study-topic-recommender/study-library/recommendations.ts` 가 만든다.
`idempotencyKey`, `reportId`, `generatedAt`, `topics` 를 담고,
`topics[]` 는 `topicKey`, `title`, `careerQuestion`, `items` 를,
`items[]` 는 `contentKey`, `summary`, `reason`, `careerValue` 를 담는다.
`reportId` 는 같은 파일의 `reportIdForMorningReading` 이 만드는 서울 날짜의 `morning-YYYY-MM-DD` 다.

이 phase 가 본문에 칸 둘을 더한다. `candidateContextVersion` 과 `rejections` 다.
client 는 Phase 04 에서 이 둘을 보낸다.

반환은 `contracts.ts` 의 `studyLibraryRecommendationRunResultSchema` 와
`studyLibraryPublicationResultSchema` 다.

**근거 문서**: `docs/data-schema.md` 의 「추천 실행」 절과 「`study_material_verdicts`」 절과 「`study_publications`」 절,
`docs/flow.md` 의 「갈라지는 곳」 절과 「제외 판정의 재사용」 절,
`docs/adr/ADR-127-공부-추천은-고르지-않은-후보의-판정을-재사용한다.md`

## 의도 메모

**추천과 판정은 한 트랜잭션이다.** 추천만 저장되고 판정이 빠지면 다음 날 같은 자료를 또 판단한다.
판정만 저장되고 추천이 빠지면 고른 자료가 제외된 것으로 남는다.
트랜잭션 시작에서 `study_recommendation_control` 행을 잠근다.

**`candidateContextVersion` 이 지금 값과 다르면 `409` 다.**
client 가 후보를 받은 뒤 사람이 기준 버전을 올렸다는 뜻이다. 옛 기준의 판정을 새 기준 아래 저장하지 않는다.

**`summary`, `reason`, `careerQuestion`, `careerValue` 는 NULL 을 받는다.**
파일에 있던 이력을 옮길 때 그 값이 없다. `docs/data-schema.md` 의 「추천 실행」 절이 이유를 적는다.
정상 실행의 빈 값은 client 의 선택 검증이 먼저 막는다.

**고른 자료와 제외한 자료가 겹치면 `400` 이다.** 한 자료가 한 실행에서 둘 다일 수 없다.

## 작업 항목

### 1. `POST recommendation-runs`

본문을 `src/study/schema.ts` 에 zod 로 정의한다.

- `rejections` 는 `{ contentKey, reason }` 배열이고 기본값은 빈 배열이다. `reason` 은 300자 이하다
- `topics` 는 20개 이하다

한 트랜잭션에서 한다.

- control 행을 잠그고 `candidateContextVersion` 을 비교한다
- `reportId` 가 이미 있으면 `409` 다
- 직전 실행의 `topic_key` 와 같은 주제가 있으면 `409` 다
- 고른 자료 중 이미 `study_recommended_materials` 에 있는 것이 있으면 `409` 다
- 고른 자료와 제외 자료가 모두 `study_materials` 에 있어야 한다. 없으면 `400` 이다
- 실행, 주제, 추천 자료를 넣는다
- 판정을 `(content_key, candidate_context_version)` 로 넣거나 갱신한다. `valid_until` 은 서울 날짜로 오늘부터 30일이다
- `history_version` 을 1 올린다

반환은 `{ reportId, historyVersion }` 이다. `historyVersion` 은 올린 뒤의 값이다.

### 2. `POST publications`

`reportId`, `channel`, `url`, `externalId`, `publishedAt`, `idempotencyKey` 를 받는다.
`reportId` 가 없으면 `404` 다. 반환은 `{ publicationId }` 다.

### 3. 기준 버전을 올리는 경로

`PUT recommendation-control` 이 `{ candidateContextVersion }` 을 받아 바꾼다.
사람이 관심사가 바뀌었을 때 부른다. 반환은 바뀐 값이다.

### 4. 이 phase 를 검증하는 `test/study-recommendations.e2e.test.ts`

확인할 것이다.

- 주제 하나와 자료 둘, 제외 셋을 저장하면 다음 후보 조회에서 다섯 모두 빠지고 `historyVersion` 이 1 오른다
- 같은 `reportId` 로 다른 본문을 보내면 `409` 다
- 같은 멱등 키와 같은 본문을 다시 보내면 저장된 응답을 그대로 준다
- 직전 실행과 같은 `topicKey` 는 `409` 다
- 이미 추천한 자료를 다시 고르면 `409` 이고 아무것도 저장되지 않는다
- `candidateContextVersion` 이 지금 값과 다르면 `409` 다
- 고른 자료와 제외 자료가 겹치면 `400` 이다
- `summary` 와 `reason` 이 `null` 인 추천도 저장된다
- 기준 버전을 올린 뒤 후보를 조회하면 예전에 제외한 자료가 다시 나온다
- 게시 기록이 저장되고, 없는 `reportId` 면 `404` 다

## 검증

```bash
# cwd: career-os/services/recommendation-api
npm run typecheck
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

기대값이다.

- `typecheck` 가 종료 코드 0
- `study-recommendations.e2e.test.ts` 의 항목이 모두 통과
- 기존 e2e 가 계속 통과
- 출력에 `skipped` 가 없다

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/src/study/schema.ts` | 수정 |
| `career-os/services/recommendation-api/src/study/study.controller.ts` | 수정 |
| `career-os/services/recommendation-api/src/study/study.service.ts` | 수정 |
| `career-os/services/recommendation-api/src/study/repository/study.repository.ts` | 수정 |
| `career-os/services/recommendation-api/test/study-recommendations.e2e.test.ts` | 신규 |
