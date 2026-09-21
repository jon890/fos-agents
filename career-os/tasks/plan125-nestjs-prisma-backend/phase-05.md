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

**추천 응답의 `schemaVersion`은 1이다.** 이 전환이 그 값을 바꾸지 않는다.
`position/schema.ts:433`이 `z.literal(1)`이고 `position/service.ts:1090`이 `schemaVersion: 1`을 쓴다.

**11과 헷갈리지 않는다.** 11은 API 응답이 아니라 downstream 리포트 산출물의 값이고
`scripts/position-recommender/recommendation/schema.ts:73`의 `RecommendationRun`이 가진다.
그쪽은 `summary`와 `companyTierSummary`와 `collectionHealth`를 가진 다른 모양이다.
두 schema를 같은 것으로 보고 하나로 검증하면 올바르게 옮겨도 실패한다.

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

**남은 참조를 문자열 검색으로 찾지 않는다.**
`grep 'Bun.SQL|Bun.serve'`는 이 전환에서 실제로 깨지는 것을 하나도 잡지 못한다.
깨지는 것은 `scripts/position-recommender/`가 지워지는 모듈을 import하고 있는 자리이고,
그 자리에는 `Bun.` 문자열이 없다.
`npx tsc --noEmit`과 `bun test career-os/scripts`가 그 판정을 소유한다.

**`contracts.ts` 벤더링은 이 전환의 범위를 넓히지 않으려고 고른 것이다.**
모노레포를 npm workspace로 바꾸면 사본과 대조 테스트를 함께 없앨 수 있다. 이번 plan의 일이 아니다.

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

### 4. 두 pipeline 테스트를 성격에 따라 나눈다

`scripts/position-recommender/`의 `company_tier_analysis_pipeline.test.ts`와
`position_analysis_pipeline.test.ts`는 `MemoryPositionRepository`와 `PositionService`를 함께 import해
실제 서비스를 메모리 저장소 위에서 돌린다.
저장소만 남기면 옛 `PositionService`도 함께 남겨야 하고 도메인 구현이 두 벌이 된다.
두 벌은 서로 어긋나도 어느 테스트도 잡지 못한다.

**script 쪽 방어는 `scripts/`에 남긴다.** 아래 둘이다.

- 큐에 남은 공고를 빠뜨리면 Backend를 부르기 전에 끝낸다
- 같은 공고를 결과와 실패에 함께 담으면 제출하지 않는다

이 둘은 Backend를 부르기 **전에** 판정하므로 서비스 인스턴스가 필요 없다.
`recommendation-api/client.ts`를 stub으로 바꾸고 호출이 일어나지 않은 것을 단언한다.
**도메인 가짜를 만들지 않는다.** 저장소 가짜도 서비스 가짜도 만들지 않는다.

**서비스 동작은 이미 서비스 쪽으로 옮겼다.** Phase 03이 셋, Phase 04가 둘을 가져갔다.
여기서 다시 만들지 않는다. 옮긴 것이 실제로 있는지 확인만 한다.

client를 stub으로 바꾸면 client와 서비스 사이의 계약이 그 테스트에서 빠진다.
그 자리는 작업 항목 7의 `test/contract.e2e.test.ts`가 막는다.

### 5. 기존 Bun 구현을 제거한다

위 표의 경로를 지운다. `position/memory-repository.ts`와 그 테스트도 지운다. 남기지 않는다.
루트 `package.json`에 이 서비스를 가리키는 script가 있으면 함께 지운다.

`test/fixtures/legacy-contract/`는 **지우지 않는다.**
다음에 이 계약을 건드릴 때 무엇이 기준이었는지 읽을 수 있어야 한다.

### 기대값은 옛 구현에서 뽑아 둔 포착 파일이 소유한다

**새 구현을 보고 기대값을 지어내지 않는다.**
전환 전의 Bun 구현을 test database에 붙여 요청과 응답과 그 뒤의 DB 행을 뽑아 둔 파일이 있다.

| 자리 | 내용 |
| --- | --- |
| `services/recommendation-api/test/fixtures/legacy-contract/cases.json` | 요청 전문과 응답 전문과 쓰기 뒤의 DB 행 |
| `services/recommendation-api/test/fixtures/legacy-contract/README.md` | 뽑은 방법, 비교에서 뺀 열, 만들지 못한 경우와 그 이유 |
| `services/recommendation-api/test/fixtures/legacy-contract/capture-legacy.bun.ts` | 뽑는 데 쓴 스크립트 |

비교하는 것이다.

- 응답 status와 본문 전체
- `Cache-Control`의 값과 `X-Request-Id`의 **유무**. `X-Request-Id`의 값은 실행마다 달라 비교하지 않는다
- 쓰기 요청이면 그 뒤의 DB 행. 어느 table의 어느 열을 비교할지는 `cases.json`이 case마다 적는다.
  `created_at`처럼 실행마다 달라지는 열은 비교에서 뺐고 `README.md`가 그 목록을 가진다

**포착 파일을 고쳐서 테스트를 통과시키지 않는다.**
값이 다르면 새 구현이 계약을 어긴 것이다. 포착 파일이 틀렸다고 판단되면 고치지 말고 보고한다.

`capture-legacy.bun.ts`는 Phase 05가 옛 구현을 지운 뒤에는 돌지 않는다.
값이 어디서 나왔는지 읽을 수 있도록 남기는 것이다.
서비스 `tsconfig.json`의 `exclude`와 `vitest.config.ts`의 `exclude`에 이 파일을 넣는다.

### 6. 이 phase를 검증하는 `test/positions-recommendation.e2e.test.ts`

실제 MySQL을 쓴다. `CAREER_RECOMMENDATION_TEST_DATABASE_URL`이 없으면 실패한다.

확인할 것이다.

- 추천 응답의 `schemaVersion`이 1이다
- 분석 대상이 없어도 재사용 수, 분석 대기 수, 수집 진단을 담은 응답을 만든다
- tier 출처 일곱 필드가 항목마다 들어간다.
  출처가 `model`이 아니면 `companyTierAssessmentId`가 없고 `companyTierEvidenceUrls`가 빈 배열이다
- `GET /runs/{id}`가 수집 실행, 분석 실행, 추천 실행 각각에 맞는 응답을 준다
- 없는 실행 ID가 `404 NOT_FOUND`
- `POST /recommendation-runs`의 본문에 `analysisRunId`가 없으면 `400 BAD_REQUEST`
- **행 잠금 확인**: 멱등 키가 다른 두 요청을 같은 분석 실행에 동시에 보내면
  추천 실행이 하나만 만들어지고 두 요청이 뒤섞인 상태가 남지 않는다

`lockRecommendationRun`의 `FOR UPDATE`를 잠시 없애고 그 테스트만 실패하는 것을 본 뒤 되돌린다.
ADR-122가 다섯 쓰기 경로 모두에 이 확인을 요구한다.
Phase 03이 수집과 회사 tier를, Phase 04가 분석 실행과 반영을, 이 phase가 추천 실행을 맡는다.

### 7. client와 응답이 같은지 확인하는 `test/contract.e2e.test.ts`

**이 전환의 합격 기준은 표면이 같은 것이다.**
endpoint 열두 개의 성공 응답을 실제로 받아 확인한다.

**열둘을 한 schema로 검증하지 않는다.** 셋에는 대응하는 `scripts/` 쪽 schema가 없다.

| endpoint | 무엇으로 검증하나 |
| --- | --- |
| `GET /health/live` | 응답 형태를 이 테스트 안에 직접 적는다 |
| `GET /health/ready` | 응답 형태를 이 테스트 안에 직접 적는다 |
| `GET /api/v1/auth/check` | 204와 빈 본문을 직접 단언한다 |
| 나머지 아홉 (`routes/positions.ts`의 것) | `scripts/position-recommender/`의 zod schema |

**`recommendation/schema.ts`는 이 표에서 쓰지 않는다.**
그것은 API 응답이 아니라 리포트 산출물의 schema다 (의도 메모의 `schemaVersion` 항목과 같은 원인).
아홉 개에 쓰는 것은 client가 실제로 쓰는 schema, 곧
`scripts/position-recommender/recommendation-api/client.ts`가 import하는 것이다.

client가 오류를 읽는 경로가 `body.error.code`인 것도 함께 단언한다.
작업 항목 4가 pipeline 테스트에서 client를 stub으로 바꿨으므로, 그 구멍을 이 테스트가 막는다.

## 검증

Phase 01의 container를 쓴다. **다시 만들지 않는다.**

```bash
# cwd: 저장소 루트
cd career-os/services/recommendation-api
npm run typecheck
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

기대값이다.

- `typecheck`가 종료 코드 0
- Phase 01에서 04까지의 테스트가 계속 통과
- 이 phase의 테스트가 모두 통과
- 출력에 `skipped`가 없다

**남은 참조는 타입 검사와 테스트로 판정한다.** 문자열 검색으로 판정하지 않는다.

```bash
# cwd: 저장소 루트
npx tsc --noEmit
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
```

기대값이다.

- `npx tsc --noEmit`이 종료 코드 0
- `bun test career-os/scripts`가 **`0 fail`**
- `skip`이 **1개를 넘지 않는다.** 그 1개는 `career-workspace/tests/career-storage-s3.integration.test.ts:15`의
  `test.skipIf(!integrationEnabled)`이고 이 plan 이전부터 있던 것이다.
  다른 것이 `skip`으로 늘면 완료가 아니다

전환 직전의 기준값은 `395 pass / 1 skip / 0 fail`이었다.
이 phase가 pipeline 테스트 둘을 나누므로 `pass` 수는 달라진다. `fail`과 `skip`만 위 조건으로 본다.

**지워졌는지 눈으로 확인한다.**

```bash
# cwd: 저장소 루트
ls career-os/services/recommendation-api/
```

`app.ts`, `server.ts`, `container.ts`, `config.ts`, `migrate.ts`,
`db/`, `http/`, `routes/`, `position/`, `migrations/`가 없어야 한다.
`test/fixtures/legacy-contract/`는 **남아 있어야 한다.**

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
| `career-os/scripts/position-recommender/company_tier_analysis_pipeline.test.ts` | 수정 (분할) |
| `career-os/scripts/position-recommender/position_analysis_pipeline.test.ts` | 수정 (분할) |
| `career-os/services/recommendation-api/test/fixtures/legacy-contract/` | 유지. 지우지 않는다 |
