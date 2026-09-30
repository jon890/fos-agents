# Phase 01. 포지션 분석 정책 조회 경로를 더한다

**Execution profile**: standard

## 목표

`GET /api/positions/v1/analysis-policy` 를 더하고 포지션 client 에 `getAnalysisPolicy()` 를 둔다.
다음 phase 가 문서 저장 뒤 정책의 나머지 칸을 그대로 보내고, 수집 전에 기준 버전을 비교하려면 저장된 정책을 읽을 수 있어야 한다.

**범위 외**: 정책 갱신과 수집 전 비교는 phase 02 다. 기존 `PUT analysis-policy` 계약과 응답은 바꾸지 않는다.

## 컨텍스트

- `career-os/services/career-backend/src/positions/positions.controller.ts` 의 `@Put("analysis-policy")` `configurePolicy` 옆에 둔다
- 저장된 정책은 `career-os/services/career-backend/src/positions/repository/positions.repository.ts` 의 `findPolicy(client)` 가 읽는다. 없으면 `undefined` 다
- 정책이 없을 때의 오류는 `positions.service.ts` 의 `requirePolicy` 와 같은 `ApiError(409, "POLICY_NOT_CONFIGURED", ...)` 다
- client 는 `career-os/scripts/position-recommender/career-backend/client.ts` 의 `configureAnalysisPolicy` 와 같은 모양으로 `careerBackendRequest` 를 쓰고 `analysisPolicySchema` 로 응답을 검사한다
- 전환 기록 `career-os/services/career-backend/test/fixtures/legacy-contract/` 는 고치지 않는다. 새 경로는 기존 case 에 영향이 없다

**근거 문서**: `career-os/docs/data-schema.md` 「포지션 분석 정책」 절, `career-os/docs/adr/ADR-132-스킬의-개인-맥락은-후보자-맥락-문서에서-읽고-지원서-공통-프로필만-brain에-둔다.md`

## 의도 메모

- 정책 schema 에서 `candidateContextVersion` 을 빼지 않는다. 전환 기록 case 23개가 이 값을 담아, 계약을 바꾸지 않고 저장 명령이 값을 맞추기로 했다

## Blocked 조건

- `career-os/scripts/candidate-context/manage_candidate_context.ts` 가 없으면 `PHASE_BLOCKED: plan136 머지 전` 을 출력하고 종료한다

## 작업 항목

### 1. `career-os/services/career-backend/src/positions/` 수정

- `positions.controller.ts` 에 `@Get("analysis-policy") getPolicy(): Promise<AnalysisPolicy>` 를 더한다
- `positions.service.ts` 에 `getPolicy()` 를 더한다. `findPolicy(this.repository.reader())` 가 없으면 `409 POLICY_NOT_CONFIGURED` 다

### 2. `career-os/scripts/position-recommender/career-backend/client.ts` 수정

`getAnalysisPolicy(): Promise<AnalysisPolicy>` 를 더한다. `GET /api/positions/v1/analysis-policy`, 멱등 키 없음, `analysisPolicySchema` 로 검사한다.

### 3. 이 phase 를 검증하는 테스트

- `career-os/services/career-backend/test/positions-analysis-policy.e2e.test.ts` 신규. 정책이 없으면 `409 POLICY_NOT_CONFIGURED`, `PUT` 뒤 `GET` 이 같은 값을 돌려준다
- `career-os/scripts/position-recommender/career-backend/client.test.ts` 수정. 가짜 `fetcher` 로 `getAnalysisPolicy` 가 경로와 메서드를 맞게 보내고 응답을 검사하는지 확인한다

## 검증

```bash
# cwd: career-os/services/career-backend
docker exec plan125-mysql mysqladmin -uroot -pplan125 ping
npm run typecheck
CAREER_BACKEND_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
  npm test
CAREER_BACKEND_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
  npx vitest run test/positions-analysis-policy.e2e.test.ts
```

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/position-recommender/career-backend/client.test.ts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
```

모두 종료 코드 0 이어야 한다. 테스트 DB container `plan125-mysql` 이 없으면 `career-os/services/career-backend/test/fixtures/legacy-contract/README.md` 「전제」 절의 명령으로 만든다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/services/career-backend/src/positions/positions.controller.ts` | 수정 |
| `career-os/services/career-backend/src/positions/positions.service.ts` | 수정 |
| `career-os/services/career-backend/test/positions-analysis-policy.e2e.test.ts` | 신규 |
| `career-os/scripts/position-recommender/career-backend/client.ts` | 수정 |
| `career-os/scripts/position-recommender/career-backend/client.test.ts` | 수정 |
