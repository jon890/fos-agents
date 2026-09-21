# Phase 02. NestJS를 띄우고 공통 계층을 옮긴다

**Execution profile**: deep

## 목표

NestJS 애플리케이션을 띄우고, 도메인과 무관한 계층 다섯을 옮긴다.
인증, 멱등, 요청 검증, 오류 응답, health 확인이다.

이 phase가 끝나면 `/health/live`, `/health/ready`, `/api/v1/auth/check` 셋이
기존 Bun 서비스와 같은 응답을 준다.

**범위 외**: 포지션 도메인 endpoint 아홉 개. Phase 03에서 05가 나눠 가진다.

## 컨텍스트

기존 구현이 이 파일들에 있다. 동작을 그대로 옮기고 구조만 NestJS의 것으로 바꾼다.

| 기존 | 무엇 | 옮길 곳 |
| --- | --- | --- |
| `app.ts` | 경로 분기, 인증, 본문 크기, 멱등 키 요구 | `src/common/`과 `src/app.module.ts` |
| `http/errors.ts` | `ApiError`와 오류 응답 형식 | `src/common/api-error.ts`와 filter |
| `http/request.ts` | Bearer 확인, 본문 읽기, 요청 ID | guard와 middleware |
| `http/idempotency.ts` | 멱등 키 처리 흐름 | interceptor |
| `db/receipt-store.ts` | `request_receipts` 읽기와 쓰기 | `src/common/idempotency/receipt.repository.ts` |
| `config.ts` | 환경값 읽기와 검증 | `src/config/` |

**근거 문서**: `docs/code-architecture.md`의 「추천 상태 Backend」 절,
`docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md`

## 의도 메모

**NestJS의 기본 오류 형식을 쓰지 않는다.**
NestJS는 `{ statusCode, message, error }`를 낸다.
이 서비스의 계약은 `{ error: { code, message, requestId } }` 하나다.
client인 `scripts/position-recommender/recommendation-api/client.ts`가 이 형식으로 분기하므로
기본값이 새어 나가면 client가 오류 코드를 읽지 못한다.
모든 응답에 `Cache-Control: no-store`와 `X-Request-Id`가 붙는 것도 같다.

**멱등 처리를 controller 안에 넣지 않는다.**
쓰기 endpoint **일곱 개**가 모두 같은 흐름을 쓴다.
`routes/positions.ts`의 POST 다섯(`:39`, `:50`, `:61`, `:74`, `:86`)과 PUT 둘(`:103`, `:116`)이다.
흐름은 키 확인, 요청 본문 hash, 선점, 처리, 응답 저장이다.
interceptor 하나가 이 흐름을 소유해야 endpoint를 더할 때 빠뜨리지 않는다.

**요청 본문 hash를 다시 만들지 않는다.**
`http/idempotency.ts:30`의 `canonicalRequestHash`가 그 값을 소유한다.
키를 정렬해 `JSON.stringify`한 뒤 sha256을 낸다.
`position/hash.ts`에는 `positionContentHash`와 `companyKey`와 `stableUuid` 셋뿐이고
그 셋은 공고 식별과 공고 내용의 hash라 쓰임이 다르다.
다른 방식으로 만들면 운영 `request_receipts`에 이미 저장된 `request_hash`와 값이 어긋나
배포 직후의 재시도가 전부 `409 IDEMPOTENCY_CONFLICT`가 된다.

**시각은 UTC 하나로 다룬다.**
운영 DB는 UTC로 운영하고 이 전환이 그것을 바꾸지 않는다.
시각 컬럼이 모두 `DATETIME(3)`이라 시간대를 저장하지 않으므로,
드라이버가 그 값을 프로세스의 지역 시간으로 해석하면 어긋난다.
개발 기기가 `Asia/Seoul`이면 다시 읽은 시각이 9시간 앞선 값이 되고,
그 상태에서는 방금 만든 회사 tier 실행도 임차권 만료로 판정된다.
전환 전 구현에서 실측한 것이다.

**`request_receipts`의 선점 판정을 바꾸지 않는다.**
`INSERT IGNORE` 뒤 영향받은 행 수로 판정한다.
Bun 드라이버에서는 그 값이 `affectedRows`에만 들어와 별도 함수로 감쌌다.
Prisma의 `$executeRaw`는 영향받은 행 수를 반환값으로 직접 준다. 감쌀 필요가 없다.

**zod를 class-validator로 바꾸지 않는다.**
`position/schema.ts` 503줄이 이미 zod이고, 그 계약을 `scripts/`가 함께 읽는다.
NestJS 관례를 따르려고 두 벌로 만들면 두 쪽이 어긋난다.

## 작업 항목

### 1. `src/config/` 신규

`config.ts`의 동작을 옮긴다. 기존 규칙을 그대로 지킨다.

- local은 `CAREER_RECOMMENDATION_DATABASE_URL`을 읽는다
- 운영은 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`를 읽는다
- 두 형식을 함께 주면 기동 전에 실패한다
- `API_HOST`, `API_PORT`, 본문 크기 상한
- API token은 `CAREER_RECOMMENDATION_API_TOKEN`과 `CAREER_RECOMMENDATION_API_TOKEN_FILE` 둘을 받는다.
  파일로 줄 때 그 파일의 권한이 `0600`이 아니면 기동 전에 실패한다 (`config.ts:33-37`, `:58-72`)

기존 `config.test.ts` 89줄을 Vitest로 옮긴다. 권한 검사 항목이 그 안에 있다.

### 1-1. 프로세스 시간대를 UTC로 고정한다

`src/main.ts`가 다른 무엇보다 먼저 `process.env.TZ = "UTC"`를 정한다.
`@prisma/adapter-mariadb`의 연결 옵션에도 UTC를 준다. 둘 다 한다.
`main.ts`만 고정하면 테스트가 `main.ts`를 거치지 않고 module을 올릴 때 빠진다.

**테스트 하네스도 같은 값으로 고정한다.** `vitest.config.ts`가 `TZ`를 `UTC`로 정한다.
고정하지 않으면 같은 테스트가 기기의 시간대에 따라 통과와 실패로 갈린다.

`test/fixtures/legacy-contract/cases.json`은 `TZ=UTC`로 뽑은 것이다.
프로세스가 다른 시간대면 그 기대값과 맞지 않는다.

### 2. `src/prisma/prisma.service.ts` 신규

`PrismaClient`를 `@prisma/adapter-mariadb`의 `PrismaMariaDb`로 만든다.
`OnModuleInit`에서 연결하고 `OnModuleDestroy`에서 닫는다.
`src/prisma/prisma.module.ts`를 `@Global()`로 둔다.

### 3. `src/common/api-error.ts`와 `src/common/api-exception.filter.ts` 신규

`ApiErrorCode` 열두 개를 그대로 옮긴다.
`BAD_REQUEST`, `BODY_TOO_LARGE`, `COMPANY_TIER_LEASE_EXPIRED`, `COMPANY_TIER_RUN_MISSING`,
`COMPANY_TIER_RUN_PENDING`, `DATABASE_UNAVAILABLE`, `IDEMPOTENCY_CONFLICT`, `INTERNAL_ERROR`,
`NOT_FOUND`, `POLICY_NOT_CONFIGURED`, `UNAUTHORIZED`, `VERSION_CONFLICT`.

filter는 `APP_FILTER`로 전역 등록한다. 세 가지를 처리한다.

- `ApiError`는 자기 status와 code로 낸다
- NestJS의 `HttpException`은 status에 맞는 code로 바꾼다
- **Prisma의 연결 실패는 `503 DATABASE_UNAVAILABLE`로 바꾼다**
- 나머지는 `500 INTERNAL_ERROR`로 낸다. 원본 메시지를 응답에 담지 않는다

**`DATABASE_UNAVAILABLE`을 던지던 자리가 없어진다.**
지금은 `position/sql-repository.ts:72`와 `:97`의 연결 실패 경로가 이 코드를 낸다.
Phase 05가 그 파일을 지우므로 이 filter가 그 책임을 받는다.
Prisma는 연결 실패를 `PrismaClientInitializationError`와 `P1001`·`P1002`·`P1017` 계열로 낸다.
그 셋을 이 코드로 매핑한다. 매핑하지 않으면 DB가 죽었을 때 client가 `500`을 받고 재시도 판단을 못 한다.

### 4. `src/common/request-id.middleware.ts` 신규

`X-Request-Id` 헤더가 있으면 그것을 쓰고 없으면 만든다.
**받은 값이 100자를 넘으면 쓰지 않고 새로 만든다** (`http/request.ts:43`).
요청 객체에 실어 filter와 interceptor가 같은 값을 쓰게 한다.

### 5. `src/common/auth.guard.ts` 신규

`Authorization: Bearer <token>`을 확인한다. 틀리면 `401 UNAUTHORIZED`.
**비교는 `timingSafeEqual`로 한다** (`http/request.ts:7`). `===`로 바꾸지 않는다.
길이가 다르면 비교 전에 거절한다. `timingSafeEqual`은 길이가 다르면 예외를 던진다.
`/health/live`와 `/health/ready`는 통과시킨다.
`APP_GUARD`로 전역 등록하고 health는 데코레이터로 제외한다.

### 6. `src/common/zod-validation.pipe.ts` 신규

zod schema를 받아 본문을 검증한다. 실패하면 `400 BAD_REQUEST`.
zod의 오류 메시지를 응답 `message`에 그대로 담지 않는다. 기존 동작과 맞춘다.

### 7. `src/common/idempotency/` 신규

`receipt.repository.ts`가 `request_receipts`를 읽고 쓴다.
`getReceipt`, `startReceipt`, `completeReceipt`, `abandonReceipt` 넷이다.
`db/receipt-store.ts`의 SQL을 Prisma의 `$queryRaw`와 `$executeRaw`로 옮긴다.

`idempotency.interceptor.ts`가 흐름을 소유한다.

1. 쓰기 method면 `Idempotency-Key` 헤더를 요구한다. 없으면 `400 BAD_REQUEST`.
   **200자를 넘어도 `400 BAD_REQUEST`다** (`http/request.ts:19`)
2. 본문의 hash를 만든다. `http/idempotency.ts:30`의 `canonicalRequestHash`를 그대로 옮긴다.
   키를 정렬해 `JSON.stringify`한 뒤 sha256이다
3. 같은 키가 있고 hash가 다르면 `409 IDEMPOTENCY_CONFLICT`
4. 같은 키에 같은 hash이고 `completed`면 저장된 응답을 그대로 낸다
5. **같은 키에 같은 hash인데 아직 `processing`이면 `409 VERSION_CONFLICT`다**
   (`http/idempotency.ts:49`, `:52`). 앞선 요청이 처리 중이므로 선점하지 않고 거절한다.
   이 분기를 빠뜨리면 같은 요청이 둘 함께 처리된다
6. 없으면 선점하고 처리한 뒤 응답을 저장한다
7. 처리가 실패하면 선점을 지운다

잘못된 JSON은 hash를 만들기 전에 `400 BAD_REQUEST`다 (`http/request.ts:37`).

### 8. `src/health/` 신규

- `GET /health/live`는 `{ ok: true }`와 200. 인증을 요구하지 않는다
- `GET /health/ready`는 DDL을 실행하지 않는다.
  연결 확인과 `prisma migrate status`에 해당하는 조회를 한다.
  적용되지 않은 migration이 있으면 `{ ok: false }`와 503
- `GET /api/v1/auth/check`는 유효한 token에만 204와 빈 본문

### 9. `src/main.ts`와 `src/app.module.ts` 신규

`main.ts`는 `API_HOST`와 `API_PORT`로 listen 한다.
NestJS의 기본 body parser 크기 상한을 설정값에 맞춘다.
상한을 넘으면 `400 BODY_TOO_LARGE`로 낸다.

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

### 10. 이 phase를 검증하는 `test/common.e2e.test.ts`

실제 MySQL을 쓴다. `CAREER_RECOMMENDATION_TEST_DATABASE_URL`이 없으면 실패한다.

확인할 것이다.

- `GET /health/live`가 200
- `GET /health/ready`가 migration을 모두 적용한 DB에서 200
- `GET /health/ready`가 적용되지 않은 migration이 있는 DB에서 503
- `GET /api/v1/auth/check`가 유효한 token에 204, 틀린 token에 401
- 401 응답의 본문이 `{ error: { code: "UNAUTHORIZED", ... } }` 형식이다
- 모든 응답에 `Cache-Control: no-store`와 `X-Request-Id`가 있다
- 없는 경로가 `404 NOT_FOUND`이고 형식이 같다
- 상한을 넘는 본문이 `400 BODY_TOO_LARGE`
- 멱등 5단계: 새 키는 처리, 같은 키에 같은 본문은 저장된 응답,
  같은 키에 다른 본문은 `409 IDEMPOTENCY_CONFLICT`,
  같은 키에 같은 본문인데 앞선 요청이 `processing`이면 `409 VERSION_CONFLICT`,
  다른 키는 다시 처리
- 쓰기 요청에 `Idempotency-Key`가 없으면 `400 BAD_REQUEST`
- `Idempotency-Key`가 200자를 넘으면 `400 BAD_REQUEST`
- 잘못된 JSON 본문이 `400 BAD_REQUEST`
- 받은 `X-Request-Id`가 100자 이하면 응답이 그 값을 되돌려주고, 넘으면 새 값을 낸다
- token을 아예 주지 않아도 `401 UNAUTHORIZED`
- token 파일의 권한이 `0600`이 아니면 기동이 실패한다
- filter에 연결 실패 예외를 직접 던지면 `503 DATABASE_UNAVAILABLE` 형식이 나온다
- filter에 그 밖의 예외를 직접 던지면 `500 INTERNAL_ERROR` 형식이 나오고
  원본 메시지가 응답에 담기지 않는다
- 처리 중 예외가 나면 `request_receipts`에 `processing` 행이 남지 않는다
- **시간대 고정 확인**: `TZ`를 `Asia/Seoul`로 두고 module을 올려도
  DB에 쓴 시각을 다시 읽은 값이 쓴 값과 같다.
  고정이 풀리면 이 테스트가 9시간 차이로 실패한다

`500 INTERNAL_ERROR`와 `503 DATABASE_UNAVAILABLE`은 정상 경로로 만들 수 없다.
이 둘은 위처럼 filter에 예외를 직접 던져 응답 형식만 확인한다.

멱등 검증에는 임시 쓰기 endpoint를 쓰지 않는다.
테스트 전용 controller를 `test/` 안에 두고 테스트 module에서만 등록한다.
운영 코드에 테스트용 경로를 남기면 배포된다.

## 검증

Phase 01의 container를 그대로 쓴다. **다시 만들지 않는다.** 없을 때만 Phase 01의 절차로 띄운다.

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
- Phase 01의 `baseline.test.ts`가 계속 통과
- `common.e2e.test.ts`의 항목이 모두 통과
- 출력에 `skipped`가 없다

**응답 형식이 실제로 계약과 같은지 client 쪽에서 확인한다.**

```bash
# cwd: 저장소 루트
grep -n 'error\.code\|error?.code' ../../scripts/position-recommender/recommendation-api/client.ts
```

client가 읽는 경로가 `body.error.code`인 것을 확인하고, 테스트가 그 경로를 단언하는지 본다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/src/main.ts` | 신규 |
| `career-os/services/recommendation-api/src/app.module.ts` | 신규 |
| `career-os/services/recommendation-api/src/config/` | 신규 |
| `career-os/services/recommendation-api/src/prisma/prisma.service.ts` | 신규 |
| `career-os/services/recommendation-api/src/prisma/prisma.module.ts` | 신규 |
| `career-os/services/recommendation-api/src/common/api-error.ts` | 신규 |
| `career-os/services/recommendation-api/src/common/api-exception.filter.ts` | 신규 |
| `career-os/services/recommendation-api/src/common/request-id.middleware.ts` | 신규 |
| `career-os/services/recommendation-api/src/common/auth.guard.ts` | 신규 |
| `career-os/services/recommendation-api/src/common/zod-validation.pipe.ts` | 신규 |
| `career-os/services/recommendation-api/src/common/idempotency/receipt.repository.ts` | 신규 |
| `career-os/services/recommendation-api/src/common/idempotency/idempotency.interceptor.ts` | 신규 |
| `career-os/services/recommendation-api/src/health/` | 신규 |
| `career-os/services/recommendation-api/test/common.e2e.test.ts` | 신규 |
