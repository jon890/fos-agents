# Phase 01. 추천 상태 Backend와 position schema

**Execution profile**: deep

## 목표

`career-os`가 소유하는 Bun HTTP Backend의 공통 경계와 versioned MySQL migration을 만들고,
포지션 수집·분석·추천 상태를 분리한 schema를 검증한다.

**범위 외**: 홈서버 database 생성과 container 배포, `fos-blog` 변경, 운영 DB migration 실행은 다른 저장소 작업이 담당한다.

## 컨텍스트

저장소는 Bun, TypeScript와 Zod를 이미 사용한다.
Bun은 MySQL 연결, prepared statement, connection pool과 transaction을 제공하므로 새 ORM과 외부 queue를 추가하지 않는다.
Backend만 DB 자격증명을 받고 skill과 cron에는 API URL과 Bearer token만 제공한다.

**근거 문서**: `docs/code-architecture.md`의 「추천 상태 Backend」,
`docs/data-schema.md`의 「포지션 분석 정책」과 「공고별 분석 이력」,
`docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md`

## 의도 메모

- Backend 코드, HTTP 계약과 migration은 `career-os`가 소유한다.
- 공고의 안정적인 식별자, 공고 version, 개인 분석과 추천 실행을 별도 table에 둔다.
- 실제 운영 database와 계정은 이 phase에서 만들지 않는다.
- migration은 적용 순서와 checksum을 기록하며 이미 적용된 파일 변경을 거부한다.
- token, connection URL과 SQL 오류 전문을 응답이나 로그에 남기지 않는다.

## 작업 항목

### 1. Backend 공통 실행 경계 추가

`services/recommendation-api/server.ts`에 `Bun.serve` 진입점을 추가한다.
`services/recommendation-api/config.ts`는 `CAREER_RECOMMENDATION_DATABASE_URL`,
`CAREER_RECOMMENDATION_API_TOKEN`, host, port와 요청 본문 상한을 Zod로 검증한다.
운영 기본 host는 모든 interface가 아니라 loopback으로 둔다.

`services/recommendation-api/http/`에 Bearer 인증, JSON 요청 검증, `Cache-Control: no-store`,
공통 오류 응답과 request ID를 구현한다.
계약 오류는 `400`, 인증 실패는 `401`, 멱등 충돌과 version 충돌은 `409`, DB 연결 실패는 `503`으로 반환한다.

### 2. Bun.SQL repository와 transaction helper 추가

`services/recommendation-api/db/connection.ts`는 주입받은 `Bun.SQL` client를 사용하고 module import 시 연결하지 않는다.
repository는 parameterized query만 사용한다.
transaction helper는 callback이 실패하면 전체를 rollback하고 원본 SQL 오류를 HTTP 응답에 포함하지 않는다.

테스트는 MySQL 없이 fake repository와 계약 테스트를 실행할 수 있어야 한다.
실제 MySQL 통합 테스트는 명시적인 테스트 URL이 있을 때만 실행하고 없으면 skip 사유를 출력한다.

### 3. versioned migration runner와 position schema 추가

`services/recommendation-api/migrations/`에 migration 기록 table과 초기 schema SQL을 추가한다.
초기 migration은 `docs/data-schema.md`에 적힌 다음 table을 만든다.

- `position_sources`
- `position_collection_runs`
- `position_source_run_diagnostics`
- `positions`
- `position_versions`
- `position_collection_items`
- `position_analysis_policy`
- `company_preferences`
- `position_analysis_runs`
- `position_analysis_run_items`
- `position_analyses`
- `position_recommendation_runs`
- `position_recommendation_items`
- `request_receipts`

foreign key, UNIQUE와 삭제 규칙은 문서와 일치시킨다.
`position_versions`에는 주관적인 점수와 추천 이유를 넣지 않는다.
JSON column은 상세 snapshot과 근거처럼 형태가 확장될 값에만 사용한다.

`services/recommendation-api/migrate.ts`는 `status`와 `up`만 제공한다.
자동 down migration과 database 생성은 제공하지 않는다.

### 4. 멱등 요청 저장 계약 추가

쓰기 요청은 `Idempotency-Key`와 canonical request hash를 저장한다.
같은 key와 같은 hash는 저장된 status와 응답을 반환하고,
같은 key에 다른 hash를 보내면 `409 IDEMPOTENCY_CONFLICT`를 반환한다.
처리 중인 요청이 있으면 새 transaction을 시작하지 않는다.

### 5. Backend 공통 계약과 migration 테스트

인증 누락, 잘못된 JSON, 본문 상한, 멱등 재시도와 충돌, transaction rollback을 테스트한다.
migration 파일 순서, checksum 변경 거부, 모든 table과 UNIQUE·foreign key·삭제 규칙을 정적 검사한다.
환경값과 오류 응답에 token과 database URL이 노출되지 않는지 검사한다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/services/recommendation-api
bunx tsc --noEmit
git diff --check
```

MySQL 통합 테스트 환경이 없을 때도 단위 테스트와 migration 정적 검사는 통과해야 한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/recommendation-api/server.ts` | 신규 |
| `services/recommendation-api/config.ts` | 신규 |
| `services/recommendation-api/http/*.ts` | 신규 |
| `services/recommendation-api/db/*.ts` | 신규 |
| `services/recommendation-api/migrations/*.sql` | 신규 |
| `services/recommendation-api/migrate.ts` | 신규 |
| `services/recommendation-api/**/*.test.ts` | 신규 |
