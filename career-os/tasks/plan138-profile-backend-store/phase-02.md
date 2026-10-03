# Phase 02. 사용량 기록 table 과 처음 값을 지키는 `usage-snapshots` 경로를 만든다

**Execution profile**: deep

## 목표

`fos_career` 에 `agent_usage_snapshots` 를 만들고 `/api/profile/v1` 에 `GET usage-snapshots` 와 `PUT usage-snapshots/:month` 를 연다.
세션 기록이 기기에서 지워진 뒤에는 그 달을 다시 셀 수 없으므로, 한 번 기록한 달의 값은 저장 요청이 다시 와도 바꾸지 않는다.

이 phase 가 끝나면 아래 두 가지를 테스트로 관측한다.

- 끝난 달의 토큰, 환산 비용, 세션 수, 측정한 날이 한 행으로 저장된다
- 이미 기록된 달에 다른 값을 다시 올려도 저장된 값이 바뀌지 않는다

**범위 외**: `career-os/scripts/profile/` 의 client 와 CLI 는 Phase 03 이다.
세션 기록을 세는 측정 스크립트, 매일 도는 수집기, 옛 기록의 이전, 차트는 이 plan 밖이다.

## 컨텍스트

Phase 01 이 만든 `career-os/services/career-backend/src/profile/` 모듈에 더한다.
지금 그 디렉터리에는 `schema.ts`, `profile.service.ts`, `profile.controller.ts`, `profile.module.ts`, `repository/profile-document.repository.ts` 가 있고,
`ProfileController` 는 `@Controller("api/profile/v1")` 아래 문서 경로 셋을 갖는다.

| 무엇 | 따를 곳 |
| --- | --- |
| 시각 주입 | `src/interview/interview.service.ts` 의 `InterviewClock`. `@Injectable()` 클래스의 `now(): Date` 를 service 생성자로 받고, e2e 는 `harness.app.get(InterviewClock).now = () => new Date(...)` 로 고정한다 |
| Seoul 날짜 | `src/positions/seoul-date.ts` 의 `todaySeoulIsoDate(now: Date): string`. `YYYY-MM-DD` 를 낸다 |
| 있으면 넣지 않는 INSERT | `src/common/idempotency/receipt.repository.ts` 의 `startReceipt`. `INSERT IGNORE` 뒤 `$executeRaw` 가 돌려준 영향받은 행 수로 판정한다 |
| transaction 과 행 잠금 | `src/profile/repository/profile-document.repository.ts` 의 `transaction` 과 `lockDocument` |
| zod 검증 | `src/common/zod-validation.pipe.ts` 의 `ZodValidationPipe` 와 `toContractError` |
| 오류 | `src/common/api-error.ts` 의 `ApiError`. 새 code 를 만들지 않고 `BAD_REQUEST` 를 쓴다 |

프로세스 시간대는 `src/utc.ts` 가 UTC 로 고정한다. 그래서 「끝난 달」 을 `new Date()` 의 달로 판정하면 한국 시각 매달 1일 00:00 부터 09:00 사이에 지난달이 아직 끝나지 않은 것으로 나온다.
전역 멱등 인터셉터(`src/common/idempotency/idempotency.interceptor.ts`)는 `PUT` 에 `Idempotency-Key` 를 요구하고, 같은 key 와 같은 본문에는 저장한 응답을 그대로 돌려준다.

**근거 문서**: `career-os/docs/data-schema.md` 의 「에이전트 사용량 기록 table」 절,
`career-os/docs/flow.md` 의 「프로필 HTTP 계약」 절(「사용량 기록 저장은 처음 값을 지킨다」 표와 흐름도),
`career-os/docs/adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md`

## 의도 메모

- **기록이 있는데 `replace` 가 없는 요청은 오류가 아니다.** `200` 으로 저장돼 있던 기록과 `created: false` 를 돌려준다. `409` 로 바꾸지 않는다. 수집기가 매일 돌며 같은 달을 다시 올릴 수 있고, 그것을 실패로 세면 정상 실행이 실패로 보인다.
- 「더 큰 값이 오면 바꾼다」 를 구현하지 않는다. ADR-133 이 기각했다. 환산 비용은 단가표가 바뀌면 함께 바뀌어 같은 달의 값이 흔들린다.
- 끝나지 않은 달을 받지 않는 것이 달 중간 측정을 막는 유일한 장치다. 이 검사를 client 에만 두지 않는다.
- `measuredOn` 이 그 달이 끝난 뒤의 날짜인지는 검사하지 않는다. `BACKFILLED` 기록은 옛 산출물에 적힌 측정일을 그대로 옮기므로 규칙을 정할 근거가 없다. 달력에 있는 날짜인지만 본다.
- 이력 table 을 두지 않는다. `replace` 로 바꾼 사유는 `note` 에 남는다.
- 기록을 지우는 경로를 만들지 않는다.
- 같은 `Idempotency-Key` 와 같은 본문의 재시도는 인터셉터가 처음 응답(`created: true`)을 그대로 돌려준다. service 까지 오지 않는다. 다른 값을 가진 요청은 key 가 달라 service 까지 오고 `created: false` 를 받는다. 두 경우 모두 저장된 값은 바뀌지 않는다.
- `INSERT IGNORE` 는 `CHECK` 위반도 경고로 낮춰 행을 넣지 않는다. zod 검증을 먼저 통과한 값만 넣으므로 정상 경로에서는 일어나지 않지만, 넣은 뒤 다시 읽은 행이 없으면 `ApiError(500, "INTERNAL_ERROR", ...)` 로 끝낸다.
- 토큰은 `BIGINT UNSIGNED` 다. 한 달 값이 `INT UNSIGNED` 의 상한을 넘는다. JSON 에서는 숫자로 내므로 zod 가 안전한 정수 범위를 넘는 값을 거절해야 한다.

## Blocked 조건

- 테스트용 MySQL 8.4 에 접속할 수 없으면 `PHASE_BLOCKED: 테스트 DB 없음` 을 출력하고 종료한다. 테스트를 건너뛰어 통과로 만들지 않는다.
- `career-os/services/career-backend/src/profile/profile.module.ts` 가 없으면 Phase 01 이 끝나지 않은 것이다. `PHASE_BLOCKED: Phase 01 미완료` 를 출력하고 종료한다.

## 작업 항목

### 1. `career-os/services/career-backend/prisma/migrations/20261002000100_agent_usage_snapshots/migration.sql` 신규

`career-os/docs/data-schema.md` 의 「에이전트 사용량 기록 table」 절 그대로 만든다.

```sql
CREATE TABLE agent_usage_snapshots (
  month CHAR(7) PRIMARY KEY,
  claude_tokens BIGINT UNSIGNED NOT NULL,
  codex_tokens BIGINT UNSIGNED NOT NULL,
  claude_cost_usd DECIMAL(12,2) NULL,
  codex_cost_usd DECIMAL(12,2) NULL,
  sessions INT UNSIGNED NULL,
  unpriced_tokens BIGINT UNSIGNED NOT NULL,
  measured_on DATE NOT NULL,
  source VARCHAR(20) NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT chk_agent_usage_snapshot_month CHECK (month REGEXP '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT chk_agent_usage_snapshot_source CHECK (source IN ('MEASURED', 'BACKFILLED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`month` 는 MySQL 의 예약어가 아니라 칸 이름으로 쓸 수 있다. MySQL 8.4 가 거절하면 백틱으로 감싼다.
Phase 01 의 `20261002000000_profile_documents` 는 고치지 않는다.

### 2. `career-os/services/career-backend/prisma/schema.prisma` 수정

model `agent_usage_snapshots` 를 더한다.

- `month String @id @db.Char(7)`
- `claude_tokens`, `codex_tokens`, `unpriced_tokens`: `BigInt @db.UnsignedBigInt`
- `claude_cost_usd`, `codex_cost_usd`: `Decimal? @db.Decimal(12, 2)`
- `sessions Int? @db.UnsignedInt`
- `measured_on DateTime @db.Date`
- `source String @db.VarChar(20)`, `note String? @db.VarChar(500)`
- `created_at DateTime`, `updated_at DateTime`

정의가 migration 과 맞는지는 `prisma/baseline.test.ts` 의 「적용한 database 와 schema.prisma 의 차이가 없다」 가 판정한다.
실패하면 migration 을 적용한 테스트 DB 에서 `npx prisma db pull --print` 가 내는 model 과 대조해 `schema.prisma` 쪽을 맞춘다.

### 3. `career-os/services/career-backend/src/profile/usage-month.ts` 신규

NestJS 와 Prisma 를 import 하지 않는 순수 함수다.

```ts
export const usageMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
/** 요청을 받은 시각의 Asia/Seoul 달. `YYYY-MM`. */
export function currentSeoulMonth(now: Date): string;
/** `month` 가 `now` 의 Asia/Seoul 달보다 앞이면 참이다. 같은 달과 미래의 달은 거짓이다. */
export function isEndedSeoulMonth(month: string, now: Date): boolean;
```

`currentSeoulMonth` 는 `../positions/seoul-date.js` 의 `todaySeoulIsoDate(now).slice(0, 7)` 이다.
`YYYY-MM` 은 자릿수가 고정이라 문자열 비교로 앞뒤를 판정한다.

### 4. `career-os/services/career-backend/src/profile/schema.ts` 수정

Phase 01 의 문서 계약 아래에 더한다.

```ts
export const usageSnapshotSources = ["MEASURED", "BACKFILLED"] as const;
export const usageSnapshotPutSchema = z.object({ ... }).strict();
export type UsageSnapshotPut = z.infer<typeof usageSnapshotPutSchema>;
export type UsageSnapshot = {
  month: string;
  claudeTokens: number; codexTokens: number;
  claudeCostUsd: number | null; codexCostUsd: number | null;
  sessions: number | null;
  unpricedTokens: number;
  measuredOn: string;          // YYYY-MM-DD
  source: "MEASURED" | "BACKFILLED";
  note: string | null;
  createdAt: string; updatedAt: string;   // UTC ISO
};
export type UsageSnapshotPutResponse = { snapshot: UsageSnapshot; created: boolean };
```

`usageSnapshotPutSchema` 의 칸이다.

| 칸 | 규칙 |
| --- | --- |
| `claudeTokens`, `codexTokens`, `unpricedTokens` | 필수. 0 이상의 정수이고 `Number.MAX_SAFE_INTEGER` 이하 |
| `claudeCostUsd`, `codexCostUsd` | 선택이고 `null` 을 받는다. `z.number().nonnegative().max(9_999_999_999.99).multipleOf(0.01).nullable().optional()` 이다. 소수 둘째 자리 검사를 `Number.isInteger(v * 100)` 처럼 손으로 하지 않는다. node 에서 `0.07*100` 은 `7.000000000000001` 이라 정상 값을 거절한다. zod 4 의 `multipleOf(0.01)` 은 `0.07`, `0.29` 를 받고 `12.345` 를 거절한다(실측) |
| `sessions` | 선택이고 `null` 을 받는다. 0 이상의 정수이고 4,294,967,295 이하 |
| `measuredOn` | 필수. `YYYY-MM-DD` 이고 달력에 있는 날짜 |
| `source` | 필수. `MEASURED` 나 `BACKFILLED` |
| `note` | 선택. `trim()` 뒤 1자 이상 500자 이하 |
| `replace` | 선택. boolean |

- 모르는 칸은 거절한다(`.strict()`). `month` 는 본문이 아니라 경로로 받는다
- `replace === true` 인데 `note` 가 없으면 거절한다. `.refine` 으로 두고 오류 경로를 `note` 로 둔다
- 빠진 선택 칸과 `null` 은 같은 뜻이다. 저장할 때 `NULL` 로 넣는다

### 5. `career-os/services/career-backend/src/profile/repository/usage-snapshot.repository.ts` 신규

`@Injectable()` 인 `UsageSnapshotRepository`. `$queryRaw` 와 `$executeRaw` 를 쓴다.

- `reader()`, `transaction(callback)`: `profile-document.repository.ts` 와 같은 옵션
- `listSnapshots(client)`: `ORDER BY month`
- `getSnapshot(month, client)`
- `lockSnapshot(month, tx)`: `... WHERE month = ? FOR UPDATE`
- `insertIfAbsent(month, value, tx): Promise<boolean>`: `INSERT IGNORE INTO agent_usage_snapshots (...) VALUES (..., NOW(3), NOW(3))`. 영향받은 행이 1 이면 `true`
- `replaceSnapshot(month, value, tx)`: `created_at` 을 뺀 모든 값 칸과 `updated_at = NOW(3)` 을 바꾼다

행을 `UsageSnapshot` 으로 바꾸는 규칙이다.

| 칸 | 변환 |
| --- | --- |
| `BIGINT` 셋 | driver 가 `bigint` 로 준다. `Number(...)` |
| `DECIMAL` 둘 | `null` 은 그대로, 아니면 `Number(String(value))` |
| `sessions` | `null` 은 그대로, 아니면 `Number(...)` |
| `measured_on` | `Date` 면 `toISOString().slice(0, 10)`. 프로세스 시간대가 UTC 라 날짜가 밀리지 않는다 |
| `created_at`, `updated_at` | `toISOString()` |

### 6. `career-os/services/career-backend/src/profile/profile.service.ts`, `profile.controller.ts`, `profile.module.ts` 수정

`profile.service.ts` 에 `@Injectable()` 인 `ProfileClock` 을 더한다. `now(): Date` 가 `new Date()` 를 돌려준다.
`ProfileService` 생성자가 `UsageSnapshotRepository` 와 `ProfileClock` 을 더 받는다.

- `listUsageSnapshots(): Promise<{ snapshots: UsageSnapshot[] }>`
- `putUsageSnapshot(month: string, value: UsageSnapshotPut): Promise<UsageSnapshotPutResponse>`
  1. `isEndedSeoulMonth(month, this.clock.now())` 가 거짓이면 `ApiError(400, "BAD_REQUEST", "끝난 달의 기록만 저장할 수 있습니다.")`
  2. transaction 을 연다
  3. `value.replace !== true` 면 `insertIfAbsent` 를 부른다. 결과가 `true` 면 `created: true`, `false` 면 `created: false` 다. 어느 쪽이든 `getSnapshot` 으로 읽은 행을 `snapshot` 으로 돌려준다. `false` 일 때 돌려주는 값은 **요청 값이 아니라 저장돼 있던 값**이다
  4. `value.replace === true` 면 `lockSnapshot` 으로 잠근다. 행이 없으면 `insertIfAbsent` 로 만들고 `created: true`, 있으면 `replaceSnapshot` 으로 바꾸고 `created: false` 다
     - 격리 수준이 `ReadCommitted` 라 없는 행에 건 `FOR UPDATE` 는 gap 잠금을 걸지 않는다. 그 사이 다른 요청이 첫 기록을 먼저 넣으면 `insertIfAbsent` 가 `false` 를 돌려준다. 그때는 `lockSnapshot` 으로 다시 잠근 뒤 `replaceSnapshot` 으로 바꾸고 `created: false` 다. 사람이 요청한 교체가 조용히 빠지지 않게 한다
     - 어느 경로든 마지막에 같은 tx 에서 `getSnapshot` 으로 읽은 행을 `snapshot` 으로 돌려준다
  5. 읽은 행이 없으면 `ApiError(500, "INTERNAL_ERROR", "사용량 기록을 저장하지 못했습니다.")`

`ProfileController` 에 더한다.

| 데코레이터 | 메서드 |
| --- | --- |
| `@Get("usage-snapshots")` | `listUsageSnapshots()` |
| `@Put("usage-snapshots/:month")`, `@HttpCode(200)` | `putUsageSnapshot(@Param("month") month: string, @Body(new ZodValidationPipe(usageSnapshotPutSchema)) body)` |

경로의 `month` 가 `usageMonthPattern` 에 맞지 않으면 `ApiError(400, "BAD_REQUEST", ...)` 다.
`ProfileModule` 의 `providers` 에 `UsageSnapshotRepository` 와 `ProfileClock` 을 더한다.

### 7. `career-os/services/career-backend/test/support/e2e-harness.ts` 수정

`DATA_TABLES` 에 `"agent_usage_snapshots"` 를 더한다. 다른 table 과 외래 키가 없어 자리는 상관없고, Phase 01 이 더한 `"profile_documents"` 바로 뒤에 둔다.

### 8. `career-os/services/career-backend/prisma/baseline.test.ts` 수정

| 상수 | 지금(Phase 01 뒤) | 바꿀 값 | 이유 |
| --- | --- | --- | --- |
| `EXPECTED_CHECK_CONSTRAINT_COUNT` | 32 | 34 | 사용량 기록 table 의 `CHECK` 둘 |
| `EXPECTED_MODEL_COUNT` | 37 | 38 | model 하나 |

상수 위 주석과 `it` 제목의 숫자도 함께 고친다.

### 9. 이 phase 를 검증하는 `career-os/services/career-backend/src/profile/usage-month.test.ts` 신규

단위 테스트다. 시각은 UTC 로 적는다.

| `now` | `month` | `isEndedSeoulMonth` |
| --- | --- | --- |
| `2026-09-30T14:59:59Z` (Seoul 9월 30일 23:59) | `2026-09` | `false` |
| `2026-09-30T15:00:00Z` (Seoul 10월 1일 00:00) | `2026-09` | `true` |
| `2026-09-30T15:00:00Z` | `2026-10` | `false` |
| `2026-09-30T15:00:00Z` | `2026-11` | `false` |
| `2026-12-31T15:00:00Z` (Seoul 2027년 1월 1일) | `2026-12` | `true` |

`usageMonthPattern` 이 `2026-13`, `2026-1`, `26-01`, `2026-00` 을 거절하고 `2026-01`, `2026-12` 를 받는 것도 확인한다.

### 10. 이 phase 를 검증하는 `career-os/services/career-backend/test/profile-usage.e2e.test.ts` 신규

`beforeAll` 에서 `harness.app.get(ProfileClock).now = () => new Date("2026-10-01T03:00:00Z")` 로 요청 시각을 고정한다. Seoul 기준 2026년 10월 1일이다.
숫자는 지어낸 값만 쓴다. 실제 측정값을 넣지 않는다.

기준 요청은 `{ claudeTokens: 1200, codexTokens: 300, claudeCostUsd: 12.34, codexCostUsd: 5.6, sessions: 7, unpricedTokens: 10, measuredOn: "2026-10-01", source: "MEASURED" }` 다.

- `claudeCostUsd: 0.07`, `codexCostUsd: 0.29` 로 보내면 저장되고, 응답과 `GET` 에서 같은 값으로 읽힌다. 소수 검사를 곱셈으로 구현하면 이 case 가 400 으로 실패한다
- `claudeCostUsd: 12.345` 로 보내면 400 이다

- 빈 DB 에서 `GET usage-snapshots` 가 `{ snapshots: [] }` 다
- `PUT usage-snapshots/2026-09` 에 기준 요청을 보내면 `200` 이고 `created: true` 다. `snapshot` 이 요청 값과 같고 `note` 가 `null`, `createdAt` 과 `updatedAt` 이 ISO 문자열이다
- **처음 값을 지킨다**: 같은 달에 다른 `Idempotency-Key` 로 `claudeTokens: 9` 를 보내면 `200` 이고 `created: false` 다. 응답의 `snapshot.claudeTokens` 가 1200 이고, `agent_usage_snapshots` 행의 `claude_tokens` 도 1200 이며 `updated_at` 이 첫 저장과 같다
- `replace: true` 와 `note` 를 함께 보내면 값이 바뀌고 `created: false` 다. `note` 가 저장되고 `created_at` 은 그대로이며 `updated_at` 이 `created_at` 이상이다
- `replace: true` 인데 `note` 가 없으면 `400 BAD_REQUEST` 이고 행이 바뀌지 않는다
- 기록이 없는 달에 `replace: true` 와 `note` 를 보내면 만들어지고 `created: true` 다
- `PUT usage-snapshots/2026-10`(끝나지 않은 달)과 `2026-11`(미래의 달)은 `400` 이고 행이 생기지 않는다
- `PUT usage-snapshots/2026-13`, `2026-9`, `latest` 는 `400` 이다
- 음수 토큰, 소수 토큰, 소수 셋째 자리 비용, `source: "GUESSED"`, `measuredOn: "2026-02-30"`, 모르는 칸 `month` 를 담은 본문은 각각 `400` 이다
- `claudeCostUsd`, `codexCostUsd`, `sessions` 를 빼고 `source: "BACKFILLED"` 로 보내면 저장되고 응답과 `GET` 에서 셋이 `null` 이다
- `claudeTokens: 24600000000` 을 저장하고 `GET` 으로 읽으면 같은 숫자다. `INT` 범위를 넘는 값의 왕복 확인이다
- `2026-08`, `2026-06`, `2026-07` 순으로 저장한 뒤 `GET usage-snapshots` 의 `month` 순서가 `2026-06`, `2026-07`, `2026-08` 이다
- 같은 달의 첫 기록을 서로 다른 `Idempotency-Key` 와 서로 다른 `claudeTokens` 로 `Promise.all` 두 건을 보내면 둘 다 `200` 이고 `created` 가 `true` 하나와 `false` 하나다. 두 응답의 `snapshot.claudeTokens` 가 같고 행이 하나다
- 같은 `Idempotency-Key` 와 같은 본문으로 다시 보내면 처음 응답과 같은 본문이 오고 행이 하나다

## 검증

테스트는 실제 MySQL 8.4 를 요구한다. 접속 문자열이 없으면 건너뛰지 않고 실패한다.
아래 값은 지어낸 예시다. 이미 띄워 둔 테스트용 MySQL 이 있으면 `TEST_MYSQL` 만 그 주소로 바꾼다.
계정은 database 를 만들고 지울 수 있어야 한다. `prisma/baseline.test.ts` 가 `fos_career_baseline_check` 를 만들고 지운다.

```bash
# 테스트용 MySQL 이 없을 때만
docker run -d --name career-backend-test-mysql -e MYSQL_ROOT_PASSWORD=example-test-password -p 13400:3306 mysql:8.4
docker exec career-backend-test-mysql mysql -uroot -pexample-test-password \
  -e 'CREATE DATABASE IF NOT EXISTS fos_career_test; CREATE DATABASE IF NOT EXISTS fos_career_shadow'
```

| 환경값 | 쓰는 곳 |
| --- | --- |
| `DATABASE_URL` | `prisma.config.ts` 의 datasource. `prisma generate`, `prisma migrate deploy` 가 읽는다 |
| `SHADOW_DATABASE_URL` | `prisma/baseline.test.ts` 의 `prisma migrate diff --from-migrations` 가 쓰는 임시 database |
| `CAREER_BACKEND_TEST_DATABASE_URL` | 모든 e2e 테스트와 `prisma/baseline.test.ts` 가 붙는 MySQL |

```bash
# cwd: career-os/services/career-backend
export TEST_MYSQL="mysql://root:example-test-password@127.0.0.1:13400"
npm install
DATABASE_URL="$TEST_MYSQL/fos_career_test" npx prisma generate
npm run typecheck
# 로컬 fos_career_test 에만 migration 을 적용한다. 운영 DB 에는 적용하지 않는다.
DATABASE_URL="$TEST_MYSQL/fos_career_test" npx prisma migrate deploy
DATABASE_URL="$TEST_MYSQL/fos_career_test" \
CAREER_BACKEND_TEST_DATABASE_URL="$TEST_MYSQL/fos_career_test" \
SHADOW_DATABASE_URL="$TEST_MYSQL/fos_career_shadow" \
  npx vitest run
```

모두 종료 코드 0 이어야 한다. `npx vitest run` 은 `package.json` 의 `npm test` 와 같은 명령이고 `vitest.config.ts` 의 `include` 가 `prisma/**/*.test.ts`, `src/**/*.test.ts`, `test/**/*.test.ts` 다.
결과에 `src/profile/usage-month.test.ts`, `test/profile-usage.e2e.test.ts`, `test/profile-documents.e2e.test.ts`, `prisma/baseline.test.ts` 가 실행된 것이 보여야 한다.

```bash
# cwd: 저장소 루트
git diff --stat -- career-os/services/career-backend/prisma/migrations/20261002000000_profile_documents
git diff --check
```

첫 명령의 출력이 비어 있어야 한다. 적용한 migration 파일을 고치지 않았다는 확인이다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/services/career-backend/prisma/migrations/20261002000100_agent_usage_snapshots/migration.sql` | 신규 |
| `career-os/services/career-backend/prisma/schema.prisma` | 수정 |
| `career-os/services/career-backend/src/profile/usage-month.ts` | 신규 |
| `career-os/services/career-backend/src/profile/schema.ts` | 수정 |
| `career-os/services/career-backend/src/profile/repository/usage-snapshot.repository.ts` | 신규 |
| `career-os/services/career-backend/src/profile/profile.service.ts` | 수정 |
| `career-os/services/career-backend/src/profile/profile.controller.ts` | 수정 |
| `career-os/services/career-backend/src/profile/profile.module.ts` | 수정 |
| `career-os/services/career-backend/test/support/e2e-harness.ts` | 수정 |
| `career-os/services/career-backend/prisma/baseline.test.ts` | 수정 |
| `career-os/services/career-backend/src/profile/usage-month.test.ts` | 신규 |
| `career-os/services/career-backend/test/profile-usage.e2e.test.ts` | 신규 |
