# Phase 01. 작업 폴더 SQLite 저장 모듈의 기반과 ADR

**Execution profile**: standard

## 목표

실행기가 여는 SQLite 파일 하나와 그 공통 규칙(위치, 스키마 버전, 잠금, 깨진 파일 처리, 재시도 방지 기록, 기준 버전 계산)을 만든다. 뒤 phase 의 공고·공부 저장소가 이 위에 올라간다.

**범위 외**: 공고와 공부의 질의(phase 02, 03), 실행기 호출부 전환(phase 04), 면접 표와 MCP 도구(다음 계획).

## 컨텍스트

- 지금 공고·공부 데이터는 `career-os/services/career-backend`(NestJS, Prisma, MySQL)가 갖고 실행기는 HTTP 로 부른다.
- 새 자리는 `career-os/scripts/lib/career-store/` 다. `bun:sqlite` 만 쓰고 의존성을 더하지 않는다. 실행기는 이미 `bun` 으로 돈다.
- Backend 의 저장소 코드는 Prisma 모델이 아니라 직접 쓴 SQL(`$queryRaw`)이라, 테이블과 열 이름을 그대로 두고 SQLite 문법으로 옮긴다.
- 열 정의의 원본은 `career-os/services/career-backend/prisma/schema.prisma` 다. 공고·회사·공부 묶음과 `request_receipts` 만 옮긴다. `candidate_context_*`, `profile_*`, `agent_usage_snapshots`, `interview_*` 는 만들지 않는다.

**요구사항**: REQ3, REQ4 의 기반(원본 스펙 fos-assistant `docs/features/career-migrate/spec.md`, 설계 DECISION1, 3, 5, 8)

**근거 문서**: `career-os/docs/features/career-migrate/README.md`, `career-os/docs/adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md`

## 의도 메모

- 시각은 UTC ISO 문자열(`toISOString()`)로, 날짜는 `YYYY-MM-DD` 문자열로 저장한다. 폭이 같아 문자열 비교가 시간 순서와 같다.
- MySQL 의 행 잠금(`FOR UPDATE`)은 옮기지 않는다. 쓰기는 모두 `BEGIN IMMEDIATE` 로 파일 전체를 잠근다. 쓰는 사람이 한 명이다.
- 깨진 파일은 덮어쓰지 않는다. 백업도 하지 않는다. 고치는 방법은 파일을 지우고 다시 쌓는 것이다.
- 분석 정책에 기본값을 넣지 않는다(`career-os/docs/data-schema.md` 의 「DB 기본값을 두지 않는다」). 정책이 없으면 지금처럼 `POLICY_NOT_CONFIGURED` 로 멈춘다.

## 작업 항목

### 1. `career-os/scripts/lib/career-store/errors.ts`

`CareerStoreError(status, code, message)`. `status`, `code` 는 지금 Backend 의 `ApiError` 와 같은 값을 쓰고, 저장소 고유 코드 `CAREER_STORE_BUSY`(503), `CAREER_STORE_CORRUPT`(500)를 더한다.

### 2. `career-os/scripts/lib/career-store/database.ts`

- `resolveCareerStoreRoot(environment)`: `CAREER_WORKSPACE_ROOT` 가 있으면 그 절대 경로, 없으면 `/workspace/career`.
- `openCareerStore(environment)`: `<root>/state/career.sqlite` 를 연다. 폴더가 없으면 만든다. `PRAGMA journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`. 이미 있던 파일은 `PRAGMA integrity_check` 가 `ok` 가 아니거나 열기가 실패하면 `CAREER_STORE_CORRUPT` 로 던진다. `user_version` 이 코드보다 크면 같은 코드로 던진다.
- `migrate(db)`: `BEGIN IMMEDIATE` 로 잠근 뒤 `user_version` 을 다시 읽고 모자란 단계만 적용한다. 두 실행이 동시에 처음 열어도 같은 단계를 두 번 적용하지 않는다.
- `writeTransaction(db, callback)`: `BEGIN IMMEDIATE` 로 열고 성공하면 `COMMIT`, 던지면 `ROLLBACK`. SQLite 의 busy 오류는 `CAREER_STORE_BUSY` 로 바꾼다.
- 프로세스 안에서 같은 경로는 연결 하나를 다시 쓴다. 테스트용 `closeCareerStores()` 를 둔다.

### 3. `career-os/scripts/lib/career-store/ddl.ts`

스키마 1단계의 `CREATE TABLE` 과 유일 키. `study_recommendation_control` 의 단일 행(`history_version = 0`)은 여기서 넣는다. `company_evidence` 의 유일 키는 `(company_key, source_type, url)` 이다(MySQL 은 긴 URL 때문에 `url_hash` 를 썼다).

### 4. `career-os/scripts/lib/career-store/receipts.ts`

`runWithReceipt(db, key, body, status, handler)`. `career-os/services/career-backend/src/common/idempotency/` 의 흐름을 옮긴다. 같은 키와 같은 본문이면 저장한 응답을 돌려주고, 본문이 다르면 `409 IDEMPOTENCY_CONFLICT` 다. Backend 의 「처리 중」 선점 행은 두지 않는다. 실행기 프로세스가 도중에 죽으면 그 행이 남아 같은 명령이 영영 막히기 때문이다. 처리가 끝난 응답만 기록한다. 본문 해시는 `request-hash.ts` 의 `canonicalRequestHash` 를 같은 폴더로 복사해 쓴다.

### 5. `career-os/scripts/lib/career-store/context.ts`

- `readContextDocument(root, key)`: `<root>/context/<key>.md` 를 읽는다. 없거나 공백뿐이면 `409 CANDIDATE_CONTEXT_MISSING`.
- `contextVersion(key, body)`: 본문을 정규화(줄바꿈 LF, 줄끝 공백 제거, 앞뒤 빈 줄 제거)한 뒤 `"<key>:sha256:<hex>"`.

### 6. ADR

ADR-146 과 ADR-118, 121, 131, 134, 138, 142 의 대체 표시, `career-os/docs/adr/INDEX.md` 는 계획과 같은 커밋에서 이미 썼다. 이 phase 에서는 구현이 ADR 의 결정(잠금 시간, 오류 code, 기준 버전 형식)과 같은지만 맞춘다.

### 7. 테스트 `career-os/scripts/lib/career-store/database.test.ts`, `receipts.test.ts`, `context.test.ts`

- 없는 경로에서 열면 파일과 테이블이 생긴다. 다시 열면 그대로다.
- 쓰레기 바이트를 쓴 파일은 `CAREER_STORE_CORRUPT` 로 실패하고 파일 내용이 바뀌지 않는다.
- 다른 연결이 쓰기 잠금을 쥔 동안 `writeTransaction` 은 `CAREER_STORE_BUSY`(테스트는 `busy_timeout` 을 짧게 준다).
- 같은 키 재전송은 handler 를 다시 부르지 않고, 다른 본문은 충돌이다.
- 공백과 줄바꿈만 다른 본문은 같은 기준 버전, 글자가 다르면 다른 버전이다.

## 검증

```bash
bun test ./career-os/scripts/lib/career-store
bunx tsc --noEmit -p .
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/career-store/errors.ts` | 신규 |
| `career-os/scripts/lib/career-store/database.ts` | 신규 |
| `career-os/scripts/lib/career-store/ddl.ts` | 신규 |
| `career-os/scripts/lib/career-store/receipts.ts` | 신규 |
| `career-os/scripts/lib/career-store/request-hash.ts` | 신규 (Backend 에서 복사) |
| `career-os/scripts/lib/career-store/context.ts` | 신규 |
| `career-os/scripts/lib/career-store/database.test.ts` | 신규 |
| `career-os/scripts/lib/career-store/receipts.test.ts` | 신규 |
| `career-os/scripts/lib/career-store/context.test.ts` | 신규 |
