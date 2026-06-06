# Phase 01 — fos-career 저장소 계약 및 스캐폴드 경계 정의

**Model**: sonnet
**Status**: pending

---

## 목표

`~/services/fos-career` 저장소를 생성하고 Next.js 프로젝트 스캐폴드와 패키지 의존성 계약을 확정한다.

**범위 외**: 실제 라우트 구현, 데이터 어댑터, 인증, LLM 채팅, Docker 설정은 다음 phase에서 한다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 경로를 사용하므로 첫 bash에서 ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md` — ADR-046
- `career-os/docs/code-architecture.md` — Planned: fos-career 웹 대시보드 섹션
- `career-os/tasks/plan039-fos-career-dashboard/index.json`

---

## 작업 항목

### 1. 사전 안전 검사

다음 검사를 순서대로 실행하고, 실패하면 즉시 중단한다.

```bash
# ~/services 디렉터리 준비
mkdir -p ~/services

# fos-career가 이미 존재하면 중단
if [ -d ~/services/fos-career ]; then
  echo "PHASE_BLOCKED: ~/services/fos-career already exists. Review manually before proceeding."
  exit 2
fi

# Node.js 18+ 확인
node_ver=$(node -e "process.exit(parseInt(process.version.slice(1)) < 18 ? 1 : 0)" 2>/dev/null && echo ok)
[ "$node_ver" = "ok" ] || { echo "PHASE_BLOCKED: node 18+ required"; exit 2; }

# pnpm 또는 npm 확인
pnpm --version 2>/dev/null || npm --version || { echo "PHASE_BLOCKED: neither pnpm nor npm found"; exit 2; }
```

### 2. Next.js 프로젝트 생성

패키지 선택 근거:

- **Next.js 15 App Router** — 서버 컴포넌트로 career-os 파일을 서버 사이드에서만 읽음. 클라이언트에 raw 파일 내용이 노출되지 않음.
- **TypeScript** — career-os 스키마와 타입 공유 가능.
- **Tailwind CSS** — 빠른 UI 구성.
- **pnpm** — 우선 사용. 없으면 npm 사용.

```bash
cd ~/services

# pnpm이 있으면 pnpm, 없으면 npm 사용
if command -v pnpm &>/dev/null; then
  pnpm create next-app fos-career \
    --typescript \
    --tailwind \
    --app \
    --no-eslint \
    --no-src-dir \
    --import-alias "@/*" \
    --use-pnpm
else
  npm create next-app@latest fos-career \
    --typescript \
    --tailwind \
    --app \
    --no-eslint \
    --no-src-dir \
    --import-alias "@/*"
fi
```

### 3. 추가 의존성 설치

```bash
cd ~/services/fos-career

if command -v pnpm &>/dev/null; then
  pnpm add mysql2 drizzle-orm bcryptjs iron-session @anthropic-ai/sdk
  pnpm add -D drizzle-kit @types/bcryptjs
else
  npm install mysql2 drizzle-orm bcryptjs iron-session @anthropic-ai/sdk
  npm install --save-dev drizzle-kit @types/bcryptjs
fi
```

### 4. 디렉터리 구조 초기화

```bash
cd ~/services/fos-career
mkdir -p lib/career-os lib/db db/migrations
mkdir -p "app/(auth)/login"
mkdir -p app/dashboard/positions
mkdir -p app/dashboard/applications
mkdir -p app/api/auth/login
mkdir -p app/api/auth/logout
mkdir -p app/api/chat
mkdir -p docs
```

### 5. .env.example 생성

```bash
cat > ~/services/fos-career/.env.example << 'EOF'
# career-os 읽기 전용 마운트 경로
# Docker 환경: /data/career-os
# 로컬 개발: /home/bifos/ai-nodes/career-os
CAREER_OS_ROOT=

# MySQL 연결 (Drizzle ORM)
DATABASE_URL=mysql://fos_career_user:password@localhost:3306/fos_career

# 관리자 세션 암호화 키 (32자 이상 랜덤 문자열)
SESSION_SECRET=

# Anthropic API 키 (LLM 채팅용)
ANTHROPIC_API_KEY=

# Next.js 서버 포트
PORT=3000

# MySQL 서비스 비밀번호 (docker-compose MySQL 서비스와 일치)
MYSQL_ROOT_PASSWORD=
MYSQL_PASSWORD=

# 관리자 계정 초기 설정용 (seed 스크립트 1회 실행 시 사용)
ADMIN_USERNAME=
ADMIN_PASSWORD_PLAIN=
EOF
```

### 6. .gitignore 확인 및 보완

create-next-app이 생성한 `.gitignore`에 누락된 항목을 추가한다.

```bash
cd ~/services/fos-career
grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
grep -q "\.env\.local" .gitignore || echo ".env.local" >> .gitignore
grep -q "db/data" .gitignore || echo "db/data/" >> .gitignore
```

### 7. 초기 git 커밋

create-next-app이 git init을 수행하지 않았으면 직접 수행한다.

```bash
cd ~/services/fos-career
git log --oneline -1 2>/dev/null || git init
git add .
git status --short
git commit -m "chore: initial Next.js scaffold for fos-career dashboard"
```

---

## 검증

보고 직전 반드시 실행한다.

```bash
# 디렉터리 및 파일 구조 확인
ls ~/services/fos-career/package.json
ls ~/services/fos-career/.env.example
ls ~/services/fos-career/app/
ls ~/services/fos-career/lib/

# 필수 의존성 확인
cd ~/services/fos-career
grep '"mysql2"' package.json
grep '"drizzle-orm"' package.json
grep '"iron-session"' package.json
grep '"@anthropic-ai/sdk"' package.json
grep '"drizzle-kit"' package.json

# TypeScript 컴파일 확인 (경고는 허용, 에러만 체크)
pnpm tsc --noEmit 2>&1 | grep -v "^$" | head -20 || true
```

## Blocked 조건

- `~/services/fos-career`가 이미 존재하면 `PHASE_BLOCKED: ~/services/fos-career already exists`를 출력하고 exit 2.
- `node` 18+ 가 없으면 `PHASE_BLOCKED: node 18+ required`를 출력하고 exit 2.
- create-next-app이 실패하면 `PHASE_FAILED: create-next-app failed`를 출력하고 exit 1.
- 의존성 설치가 실패하면 `PHASE_FAILED: dependency install failed`를 출력하고 exit 1.
