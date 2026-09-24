# Phase 02. 자료를 저장하고 후보를 거른다

**Execution profile**: deep

## 목표

수집한 자료와 다음 cursor 를 한 번에 저장하는 경로와,
이미 추천했거나 유효한 제외 판정이 있는 자료를 뺀 후보를 주는 경로를 만든다.

이 phase 가 끝나면 `POST /api/study/v1/ingestions` 와 `GET /api/study/v1/candidates` 가 동작한다.

**범위 외**: 추천과 제외 판정을 저장하는 것은 Phase 03 이다.
이 phase 의 테스트는 판정과 추천 행을 SQL 로 직접 넣어 거르기를 확인한다.

## 컨텍스트

Phase 01 이 table 열 개와 `src/study/` 모듈을 만들었다.

client 가 보내는 본문은 `career-os/scripts/study-topic-recommender/study-library/ingestion.ts` 의
`StudyLibraryIngestionPayload` 다. `sourceKey`, `mode`, `items`, `cursor`, `expectedCursorVersion`, `idempotencyKey` 를 담는다.
`items` 의 한 건은 같은 파일의 `toIngestionItem` 이 만든다.
`contentKey`, `canonicalUrl`, `url`, `title`, `published`, `publishedAt`, `excerpt`, `kind`, `tags`, `collectedAt` 이다.

client 가 받는 모양은 `contracts.ts` 의 `studyLibraryIngestionResultSchema` 와
`studyLibraryCandidatePageSchema` 다.
후보 조회의 query 는 `study-library/candidates.ts` 의 `searchParams` 가 정한다.
`sourceKey`, `category`, `publishedFrom`, `publishedTo`, `limit`, `cursor` 다. `limit` 은 1 부터 100 이다.

**근거 문서**: `docs/data-schema.md` 의 「cursor 와 자료 배치」 절과 「`study_material_verdicts`」 절,
`docs/flow.md` 의 「갈라지는 곳」 절,
`docs/adr/ADR-127-공부-추천은-고르지-않은-후보의-판정을-재사용한다.md`

## 의도 메모

**자료 저장과 cursor 교체는 한 트랜잭션이다.**
cursor 만 진행되고 자료가 빠지면 그 자료는 다시 수집되지 않는다.
트랜잭션 시작에서 `(source_key, mode)` cursor 행을 잠그고 `expectedCursorVersion` 을 비교한다.
다르면 아무것도 쓰지 않고 `409` 다.

**`tags` 는 빈 배열만 받는다.** 저장할 table 이 없다. 비어 있지 않으면 `400` 이다.
받아서 버리면 client 가 저장된 줄 안다.

**후보 거르기는 SQL 이 한다.** 메모리에서 거르면 `limit` 과 페이지가 맞지 않는다.
`study_recommended_materials` 에 있는 자료와,
지금 `study_recommendation_control.candidate_context_version` 으로 된 판정이 있고
`valid_until` 이 오늘 이후인 자료를 `NOT EXISTS` 로 뺀다.
오늘은 서울 날짜다. `src/positions/seoul-date.ts` 를 쓴다.

**`previouslyRecommended` 는 늘 `false` 다.** 이미 추천한 자료는 후보로 오지 않는다.
client 계약이 칸을 요구하므로 남긴다.

**`recentStudyTopicKeys` 는 가장 최근 추천 실행의 `topic_key` 들이다.** 실행이 없으면 빈 배열이다.

**페이지 cursor 는 서버가 만드는 불투명 문자열이다.** 정렬 기준이 되는 값을 base64url 로 담는다.
정렬은 `published_at` 이 늦은 것부터, 같으면 `content_key` 순이다. `published_at` 이 NULL 인 자료는 뒤로 간다.

## 작업 항목

### 1. `POST ingestions`

본문을 `src/study/schema.ts` 에 zod 로 정의한다.
`items` 는 100건 이하, 같은 배치 안의 `contentKey` 중복은 `400`, `cursor` 직렬화는 64 KiB 이하다.

한 트랜잭션에서 한다.

- cursor 행을 잠그고 `expectedCursorVersion` 을 비교한다. 행이 없으면 version 0 으로 본다
- `study_materials` 에 `content_key` 로 넣거나 갱신한다. 갱신이면 제목, 발췌, `last_collected_at` 을 바꾼다
- `study_material_sources` 에 `(content_key, source_key)` 를 넣는다. 있으면 그대로 둔다
- cursor 를 교체하고 version 을 1 올린다

반환은 `{ idempotencyKey, acceptedCount, cursorVersion }` 이다.
`acceptedCount` 는 받은 `items` 수다.

소스가 없거나 꺼져 있으면 `404` 와 `409` 다.

### 2. `GET candidates`

`docs/data-schema.md` 의 「`study_material_verdicts`」 절이 거르는 규칙을 정한다.

반환은 `{ candidates, recentStudyTopicKeys, nextCursor, historyVersion, candidateContextVersion }` 이다.
`candidateContextVersion` 은 client 가 추천을 저장할 때 그대로 돌려보낸다. client 계약에는 Phase 04 가 더한다.
각 후보는 `studyLibraryCandidateSchema` 의 칸을 모두 담는다.
`sourceName` 은 `study_sources.title`, `category` 는 그 소스의 `category` 다.
자료가 여러 소스에서 나왔으면 가장 먼저 수집한 소스를 쓴다.
`historyVersion` 은 `study_recommendation_control.history_version` 이다.

꺼진 소스에서만 나온 자료는 후보에서 뺀다.

### 3. 이 phase 를 검증하는 `test/study-candidates.e2e.test.ts`

확인할 것이다.

- 자료 셋을 ingestion 으로 넣으면 후보 셋이 나오고 `studyLibraryCandidatePageSchema` 로 파싱된다
- 응답의 `candidateContextVersion` 이 control 행의 값과 같다
- 같은 `contentKey` 를 다시 ingestion 하면 자료가 늘지 않고 제목이 갱신된다
- `expectedCursorVersion` 이 틀리면 `409` 이고 자료도 cursor 도 바뀌지 않는다
- `tags` 가 비어 있지 않으면 `400` 이다
- `study_recommended_materials` 에 넣은 자료는 후보에서 빠진다
- 지금 기준 버전으로 된 판정이 있고 `valid_until` 이 내일이면 빠진다
- 같은 판정의 `valid_until` 이 어제면 다시 나온다
- 기준 버전을 바꾸면 예전 판정이 있는 자료가 다시 나온다
- `limit` 2 로 받으면 `nextCursor` 가 있고, 그것으로 다음 페이지를 받으면 나머지가 나온다
- 꺼진 소스에서만 나온 자료는 후보에 없다

추천 행과 판정 행은 SQL 로 직접 넣는다. 저장 경로는 Phase 03 이다.

## 검증

Phase 01 의 container 를 그대로 쓴다.

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
- `study-candidates.e2e.test.ts` 의 항목이 모두 통과
- Phase 01 을 포함해 기존 e2e 가 계속 통과
- 출력에 `skipped` 가 없다

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/src/study/schema.ts` | 수정 |
| `career-os/services/recommendation-api/src/study/study.controller.ts` | 수정 |
| `career-os/services/recommendation-api/src/study/study.service.ts` | 수정 |
| `career-os/services/recommendation-api/src/study/repository/study.repository.ts` | 수정 |
| `career-os/services/recommendation-api/test/study-candidates.e2e.test.ts` | 신규 |
