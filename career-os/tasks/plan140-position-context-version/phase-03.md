# Phase 03. 분석 정책의 계약과 저장 칸에서 candidateContextVersion 을 지운다

**Execution profile**: deep

## 목표

분석 정책의 요청과 응답 스키마, 저장소 질의, DB 칸에서 `candidateContextVersion` 을 지운다.
phase 01 뒤로 이 값은 저장만 되고 읽히지 않는다. 남겨 두면 정책을 읽는 쪽이 그 값을 기준으로 오해한다.

**범위 외**

- 실행과 분석과 평가의 `candidate_context_version` 칸(`company_tier_assessment_runs`, `company_tier_assessments`, `position_analysis_runs`, `position_analyses`)은 고치지 않는다. 그 행을 만들 때 쓴 기준의 기록이다.
- `src/study/` 와 `study_*` table 의 `candidate_context_version` 은 `learning-interests` 문서의 것이다. 고치지 않는다.
- `career-os/docs/` 는 이미 이 phase 가 끝난 상태로 적혀 있다. 고치지 않는다.
- 운영 DB 에 migration 을 적용하는 일과 배포는 `remote-verification.md` 의 항목이다.

## 컨텍스트

작업 디렉터리는 `career-os/services/career-backend` 다.

**지울 곳.**

| 파일 | 지금 |
| --- | --- |
| `src/positions/schema.ts` | `analysisPolicySchema` 의 `candidateContextVersion: nonEmpty`. 이 스키마는 `.strict()` 라 칸을 지우면 그 칸을 보낸 요청이 `400` 이 된다 |
| `src/positions/repository/positions.repository.ts` | `findPolicy` 의 `SELECT candidate_context_version` 과 결과 객체의 `candidateContextVersion`. `upsertPolicy` 의 `INSERT` 칸 목록과 값, `ON DUPLICATE KEY UPDATE` 의 `candidate_context_version = VALUES(candidate_context_version)` |
| `prisma/schema.prisma` | `model position_analysis_policy` 의 `candidate_context_version String` |
| DB | `position_analysis_policy.candidate_context_version VARCHAR(191) NOT NULL`. 기본값이 없다. 이 칸을 참조하는 `CHECK` 제약과 index 는 없다 |

`src/positions/repository/positions.repository.ts` 의 다른 `candidate_context_version` 과 `candidateContextVersion`(`PositionAnalysisRow`, `CompanyTierRunRow`, `AnalysisRunRow`, 질의의 `a.candidate_context_version` 들)은 실행과 분석과 평가의 것이다. **고치지 않는다.**
`src/positions/stored.ts` 의 `StoredCompanyTierAssessment.candidateContextVersion` 도 평가 행의 것이라 고치지 않는다.

**스크립트가 같은 스키마 파일을 import 한다.** `career-os/scripts/position-recommender/career-backend/client.ts` 가 `analysisPolicySchema` 로 정책 응답을 검사한다. 스키마에서 칸을 지우면 그 칸을 담은 스크립트 테스트 fixture 가 깨진다. 그래서 이 phase 의 커밋에 스크립트 테스트 두 파일이 함께 들어간다. 스크립트의 실행 코드는 phase 02 가 이미 이 칸을 쓰지 않게 했으므로 고칠 것이 없다.

**본보기.** 공부 추천이 같은 일을 했다. `prisma/migrations/20260930000100_study_control_drop_context_version/migration.sql` 이 `study_recommendation_control.candidate_context_version` 을 `DROP COLUMN` 한 줄로 지웠다.

**migration 규칙.** `README.md` 의 「migration 을 만들고 고치는 규칙」 을 따른다. 적용한 migration 파일은 고치지 않고 새 migration 을 만든다.

**근거 문서**: `career-os/docs/data-schema.md` 의 「포지션 분석 정책」 절,
`career-os/services/career-backend/README.md` 의 「Prisma migration」 절과 「전환 전 정답지」 절,
`career-os/docs/adr/ADR-134-공고-분석의-기준-버전은-position-preferences-문서-버전에서-계산한다.md`

## 의도 메모

- **칸을 남기지 않고 지운다.** ADR-134 가 「저장돼 있던 값은 버린다」 고 정했다. 남기고 쓰지 않는 선택은 migration 없이는 성립하지 않는다. 칸이 `NOT NULL` 이고 기본값이 없어, 새 코드가 그 칸을 빼고 `INSERT` 하면 실패한다. 남기려면 nullable 로 바꾸는 migration 과 나중에 지우는 migration 이 둘 필요하고, 그 사이에 아무도 읽지 않는 칸이 정책 행에 남는다.
- **배포 순서에서 깨지는 곳.** 배포 스크립트는 DB 백업, `migrate`, `serve` 순서로 돈다.
  - 옛 코드와 새 스키마: `migrate` 가 끝나고 새 container 가 뜨기 전까지 옛 코드가 돌고 있으면 정책을 읽는 요청(`findPolicy` 의 `SELECT`)이 `500` 으로 끝난다. 수집은 사람이나 cron 이 하루 한 번 부르는 동기 요청이라 이 구간에 요청이 없으면 영향이 없다. 구간을 피하는 방법은 `remote-verification.md` 가 적는다.
  - 새 코드와 옛 스키마: 생기지 않는다. `GET /health/ready` 가 적용되지 않은 migration 이 있으면 `503` 이고 배포 스크립트가 `migrate` 를 `serve` 앞에 돌린다.
  - 되돌리기: 옛 image 는 지운 칸을 읽으므로 image 만 되돌려서는 돌지 않는다. 배포 스크립트가 만든 백업으로 DB 를 복원해야 한다. 공부 추천의 같은 변경도 같은 조건으로 나갔다.
- 기각: phase 01 과 이 phase 를 한 커밋으로 합친다. 계산을 바꾸는 일과 계약을 지우는 일을 나누면 phase 01 뒤에 테스트가 「정책 값을 무시한다」 를 관측하고, 이 phase 는 지우는 일만 남는다.
- 기각: 스키마가 `candidateContextVersion` 을 받되 버린다(`.strict()` 를 풀거나 optional 로 둔다). 옛 client 가 보낸 값이 조용히 무시되면 기준 버전을 정책으로 정할 수 있다고 계속 믿게 된다. `400` 으로 거절한다.
- 전환 전 정답지 `cases.json` 은 고치지 않는다. 정책 요청과 응답과 정책 행의 비교는 `test/support/legacy-contract.ts` 가 비교 시점에 바꾼다. phase 01 이 더한 `expectedLegacyRow` 와 같은 방식이다.

## Blocked 조건

- 테스트용 MySQL 에 접속할 수 없으면 `PHASE_BLOCKED: 테스트 DB 없음` 을 출력하고 종료한다. 테스트를 건너뛰어 통과로 만들지 않는다.
- `prisma/migrations/` 에 `20261002000100` 보다 늦은 이름의 migration 이 이미 있으면 그보다 늦은 timestamp 로 이름을 바꿔 만든다. 이름만 바뀌고 내용은 같다. 변경 파일 표의 경로와 달라지므로 커밋 메시지에 적는다.

## 작업 항목

### 1. `prisma/migrations/20261002000100_position_policy_drop_context_version/migration.sql` 신규

```sql
-- 포지션 분석의 기준 버전은 position-preferences 후보자 맥락 문서의 version 에서 계산한다. ADR-134 를 따른다.
-- 정책 행의 기준 버전 칸은 더 읽지 않으므로 지운다.
ALTER TABLE position_analysis_policy DROP COLUMN candidate_context_version;
```

### 2. `prisma/schema.prisma` 의 `position_analysis_policy` 에서 칸을 지운다

`candidate_context_version String` 한 줄을 지운다. 다른 model 의 같은 이름 칸은 건드리지 않는다.

`prisma/baseline.test.ts` 가 단언하는 개수는 바뀌지 않는다. `CHECK` 제약 30개와 model 35개 그대로다. 칸 하나를 지울 뿐이고 그 칸을 쓰는 제약이 없다. 그래서 이 파일은 고치지 않는다. 테스트가 개수 때문에 실패하면 원인을 다시 확인한다.

### 3. `src/positions/schema.ts` 의 `analysisPolicySchema` 에서 칸을 지운다

`candidateContextVersion: nonEmpty,` 한 줄을 지운다. `.strict()` 와 `superRefine` 은 그대로 둔다.

### 4. `src/positions/repository/positions.repository.ts` 의 정책 질의 둘을 고친다

- `findPolicy`: `SELECT` 목록과 결과 객체에서 지운다.
- `upsertPolicy`: `INSERT` 의 칸 목록과 `VALUES`, `ON DUPLICATE KEY UPDATE` 에서 지운다.

### 5. `test/support/legacy-contract.ts` 가 정책의 요청과 응답과 정책 행을 비교 시점에 바꾼다

정답지에서 이 칸을 담은 곳은 셋이다. `PUT /api/positions/v1/analysis-policy` 의 요청 본문(`ok-04-put-analysis-policy`, `err-09-schema-violation`, 그리고 스물한 case 의 `given`), `ok-04` 의 응답 본문, `ok-04` 의 `position_analysis_policy` 기대 행과 `comparedColumns` 다.

- `materializeLegacyBody`: 본문이 객체이고 최상위에 `candidateContextVersion` 이 있으면 그 키를 지운 사본을 돌려준다. 정답지에서 최상위에 이 키를 가진 요청 본문은 정책 요청뿐이다. 정답지를 보내는 모든 경로(`harness.replayGiven`, `harness.sendLegacyRequest`, `positions-recommendation.e2e.test.ts` 의 `replayGivenWithLiveIds`)가 이 함수를 거친다.
  `err-09` 는 `prioritySlots` 와 `agingSlots` 의 합이 틀려 `400` 을 기대한다. 이 키를 지우지 않으면 `.strict()` 의 오류 문장이 앞에 붙어 정답지의 오류 본문과 달라진다.
- `expectedLegacyResponseBody(body: unknown): unknown` 을 더한다. 최상위에 `candidateContextVersion` 이 있으면 지운 사본을 돌려준다. `test/support/e2e-harness.ts` 의 `expectMatchesLegacy` 가 기대 본문을 이 함수에 통과시킨다.
- `expectedLegacyRow`: `table` 이 `position_analysis_policy` 이면 `candidate_context_version` 키를 지운 사본을 돌려준다.
- 비교할 열 목록에서도 그 열을 뺀다. `legacyComparedColumns` 를 내보낼 때 `position_analysis_policy` 의 `columns` 에서 `candidate_context_version` 을 거른다. `expectMatchesLegacyDatabase` 가 이 목록으로 `SELECT` 를 만들기 때문에 거르지 않으면 없는 열을 읽어 실패한다.

### 6. 정책 본문을 만드는 테스트에서 칸을 지운다

| 파일 | 고칠 곳 |
| --- | --- |
| `test/positions-analysis-policy.e2e.test.ts` | `policy` 의 `candidateContextVersion`. 다시 저장하는 `changed` 는 `staleAfterDays` 만 바꾼다 |
| `test/positions-analysis.e2e.test.ts` | `AnalysisPolicyBody` 타입과 `policy()` 의 기본값. phase 01 이 더한 테스트의 `"ignored-by-backend"` 설정 |
| `test/positions-collection.e2e.test.ts` | `policy(dailyCompanyTierLimit)` 와 `policyBody()` 의 기본값. 「정책에 동시에 온 두 요청 가운데 하나만 통째로 남는다」 의 `SELECT` 목록과 `asStored` 의 `candidate_context_version` |
| `test/positions-recommendation.e2e.test.ts` | `AnalysisPolicyBody` 타입과 `policy()` 의 기본값 |
| `test/contract.e2e.test.ts` | `PUT /api/positions/v1/analysis-policy` 본문의 `candidateContextVersion` |
| `src/positions/queue.test.ts` | `selectAnalysisQueue` 에 넘기는 정책 객체의 `candidateContextVersion` |
| `career-os/scripts/position-recommender/career-backend/client.test.ts` | 「분석 정책 설정은 인증된 PUT 요청을 사용한다」 와 「분석 정책 조회는 ...」 의 `policy` 객체 둘 |
| `career-os/scripts/position-recommender/configure_position_analysis_policy.test.ts` | phase 02 가 만든 fixture 의 정책 객체 |

`test/positions-collection.e2e.test.ts` 에서 `companyTierProvenanceFields` 에 넘기는 `candidateContextVersion: "context-1"` 은 평가 행의 값이다. 지우지 않는다.

phase 01 의 「수집과 분석 실행이 문서 version 을 기록한다」 테스트는 정책에 `"ignored-by-backend"` 를 넣어 그 값이 쓰이지 않는 것을 확인했다. 이제 그 값을 보낼 수 없다. 정책 설정을 기본값으로 바꾸고 기대값 `"position-preferences:v1"` 단언은 남긴다.

### 7. 이 phase 를 검증하는 `test/positions-analysis-policy.e2e.test.ts` 의 테스트 둘

| 테스트 | 입력 | 기대 |
| --- | --- | --- |
| 저장한 정책에 `candidateContextVersion` 이 없다 | 정책을 저장하고 `GET /api/positions/v1/analysis-policy` | 응답 본문이 보낸 본문과 같고 `candidateContextVersion` 키가 없다. `position_analysis_policy` 를 `SELECT *` 로 읽은 행에 `candidate_context_version` 키가 없다 |
| `candidateContextVersion` 을 보낸 정책 요청은 `400` 이다 | 올바른 정책 본문에 `candidateContextVersion: "position-preferences:v1"` 을 더해 `PUT` | status 400, `error.code` 가 `BAD_REQUEST`. `position_analysis_policy` 에 행이 없다 |

### 8. `test/fixtures/legacy-contract/README.md` 의 「포착 뒤에 달라진 계약」 절에 한 항목을 더한다

정책의 요청과 응답과 정책 행에서 `candidateContextVersion` 과 `candidate_context_version` 을 빼고 보내고 비교한다는 것, 이유는 ADR-134 라는 것, 바꾸는 코드는 `materializeLegacyBody`, `expectedLegacyResponseBody`, `expectedLegacyRow` 라는 것을 적는다.

## 검증

```bash
# cwd: career-os/services/career-backend
npx prisma generate
npm run typecheck
# 로컬 테스트 DB 에만 새 migration 을 적용한다. 운영 DB 에는 적용하지 않는다.
DATABASE_URL="<테스트 DB>" npx prisma migrate deploy
DATABASE_URL="<테스트 DB>" CAREER_BACKEND_TEST_DATABASE_URL="<테스트 DB>" SHADOW_DATABASE_URL="<빈 shadow DB>" \
  npx vitest run \
  src/positions/queue.test.ts \
  test/positions-analysis-policy.e2e.test.ts \
  test/positions-analysis.e2e.test.ts \
  test/positions-collection.e2e.test.ts \
  test/positions-recommendation.e2e.test.ts \
  test/contract.e2e.test.ts
DATABASE_URL="<테스트 DB>" CAREER_BACKEND_TEST_DATABASE_URL="<테스트 DB>" SHADOW_DATABASE_URL="<빈 shadow DB>" npm test
```

모두 종료 코드 0 이어야 한다.
`npx vitest run` 은 이 phase 가 고친 테스트를 이름으로 먼저 실행한다. 그 뒤의 `npm test` 가 전체를 실행한다.
`npm test` 는 `vitest.config.ts` 의 `include` 가 `prisma/**/*.test.ts`, `src/**/*.test.ts`, `test/**/*.test.ts` 를 담으므로 `prisma/baseline.test.ts`, `src/positions/queue.test.ts` 와 위의 e2e 파일을 모두 실행한다.
`prisma/baseline.test.ts` 의 「적용한 database 와 schema.prisma 의 차이가 없다」 가 통과해야 한다. migration 과 `schema.prisma` 가 같은 칸을 지웠다는 뜻이다.

```bash
# cwd: 저장소 루트
bun test \
  ./career-os/scripts/position-recommender/career-backend/client.test.ts \
  ./career-os/scripts/position-recommender/configure_position_analysis_policy.test.ts
bun test ./career-os/scripts/position-recommender ./career-os/scripts/candidate-context
bunx tsc --noEmit
```

셋 다 종료 코드 0 이어야 한다. 둘째 명령은 같은 스키마를 import 하는 나머지 스크립트 테스트가 함께 깨지지 않았는지 본다.

```bash
# cwd: 저장소 루트
git diff --quiet -- career-os/services/career-backend/test/fixtures/legacy-contract/cases.json
! git grep -n "candidateContextVersion" -- career-os/services/career-backend/src/positions/schema.ts career-os/scripts/position-recommender/configure_position_analysis_policy.ts
git grep -c "candidate_context_version" -- career-os/services/career-backend/prisma/schema.prisma
```

앞의 둘은 종료 코드 0 이어야 한다.
마지막 명령은 `10` 을 낸다. 지금은 `11` 이고 정책 model 의 한 줄만 준다.
남는 열 줄은 `study_recommendation_runs` 의 칸, `study_material_verdicts` 의 칸과 `@@id` 와 `@@index`, `company_tier_assessment_runs` 의 칸, `company_tier_assessments` 의 칸과 `@@index`, `position_analyses` 의 칸과 `@@unique`, `position_analysis_runs` 의 칸이다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/services/career-backend/prisma/migrations/20261002000100_position_policy_drop_context_version/migration.sql` | 신규 |
| `career-os/services/career-backend/prisma/schema.prisma` | 수정 |
| `career-os/services/career-backend/src/positions/schema.ts` | 수정 |
| `career-os/services/career-backend/src/positions/repository/positions.repository.ts` | 수정 |
| `career-os/services/career-backend/src/positions/queue.test.ts` | 수정 |
| `career-os/services/career-backend/test/support/legacy-contract.ts` | 수정 |
| `career-os/services/career-backend/test/support/e2e-harness.ts` | 수정 |
| `career-os/services/career-backend/test/positions-analysis-policy.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/positions-analysis.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/positions-collection.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/positions-recommendation.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/contract.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/fixtures/legacy-contract/README.md` | 수정 |
| `career-os/scripts/position-recommender/career-backend/client.test.ts` | 수정 |
| `career-os/scripts/position-recommender/configure_position_analysis_policy.test.ts` | 수정 |
