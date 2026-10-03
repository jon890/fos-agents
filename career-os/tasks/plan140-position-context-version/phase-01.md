# Phase 01. Backend 가 공고 분석의 기준 버전을 position-preferences 문서에서 계산한다

**Execution profile**: deep

## 목표

커리어 Backend 의 공고 모듈이 기준 버전을 분석 정책 행이 아니라 `position-preferences` 후보자 맥락 문서의 `version` 에서 계산하게 한다.
문서를 어느 경로로 저장해도 다음 수집부터 새 기준 버전이 쓰이게 하기 위해서다.

이 phase 가 끝난 상태에서 분석 정책의 요청과 응답과 저장 칸은 그대로다.
정책이 받은 `candidateContextVersion` 값은 저장만 되고 어디에서도 읽히지 않는다.

**범위 외**

- 정책의 요청과 응답 스키마, 저장 칸, migration 은 phase 03 이 바꾼다. 이 phase 에서 `src/positions/schema.ts` 를 고치지 않는다.
- `career-os/scripts/` 는 phase 02 가 바꾼다. 이 phase 에서 고치지 않는다.
- `src/study/` 의 `candidate_context_version` 은 `learning-interests` 문서의 것이다. 대상이 아니다.

## 컨텍스트

작업 디렉터리는 `career-os/services/career-backend` 다. NestJS, Prisma, MySQL 8.4, vitest 를 쓴다.

**지금의 동작.** `src/positions/positions.service.ts` 가 `requirePolicy(tx)` 로 읽은 정책의 `candidateContextVersion` 을 여섯 곳에서 쓴다.

| 메서드 | 쓰는 곳 |
| --- | --- |
| `createPositionAnalysisRun` | `selectAnalysisQueue` 에 넘기는 spec 의 `candidateContextVersion`, 새 `AnalysisRunRow` 의 `candidateContextVersion` |
| `refreshPendingSince` | `analysisStatusOf` 의 `contextVersion` 인자 |
| `openCompanyTierRun` | `selectCompanyTierQueue` 의 둘째 인자, 새 `CompanyTierRunRow` 의 `candidateContextVersion` |
| `preparationResponse` | `analysisSummary` 의 `candidateContextVersion` 인자 |

`refreshPendingSince`, `openCompanyTierRun`, `preparationResponse` 는 모두 `saveCollection` 이 부른다.
그래서 기준 버전이 필요한 요청은 `POST /api/positions/v1/collection-runs` 와 `POST /api/positions/v1/collection-runs/:collectionRunId/analysis-runs` 둘이다.

나머지 사용처는 `run.candidateContextVersion` 이다. 실행 행(`company_tier_assessment_runs`, `position_analysis_runs`)에 저장된 값이고 그 실행을 만들 때 쓴 기준의 기록이다. **이 값들은 고치지 않는다.**

**본보기.** 공부 추천 모듈이 같은 일을 `learning-interests` 문서로 한다.

| 볼 것 | 경로 |
| --- | --- |
| 모듈 의존 | `src/study/study.module.ts` 의 `imports: [CandidateContextModule]` |
| 문서에서 기준 버전 계산, 문서가 없을 때의 오류 | `src/study/study.service.ts` 의 `learningInterestsContext` |
| transaction 안에서 문서를 공유 잠금으로 읽기 | `src/study/study.service.ts` 의 `createRecommendationRun`, `src/candidate-context/repository/candidate-context.repository.ts` 의 `lockDocumentForShare(documentKey, tx)` |
| e2e 가 문서를 선행 상태로 만드는 법 | `test/support/e2e-harness.ts` 의 `putLearningInterests` |

`src/candidate-context/candidate-context.module.ts` 는 `CandidateContextRepository` 와 `CandidateContextService` 를 내보내고 다른 모듈을 import 하지 않는다.
`PositionsModule` 을 import 하는 곳은 `src/app.module.ts` 뿐이다. 그래서 `PositionsModule` 이 `CandidateContextModule` 을 import 해도 순환이 생기지 않는다.

오류 코드 `CANDIDATE_CONTEXT_MISSING` 은 `src/common/api-error.ts` 에 이미 있다. 새로 더하지 않는다.

**근거 문서**: `career-os/docs/data-schema.md` 의 「후보자 맥락 문서」 절과 「포지션 분석 정책」 절,
`career-os/docs/flow.md` 의 「커리어 Backend」 절의 상태 코드 표와 「후보자 맥락 문서」 절,
`career-os/docs/adr/ADR-134-공고-분석의-기준-버전은-position-preferences-문서-버전에서-계산한다.md`

## 의도 메모

- **과거 실행에 남은 기준 버전은 그대로 둔다.** `company_tier_assessment_runs`, `company_tier_assessments`, `position_analysis_runs`, `position_analyses` 의 `candidate_context_version` 은 그 행을 만들 때 쓴 기준의 기록이면서 재사용을 찾는 키다(`position_analyses` 의 UNIQUE 와 `idx_company_tier_assessment_lookup`). 값의 모양 `position-preferences:v{version}` 도 바뀌지 않는다. 그래서 데이터를 옮기는 migration 이 없다.
- 배포 시점에 운영 정책의 저장값이 문서 version 과 같았다면 기존 분석이 그대로 `fresh` 로 재사용된다. 달랐다면 계산한 값이 이기고 옛 값으로 저장된 분석은 `stale` 로 다시 대기열에 들어간다. 하루 상한이 있어 한 번에 몰리지 않는다.
- **오류 순서를 지킨다.** 정책이 없으면 `POLICY_NOT_CONFIGURED` 가 먼저다. 전환 전 정답지의 `err-10-policy-not-configured` 가 이 순서를 기대한다. 문서 확인은 정책 확인 뒤에 둔다.
- **잠금 순서는 수집 실행 행 다음에 문서다.** `saveCollection` 과 `createPositionAnalysisRun` 이 모두 `lockCollectionRun` 뒤에 문서를 공유 잠금으로 읽는다. 한쪽이 문서를 먼저 잡으면, 문서 저장(`PUT documents/position-preferences` 의 `FOR UPDATE`)이 사이에 끼었을 때 세 transaction 이 서로를 기다리는 교착이 생길 수 있다.
- 공유 잠금으로 읽는 이유는 실행 행에 적는 기준 버전이 commit 시점의 문서 version 과 같게 하기 위해서다. 공부 추천의 추천 저장과 같은 이유다.
- 기각: 문서를 저장하는 transaction 에서 정책 칸도 고친다. ADR-134 가 기각했다. 후보자 맥락 모듈이 공고 모듈을 알게 된다.
- 기각: `preparationResponse` 가 이미 있는 실행의 집계에 실행 행의 값을 쓰게 바꾼다. 지금은 요청 시점의 기준으로 집계한다. 이 plan 은 값이 어디서 오는지만 바꾸고 집계 규칙은 건드리지 않는다.
- 전환 전 정답지 `test/fixtures/legacy-contract/cases.json` 은 고치지 않는다. 그 파일의 README 가 금지한다. 달라진 저장 계약은 비교 시점에 반영한다. `test/support/legacy-contract.ts` 의 `expectedLegacyAssessment` 가 같은 방식의 선례다.

## Blocked 조건

- 테스트용 MySQL 에 접속할 수 없으면 `PHASE_BLOCKED: 테스트 DB 없음` 을 출력하고 종료한다. 테스트를 건너뛰어 통과로 만들지 않는다.

## 작업 항목

### 1. `src/positions/positions.module.ts` 가 `CandidateContextModule` 을 import 한다

`imports: [CandidateContextModule]` 을 더한다. 경로는 `../candidate-context/candidate-context.module.js` 다.

### 2. `src/positions/positions.service.ts` 가 기준 버전을 문서에서 계산한다

- 생성자에 `private readonly candidateContextRepository: CandidateContextRepository` 를 더한다.
- 파일 상단에 문서 키 상수를 둔다. `const positionPreferencesKey = "position-preferences";`
- private 메서드를 더한다.

```ts
/** 공고 분석의 기준 버전은 position-preferences 문서의 version 에서 계산한다. ADR-134 를 따른다. */
private async requireContextVersion(tx: Prisma.TransactionClient): Promise<string>
```

  `this.candidateContextRepository.lockDocumentForShare(positionPreferencesKey, tx)` 로 읽는다.
  문서가 없으면 `new ApiError(409, "CANDIDATE_CONTEXT_MISSING", "position-preferences 후보자 맥락 문서가 없습니다.")` 를 던진다.
  있으면 `` `position-preferences:v${document.version}` `` 을 돌려준다.

- `saveCollection`: `requirePolicy(tx)` 와 `lockCollectionRun(...)` 다음 줄에서 `const contextVersion = await this.requireContextVersion(tx);` 를 부른다. `existingRun` 분기보다 앞이다.
- `preparationResponse` 의 `policy` 인자를 `contextVersion: string` 으로 바꾼다. 이 메서드는 정책에서 기준 버전만 읽는다.
- `refreshPendingSince` 의 `policy` 인자를 `contextVersion: string` 으로 바꾼다. 이 메서드도 정책에서 기준 버전만 읽는다.
- `openCompanyTierRun` 은 `policy.dailyCompanyTierLimit` 을 계속 쓰므로 `policy` 를 남기고 `contextVersion: string` 인자를 더한다.
- `createPositionAnalysisRun`: 회사 tier 실행의 상태 확인(`COMPANY_TIER_RUN_MISSING`, `COMPANY_TIER_RUN_PENDING`)이 끝난 뒤, `selectAnalysisQueue` 를 부르기 직전에 `requireContextVersion(tx)` 를 부른다. 이미 만든 실행을 돌려주는 분기는 문서를 읽지 않는다.
- 이 phase 가 끝나면 `positions.service.ts` 에 `policy.candidateContextVersion` 이 남지 않는다.

`run.candidateContextVersion` 을 읽는 곳과 `analysisStatusOf`, `analysisSummary`, `companyAssessmentsForRun` 의 시그니처는 고치지 않는다.

### 3. `test/support/e2e-harness.ts` 에 `position-preferences` 선행 상태를 만드는 도구 둘을 더한다

`E2eHarness` 타입과 구현에 더한다.

```ts
/** position-preferences 문서가 없으면 version 1 로 만든다. HTTP 를 거치지 않아 request_receipts 에 행이 남지 않는다. */
ensurePositionPreferences(): Promise<void>;
/** position-preferences 문서를 현재 version 위에 HTTP 로 저장하고 새 version 을 돌려준다. */
putPositionPreferences(body: string): Promise<number>;
```

- `ensurePositionPreferences` 는 `candidate_context_documents`(`document_key`, `body`, `version`, `note`, `updated_at`)와 `candidate_context_document_revisions`(`document_key`, `version`, `body`, `note`, `created_at`)에 행을 직접 넣는다. 본문은 `"예시 선호 문장"` 같은 지어낸 값이다.
  **HTTP 로 만들지 않는 이유**: 정답지의 여러 case 가 `request_receipts` 의 행 전체를 비교한다. HTTP 로 저장하면 영수증 행이 하나 늘어 그 비교가 깨진다.
- `putPositionPreferences` 는 기존 `putLearningInterests` 와 같은 방식이다. 두 메서드가 문서 키만 다르므로 키를 받는 내부 함수 하나로 합치고 둘이 그것을 부르게 한다.

### 4. `test/support/legacy-contract.ts` 가 정답지의 기준 버전 값을 비교 시점에 바꾼다

정답지의 DB 기대값은 실행과 분석과 평가의 `candidate_context_version` 을 `"candidate-context-2026-09"` 로 적었다. 이제 서버는 문서 version 1 에서 `"position-preferences:v1"` 을 계산한다.

- `export const legacyContextVersion = "position-preferences:v1";` 를 더한다.
- `export function expectedLegacyRow(table: string, row: Record<string, unknown>): Record<string, unknown>` 를 더한다.
  `table` 이 `company_tier_assessment_runs`, `company_tier_assessments`, `position_analysis_runs`, `position_analyses` 가운데 하나이고 행에 `candidate_context_version` 이 있으면 그 값을 `legacyContextVersion` 으로 바꾼 사본을 돌려준다.
  `position_analysis_policy` 는 바꾸지 않는다. 이 phase 에서는 정책이 받은 값을 그대로 저장한다.
- `test/support/e2e-harness.ts` 의 `expectMatchesLegacyDatabase` 가 기대 행을 `expectedLegacyRow(table, row)` 에 통과시킨 뒤 비교한다. `company_tier_assessments` 는 기존 `expectedLegacyAssessment` 와 함께 적용한다.

`test/fixtures/legacy-contract/cases.json` 은 고치지 않는다.

### 5. 공고 e2e 가 문서를 선행 상태로 둔다

`POST /api/positions/v1/collection-runs` 를 보내는 테스트 파일은 다섯이다.
`test/contract.e2e.test.ts`, `test/positions-analysis.e2e.test.ts`, `test/positions-collection.e2e.test.ts`, `test/positions-company-tier-unknown.e2e.test.ts`, `test/positions-recommendation.e2e.test.ts` 다.

각 파일의 `beforeEach` 에서 `harness.clearAll()` 다음에 `await harness.ensurePositionPreferences();` 를 부른다.
정답지를 재생하는 경로(`harness.replayGiven`, `harness.sendLegacyRequest`, `positions-recommendation.e2e.test.ts` 의 `replayGivenWithLiveIds`)는 이 선행 상태 위에서 그대로 돈다.

`test/positions-recommendation.e2e.test.ts` 에서 정책의 `candidateContextVersion` 을 `"candidate-context-2026-12"` 로 바꿔 「정책을 바꾼 뒤의 집계」 를 확인하는 테스트가 있다. 정책의 값은 더 읽히지 않으므로 이 테스트가 아무것도 확인하지 못하게 된다.
`configure({ candidateContextVersion: ... }, "policy-changed")` 를 `await harness.putPositionPreferences("바뀐 예시 선호 문장");` 으로 바꾸고, 테스트 이름과 단언 메시지를 「문서를 새로 저장한 뒤」 로 고친다. 기대값은 그대로다. 이미 만든 실행의 집계는 실행 행의 기준 버전으로 계산하므로 바뀌지 않아야 한다.

### 6. 이 phase 를 검증하는 `test/positions-analysis.e2e.test.ts` 의 새 describe

이 파일의 기존 helper(`configure`, `collect`, `assess`, `openQueue`)를 쓴다. describe 이름은 「기준 버전은 position-preferences 문서에서 계산한다」 다.

| 테스트 | 입력 | 기대 |
| --- | --- | --- |
| 수집과 분석 실행이 문서 version 을 기록한다 | 문서 version 1. 정책은 `candidateContextVersion: "ignored-by-backend"` 로 설정. 수집, 회사 평가, 분석 실행 생성 | `company_tier_assessment_runs` 와 `position_analysis_runs` 의 `candidate_context_version` 이 `"position-preferences:v1"` 이다. `"ignored-by-backend"` 가 아니다 |
| 문서를 새로 저장하면 다음 수집부터 새 기준 버전이 쓰인다 | 위 흐름으로 분석까지 마친 뒤 `harness.putPositionPreferences(...)` 로 version 2 를 만들고, 같은 공고로 둘째 수집 | 둘째 수집의 `company_tier_assessment_runs` 행이 `"position-preferences:v2"` 다. 둘째 수집 응답의 `summary.reusedCount` 가 0 이고 `summary.staleCount` 가 공고 수와 같다 |
| 문서가 없으면 수집을 409 `CANDIDATE_CONTEXT_MISSING` 으로 거절한다 | 정책 설정 뒤 `candidate_context_document_revisions` 와 `candidate_context_documents` 의 행을 SQL 로 지우고 수집 | status 409, `error.code` 가 `CANDIDATE_CONTEXT_MISSING`. `position_collection_runs` 에 행이 없다 |
| 정책도 문서도 없으면 `POLICY_NOT_CONFIGURED` 가 먼저다 | 둘 다 없는 상태에서 수집 | status 409, `error.code` 가 `POLICY_NOT_CONFIGURED` |
| 문서가 없으면 분석 실행 생성을 409 `CANDIDATE_CONTEXT_MISSING` 으로 거절한다 | 수집과 회사 평가를 마친 뒤 문서 행을 SQL 로 지우고 분석 실행 생성 | status 409, `error.code` 가 `CANDIDATE_CONTEXT_MISSING`. `position_analysis_runs` 에 행이 없다 |

`summary` 의 칸 이름은 `src/positions/positions.service.ts` 의 `analysisSummary` 가 돌려주는 객체에서 확인한다.
이 파일의 `collect` helper 는 status 201 을 단언하고 `companyTierQueue` 만 돌려준다. 409 를 기대하는 테스트와 `summary` 를 읽는 테스트는 `send("POST", "/api/positions/v1/collection-runs", { idempotencyKey, body: pool(runId, postings, collectedAt) })` 로 직접 보낸다.
문서 행을 지울 때는 외래 키 때문에 `candidate_context_document_revisions` 를 먼저 지운다.

### 7. `test/fixtures/legacy-contract/README.md` 에 비교 시점에 바꾸는 값을 적는다

문서 끝에 「포착 뒤에 달라진 계약」 절을 더한다.
실행과 분석과 평가의 `candidate_context_version` 은 포착값 `candidate-context-2026-09` 대신 `position-preferences:v1` 과 비교한다는 것, 이유는 ADR-134 라는 것, 바꾸는 코드는 `test/support/legacy-contract.ts` 의 `expectedLegacyRow` 라는 것을 적는다.
`cases.json` 을 고치지 않는다는 기존 규칙은 그대로 둔다.

## 검증

```bash
# cwd: career-os/services/career-backend
npx prisma generate
npm run typecheck
CAREER_BACKEND_TEST_DATABASE_URL="<테스트 DB>" SHADOW_DATABASE_URL="<빈 shadow DB>" \
  npx vitest run \
  test/positions-analysis.e2e.test.ts \
  test/positions-collection.e2e.test.ts \
  test/positions-company-tier-unknown.e2e.test.ts \
  test/positions-recommendation.e2e.test.ts \
  test/contract.e2e.test.ts
CAREER_BACKEND_TEST_DATABASE_URL="<테스트 DB>" SHADOW_DATABASE_URL="<빈 shadow DB>" npm test
```

모두 종료 코드 0 이어야 한다. 테스트 DB 에는 `prisma/migrations/` 의 migration 이 모두 적용돼 있어야 한다.
`npx vitest run` 은 이 phase 가 고친 테스트를 이름으로 먼저 실행한다. 그 뒤의 `npm test` 가 전체를 실행한다.
`npm test` 는 `vitest.config.ts` 의 `include` 가 `test/**/*.test.ts` 를 담으므로 위에서 고친 e2e 파일을 모두 실행한다.
출력에 `test/positions-analysis.e2e.test.ts` 의 새 describe 다섯 테스트가 통과로 보여야 한다.

```bash
# cwd: 저장소 루트
! git grep -n "policy\.candidateContextVersion" -- career-os/services/career-backend/src/positions/positions.service.ts
git diff --quiet -- career-os/services/career-backend/test/fixtures/legacy-contract/cases.json
git diff --quiet -- career-os/services/career-backend/src/positions/schema.ts career-os/scripts
bunx tsc --noEmit
```

넷 다 종료 코드 0 이어야 한다. 마지막 명령은 `career-os/scripts/` 가 import 하는 서비스 파일의 타입이 깨지지 않았는지 본다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/services/career-backend/src/positions/positions.module.ts` | 수정 |
| `career-os/services/career-backend/src/positions/positions.service.ts` | 수정 |
| `career-os/services/career-backend/test/support/e2e-harness.ts` | 수정 |
| `career-os/services/career-backend/test/support/legacy-contract.ts` | 수정 |
| `career-os/services/career-backend/test/contract.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/positions-analysis.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/positions-collection.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/positions-company-tier-unknown.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/positions-recommendation.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/fixtures/legacy-contract/README.md` | 수정 |
