# Phase 01. study table 과 소스 경로를 만든다

**Execution profile**: deep

## 목표

`fos_career` 에 study table 열 개를 만들고, 소스와 cursor 를 읽고 쓰는 경로 셋을 연다.

이 phase 가 끝나면 `GET /api/study/v1/sources`, `PUT /api/study/v1/sources/{sourceKey}`,
`GET /api/study/v1/sources/{sourceKey}/cursor?mode=` 가 동작한다.

**범위 외**: 자료 저장과 후보 조회는 Phase 02, 추천 저장은 Phase 03, client 변경은 Phase 04 다.

## 컨텍스트

추천 Backend 는 `career-os/services/recommendation-api/` 의 NestJS 와 Prisma 서비스다.
포지션 쪽 `src/positions/` 의 배치를 그대로 따른다.

| 무엇 | 따를 곳 |
| --- | --- |
| 모듈 등록 | `src/app.module.ts` 의 `imports` 에 `StudyModule` 을 더한다 |
| controller | `src/positions/positions.controller.ts` 의 `@Controller("api/positions/v1")` |
| zod 계약과 검증 pipe | `src/positions/schema.ts`, `src/common/zod-validation.pipe.ts` |
| 저장 계층 | `src/positions/repository/positions.repository.ts` |
| migration | `prisma/migrations/<timestamp>_<이름>/migration.sql` |
| 테스트 격리 | `test/support/e2e-harness.ts` 의 `DATA_TABLES` |

인증과 멱등은 전역이다. `src/bootstrap.ts` 가 모든 경로에 Bearer 인증을 걸고,
`src/app.module.ts` 의 `IdempotencyInterceptor` 가 본문이 있는 모든 요청에 `Idempotency-Key` 헤더를 요구한다.
새 경로는 따로 설정하지 않아도 둘 다 적용된다.

client 가 기대하는 응답 모양은 `career-os/scripts/study-topic-recommender/study-library/contracts.ts` 가 정한다.
`studyLibrarySourceSchema`, `studyLibrarySourcesResponseSchema`,
`studyLibrarySourceUpsertResponseSchema`, `studyLibraryCursorResultSchema` 다.

**근거 문서**: `docs/data-schema.md` 의 「study-topic-recommender」 절,
`docs/flow.md` 의 「학습자료 HTTP 계약」 절,
`docs/adr/ADR-126-읽을거리-소스-목록은-backend가-원본을-가진다.md`

## 의도 메모

**table 열 개를 한 migration 에 만든다.** 나누면 foreign key 순서를 migration 사이에서 맞춰야 한다.
`docs/data-schema.md` 의 「study table」 표가 목록이다.

**migration timestamp 는 base 를 최신으로 받은 뒤 정한다.**
`prisma/migrations/` 에서 가장 늦은 이름보다 뒤여야 한다.
다른 브랜치가 먼저 머지되면 그쪽 migration 이 앞에 들어온다.
작업을 시작할 때와 PR 을 만들기 직전에 한 번씩 확인한다.

**`VARCHAR(2048)` 칸에 UNIQUE 나 index 를 걸지 않는다.**
utf8mb4 에서 index key 가 8192 바이트가 되어 InnoDB 상한 3072 를 넘는다.
`study_materials` 는 이미 `content_key` 가 hash 라 URL 에 index 가 필요 없다.

**`PUT /sources/{sourceKey}` 는 소스 한 행의 모든 칸을 받은 값으로 바꾼다.** `expectedVersion` 이 저장된 값과 다르면 `409` 다.
새 소스는 `expectedVersion: 0` 으로 만든다.
`note` 는 선택값이고 500자 이하다. 이 phase 에서 client 의
`studyLibrarySourcePutPayloadSchema` 에도 `note` 를 추가한다. 서버는 빠진 `note` 도 받는다.
수집 가능한 소스만 저장한다. `feed` 는 `feedUrl`, `page` 는 `url`, `youtube` 는
채널 `url` 과 최근 수집용 `feedUrl` 이 모두 필요하다. 이 조건은 서버 요청과
client PUT 계약에서 함께 검증한다. 기존 `readingSourceSchema` 의 조건보다
YouTube feed 요구가 엄격한 이유는 실제 recent 수집기가 `feedUrl` 을 사용하기 때문이다.

## 작업 항목

### 1. `prisma/migrations/` 에 study table migration 추가

`docs/data-schema.md` 의 「study-topic-recommender」 절이 의미와 공개 계약을 정한다.
아래 표가 SQL에서 빠짐없이 만들 칸과 타입을 정한다. 열 개를 모두 만든다.
모든 문자열은 `utf8mb4_unicode_ci`, 모든 시각은 `DATETIME(3)`이다.
`created_at`과 `updated_at`은 각각 삽입 시각과 마지막 변경 시각을 담는다.

| table | 칸과 타입 | 키와 조회용 index |
| --- | --- | --- |
| `study_sources` | `source_key VARCHAR(100)`, `title VARCHAR(255)`, `category VARCHAR(50)`, `adapter ENUM('feed','page','youtube')`, `url VARCHAR(2048) NULL`, `feed_url VARCHAR(2048) NULL`, `enabled BOOLEAN`, `note VARCHAR(500) NULL`, `version INT UNSIGNED`, `created_at`, `updated_at` | PK `source_key` |
| `study_source_cursors` | `source_key VARCHAR(100)`, `mode VARCHAR(20)`, `cursor_json JSON NULL`, `version INT UNSIGNED`, `updated_at` | PK `(source_key,mode)` |
| `study_materials` | `content_key VARCHAR(191)`, `canonical_url VARCHAR(2048)`, `url VARCHAR(2048)`, `title VARCHAR(500)`, `published VARCHAR(100)`, `published_at DATETIME(3) NULL`, `excerpt TEXT NULL`, `kind ENUM('feed-article','feed-video','page-link','page-video')`, `first_collected_at`, `last_collected_at` | PK `content_key`; index `(published_at,content_key)` |
| `study_material_sources` | `content_key VARCHAR(191)`, `source_key VARCHAR(100)`, `first_collected_at` | PK `(content_key,source_key)`; index `(source_key,first_collected_at,content_key)` |
| `study_recommendation_control` | `singleton_id TINYINT UNSIGNED`, `candidate_context_version VARCHAR(191)`, `history_version INT UNSIGNED`, `updated_at` | PK `singleton_id`, `CHECK (singleton_id = 1)` |
| `study_recommendation_runs` | `report_id VARCHAR(40)`, `generated_at`, `candidate_context_version VARCHAR(191)`, `created_at` | PK `report_id`; index `(generated_at,report_id)` |
| `study_recommendation_topics` | `report_id VARCHAR(40)`, `topic_key VARCHAR(191)`, `title VARCHAR(500)`, `career_question VARCHAR(300) NULL`, `position SMALLINT UNSIGNED` | PK `(report_id,topic_key)`; unique `(report_id,position)` |
| `study_recommended_materials` | `report_id VARCHAR(40)`, `content_key VARCHAR(191)`, `topic_key VARCHAR(191)`, `summary VARCHAR(300) NULL`, `reason VARCHAR(300) NULL`, `career_value VARCHAR(40) NULL`, `position SMALLINT UNSIGNED` | PK `(report_id,content_key)`; unique `content_key`; unique `(report_id,topic_key,position)` |
| `study_material_verdicts` | `content_key VARCHAR(191)`, `candidate_context_version VARCHAR(191)`, `verdict ENUM('rejected')`, `reason VARCHAR(300)`, `report_id VARCHAR(40)`, `judged_at`, `valid_until DATE` | PK `(content_key,candidate_context_version)`; index `(candidate_context_version,valid_until)`; index `report_id` |
| `study_publications` | `publication_id CHAR(36)`, `report_id VARCHAR(40)`, `channel VARCHAR(50)`, `url VARCHAR(2048) NULL`, `external_id VARCHAR(255)`, `published_at` | PK `publication_id`; index `report_id` |

표의 시각 칸은 모두 NOT NULL 이며, `NULL`이라고 적힌 칸만 nullable이다.
foreign key는 부모 변경과 삭제를 거부한다. 실행과 연결한 자식도 자동 삭제하지 않는다.

`CHECK` 제약이다.

- `study_sources`: `url` 과 `feed_url` 중 하나 이상이 NOT NULL
- `study_sources`: `url` 과 `feed_url` 이 NULL 이 아니면 `https://` 로 시작
- `study_source_cursors`: `mode` 가 `recent` 또는 `archive`
- `study_recommended_materials`: `career_value` 가 NULL 이거나 네 값 중 하나

foreign key 다.

- `study_source_cursors.source_key` 와 `study_material_sources.source_key` 가 `study_sources`
- `study_material_sources.content_key` 가 `study_materials`
- `study_recommendation_topics.report_id` 와 `study_recommended_materials.report_id` 와
  `study_publications.report_id` 가 `study_recommendation_runs`
- `study_recommended_materials.content_key` 가 `study_materials`
- `study_recommended_materials.(report_id,topic_key)` 가 `study_recommendation_topics`
- `study_material_verdicts.content_key` 가 `study_materials`, `report_id` 가 `study_recommendation_runs`

`study_recommendation_control` 의 한 행은 migration 이 넣는다.
`candidate_context_version` 은 `initial`, `history_version` 은 `0` 이다.

collation 은 기존 table 과 같은 `utf8mb4_unicode_ci` 다.

`prisma/schema.prisma` 에 모델을 더한다. `CHECK` 는 Prisma 가 표현하지 못하므로 SQL 에만 쓴다.

### 2. `src/study/` 모듈 골격

- `src/study/study.module.ts`
- `src/study/study.controller.ts`: `@Controller("api/study/v1")`
- `src/study/schema.ts`
- `src/study/study.service.ts`
- `src/study/repository/study.repository.ts`

`src/app.module.ts` 의 `imports` 에 `StudyModule` 을 더한다.

### 3. 소스 경로 둘

| 경로 | 반환 |
| --- | --- |
| `GET sources` | `{ sources: [...] }`. 각 항목은 `sourceKey`, `title`, `category`, `url`, `feedUrl`, `adapter`, `enabled`, `version`, `note` |
| `PUT sources/:sourceKey` | `{ source, version }` |

`PUT` 은 한 트랜잭션에서 소스 행을 잠그고 `expectedVersion` 을 비교한 뒤 쓴다.
성공하면 `version` 을 1 올린다.
`contracts.ts` 의 source 응답에 `note: string | null` 을 더하고 PUT payload 에는
`note?: string | null` 을 더한다. 응답 계약이 `note` 를 제거하지 않아야 한다.

### 4. cursor 조회 경로

`GET sources/:sourceKey/cursor?mode=recent|archive` 는 `{ sourceKey, mode, cursor, version }` 을 준다.
저장된 cursor 가 없으면 `cursor: null`, `version: 0` 이다. 소스가 없으면 `404` 다.

### 5. 이 phase 를 검증하는 `test/study-sources.e2e.test.ts`

`test/support/e2e-harness.ts` 의 `DATA_TABLES` 에 study table 을 자식부터 더한다.
`study_recommendation_control` 은 지우지 않고 첫 행을 `initial` 과 `0` 으로 되돌린다.

확인할 것이다.

- 새 소스를 `expectedVersion: 0` 으로 `PUT` 하면 `version: 1` 이 되고 `GET sources` 에 나온다
- 같은 소스를 `expectedVersion: 0` 으로 다시 `PUT` 하면 `409` 다
- `url` 과 `feedUrl` 이 둘 다 `null` 이면 `400` 이다
- `feed` 의 `feedUrl`, `page` 의 `url`, `youtube` 의 `url` 또는 `feedUrl` 이 빠지면 `400` 이다
- `http://` URL 은 `400` 이고, SQL 로 직접 넣어도 `CHECK` 가 막는다
- cursor 가 없는 소스의 cursor 조회가 `cursor: null`, `version: 0` 이다
- 없는 소스의 cursor 조회가 `404` 다
- `Idempotency-Key` 없이 `PUT` 하면 거절된다
- 응답이 `studyLibrarySourcesResponseSchema` 와 `studyLibraryCursorResultSchema` 로 파싱된다
- source 응답을 파싱한 결과에도 저장된 `note` 가 남는다

마지막 항목은 client 의 zod 계약을 테스트에서 import 해 확인한다.

## 검증

테스트용 MySQL container 를 확인한다. 떠 있으면 다시 만들지 않는다.

```bash
# cwd: 아무 곳
docker ps --filter name=plan125-mysql --format '{{.Names}} {{.Status}}'
```

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
- `study-sources.e2e.test.ts` 의 항목이 모두 통과
- 기존 e2e 가 계속 통과
- 출력에 `skipped` 가 없다

**table 열 개가 실제로 생겼는지 센다.**

```bash
# cwd: 아무 곳
docker exec plan125-mysql mysql -uroot -pplan125 -N -e \
  'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA="fos_career_test" AND TABLE_NAME LIKE "study\_%";'
```

`10` 이어야 한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/prisma/migrations/*_study_schema/migration.sql` | 신규 |
| `career-os/services/recommendation-api/prisma/schema.prisma` | 수정 |
| `career-os/services/recommendation-api/src/app.module.ts` | 수정 |
| `career-os/services/recommendation-api/src/study/` | 신규 |
| `career-os/services/recommendation-api/test/support/e2e-harness.ts` | 수정 |
| `career-os/services/recommendation-api/test/study-sources.e2e.test.ts` | 신규 |
| `career-os/scripts/study-topic-recommender/study-library/contracts.ts` | source note 계약 수정 |
