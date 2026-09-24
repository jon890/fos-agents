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
`note` 는 선택값이고 500자 이하다. client 의 `studyLibrarySourcePutPayloadSchema` 에 `note` 가 아직 없으므로
서버는 `note` 가 없어도 받는다.

## 작업 항목

### 1. `prisma/migrations/` 에 study table migration 추가

`docs/data-schema.md` 의 「study-topic-recommender」 절이 칸과 타입과 키를 정한다.
열 개를 모두 만든다.

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
- `http://` URL 은 `400` 이고, SQL 로 직접 넣어도 `CHECK` 가 막는다
- cursor 가 없는 소스의 cursor 조회가 `cursor: null`, `version: 0` 이다
- 없는 소스의 cursor 조회가 `404` 다
- `Idempotency-Key` 없이 `PUT` 하면 거절된다
- 응답이 `studyLibrarySourcesResponseSchema` 와 `studyLibraryCursorResultSchema` 로 파싱된다

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
