# Phase 05. 추천 실행과 조회를 옮기고 기존 Bun 코드를 지운다

**Execution profile**: deep

## 목표

남은 endpoint 둘을 옮기고, 더 이상 쓰이지 않는 Bun 구현을 제거한다.

| method | 경로 | 기존 메서드 |
| --- | --- | --- |
| POST | `/api/positions/v1/recommendation-runs` | `createRecommendation` |
| GET | `/api/positions/v1/runs/{id}` | `getRun` |

이 phase가 끝나면 `services/recommendation-api/`에 NestJS 구현만 남는다.

**범위 외**: Docker image와 배포. Phase 06이 가진다.

## 컨텍스트

옮길 원본은 `position/service.ts`의 `createRecommendation`(1007줄)과 `getRun`(1139줄)이다.

지울 것은 다음이다. 모두 Bun 전용이거나 메모리 스냅샷 구조에 속한다.

| 경로 | 이유 |
| --- | --- |
| `app.ts`, `app.test.ts` | Phase 02의 NestJS module이 대체 |
| `server.ts`, `container.ts`, `migrate.ts` | `main.ts`와 `prisma migrate`가 대체 |
| `config.ts`, `config.test.ts` | `src/config/`가 대체 |
| `container.test.ts` | 대상이 사라짐 |
| `db/` 전체 | `src/prisma/`와 repository가 대체 |
| `http/` 전체 | `src/common/`이 대체 |
| `routes/` 전체 | controller가 대체 |
| `position/` 전체 | `src/positions/`가 대체 |
| `migrations/` | `prisma/migrations/`가 대체 |

**근거 문서**: `docs/adr/ADR-122-추천-상태는-질의-단위로-읽고-쓴다.md`,
`docs/data-schema.md`의 「실행 중 생성되는 포지션 추천 데이터」 절

## 의도 메모

**추천 응답의 schema version은 11이다.** 이 전환이 그 값을 바꾸지 않는다.
`scripts/position-recommender/recommendation/schema.ts`가 같은 값을 검사한다.
한쪽만 올리면 검증이 거절한다.

**`GET /runs/{id}`는 세 종류의 실행 ID를 받는다.**
수집 실행, 공고 분석 실행, 추천 실행이다. 어느 것인지에 따라 응답이 다르다.
하나로 합치지 말고 기존 분기를 그대로 옮긴다.

**추천 응답에 tier 출처 일곱 필드와 집계 네 필드가 들어간다.**
`companyTierSource`, `companyTierAssessmentId`, `companyTierAssessedAt`, `companyTierValidUntil`,
`companyTierConfidence`, `companyTierReason`, `companyTierEvidenceUrls`가 항목별 필드다.
`companyTierReason`은 200자 상한이 있고, 이 값이 공개 HTML에 그대로 실린다.
상한을 읽는 자리가 아니라 들어오는 자리에서 막는 것이 기존 설계다.

**`migrations/` 디렉터리를 지우기 전에 Phase 01이 만든 초기 migration과 같은지 확인한다.**
Phase 01의 `baseline.test.ts`가 바이트 비교를 한다.
그 테스트가 원본 파일을 읽으므로, 지울 때 그 비교 대상을 초기 migration 안의 사본으로 바꾼다.
비교를 없애지 않는다. 없애면 초기 migration이 운영 schema와 어긋나도 드러나지 않는다.

**지운 뒤 남은 참조를 찾는다.**
`Bun.SQL`, `Bun.serve`, `bun test`를 가리키는 문자열이 저장소 어디에도 남지 않아야 한다.
루트 `package.json`의 script와 `Dockerfile`이 여기 해당한다.

## 작업 항목

### 1. `src/positions/repository/`에 질의를 더한다

- `findRecommendationInputs(analysisRunId)` — 활성 공고, 유효한 분석, 분석 대기, 수집 진단
- `insertRecommendationRun(run, items, tx)`
- `lockRecommendationRun(id, tx)`
- `findRunById(id)` — 세 종류의 실행을 구분해 반환

### 2. `src/positions/positions.service.ts`에 두 메서드를 더한다

`createRecommendation`과 `getRun`을 옮긴다.
추천 응답 조립의 필드와 순서를 그대로 유지한다.

### 3. `src/positions/positions.controller.ts`에 endpoint 둘을 더한다

`POST /recommendation-runs`는 201이고 본문에 `analysisRunId`가 문자열이어야 한다.
없거나 문자열이 아니면 `400 BAD_REQUEST`다.
`GET /runs/{id}`는 200이고 멱등 키를 요구하지 않는다.

### 4. 기존 Bun 구현을 제거한다

위 표의 경로를 지운다.
루트 `package.json`에 이 서비스를 가리키는 script가 있으면 함께 지운다.

### 5. 이 phase를 검증하는 `test/positions-recommendation.e2e.test.ts`

실제 MySQL을 쓴다. `CAREER_RECOMMENDATION_TEST_DATABASE_URL`이 없으면 실패한다.

확인할 것이다.

- 추천 응답의 `schemaVersion`이 11이다
- 분석 대상이 없어도 재사용 수, 분석 대기 수, 수집 진단을 담은 응답을 만든다
- tier 출처 일곱 필드가 항목마다 들어간다.
  출처가 `model`이 아니면 `companyTierAssessmentId`가 없고 `companyTierEvidenceUrls`가 빈 배열이다
- `GET /runs/{id}`가 수집 실행, 분석 실행, 추천 실행 각각에 맞는 응답을 준다
- 없는 실행 ID가 `404 NOT_FOUND`
- `POST /recommendation-runs`의 본문에 `analysisRunId`가 없으면 `400 BAD_REQUEST`

### 6. client와 응답이 같은지 확인하는 `test/contract.e2e.test.ts`

**이 전환의 합격 기준은 표면이 같은 것이다.**
endpoint 열두 개의 성공 응답을 실제로 받아 `scripts/position-recommender/`의
zod schema로 검증한다. client가 쓰는 것과 같은 schema를 import 한다.

검증할 schema는 다음이다.

- `scripts/position-recommender/recommendation/schema.ts`
- `scripts/position-recommender/company-tier-analysis/schema.ts`
- `services/recommendation-api/src/positions/schema.ts`의 응답 schema

client가 오류를 읽는 경로가 `body.error.code`인 것도 함께 단언한다.

## 검증

Phase 01의 container를 쓴다.

```bash
# cwd: 저장소 루트
cd career-os/services/recommendation-api
npm run typecheck
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

기대값이다.

- `typecheck`가 종료 코드 0
- Phase 01에서 04까지의 테스트가 계속 통과
- 이 phase의 테스트가 모두 통과
- 출력에 `skipped`가 없다

**Bun 흔적이 남지 않았는지 확인한다.** 저장소 루트에서 돌린다.

```bash
# cwd: 저장소 루트
grep -rn 'Bun\.SQL\|Bun\.serve' career-os/services/ || echo "남은 참조 없음"
ls career-os/services/recommendation-api/
```

두 번째 명령의 결과에 `app.ts`, `server.ts`, `db/`, `http/`, `routes/`, `position/`, `migrations/`가
없어야 한다.

**모노레포의 나머지가 깨지지 않았는지 확인한다.**

```bash
# cwd: 아무 곳. 아래에서 저장소 루트로 옮긴다
cd /path/to/fos-agents
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
npx tsc --noEmit
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/src/positions/repository/` | 수정 |
| `career-os/services/recommendation-api/src/positions/positions.service.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/positions.controller.ts` | 수정 |
| `career-os/services/recommendation-api/test/positions-recommendation.e2e.test.ts` | 신규 |
| `career-os/services/recommendation-api/test/contract.e2e.test.ts` | 신규 |
| `career-os/services/recommendation-api/prisma/baseline.test.ts` | 수정 |
| `career-os/services/recommendation-api/app.ts` | 삭제 |
| `career-os/services/recommendation-api/app.test.ts` | 삭제 |
| `career-os/services/recommendation-api/server.ts` | 삭제 |
| `career-os/services/recommendation-api/container.ts` | 삭제 |
| `career-os/services/recommendation-api/container.test.ts` | 삭제 |
| `career-os/services/recommendation-api/migrate.ts` | 삭제 |
| `career-os/services/recommendation-api/config.ts` | 삭제 |
| `career-os/services/recommendation-api/config.test.ts` | 삭제 |
| `career-os/services/recommendation-api/db/` | 삭제 |
| `career-os/services/recommendation-api/http/` | 삭제 |
| `career-os/services/recommendation-api/routes/` | 삭제 |
| `career-os/services/recommendation-api/position/` | 삭제 |
| `career-os/services/recommendation-api/migrations/` | 삭제 |
