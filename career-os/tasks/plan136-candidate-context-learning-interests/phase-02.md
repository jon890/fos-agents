# Phase 02. 공부 추천의 기준 버전을 learning-interests 문서에서 계산한다

**Execution profile**: deep

## 목표

공부 후보 조회가 `learning-interests` 문서의 본문과 버전을 함께 돌려주고, 기준 버전을 `learning-interests:v{version}` 으로 계산한다.
사람이 따로 올리던 `study_recommendation_control.candidate_context_version` 과 `PUT /recommendation-control` 을 지운다.
관심사를 저장하는 일과 기준 버전을 올리는 일이 한 동작이 되어, 버전 올리기를 잊어 예전 판정이 남는 일이 없어진다.

**범위 외**: client 계약, `configure_study_recommendation.ts` 삭제와 CLI 는 phase 03 이다. 스킬 문서는 phase 04 다.

## 컨텍스트

phase 01 이 `src/candidate-context/` 와 `CandidateContextService.readDocument(key, client)`, `CandidateContextRepository.lockDocumentForShare(key, tx)` 를 만들었다.

지금 기준 버전을 쓰는 자리다. 모두 `services/career-backend/` 아래다.

| 자리 | 지금 동작 |
| --- | --- |
| `src/study/study.service.ts` `getCandidates` | `getRecommendationControl` 로 `candidateContextVersion` 을 읽어 응답에 넣는다 |
| `src/study/study.service.ts` `createRecommendationRun` | `lockRecommendationControl` 로 잠그고 본문의 `candidateContextVersion` 과 비교해 다르면 `409 VERSION_CONFLICT` |
| `src/study/study.service.ts` `updateRecommendationControl` | 사람이 기준 버전을 바꾼다 |
| `src/study/study.controller.ts` `@Put("recommendation-control")` | 위 서비스를 부른다 |
| `src/study/schema.ts` `studyRecommendationControlSchema`, `StudyRecommendationControl`, `StudyCandidatePage` | 계약과 응답 타입 |
| `src/study/repository/study.repository.ts` `getRecommendationControl`, `lockRecommendationControl`, `updateCandidateContextVersion` | control 행 읽기와 쓰기 |
| `src/study/repository/study.repository.ts` `listCandidates` | 판정 제외 조건이 `study_recommendation_control` 과 JOIN 해 `control.candidate_context_version` 과 비교한다 |
| 하네스의 `clearAll` | control 행의 `candidate_context_version` 을 `'initial'` 로 되돌린다 |

`study_recommendation_runs.candidate_context_version` 과 `study_material_verdicts.candidate_context_version` 칸은 그대로 둔다. 계산한 문자열을 거기 쓴다.

**근거 문서**: `career-os/docs/flow.md` 의 「study-topic-recommender」 절(실행 흐름 5·6, 갈라지는 곳, 제외 판정의 재사용, 학습자료 HTTP 계약), `career-os/docs/data-schema.md` 의 「`study_recommendation_control`」 과 「`study_material_verdicts`」 절, ADR-127, ADR-131

## 의도 메모

- 문서 저장이 control 행을 갱신하게 하지 않는다. 후보자 맥락 module 이 공부 추천 table 에 쓰게 되고 두 경로가 같은 값을 바꾼다. ADR-131 이 기각했다
- 운영 DB 의 기존 판정은 `'initial'` 같은 옛 버전 문자열이라 새 기준 버전과 맞지 않아 모두 다시 후보로 나온다. 관심사가 바뀐 지금 의도한 결과다. 데이터 이관은 하지 않는다
- **배포 뒤 `learning-interests` 문서를 저장하기 전까지 아침 추천이 `409 CANDIDATE_CONTEXT_MISSING` 으로 멈춘다.** 과거 기준으로 조용히 돌지 않게 하려는 것이다. 문서가 없을 때 빈 관심사로 계속하는 기본값을 두지 않는다
- 추천 저장 transaction 에서 문서 행을 `FOR SHARE` 로 읽는다. 저장 도중 문서가 바뀌면 문서 쪽 `FOR UPDATE` 가 기다리므로 비교 결과가 뒤집히지 않는다

## 작업 항목

### 1. `services/career-backend/prisma/migrations/20260930000100_study_control_drop_context_version/migration.sql` 신규

```sql
ALTER TABLE study_recommendation_control DROP COLUMN candidate_context_version;
```

첫 줄에 ADR-131 을 따른다는 주석을 단다. `schema.prisma` 의 `study_recommendation_control` model 에서 그 칸을 지운다.

### 2. `services/career-backend/src/common/api-error.ts` 수정

`ApiErrorCode` 에 `"CANDIDATE_CONTEXT_MISSING"` 을 더한다.

### 3. `services/career-backend/src/study/` 수정

- `study.module.ts` 의 `imports` 에 `CandidateContextModule` 을 더한다
- `study.service.ts` 에 `learningInterestsContext(client)` 를 둔다. `readDocument("learning-interests", client)` 가 없으면 `ApiError(409, "CANDIDATE_CONTEXT_MISSING", "learning-interests 후보자 맥락 문서가 없습니다.")` 를 던지고, 있으면 `{ candidateContextVersion: \`learning-interests:v${version}\`, learningInterests: { version, body } }` 를 돌려준다
- `getCandidates` 는 이 값을 써서 응답에 `candidateContextVersion` 과 `learningInterests` 를 넣고, `listCandidates` 에 `candidateContextVersion` 을 넘긴다. `historyVersion` 은 control 행에서 계속 읽는다
- `createRecommendationRun` 은 control 행을 잠근 뒤 `lockDocumentForShare("learning-interests", tx)` 로 문서를 읽어 계산한 버전과 본문의 `candidateContextVersion` 을 비교한다. 문서가 없으면 `409 CANDIDATE_CONTEXT_MISSING`, 다르면 기존과 같은 `409 VERSION_CONFLICT` 다
- `updateRecommendationControl`, `@Put("recommendation-control")`, `studyRecommendationControlSchema`, `StudyRecommendationControl`, `updateCandidateContextVersion` 을 지운다
- `getRecommendationControl` 과 `lockRecommendationControl` 은 `historyVersion` 만 돌려준다
- `listCandidates` 의 판정 제외 조건을 `verdict.candidate_context_version = ?` 로 바꾸고 JOIN 을 지운다. 인자 순서는 `candidateContextVersion`, `today` 다
- `StudyCandidatePage` 에 `learningInterests: { version: number; body: string }` 를 더한다

### 4. e2e 하네스 수정

`test/support/` 의 하네스 파일에서 `clearAll` 의 control 행 초기화에서 `candidate_context_version` 을 뺀다.
테스트가 쓸 `putLearningInterests(body)` 도우미를 더한다. `PUT /api/candidate-context/v1/documents/learning-interests` 를 현재 version 으로 부르고 새 version 을 돌려준다.

### 5. 이 phase 를 검증하는 e2e 테스트 수정

`test/study-candidates.e2e.test.ts` 와 `test/study-recommendations.e2e.test.ts` 의 `beforeEach` 에서 `putLearningInterests` 로 문서를 저장한다.
`'initial'`, `'new'`, `'A'` 같은 직접 쓴 버전 문자열은 `learning-interests:v1` 처럼 계산한 값으로 바꾼다.
control 행을 직접 `UPDATE` 하던 경우와 `PUT /recommendation-control` 경우는 `putLearningInterests` 로 바꾼다.

| 경우 | 기대 |
| --- | --- |
| 문서가 없을 때 `GET /candidates` | `409 CANDIDATE_CONTEXT_MISSING` |
| 문서 저장 뒤 `GET /candidates` | `candidateContextVersion: "learning-interests:v1"`, `learningInterests.body` 가 저장한 본문 |
| v1 에서 제외 판정 저장 뒤 문서를 다시 저장 | 그 자료가 다시 후보로 나온다 |
| 후보를 v1 으로 받은 뒤 문서를 저장하고 v1 으로 추천 저장 | `409 VERSION_CONFLICT`, 행이 생기지 않는다 |
| `PUT /api/study/v1/recommendation-control` | `404` |

## 검증

```bash
# cwd: career-os/services/career-backend
npx prisma generate
npm run typecheck
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
  npx prisma migrate deploy
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_BACKEND_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
CAREER_BACKEND_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
  npx vitest run test/study-candidates.e2e.test.ts test/study-recommendations.e2e.test.ts
```

```bash
# cwd: 저장소 루트
! git grep -n "recommendation-control\|updateCandidateContextVersion\|studyRecommendationControlSchema" -- career-os/services/career-backend/src career-os/services/career-backend/test
```

모두 종료 코드 0 이어야 한다. `npm test` 결과에 `study-candidates.e2e.test.ts` 와 `study-recommendations.e2e.test.ts` 가 실행된 것이 보여야 한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/services/career-backend/prisma/migrations/20260930000100_study_control_drop_context_version/migration.sql` | 신규 |
| `career-os/services/career-backend/prisma/schema.prisma` | 수정 |
| `career-os/services/career-backend/src/common/api-error.ts` | 수정 |
| `career-os/services/career-backend/src/study/study.module.ts` | 수정 |
| `career-os/services/career-backend/src/study/study.service.ts` | 수정 |
| `career-os/services/career-backend/src/study/study.controller.ts` | 수정 |
| `career-os/services/career-backend/src/study/schema.ts` | 수정 |
| `career-os/services/career-backend/src/study/repository/study.repository.ts` | 수정 |
| `career-os/services/career-backend/test/support/e2e-harness.ts` | 수정 |
| `career-os/services/career-backend/test/study-candidates.e2e.test.ts` | 수정 |
| `career-os/services/career-backend/test/study-recommendations.e2e.test.ts` | 수정 |
