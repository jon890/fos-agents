# Phase 01. 회사 tier 평가 이력과 run 원장

**Execution profile**: deep

## 목표

모델이 만든 회사 tier 평가와 어느 run이 어느 회사를 처리했는지 MySQL에 이력으로 남기고,
사람이 정한 `company_preferences`와 자동 평가를 분리한다.

**범위 외**: HTTP 호출 순서, 스킬 연동과 HTML 표시는 다음 phase가 담당한다.
홈서버 migration 적용과 container 배포는 인프라 저장소의 별도 작업이다.

## 컨텍스트

현재 `company_preferences`는 사람이 정한 tier와 제외를 저장하고,
`position/service.ts` 안의 `tierFor` 함수가 등록되지 않은 회사에 기본 tier를 적용한다.
2026-09-20 홈서버 운영 DB를 조회하니 `company_preferences`에 행이 없고
활성 공고 121건이 회사 36곳에 걸쳐 있어, 36곳 전부가 Tier 3으로 처리되고 있다.

`001_position_schema.sql`은 이미 운영 DB에 적용됐으므로 고치지 않고
`002_company_tier_assessments.sql`을 추가한다.

**근거 문서**: `docs/data-schema.md`의 「포지션 분석 정책」과 「공고별 분석 이력」,
`docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md`,
`docs/adr/ADR-119-분석-실행의-처리-결과와-분석의-생성-출처를-분리해-저장한다.md`

## 의도 메모

- `company_preferences`는 사람 override와 제외만 저장한다. 모델 결과를 upsert하지 않는다.
- 모델은 tier를 제안하지만 회사를 제외하지 못한다.
- tier는 회사의 절대 서열이 아니라 `candidate_context_version`에 종속된 후보자 기준의 우선순위다.
- 수집 공고 수로 회사 tier를 정하지 않는다. 공고 수는 아직 평가하지 않은 회사의 첫 평가 순서만 정한다.
- 현재 Backend는 단일 인스턴스만 지원한다. 외부 queue나 ORM은 추가하지 않는다.

## 작업 항목

### 1. `position_analysis_policy` 계약을 schema version 2로 올린다

`services/recommendation-api/position/schema.ts`와 저장 모델에 다음 필드를 추가한다.

| 필드 | 타입과 제약 |
| --- | --- |
| `dailyCompanyTierLimit` | 1부터 20까지의 정수 |
| `companyTierStaleAfterDays` | 1부터 365까지의 정수 |

정책 버전 리터럴은 저장소에 두 곳뿐이다. 둘 다 2로 올린다.

| 파일 | 현재 |
| --- | --- |
| `position/schema.ts:12` | `schemaVersion: z.literal(1)` |
| `position/sql-repository.ts:272` | `schemaVersion: 1 as const` |

`scripts/position-recommender/configure_position_analysis_policy.ts`에는 이 리터럴이 없으므로 고치지 않는다.
`docs/data-schema.md`의 예제 JSON은 이미 `"schemaVersion": 2`이므로 갱신 대상이 아니다.

`analysisPolicySchema`를 `z.literal(2)`로 올리면
`scripts/position-recommender/recommendation-api/client.ts:161`이 이 schema로 응답을 파싱하는 경로가 함께 깨진다.
그 경로의 테스트를 이 phase의 검증에 포함한다.

### 2. `002_company_tier_assessments.sql` migration을 추가한다

이 파일 하나가 이 phase의 모든 DB 변경을 담는다.
`position_analysis_policy`의 두 column 추가도 여기 들어간다.
두 column도 작업 항목 3과 같은 4단계로 붙인다.
nullable로 추가하고, 기존 singleton 행에 5와 90을 채우고, `NOT NULL`로 바꾸고, `CHECK`를 붙인다.
`NOT NULL`로 한 번에 붙이면 기존 행이 정수의 암묵 기본값인 0으로 채워져
`daily_company_tier_limit`의 1부터 20까지 범위를 벗어난다.
DB 기본값은 남기지 않는다.

**문장 분할 규칙을 지킨다.** `db/migrations.ts:8`의 `splitMigrationStatements`는
세미콜론 뒤 줄바꿈으로만 문장을 쪼갠다.
모든 문장을 세미콜론과 줄바꿈으로 끝내고 문자열 리터럴 안에 세미콜론을 두지 않는다.

**중간 실패를 견디게 만든다.** `applyMigrations`는 문장들을 `sql.begin` 안에서 실행하지만
MySQL의 DDL은 암묵 커밋이라 rollback되지 않는다.
중간에 실패하면 일부 DDL만 남고 `schema_migrations` 행은 들어가지 않아 재실행이 계속 실패한다.
그래서 모든 문장을 다시 실행해도 안전하게 쓴다.

table 생성은 `CREATE TABLE IF NOT EXISTS`로 쓴다.

**column 추가는 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`로 쓸 수 없다.**
운영 MySQL은 8.4.8이고 그 문법은 MariaDB에만 있다.
대신 `information_schema.COLUMNS`로 확인한 뒤 동적 SQL로 돌린다.

```sql
SET @ddl := (
  SELECT IF(COUNT(*) > 0,
    'SELECT 1',
    'ALTER TABLE position_analysis_run_items ADD COLUMN ...')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'position_analysis_run_items'
    AND COLUMN_NAME = 'company_tier_source'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

네 문장 모두 세미콜론과 줄바꿈으로 끝나므로 위 분할 규칙과 어긋나지 않는다.

**`CHECK` 제약도 같은 모양으로 가드한다.** 제약 이름은 schema 안에서 유일해야 하고,
같은 이름으로 다시 `ADD CONSTRAINT`하면 `Duplicate check constraint name`으로 실패한다.
column 가드는 이름만 보므로 이것을 막지 못한다.
조회 대상만 `information_schema.TABLE_CONSTRAINTS`로 바꾸고 `CONSTRAINT_NAME`으로 찾는다.

가드가 이름으로 조회하므로 이 phase가 더하는 제약 이름을 먼저 고정한다.
`001_position_schema.sql`의 `chk_<table>_<의미>` 표기를 따른다.

| 제약 이름 | 대상 |
| --- | --- |
| `chk_position_policy_company_tier_limit` | `daily_company_tier_limit`이 1부터 20까지 |
| `chk_position_policy_company_tier_stale` | `company_tier_stale_after_days`가 1부터 365까지 |
| `chk_position_analysis_item_tier_source` | `position_analysis_run_items`의 출처와 평가 ID 대응 |
| `chk_position_recommendation_item_tier_source` | `position_recommendation_items`의 출처와 평가 ID 대응 |

**모든 이관 `UPDATE`는 대상 column이 `NULL`인 행만 고른다.**
`NOT NULL`로 바꾸기 전에 돌리므로 두 번째 실행에서는 고르는 행이 없다.

`MODIFY COLUMN`은 가드하지 않아도 된다. 같은 정의로 다시 돌려도 성공한다.
다만 `MODIFY COLUMN`은 column 정의를 통째로 갈아 끼운다.
ENUM 값 목록과 `NOT NULL`을 포함한 전체 정의를 매번 적는다.
그 문장에 적지 않은 속성은 그 실행에서 사라진다.

이 형태 전체가 실제로 도는 것을 홈서버에서 확인했다.
migration runner와 같은 조건인 `sql.begin` 안의 `transaction.unsafe(문장).simple()`로
가드된 column 추가 둘, 이관 `UPDATE`, `MODIFY NOT NULL`, 가드된 `CHECK` 추가를 묶어 세 번 돌렸다.
세 번 모두 성공했고 기존 3행이 `default`로 채워졌으며 `CHECK`도 동작했다.

`docs/data-schema.md`의 정의대로 다음 table을 만든다.

- `company_tier_assessment_runs`
- `company_tier_assessments`
- `company_tier_assessment_run_items`

table 순서는 run, 평가, run 항목 순으로 둔다.
평가는 `created_by_company_tier_run_id` FK를 `ON DELETE RESTRICT`로 갖고,
run 항목은 연결한 평가 ID를 `ON DELETE RESTRICT`로 갖는다.

`company_tier_assessments`는 정규화한 `company_key`, 표시명, 후보자 기준·계약 버전,
Tier 1부터 3, `low`·`medium`·`high` 신뢰도, 종합 이유, 신호·근거·가정 JSON,
`assessed_at`과 `valid_until`을 가진다.
`회사, 후보자 기준, 계약 버전, 유효기간, 평가 시각`을 정렬할 수 있는 복합 index를 둔다.

`company_tier_assessment_run_items`는 `pending`·`created`·`reused`·`failed`, 평가 ID,
실패 코드, 제출 횟수와 완료 시각을 가지며 상태별 `CHECK`를 둔다.

세 table의 column은 다음으로 고정한다.

| table | column |
| --- | --- |
| `company_tier_assessment_runs` | `company_tier_run_id`, `collection_run_id`, `candidate_context_version`, `contract_version`, `status`, `assessed_now_count`, `created_at`, `completed_at` |
| `company_tier_assessments` | `company_tier_assessment_id`, `company_key`, `company_name`, `candidate_context_version`, `contract_version`, `created_by_company_tier_run_id`, `recommended_tier`, `confidence`, `reason`, `signals_json`, `evidence_json`, `assumptions_json`, `assessed_at`, `valid_until` |
| `company_tier_assessment_run_items` | `company_tier_run_id`, `company_key`, `company_name`, `selection_order`, `assessment_status`, `selection_reason`, `prior_tier`, `active_position_count`, `result_status`, `company_tier_assessment_id`, `failure_code`, `attempt_count`, `completed_at` |

`assessment_status`는 `new`·`stale`, `selection_reason`은 `discovery`·`refresh`만 허용한다.
`failure_code`는 client가 보내는 `research_unavailable`·`model_unavailable`·`contract_rejected`·`internal_error`와
Backend가 남기는 `lease_expired`만 허용한다.
run 하나는 수집 run 하나만 참조하고 `collection_run_id`에 UNIQUE를 둔다.
run 항목은 `(company_tier_run_id, company_key)`를 PK로,
`(company_tier_run_id, selection_order)`를 UNIQUE로 둔다.
`회사 평가를 만든 run`과 `run 항목이 연결한 평가`는 모두 FK로 검증한다.
`company_key`는 기존 자연 키를 쓰고 이 phase에서 `companies` table을 새로 만들지 않는다.

### 3. 공고 분석과 추천에 tier 출처를 보존한다

`position_analysis_run_items`와 `position_recommendation_items`에 다음을 추가한다.

```text
company_tier_source ENUM('manual', 'model', 'default') NOT NULL
company_tier_assessment_id CHAR(36) NULL
```

`company_tier_source = model`일 때만 평가 ID가 있도록 `CHECK`를 둔다.
기존 행은 `company_tier_source = default`로 이관하고 평가 ID를 비운다.

**`NOT NULL`로 한 번에 붙이지 않는다.** 기존 행이 있는 table에 `NOT NULL` ENUM을 붙이면
MySQL이 그 자리에서 ENUM의 첫 값으로 채운다.
그러면 기존 행이 `default`가 아니라 `manual`로 채워지고,
`NOT NULL`이라 `IS NULL`로 가려낼 수도 없어 진짜 `manual`과 구별되지 않는다.
운영 DB에 두 table 모두 기존 행이 있으므로 이 순서를 지켜야 한다.
홈서버에서 실제로 돌려 기존 2행이 전부 `manual`로 채워지는 것을 확인했다.

다음 4단계로 나눈다.

1. `company_tier_source`를 nullable로 추가한다. `company_tier_assessment_id`도 함께 추가한다.
2. `UPDATE ... SET company_tier_source = 'default' WHERE company_tier_source IS NULL`로 기존 행을 이관한다.
3. `MODIFY COLUMN ... NOT NULL`로 바꾼다.
4. `CHECK` 제약을 붙인다.

이 순서면 2단계의 `IS NULL` 조건이 재실행 안전 조건도 함께 만족한다.
1단계와 4단계는 작업 항목 2의 가드로 감싼다.

**이 phase 구간에서 새로 쓰는 행의 출처는 `manual`과 `default` 둘뿐이다.**
`model`은 Phase 02가 회사 tier를 해결하기 시작할 때 처음 쓰인다.
`position/service.ts:74`의 `tierFor`는 지금 tier 숫자만 돌려주므로,
`company_preferences`에서 값을 찾았으면 `manual`, 정책 기본값으로 떨어졌으면 `default`로 분류해 함께 돌려주게 바꾼다.
평가 ID는 이 구간에서 항상 비운다.

### 4. repository에 회사 tier 평가 상태를 추가한다

`position/memory-repository.ts`에 run, run 항목과 평가 타입을 추가하고,
`position/sql-repository.ts`의 `load`와 `persist`가 신규 table과 tier 출처를 모두 읽고 쓰게 한다.
평가를 만든 run은 삭제할 수 없고, 실행 항목의 상태와 연결한 평가가 어긋나지 않게 저장 순서를 정한다.

### 5. schema와 repository를 회귀 검증한다

`db/migrations.test.ts`는 001과 002의 적용 순서, checksum 변경 거부, 신규 table·FK·CHECK와 기존 행 이관을 검증한다.
`splitMigrationStatements`에 002 본문을 넣어 쪼갠 문장 중 세미콜론이 잘려 깨진 것이 없는지 검증한다.
문장 수의 기대값은 002 본문을 직접 세어 정한다.
이 파일은 DB에 붙지 않으므로 여기까지만 맡긴다.
`position/sql-repository.test.ts`는 평가 run의 선택 순서, 결과, 출처와 유효기간을 재시작 전후에 같게 복원하는지 검증한다.
`db/mysql.integration.test.ts`가 실제 MySQL에 002까지 적용해 확인한다.
DDL을 실제로 돌려 보는 곳은 이 파일 하나뿐이므로 재실행 안전성 검증도 여기 둔다.

**002를 적용하기 전에 이관 대상 행을 먼저 넣는다.**
001을 적용한 뒤 `position_analysis_policy`의 singleton 행 하나와
`position_analysis_run_items`, `position_recommendation_items`의 행을 각각 하나 이상 만든다.
이 행들이 없으면 아래 확인이 행 0개 위에서 통과한다.
작업 항목 2와 3의 4단계를 지우고 `NOT NULL`로 한 번에 붙이도록 되돌려도 테스트가 초록으로 끝난다.

그 상태에서 다음을 확인한다.

- 신규 table 셋과 새 column 둘, 새 foreign key와 `CHECK` 제약이 만들어진다.
- 002의 문장들을 두 번 적용해도 실패하지 않는다.
- 두 번째 적용 뒤에도 기존 행의 `company_tier_source`가 `default`로 남아 있다.
- 기존 singleton 행의 `daily_company_tier_limit`이 0이 아니라 5이고 `company_tier_stale_after_days`가 90이다.
- `company_tier_source`가 `model`인데 평가 ID가 없는 행은 `CHECK`에 걸려 거절된다.

## 검증

**통합 테스트 출력에 `건너뜁니다`가 있으면 이 phase는 완료가 아니다.**
`db/mysql.integration.test.ts`는 `CAREER_RECOMMENDATION_TEST_DATABASE_URL`이 없으면
통째로 건너뛰고 그 한 줄만 남긴 채 초록으로 끝난다.
이 phase가 다루는 위험은 전부 실제 DDL 적용에서만 드러나므로 건너뛴 실행을 완료 근거로 쓰지 않는다.

그래서 DB부터 띄운다. 운영과 같은 MySQL 8.4.8을 로컬 container로 쓴다.

```bash
docker run -d --name plan124-mysql \
  -e MYSQL_ROOT_PASSWORD=plan124 -e MYSQL_DATABASE=fos_career_test \
  -p 13399:3306 mysql:8.4.8
until docker exec plan124-mysql mysql -uroot -pplan124 -e 'SELECT 1' fos_career_test >/dev/null 2>&1; do sleep 2; done
```

`docker run -d` 직후에는 MySQL이 아직 연결을 받지 않는다.
이 환경에는 `timeout`과 `gtimeout`이 없으므로 위처럼 `until` 로 준비를 기다린다.
`mysqladmin ping`은 쓰지 않는다.
`mysql:8.4.8` container가 초기화 중에 띄우는 임시 서버에도 응답해 일찍 빠져나올 수 있다.
실제 database에 접속해 `SELECT 1`이 도는지로 판정한다.

DB가 준비된 뒤에 돌린다.
**환경변수는 명령과 같은 줄에 준다.** 이 환경은 Bash 호출마다 새 shell로 시작해
앞선 호출의 `export`가 다음 호출로 이어지지 않는다.
다른 블록에서 `export`하면 통합 테스트가 그 값을 보지 못하고 통째로 건너뛴다.

```bash
CAREER_RECOMMENDATION_TEST_DATABASE_URL=mysql://root:plan124@127.0.0.1:13399/fos_career_test \
  bun test career-os/services/recommendation-api/db/migrations.test.ts \
  career-os/services/recommendation-api/position/sql-repository.test.ts \
  career-os/services/recommendation-api/db/mysql.integration.test.ts
bun test career-os/scripts/position-recommender
bunx tsc --noEmit
```

`bun test career-os/scripts/position-recommender`가 정책 schema version을 2로 올린 영향을 받는다.
`client.ts`가 `analysisPolicySchema`로 응답을 파싱하므로 `tsc`만으로는 이 어긋남이 드러나지 않는다.

phase를 마치면 container를 지운다.

```bash
docker rm -f plan124-mysql
```

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/recommendation-api/migrations/002_company_tier_assessments.sql` | 신규 |
| `services/recommendation-api/position/schema.ts` | 수정 |
| `services/recommendation-api/position/service.ts` | 수정 |
| `services/recommendation-api/position/memory-repository.ts` | 수정 |
| `services/recommendation-api/position/sql-repository.ts` | 수정 |
| `services/recommendation-api/db/migrations.test.ts` | 수정 |
| `services/recommendation-api/position/sql-repository.test.ts` | 수정 |
| `services/recommendation-api/db/mysql.integration.test.ts` | 수정 |
| `scripts/position-recommender/position_analysis_pipeline.test.ts` | 수정 |
| `scripts/position-recommender/recommendation-api/client.test.ts` | 수정 |
