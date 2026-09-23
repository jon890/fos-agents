# Phase 02. 회사 근거를 Backend로 옮긴다

**Execution profile**: deep

## 목표

`state/company-research/`가 담던 회사별 공개 사실을 `fos_career.company_evidence`로 옮기고,
저장하고 읽는 HTTP 경로 둘을 만든다.

이 phase가 끝나면 수집한 근거를 회사 tier 실행 단위로 저장하고,
한 회사의 유효한 근거만 골라 읽을 수 있다.

**범위 외**: 근거를 실제로 모으는 수집기는 셋째 계획이다.
모델이 근거를 읽고 축을 판정하는 계약 변경도 셋째 계획이다.
파일에 있는 8개 profile을 옮기는 이관 명령은 Phase 03이다.

## 컨텍스트

기존 계약은 `scripts/position-recommender/company-research/schema.ts`가 소유한다.
`CompanyResearchFact`가 `source.sourceType`과 `observedAt`과 `validUntil`을 이미 담고,
`CompanyResearchInference`가 `basisFactIds`로 사실과 추론을 잇는다.
**이 모양을 그대로 옮긴다.** 새 모델을 만들지 않는다.

옮기면서 바뀌는 것은 둘이다. 저장 위치가 파일에서 table이 되고,
`sourceType`의 값이 수집기 이름에 맞게 정해진다.

Backend의 기존 패턴은 Phase 01과 같다.
`src/positions/positions.controller.ts`와 `schema.ts`와
`repository/positions.repository.ts`를 따른다.

**근거 문서**: `docs/data-schema.md`의 「회사 근거」 절,
`docs/adr/ADR-123-회사-근거와-개인-제외-정책은-backend가-소유한다.md`

## 의도 메모

**근거를 회사 tier 실행 단위로 저장한다.**
`PUT company-tier-runs/:companyTierRunId/evidence`가 경로인 이유다.
회사 하나씩 저장하면 회사가 스물이면 요청이 스물이 된다.
실행 단위로 묶으면 한 요청으로 끝나고, 그 실행이 `completed`인지로 저장을 거절할 수 있다.

**`company_evidence`에 `company_tier_run_id` 칸을 두지 않는다.**
`docs/data-schema.md`의 「회사 근거」 표가 칸을 정하고 그 표에 없다.
같은 출처를 다시 모으면 같은 행을 갱신하므로 어느 실행이 그 행을 마지막으로 건드렸는지만 남길 수 있고,
그것은 `observed_at`이 이미 담는다. 실행 단위는 경로와 잠금에만 쓴다.

**같은 출처를 다시 모으면 행을 늘리지 않고 갱신한다.**
`(company_key, source_type, url_hash)`가 UNIQUE인 이유다.
`url_hash`로 거는 이유는 `docs/data-schema.md`의 「회사 근거」가 정한다.
회사 조사는 이력이 아니라 현재 상태다. 이력은 `company_tier_assessments`가 담는다.

**추론을 근거와 같은 table에 넣지 않는다.**
`company_evidence`는 외부에서 관측한 것만 담는다.
추론은 판정의 일부이므로 `company_tier_assessments`의 `reason`과 `signals_json`과
`evidence_json`과 `assumptions_json`이 담는다.
둘을 섞으면 어느 문장이 출처를 가졌는지 구분할 수 없다.

## 작업 항목

### 1. `prisma/migrations/`에 `company_evidence` migration 추가

`docs/data-schema.md`의 「회사 근거」 표가 칸과 타입과 `source_type`의 값을 정한다.

`CHECK` 제약 둘을 함께 넣는다.

- `url`이 `https://`로 시작한다
- `valid_until`이 `observed_at`의 날짜보다 이르지 않다

`(company_key, source_type, url_hash)`에 UNIQUE를 건다.
`(company_key, valid_until)`에 조회용 index를 건다.

collation은 `utf8mb4_unicode_ci`다.

### 2. `src/positions/schema.ts`에 근거 계약 추가

`companyEvidenceSchema`가 한 건을 담는다.
`sourceType`은 `docs/data-schema.md`가 정한 아홉 값의 enum이다.
`payloadJson`은 수집기마다 모양이 다르므로 `z.record(z.unknown())`으로 받고
Backend가 내용을 해석하지 않는다.

`companyEvidenceRequestSchema`는 회사별로 묶인 배열을 담는다.
한 요청이 여러 회사의 근거를 함께 담는다.

`summary`는 500자까지다. 그보다 긴 것은 `payloadJson`에 둔다.

### 3. 저장 계층과 service에 저장과 조회 추가

`PositionsRepository`에 `saveCompanyEvidence`와 `listValidCompanyEvidence`를 더한다.

저장은 한 트랜잭션에서 `INSERT ... ON DUPLICATE KEY UPDATE`로 한다.
회사 tier 실행 행을 먼저 잠근다. `docs/adr/ADR-122-추천-상태는-질의-단위로-읽고-쓴다.md`를 따른다.

조회는 `valid_until`이 오늘 이후인 것만 돌려준다.
만료된 근거는 지우지 않는다. 다음 수집이 같은 키로 갱신한다.

회사 tier 실행이 이미 `completed`면 `409`로 거절한다.

### 4. controller에 경로 둘 추가

| 메서드와 경로 | 반환 |
| --- | --- |
| `PUT company-tier-runs/:companyTierRunId/evidence` | 회사별 저장 건수 |
| `GET companies/:companyKey/evidence` | 유효한 근거 배열 |

`PUT`은 멱등 처리 대상이다.

### 5. 이 phase를 검증하는 `test/positions-company-evidence.e2e.test.ts`

확인할 것이다.

- `PUT` 뒤 `GET`이 저장한 근거를 돌려준다
- 같은 `(company_key, source_type, url)`로 다시 `PUT`하면 행이 늘지 않고 `summary`가 갱신된다
- `valid_until`이 어제인 근거가 `GET`에 나오지 않는다
- `http://`로 시작하는 `url`은 DB의 `CHECK`가 막는다
- 이미 `completed`인 회사 tier 실행에 `PUT`하면 `409`다
- 같은 멱등 키로 두 번 `PUT`하면 두 번째가 저장된 응답을 돌려준다

`CHECK` 확인은 repository를 우회해 SQL로 직접 넣는다.

### 6. `test/support/e2e-harness.ts`의 `DATA_TABLES`에 새 table 등록

Phase 01이 `position_exclusions`를 더한 그 배열에 `company_evidence`를 더한다.
등록하지 않으면 앞 테스트가 넣은 근거가 남아 실행 순서에 따라 결과가 달라진다.

## 검증

Phase 01의 container를 그대로 쓴다. 없을 때만 Phase 01의 절차로 띄운다.
Phase 01과 같은 이유로 `prisma migrate deploy`를 테스트 앞에 먼저 돌린다.

```bash
# cwd: career-os/services/recommendation-api
npm run typecheck
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npx prisma migrate deploy
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

기대값이다.

- `typecheck`가 종료 코드 0
- `migrate deploy`가 종료 코드 0
- `positions-company-evidence.e2e.test.ts`의 항목이 모두 통과
- Phase 01의 테스트를 포함해 기존 e2e가 계속 통과
- 출력에 `skipped`가 없다

`CHECK` 제약이 Phase 01의 19개에서 둘 늘어 21개여야 한다.

```bash
# cwd: 아무 곳
docker exec plan125-mysql mysql -uroot -pplan125 -N -e \
  'SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA="fos_career_test";'
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/prisma/migrations/*/migration.sql` | 신규 |
| `career-os/services/recommendation-api/prisma/schema.prisma` | 수정 |
| `career-os/services/recommendation-api/src/positions/schema.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/repository/positions.repository.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/positions.service.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/positions.controller.ts` | 수정 |
| `career-os/services/recommendation-api/test/support/e2e-harness.ts` | 수정 |
| `career-os/services/recommendation-api/test/positions-company-evidence.e2e.test.ts` | 신규 |
