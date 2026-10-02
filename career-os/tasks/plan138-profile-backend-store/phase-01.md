# Phase 01. 프로필 원고 table 과 `/api/profile/v1/documents` 경로를 만든다

**Execution profile**: standard

## 목표

`fos_career` 에 `profile_documents` 와 `profile_document_revisions` 를 만들고 `/api/profile/v1` 의 문서 경로 셋을 연다.
원티드, LinkedIn, GitHub 프로필 원고를 홈서버 SSH 없이 Backend 에서 읽고 쓰기 위해서다.

이 phase 가 끝나면 `GET documents`, `GET documents/:documentKey`, `PUT documents/:documentKey` 가 동작한다.

**범위 외**: 사용량 기록 table 과 `usage-snapshots` 경로는 Phase 02, `career-os/scripts/profile/` 의 client 와 CLI 는 Phase 03 이다.
기존 원고를 Backend 로 옮기는 일, `sync-profile` 스킬 수정, 운영 배포와 migration 적용은 이 plan 밖이다.

## 컨텍스트

커리어 Backend 는 `career-os/services/career-backend/` 의 NestJS 와 Prisma 서비스다.
후보자 맥락 모듈 `src/candidate-context/` 가 같은 저장 규칙을 이미 구현했다. 그 다섯 파일의 구조를 그대로 따른다.

| 무엇 | 따를 곳 |
| --- | --- |
| 모듈 등록 | `src/app.module.ts` 의 `imports` 배열. 지금 마지막 원소가 `CandidateContextModule` 이다 |
| controller | `src/candidate-context/candidate-context.controller.ts`. `@Controller("api/candidate-context/v1")`, `@Put` 에 `@HttpCode(200)`, 경로 키는 `toContractError` 로 `400` 을 낸다 |
| zod 계약 | `src/candidate-context/schema.ts`. `maxBodyBytes = 65_536`, `.strict()`, `PUT` 응답 타입에 본문이 없다 |
| service | `src/candidate-context/candidate-context.service.ts` 의 `putDocument` 와 `isDuplicateDocumentKey` |
| 저장 계층 | `src/candidate-context/repository/candidate-context.repository.ts`. `$queryRaw` 와 `$executeRaw`, `isolationLevel: "ReadCommitted"` transaction, `SELECT ... FOR UPDATE` |
| migration | `prisma/migrations/20260930000000_candidate_context/migration.sql`. 가장 최근 migration 은 `20260930000100_study_control_drop_context_version` 이다 |
| 오류 | `src/common/api-error.ts` 의 `ApiError(status, code, message)`. 새 code 를 만들지 않는다 |
| 테스트 격리 | `test/support/e2e-harness.ts` 의 `DATA_TABLES`. 자식 table 이 앞이다 |
| e2e 테스트 | `test/candidate-context.e2e.test.ts` 의 `startE2eHarness`, `harness.send`, `harness.clearAll` |

인증과 멱등은 전역이다. `src/common/auth.middleware.ts` 가 `/health/live` 와 `/health/ready` 를 뺀 모든 경로에 Bearer 인증을 건다.
`src/common/idempotency/idempotency.interceptor.ts` 가 `POST`, `PUT`, `PATCH`, `DELETE` 요청에 `Idempotency-Key` 헤더를 요구하고,
같은 key 와 같은 본문의 재시도에 `request_receipts` 에 저장한 응답을 돌려준다. 새 경로는 따로 설정하지 않아도 둘 다 적용된다.

**근거 문서**: `career-os/docs/data-schema.md` 의 「프로필 원고 table」 절,
`career-os/docs/flow.md` 의 「프로필 HTTP 계약」 절과 「커리어 Backend」 절,
`career-os/docs/code-architecture.md` 의 「커리어 Backend」 절,
`career-os/docs/adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md`

## 의도 메모

- 후보자 맥락 table 에 키를 더하지 않는다. ADR-133 이 기각했다. 후보자 맥락은 판단의 입력이고 프로필 원고는 밖에 올린 결과다.
- 후보자 맥락 모듈의 코드를 공통 모듈로 뽑아내지 않는다. 문서 저장 코드가 한 벌 더 생기는 것은 ADR-133 이 감당하기로 한 비용이다. `src/candidate-context/` 의 파일은 이 phase 에서 고치지 않는다.
- `PUT` 응답에 본문과 `note` 를 담지 않는다. 전역 멱등 인터셉터가 응답 본문을 `request_receipts` 에 저장하므로, 담으면 원고의 사본이 그 table 에 남는다.
- 문서 행과 이력 행을 지우는 경로를 만들지 않는다.
- `src/profile/` 의 파일 이름은 Phase 02 가 같은 모듈에 사용량 기록을 더할 것을 전제로 한다. service 와 controller 와 module 은 하나씩 두고, 저장 계층만 문서와 사용량으로 나눈다.
- `ProfileModule` 은 다른 module 에 아무것도 내보내지 않는다. `exports` 를 두지 않는다. 프로필 원고를 읽는 다른 module 이 없다.

## Blocked 조건

- 테스트용 MySQL 8.4 에 접속할 수 없으면 `PHASE_BLOCKED: 테스트 DB 없음` 을 출력하고 종료한다. 테스트를 건너뛰어 통과로 만들지 않는다.

## 작업 항목

### 1. `career-os/services/career-backend/prisma/migrations/20261002000000_profile_documents/migration.sql` 신규

`career-os/docs/data-schema.md` 의 「프로필 원고 table」 절 그대로 table 둘을 만든다.
`20260930000000_candidate_context/migration.sql` 과 칸 타입이 같고 이름과 키 목록만 다르다.

- `profile_documents`: `document_key VARCHAR(50) PRIMARY KEY`, `body MEDIUMTEXT NOT NULL`, `version INT UNSIGNED NOT NULL`, `note VARCHAR(500) NOT NULL`, `updated_at DATETIME(3) NOT NULL`
  - `CONSTRAINT chk_profile_document_key CHECK (document_key IN ('wanted', 'linkedin', 'github'))`
  - `CONSTRAINT chk_profile_document_version CHECK (version >= 1)`
- `profile_document_revisions`: `document_key VARCHAR(50) NOT NULL`, `version INT UNSIGNED NOT NULL`, `body MEDIUMTEXT NOT NULL`, `note VARCHAR(500) NOT NULL`, `created_at DATETIME(3) NOT NULL`, `PRIMARY KEY (document_key, version)`
  - `CONSTRAINT fk_profile_document_revision_document FOREIGN KEY (document_key) REFERENCES profile_documents (document_key) ON DELETE RESTRICT ON UPDATE RESTRICT`
- 두 table 모두 `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`

`CHECK` 제약은 `schema.prisma` 가 표현하지 못하므로 SQL 에만 둔다. `career-os/services/career-backend/README.md` 의 「migration 을 만들고 고치는 규칙」 을 따른다.
기존 migration 파일은 고치지 않는다.

### 2. `career-os/services/career-backend/prisma/schema.prisma` 수정

model 둘을 더한다. 이름은 table 이름과 같게 둔다. 같은 파일의 `candidate_context_documents`, `candidate_context_document_revisions` model 과 같은 모양이다.

- `profile_documents`: `document_key String @id @db.VarChar(50)`, `body String @db.MediumText`, `version Int @db.UnsignedInt`, `note String @db.VarChar(500)`, `updated_at DateTime`, `profile_document_revisions profile_document_revisions[]`
- `profile_document_revisions`: 같은 칸에 `created_at DateTime`, relation 은 `onDelete: Restrict, onUpdate: Restrict, map: "fk_profile_document_revision_document"`, `@@id([document_key, version])`

`prisma/baseline.test.ts` 의 「적용한 database 와 schema.prisma 의 차이가 없다」 가 migration 과 model 이 어긋나면 실패한다.

### 3. `career-os/services/career-backend/src/profile/schema.ts` 신규

zod 만 import 한다.

```ts
export const profileDocumentKeys = ["wanted", "linkedin", "github"] as const;
export const profileDocumentKeySchema = z.enum(profileDocumentKeys);
export type ProfileDocumentKey = z.infer<typeof profileDocumentKeySchema>;

export const profileDocumentPutSchema = z.object({ body, note, expectedVersion }).strict();
export type ProfileDocumentPut = z.infer<typeof profileDocumentPutSchema>;

export type ProfileDocument = { documentKey: ProfileDocumentKey; body: string; version: number; note: string; updatedAt: string };
export type ProfileDocumentSummary = Omit<ProfileDocument, "body" | "note">;
export type ProfileDocumentPutResponse = { document: ProfileDocumentSummary };
```

- `body`: 문자열. `trim()` 한 길이가 0 이면 거절, `Buffer.byteLength(value, "utf8")` 가 65,536 을 넘으면 거절
- `note`: `z.string().trim().min(1).max(500)`
- `expectedVersion`: `z.number().int().nonnegative()`

### 4. `career-os/services/career-backend/src/profile/repository/profile-document.repository.ts` 신규

`@Injectable()` 인 `ProfileDocumentRepository`. `candidate-context.repository.ts` 의 메서드에서 `lockDocumentForShare` 를 뺀 것과 같다.

- `reader()`, `transaction(callback)`: `maxWait: 30_000`, `timeout: 30_000`, `isolationLevel: "ReadCommitted"`
- `listDocuments(client)`: `SELECT document_key, version, updated_at FROM profile_documents ORDER BY document_key`
- `getDocument(documentKey, client)`
- `lockDocument(documentKey, tx)`: `... FOR UPDATE`
- `insertDocument(documentKey, value, tx)`: `version` 1, `updated_at = NOW(3)`
- `updateDocument(documentKey, value, tx)`: `version = version + 1`, `updated_at = NOW(3)`
- `insertRevision(saved, tx)`: 저장한 문서 행을 그대로 `profile_document_revisions` 에 넣는다

`updatedAt` 은 `Date` 를 `toISOString()` 으로 낸다.

### 5. `career-os/services/career-backend/src/profile/profile.service.ts`, `profile.controller.ts`, `profile.module.ts` 신규

`ProfileService`:

- `listDocuments(): Promise<{ documents: ProfileDocumentSummary[] }>`
- `getDocument(documentKey): Promise<{ document: ProfileDocument }>`. 없으면 `ApiError(404, "NOT_FOUND", "프로필 원고를 찾을 수 없습니다.")`
- `putDocument(documentKey, value): Promise<ProfileDocumentPutResponse>`. `candidate-context.service.ts` 의 `putDocument` 와 같은 순서다
  1. transaction 안에서 `lockDocument`
  2. 행이 있는데 `version !== expectedVersion` 이면 `ApiError(409, "VERSION_CONFLICT", ...)`
  3. 행이 없는데 `expectedVersion !== 0` 이면 `ApiError(409, "VERSION_CONFLICT", ...)`
  4. `updateDocument` 나 `insertDocument`, 다시 `lockDocument` 로 읽어 `insertRevision`
  5. `{ document: { documentKey, version, updatedAt } }` 를 돌려준다
  6. 같은 새 문서를 동시에 만든 요청 중 늦은 쪽의 PK 충돌(`P2002`, `P2010` 의 `meta.code === "1062"`, 메시지의 `Duplicate entry`)은 `409 VERSION_CONFLICT` 로 바꾼다

`ProfileController` 는 `@Controller("api/profile/v1")` 이다.

| 데코레이터 | 메서드 |
| --- | --- |
| `@Get("documents")` | `listDocuments()` |
| `@Get("documents/:documentKey")` | `getDocument(@Param("documentKey") documentKey: string)` |
| `@Put("documents/:documentKey")`, `@HttpCode(200)` | `putDocument(@Param("documentKey") ..., @Body(new ZodValidationPipe(profileDocumentPutSchema)) ...)` |

경로의 문서 키는 `profileDocumentKeySchema.parse` 로 검사하고 실패하면 `toContractError` 로 `400 BAD_REQUEST` 를 낸다.

`ProfileModule` 은 `controllers: [ProfileController]`, `providers: [ProfileDocumentRepository, ProfileService]` 다.

### 6. `career-os/services/career-backend/src/app.module.ts` 수정

`imports` 배열 끝에 `ProfileModule` 을 더한다.

### 7. `career-os/services/career-backend/test/support/e2e-harness.ts` 수정

`DATA_TABLES` 맨 앞에 `"profile_document_revisions"`, `"profile_documents"` 를 이 순서로 더한다. 자식인 이력 table 이 먼저다.
넣지 않으면 `clearAll` 이 프로필 행을 남겨 다음 case 가 `409` 로 실패한다.

### 8. `career-os/services/career-backend/prisma/baseline.test.ts` 수정

개수를 상수로 단언하는 테스트다. 이 phase 의 migration 으로 값이 달라진다.

| 상수 | 지금 | 바꿀 값 | 이유 |
| --- | --- | --- | --- |
| `EXPECTED_CHECK_CONSTRAINT_COUNT` | 30 | 32 | 프로필 원고 table 의 `CHECK` 둘 |
| `EXPECTED_MODEL_COUNT` | 35 | 37 | model 둘 |

상수 위 주석과 `it` 제목의 숫자(「CHECK 제약이 30개 생긴다」, 「model 이 35개 있다」)도 함께 고친다.
초기 migration SQL 의 바이트 비교는 그대로 둔다.

### 9. 이 phase 를 검증하는 `career-os/services/career-backend/test/profile-documents.e2e.test.ts` 신규

`test/candidate-context.e2e.test.ts` 와 같은 모양으로 쓴다. 기본 경로는 `/api/profile/v1/documents` 다.
본문은 지어낸 예시 문장만 쓴다. 실제 프로필 문장을 넣지 않는다.

- 새 문서를 `expectedVersion: 0` 으로 저장하면 `200` 이고 응답이 `{ document: { documentKey: "github", version: 1, updatedAt } }` 다. 응답에 `body` 와 `note` 가 없다. `profile_document_revisions` 에 행 하나가 생긴다. `request_receipts.response_body` 에 본문 문장이 없다. `GET documents/github` 가 본문, `version`, `note`, `updatedAt` 을 돌려준다
- `expectedVersion: 1` 로 다시 저장하면 `version` 이 2 가 되고 첫 이력 행이 그대로 남는다
- `expectedVersion` 이 현재보다 낮거나 높으면, 그리고 없는 문서에 0 이 아닌 값을 보내면 `409 VERSION_CONFLICT` 이고 문서와 이력이 바뀌지 않는다
- 문서 키 `unknown-key` 와 후보자 맥락의 키 `career-status` 는 `GET` 과 `PUT` 모두 `400 BAD_REQUEST` 이고 행이 생기지 않는다
- 빈 본문, 공백뿐인 본문, UTF-8 65,537 바이트 본문은 `400` 이고 65,536 바이트 정확히는 저장된다
- 저장한 적 없는 문서를 조회하면 `404 NOT_FOUND` 다
- 목록은 본문 없이 `documentKey`, `version`, `updatedAt` 을 키 순(`github`, `linkedin`, `wanted`)으로 돌려주고, 문서가 없으면 `{ documents: [] }` 다
- 같은 새 문서를 `Promise.all` 로 두 요청이 동시에 만들면 상태 코드가 `[200, 409]` 이고 `version` 이 1, 이력 행이 하나다
- 프로필 문서를 저장해도 `candidate_context_documents` 에 행이 생기지 않는다

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
결과에 `test/profile-documents.e2e.test.ts` 와 `prisma/baseline.test.ts` 가 실행된 것이 보여야 한다.
`test/candidate-context.e2e.test.ts` 도 그대로 통과해야 한다.

```bash
# cwd: 저장소 루트
git diff --stat -- career-os/services/career-backend/src/candidate-context
git diff --check
```

첫 명령의 출력이 비어 있어야 한다. 후보자 맥락 모듈을 고치지 않았다는 확인이다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/services/career-backend/prisma/migrations/20261002000000_profile_documents/migration.sql` | 신규 |
| `career-os/services/career-backend/prisma/schema.prisma` | 수정 |
| `career-os/services/career-backend/src/profile/schema.ts` | 신규 |
| `career-os/services/career-backend/src/profile/repository/profile-document.repository.ts` | 신규 |
| `career-os/services/career-backend/src/profile/profile.service.ts` | 신규 |
| `career-os/services/career-backend/src/profile/profile.controller.ts` | 신규 |
| `career-os/services/career-backend/src/profile/profile.module.ts` | 신규 |
| `career-os/services/career-backend/src/app.module.ts` | 수정 |
| `career-os/services/career-backend/test/support/e2e-harness.ts` | 수정 |
| `career-os/services/career-backend/prisma/baseline.test.ts` | 수정 |
| `career-os/services/career-backend/test/profile-documents.e2e.test.ts` | 신규 |
