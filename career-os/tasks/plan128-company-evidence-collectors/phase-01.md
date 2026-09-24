# Phase 01. 판정 계약이 모르는 상태를 표현하게 한다

**Execution profile**: deep

## 목표

회사 판정 계약에서 값을 채우도록 강요하는 자리를 없앤다.
근거를 요구해서 등급을 받는 것이 아니라 근거가 있는 축만 등급을 받게 한다.

**범위 외**: 근거를 모으는 수집기는 Phase 02와 03이다.
리포트 표시는 Phase 04다.

## 컨텍스트

2026-09-22 운영 `fos_career.company_tier_assessments`의 5건을 조회한 결과다.

| tier | 신뢰도 | 근거 수 | `compensation-upside` |
| --- | --- | --- | --- |
| 1 | high | 2 | unknown |
| 2 | low | 1 | unknown |
| 2 | medium | 2 | unknown |
| 1 | medium | 2 | unknown |
| 2 | medium | 1 | unknown |

`confidence`가 `high`인 것도 근거가 2개다.
보상 축은 5건 전부 `unknown`이다.

계약이 이유를 설명한다. `services/recommendation-api/src/positions/schema.ts`의
`companyTierResultSchema`에서 `evidence`가 `.min(1)`이고
`recommendedTier`가 1부터 3 사이 필수이며 `confidence`도 필수다.
모르는 상태를 표현할 값이 축의 `level`에만 있어서, 정직하게 비워진 자리가 그 축 하나뿐이다.

**근거 문서**: `docs/data-schema.md`의 「회사 tier 평가 이력」 절,
`docs/adr/ADR-124-판정-스키마는-모르는-상태를-표현한다.md`

## 의도 메모

**기존 5건을 지우지 않는다.**
축별 근거 요구를 만족하지 않지만 유효기간이 끝나면 자연히 다시 평가된다.
지우면 그때 무엇을 알았는지가 사라진다.

**`recommendedTier`가 `null`이어도 공고 분석은 멈추지 않는다.**
`manual`, `model`, `default` 순서에서 `model`이 값을 내지 않으면 `default`가 선다.
`position_analysis_run_items.company_tier`는 계속 NOT NULL이다.

**`reason`의 200자를 늘리지 않는다.**
그 값이 공개 HTML에 그대로 실리므로 길이가 곧 노출 면적이다.
서술은 `assessment`가 따로 받는다.

**`evidenceIds`는 `company_evidence`의 ID를 가리킨다.**
축과 근거를 잇는 것이 이 phase의 핵심이다.
근거 없이 등급을 매긴 축을 계약이 거절해야 한다.

구현 때 확인한 기존 계약에는 평가 결과의 `evidence` 항목에 ID 칸이 없었다.
저장된 과거 평가를 읽을 수 있도록 `id`를 선택 항목으로 더하되,
새 축이 등급을 받으려면 같은 결과의 `evidence`에 있는 ID를 가리키게 한다.
과거 요청의 포착 파일은 고치지 않고 테스트 입력 변환에서 새 계약에 맞춘다.

## 작업 항목

### 1. `src/positions/schema.ts`의 `companyTierResultSchema`를 고친다

| 지금 | 뒤 |
| --- | --- |
| `evidence: z.array(...).min(1)` | `.default([])` |
| `recommendedTier: z.number().int().min(1).max(3)` | 같은 범위에 `.nullable()` |
| `confidence: z.enum(["low","medium","high"])` | 같은 값에 `.nullable()` |
| `reason: nonEmpty.max(200)` | 그대로 |
| (없음) | `assessment: z.string().trim().max(2000).optional()` |

`companyTierSignalSchema`에 `evidenceIds: z.array(z.string()).default([])`를 더한다.

`superRefine`에 검사를 더한다.
**`evidenceIds`가 비어 있는데 `level`이 `unknown`이 아니면 거절한다.**
그리고 `evidenceIds`의 각 값이 `evidence`에 담긴 근거의 ID여야 한다.

### 2. `company_tier_assessments` migration 추가

`prisma/migrations/`에 새 디렉터리를 만든다.

- `recommended_tier`를 NULL 허용으로 바꾼다
- `confidence`를 NULL 허용으로 바꾼다
- `assessment` TEXT NULL을 더한다

기존 `CHECK` 가운데 `recommended_tier`가 1부터 3임을 강제하는 것이 있으면
NULL을 허용하도록 다시 만든다.

MySQL 8.4.8에는 `ADD COLUMN IF NOT EXISTS`가 없다. 조건 없이 쓴다.

### 3. tier 해결에서 `null`을 다룬다

`src/positions/tier-provenance.ts`와 `positions.service.ts`에서
모델 평가의 `recommended_tier`가 NULL이면 그 평가를 tier 출처로 쓰지 않는다.
`manual`이 없으면 `default`가 선다.

`companyTierProvenanceShape`의 `companyTierSource`는 그때 `default`다.
`companyTierAssessmentId`를 함께 내보내지 않는다.
`company_tier_source`가 `model`일 때만 평가 ID가 있어야 한다는 기존 `CHECK`를 지킨다.

### 4. client 쪽 계약을 맞춘다

`scripts/position-recommender/company-tier-analysis/schema.ts`는
Backend의 schema를 import하므로 자동으로 따라간다.
`assessment`가 공개 HTML로 새어 나가지 않는지 확인하는 자리를 정한다.

### 5. 이 phase를 검증하는 `test/positions-company-tier-unknown.e2e.test.ts`

확인할 것이다.

- `evidence`가 빈 배열이고 세 축이 모두 `unknown`이며 `recommendedTier`가 `null`인 결과가 저장된다
- 그 회사의 tier가 `default`로 풀리고 `companyTierAssessmentId`가 응답에 없다
- `evidenceIds`가 비었는데 `level`이 `high`면 `400`이다
- `evidenceIds`가 `evidence`에 없는 ID를 가리키면 `400`이다
- `assessment`가 2000자를 넘으면 `400`이다
- 기존처럼 `recommendedTier`가 2인 결과도 그대로 저장되고 tier가 `model`로 풀린다

## 검증

테스트용 MySQL container를 확인한다. 떠 있으면 다시 만들지 않는다.

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

- `typecheck`가 종료 코드 0
- `positions-company-tier-unknown.e2e.test.ts`의 항목이 모두 통과
- 기존 e2e 테스트가 계속 통과
- 출력에 `skipped`가 없다

**NULL 허용이 실제로 반영됐는지 본다.**

```bash
# cwd: 아무 곳
docker exec plan125-mysql mysql -uroot -pplan125 -N -e \
  'SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA="fos_career_test" AND TABLE_NAME="company_tier_assessments"
     AND COLUMN_NAME IN ("recommended_tier","confidence","assessment");'
```

셋 모두 `YES`여야 한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/src/positions/schema.ts` | 수정 |
| `career-os/services/recommendation-api/prisma/migrations/*/migration.sql` | 신규 |
| `career-os/services/recommendation-api/prisma/schema.prisma` | 수정 |
| `career-os/services/recommendation-api/src/positions/tier-provenance.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/positions.service.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/repository/positions.repository.ts` | 수정 |
| `career-os/services/recommendation-api/test/positions-company-tier-unknown.e2e.test.ts` | 신규 |
