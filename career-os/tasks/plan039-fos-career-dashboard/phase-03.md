# Phase 03 — 관리자 인증 및 MySQL 스키마/마이그레이션

**Model**: sonnet
**Status**: pending

---

## 목표

MySQL 스키마(admin 관련 테이블 4개)를 정의하고, 관리자 ID/password 인증 흐름과 세션 미들웨어를 구현한다.

**범위 외**: LLM 채팅 테이블(llm_chat_sessions, llm_chat_messages)은 phase-04에서 추가한다.
이 phase에서 MySQL 마이그레이션을 실제 DB에 적용하지 않는다 — 스키마 파일과 코드만 작성한다.
실제 DB 연결 검증은 Docker 구성 완료 후 phase-05에서 한다.
career-os 파일을 수정하지 않는다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md` — ADR-046
- `career-os/docs/data-schema.md` — fos-career MySQL 스키마 섹션 (admin_users, sessions, audit_logs, action_history)

---

## 작업 항목

### 1. Drizzle ORM 스키마 (`db/schema.ts`)

`~/services/fos-career/db/schema.ts`를 작성한다.

아래 4개 테이블을 정의한다. 타입과 제약은 docs/data-schema.md의 fos-career MySQL 스키마 섹션을 단일 출처로 한다.

**admin_users**:
- `id`: int auto-increment primary key
- `username`: varchar(64) unique not null
- `passwordHash`: varchar(255) not null
- `createdAt`: datetime not null default now()
- `lastLoginAt`: datetime nullable

**sessions**:
- `id`: varchar(128) primary key (UUID)
- `adminUserId`: int not null references admin_users(id) on delete cascade
- `expiresAt`: datetime not null
- `createdAt`: datetime not null default now()
- `ipAddress`: varchar(45) nullable

**auditLogs**:
- `id`: bigint auto-increment primary key
- `adminUserId`: int nullable references admin_users(id) on delete set null
- `action`: varchar(128) not null
- `resource`: varchar(128) nullable
- `resourceId`: varchar(255) nullable
- `detailsJson`: json nullable
- `createdAt`: datetime not null default now()

**actionHistory**:
- `id`: bigint auto-increment primary key
- `adminUserId`: int not null references admin_users(id)
- `actionType`: varchar(64) not null
- `payloadJson`: json nullable
- `status`: enum('pending','done','failed') not null default 'pending'
- `createdAt`: datetime not null default now()

### 2. Drizzle 설정 파일 (`drizzle.config.ts`)

`~/services/fos-career/drizzle.config.ts`를 작성한다.

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
```

### 3. DB 클라이언트 싱글턴 (`lib/db/client.ts`)

`~/services/fos-career/lib/db/client.ts`를 작성한다.

- `mysql2`와 `drizzle-orm`을 사용해 DB 연결 싱글턴을 만든다.
- 연결 설정은 `DATABASE_URL` 환경 변수에서만 읽는다.
- `process.env.DATABASE_URL`이 미설정이면 런타임 에러가 명확하게 표시되도록 한다.

### 4. 세션 헬퍼 (`lib/db/session.ts`)

`~/services/fos-career/lib/db/session.ts`를 작성한다.

iron-session 설정:

- 쿠키 이름: `fos_career_session`
- 암호화 키: `SESSION_SECRET` 환경 변수
- `maxAge`: 86400 (24시간)
- `secure`: `process.env.NODE_ENV === 'production'`

export 함수:

- `getSession(req, res)` — iron-session 세션 객체 반환
- `createSession(userId: number, ipAddress?: string)` — sessions 테이블에 레코드 저장 + 쿠키 설정
- `validateSession(sessionId: string)` — sessions 테이블 조회 + 만료 검사
- `destroySession(sessionId: string)` — sessions 테이블에서 레코드 삭제

### 5. 로그인 API (`app/api/auth/login/route.ts`)

- POST body: `{ username: string, password: string }`
- admin_users 테이블에서 username 조회
- `bcryptjs.compare`로 password 검증
- 성공 시: `crypto.randomUUID()` 세션 ID 생성 → sessions 테이블 저장 → iron-session 쿠키 설정 → 200 반환
- 실패 시: 401 반환 (성공/실패 구분 없는 메시지)
- audit_logs에 `auth.login_success` 또는 `auth.login_failure` 기록

### 6. 로그아웃 API (`app/api/auth/logout/route.ts`)

- POST 요청
- sessions 테이블에서 세션 삭제
- iron-session 쿠키 삭제
- audit_logs에 `auth.logout` 기록
- 200 반환

### 7. 인증 미들웨어 (`middleware.ts`)

- 보호 경로: `/dashboard/**`, `/api/chat/**`
- 세션 쿠키가 없거나 만료됐으면 `/login`으로 redirect
- `app/api/auth/**`는 미들웨어 적용 대상에서 제외

### 8. 로그인 페이지 (`app/(auth)/login/page.tsx`)

- username, password 입력 폼
- 클라이언트 컴포넌트 (`'use client'`)
- `/api/auth/login`으로 POST
- 성공 시 `router.push('/dashboard')` 이동
- 실패 시 "로그인에 실패했습니다" 에러 메시지 표시

### 9. 관리자 계정 시드 스크립트 (`db/seed-admin.ts`)

`~/services/fos-career/db/seed-admin.ts`를 작성한다.

- `ADMIN_USERNAME`, `ADMIN_PASSWORD_PLAIN` 환경 변수를 읽는다.
- 같은 username이 이미 있으면 skip하고 "already exists" 로그를 남긴다.
- bcrypt hash(round 12) 후 admin_users에 insert한다.

실행 방법 (phase-05 배포 가이드에서 참조):

```bash
# Docker 환경
docker compose exec fos-career \
  ADMIN_USERNAME=admin ADMIN_PASSWORD_PLAIN=yourpassword \
  bun db/seed-admin.ts

# 로컬 개발 환경 (DATABASE_URL을 .env에서 읽는다)
ADMIN_USERNAME=admin ADMIN_PASSWORD_PLAIN=yourpassword bun db/seed-admin.ts
```

---

## 검증

보고 직전 반드시 실행한다.

```bash
cd ~/services/fos-career

# TypeScript 타입 확인
pnpm tsc --noEmit

# 파일 존재 확인
ls db/schema.ts
ls drizzle.config.ts
ls lib/db/client.ts
ls lib/db/session.ts
ls app/api/auth/login/route.ts
ls app/api/auth/logout/route.ts
ls middleware.ts
ls "app/(auth)/login/page.tsx"
ls db/seed-admin.ts

# 스키마에 4개 테이블 포함 확인
grep -q "admin_users\|adminUsers" db/schema.ts
grep -q "sessions" db/schema.ts
grep -q "audit_logs\|auditLogs" db/schema.ts
grep -q "action_history\|actionHistory" db/schema.ts
```

## Blocked 조건

- phase-02가 완료되지 않아 `~/services/fos-career/lib/career-os/adapter.ts`가 없으면 `PHASE_BLOCKED: phase-02 not complete`를 출력하고 exit 2.
- `pnpm tsc --noEmit`이 에러를 반환하면 `PHASE_FAILED: TypeScript type check failed`를 출력하고 exit 1.
- `SESSION_SECRET`나 `DATABASE_URL`이 코드에 하드코딩되면 `PHASE_FAILED: secrets must not be hardcoded`를 출력하고 exit 1.
- career-os 파일에 쓰기 작업이 추가되면 `PHASE_FAILED: must not write to career-os files`를 출력하고 exit 1.
