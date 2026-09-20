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

`configure_position_analysis_policy.ts`와 예제 JSON도 `schemaVersion: 2`로 갱신한다.
이 migration은 기존 singleton 행에 5와 90을 채운 뒤 `NOT NULL`로 바꾸며,
DB 기본값은 남기지 않는다.

### 2. `002_company_tier_assessments.sql` migration을 추가한다

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

### 4. repository에 회사 tier 평가 상태를 추가한다

`position/memory-repository.ts`에 run, run 항목과 평가 타입을 추가하고,
`position/sql-repository.ts`의 `load`와 `persist`가 신규 table과 tier 출처를 모두 읽고 쓰게 한다.
평가를 만든 run은 삭제할 수 없고, 실행 항목의 상태와 연결한 평가가 어긋나지 않게 저장 순서를 정한다.

### 5. schema와 repository를 회귀 검증한다

`db/migrations.test.ts`는 001과 002의 적용 순서, checksum 변경 거부, 신규 table·FK·CHECK와 기존 행 이관을 검증한다.
`position/sql-repository.test.ts`는 평가 run의 선택 순서, 결과, 출처와 유효기간을 재시작 전후에 같게 복원하는지 검증한다.
MySQL 통합 테스트는 test URL이 있을 때 002까지 적용한 뒤 신규 table을 확인한다.

## 검증

```bash
bun test career-os/services/recommendation-api/db/migrations.test.ts \
  career-os/services/recommendation-api/position/sql-repository.test.ts \
  career-os/services/recommendation-api/db/mysql.integration.test.ts
bunx tsc --noEmit
```

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/recommendation-api/migrations/002_company_tier_assessments.sql` | 신규 |
| `services/recommendation-api/position/schema.ts` | 수정 |
| `services/recommendation-api/position/memory-repository.ts` | 수정 |
| `services/recommendation-api/position/sql-repository.ts` | 수정 |
| `services/recommendation-api/db/migrations.test.ts` | 수정 |
| `services/recommendation-api/position/sql-repository.test.ts` | 수정 |
| `services/recommendation-api/db/mysql.integration.test.ts` | 수정 |
