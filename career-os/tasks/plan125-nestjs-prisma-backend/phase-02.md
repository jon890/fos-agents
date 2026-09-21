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
쓰기 endpoint 여섯 개가 모두 같은 흐름을 쓴다.
키 확인, 요청 본문 hash, 선점, 처리, 응답 저장이다.
interceptor 하나가 이 흐름을 소유해야 endpoint를 더할 때 빠뜨리지 않는다.

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
- `API_HOST`, `API_PORT`, API token, 본문 크기 상한

기존 `config.test.ts` 89줄을 Vitest로 옮긴다.

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
- 나머지는 `500 INTERNAL_ERROR`로 낸다. 원본 메시지를 응답에 담지 않는다

### 4. `src/common/request-id.middleware.ts` 신규

`X-Request-Id` 헤더가 있으면 그것을 쓰고 없으면 만든다.
요청 객체에 실어 filter와 interceptor가 같은 값을 쓰게 한다.

### 5. `src/common/auth.guard.ts` 신규

`Authorization: Bearer <token>`을 확인한다. 틀리면 `401 UNAUTHORIZED`.
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

1. 쓰기 method면 `Idempotency-Key` 헤더를 요구한다. 없으면 `400 BAD_REQUEST`
2. 본문의 hash를 만든다. `position/hash.ts`의 방식을 그대로 쓴다
3. 같은 키가 있고 hash가 다르면 `409 IDEMPOTENCY_CONFLICT`
4. 같은 키에 같은 hash이고 `completed`면 저장된 응답을 그대로 낸다
5. 없으면 선점하고 처리한 뒤 응답을 저장한다
6. 처리가 실패하면 선점을 지운다

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
- 멱등 4단계: 새 키는 처리, 같은 키에 같은 본문은 저장된 응답, 같은 키에 다른 본문은 409,
  다른 키는 다시 처리
- 처리 중 예외가 나면 `request_receipts`에 `processing` 행이 남지 않는다

멱등 검증에는 임시 쓰기 endpoint를 쓰지 않는다.
테스트 전용 controller를 `test/` 안에 두고 테스트 module에서만 등록한다.
운영 코드에 테스트용 경로를 남기면 배포된다.

## 검증

Phase 01의 container를 그대로 쓴다. 없으면 그 절차로 다시 띄운다.

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
