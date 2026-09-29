# Phase 01. Backend 에 후보자 맥락 문서 저장소를 만든다

**Execution profile**: deep

## 목표

커리어 Backend 에 `/api/candidate-context/v1` 과 두 table 을 더해, 문서 키마다 Markdown 본문을 버전과 이력과 함께 저장하고 조회한다.
다음 phase 가 공부 추천의 기준 버전을 이 문서에서 계산하려면 저장소가 먼저 있어야 한다.

**범위 외**: 공부 추천이 이 문서를 읽는 변경은 phase 02, client 와 CLI 는 phase 03 이다. 초기 본문 저장은 배포 뒤 사람이 한다.

## 컨텍스트

- 구조는 `services/career-backend/src/study/` 를 따른다. controller, service, `schema.ts`, `repository/` 한 파일 배치다.
- 버전 비교는 `src/study/study.service.ts` 의 `upsertSource` 를 따른다. 행을 `FOR UPDATE` 로 잠그고 `expectedVersion` 을 비교하며, 새 행 동시 생성의 PK 충돌을 `409 VERSION_CONFLICT` 로 바꾼다.
- 멱등 처리는 전역 `IdempotencyInterceptor` 가 한다. `PUT` 은 `Idempotency-Key` 헤더 없이는 `400` 이다. controller 가 따로 할 일은 없다.
- 오류는 `src/common/api-error.ts` 의 `ApiError` 와 `ApiErrorCode` 를 쓴다. 이 phase 는 새 코드를 더하지 않는다.
- migration 규칙은 `services/career-backend/README.md` 의 「Prisma migration」 절이다. **`CHECK` 제약은 migration SQL 에 직접 쓴다.** 적용한 migration 파일은 고치지 않는다.
- e2e 는 `test/support/e2e-harness.ts` 의 `startE2eHarness` 와 `clearAll` 을 쓴다. `clearAll` 은 `DATA_TABLES` 를 자식 table 부터 지운다.

**근거 문서**: `career-os/docs/data-schema.md` 의 「후보자 맥락 문서」 절, `career-os/docs/flow.md` 의 「후보자 맥락 문서」 절, `career-os/docs/adr/ADR-131-후보자-맥락은-backend-문서로-두고-공부-추천-기준-버전을-문서-버전에서-계산한다.md`

## 의도 메모

- 문서 본문을 칸으로 나누지 않는다. 읽는 쪽이 모델이라 Markdown 한 덩어리로 둔다
- 문서 키는 넷으로 고정한다. 오타로 새 문서가 생기지 않게 zod enum 과 DB `CHECK` 둘 다 건다
- 지원서 공통 프로필(연락처, 신원)은 문서 키에 넣지 않는다. 홈서버 DB 와 backup 에 복제하지 않기로 했다
- 삭제 경로는 만들지 않는다. 이력 행은 고치거나 지우지 않는다
- 응답에 본문을 로그로 남기지 않는다. 개인 맥락이다

## 작업 항목

### 1. `services/career-backend/prisma/migrations/20260930000000_candidate_context/migration.sql` 신규

```sql
CREATE TABLE candidate_context_documents (
  document_key VARCHAR(50) PRIMARY KEY,
  body MEDIUMTEXT NOT NULL,
  version INT UNSIGNED NOT NULL,
  note VARCHAR(500) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT chk_candidate_context_document_key CHECK (
    document_key IN ('learning-interests', 'position-preferences', 'application-state', 'career-status')
  ),
  CONSTRAINT chk_candidate_context_document_version CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE candidate_context_document_revisions (
  document_key VARCHAR(50) NOT NULL,
  version INT UNSIGNED NOT NULL,
  body MEDIUMTEXT NOT NULL,
  note VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (document_key, version),
  CONSTRAINT fk_candidate_context_revision_document FOREIGN KEY (document_key)
    REFERENCES candidate_context_documents (document_key) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

첫 줄에 이 table 이 ADR-131 을 따른다는 주석을 단다. `20260923000000_position_exclusions/migration.sql` 첫 줄과 같은 형식이다.

### 2. `services/career-backend/prisma/schema.prisma` 수정

두 model 을 더한다. 기존 model 처럼 `prisma db pull` 결과 형태로 적는다. `CHECK` 는 schema 에 적지 않는다.

### 3. `services/career-backend/src/candidate-context/schema.ts` 신규

```ts
export const candidateContextDocumentKeys = [
  "learning-interests", "position-preferences", "application-state", "career-status",
] as const;
export const candidateContextDocumentKeySchema = z.enum(candidateContextDocumentKeys);
export type CandidateContextDocumentKey = z.infer<typeof candidateContextDocumentKeySchema>;

export const candidateContextDocumentPutSchema = z.object({
  body: z.string().refine((value) => value.trim().length > 0, "본문이 비어 있습니다.")
    .refine((value) => Buffer.byteLength(value, "utf8") <= 65_536, "본문은 UTF-8 64 KiB 이하여야 합니다."),
  note: z.string().trim().min(1).max(500),
  expectedVersion: z.number().int().nonnegative(),
}).strict();

export type CandidateContextDocument = {
  documentKey: CandidateContextDocumentKey;
  body: string;
  version: number;
  note: string;
  updatedAt: string; // UTC ISO
};
export type CandidateContextDocumentSummary = Omit<CandidateContextDocument, "body" | "note">;
```

### 4. `services/career-backend/src/candidate-context/repository/candidate-context.repository.ts` 신규

`src/study/repository/study.repository.ts` 의 `transaction`, `reader()`, raw query 방식을 따른다.

| 메서드 | 동작 |
| --- | --- |
| `listDocuments(client)` | 키, version, updated_at. 키 순 정렬 |
| `getDocument(documentKey, client)` | 한 행 또는 `undefined` |
| `lockDocument(documentKey, tx)` | `SELECT ... FOR UPDATE` |
| `lockDocumentForShare(documentKey, tx)` | `SELECT ... FOR SHARE`. phase 02 가 추천 저장 transaction 에서 쓴다 |
| `insertDocument`, `updateDocument` | 문서 행 쓰기. `updated_at = NOW(3)` |
| `insertRevision` | 이력 행 쓰기 |

### 5. `services/career-backend/src/candidate-context/candidate-context.service.ts` 신규

- `listDocuments()`, `getDocument(key)` 는 없으면 `ApiError(404, "NOT_FOUND", ...)`
- `putDocument(key, value)` 는 한 transaction 에서 잠금, 버전 비교, 문서 행 쓰기, 이력 행 쓰기를 한다. 새 문서는 `expectedVersion` 이 0 이어야 하고 저장 뒤 version 은 1 이다. 새 행 동시 생성의 PK 충돌은 `409 VERSION_CONFLICT` 로 바꾼다
- 다른 module 이 쓸 `readDocument(key, client)` 를 둔다. 없으면 `undefined` 를 돌려주고 예외를 던지지 않는다

### 6. `services/career-backend/src/candidate-context/candidate-context.controller.ts` 와 `candidate-context.module.ts` 신규

- `@Controller("api/candidate-context/v1")`. `GET documents`, `GET documents/:documentKey`, `PUT documents/:documentKey` (`@HttpCode(200)`)
- 경로의 `documentKey` 는 `candidateContextDocumentKeySchema` 로 검사해 실패하면 `400 BAD_REQUEST` 다
- `PUT` 응답은 `{ document: CandidateContextDocument }` 다. `GET documents` 응답은 `{ documents: CandidateContextDocumentSummary[] }` 다
- module 은 `CandidateContextService` 와 `CandidateContextRepository` 를 `exports` 에 둔다
- `src/app.module.ts` 의 `imports` 에 `CandidateContextModule` 을 더한다

### 7. e2e 하네스 수정

`test/support/` 의 하네스 파일에서 `DATA_TABLES` 에 `candidate_context_document_revisions` 를 `candidate_context_documents` 보다 앞에 더한다.

### 8. 이 phase 를 검증하는 `services/career-backend/test/candidate-context.e2e.test.ts` 신규

| 경우 | 기대 |
| --- | --- |
| `PUT learning-interests` 를 `expectedVersion: 0` 으로 | `200`, `version: 1`. 이력 행 1개 |
| 같은 문서를 `expectedVersion: 1` 로 다시 | `version: 2`. 이력 행 2개이고 첫 행 본문은 그대로다 |
| `expectedVersion` 이 현재와 다르다 | `409 VERSION_CONFLICT`. 행과 이력이 바뀌지 않는다 |
| 없는 키 `unknown-key` | `400` |
| 빈 본문, 64 KiB 초과 본문 | `400` |
| 저장한 적 없는 키의 `GET` | `404` |
| `GET documents` | 본문 없이 키, version, `updatedAt` |
| 새 문서를 두 요청이 동시에 `expectedVersion: 0` 으로 | 하나는 `200`, 하나는 `409` |

## 검증

```bash
# cwd: career-os/services/career-backend
docker exec plan125-mysql mysql -uroot -pplan125 -e 'CREATE DATABASE IF NOT EXISTS fos_career_shadow'
npx prisma generate
npm run typecheck
# 로컬 fos_career_test 에만 신규 migration 을 적용한다. 운영 DB 에는 적용하지 않는다.
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
  npx prisma migrate deploy
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_BACKEND_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
CAREER_BACKEND_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
  npx vitest run test/candidate-context.e2e.test.ts
```

모두 종료 코드 0 이어야 한다. 테스트 DB 는 로컬 container `plan125-mysql`(port 13400)이다.
마지막 명령은 새 e2e 만 따로 실행해 그 파일이 실제로 도는지 확인한다.
container 가 없으면 `PHASE_BLOCKED: 테스트 DB container plan125-mysql 없음` 을 출력하고 종료한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/services/career-backend/prisma/migrations/20260930000000_candidate_context/migration.sql` | 신규 |
| `career-os/services/career-backend/prisma/schema.prisma` | 수정 |
| `career-os/services/career-backend/src/candidate-context/schema.ts` | 신규 |
| `career-os/services/career-backend/src/candidate-context/repository/candidate-context.repository.ts` | 신규 |
| `career-os/services/career-backend/src/candidate-context/candidate-context.service.ts` | 신규 |
| `career-os/services/career-backend/src/candidate-context/candidate-context.controller.ts` | 신규 |
| `career-os/services/career-backend/src/candidate-context/candidate-context.module.ts` | 신규 |
| `career-os/services/career-backend/src/app.module.ts` | 수정 |
| `career-os/services/career-backend/test/support/e2e-harness.ts` | 수정 |
| `career-os/services/career-backend/test/candidate-context.e2e.test.ts` | 신규 |
