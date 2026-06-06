# Phase 05 — Docker/홈서버 배포 가이드, env 템플릿, 검증 및 완료 체크

**Model**: haiku
**Status**: pending

---

## 목표

Docker 이미지, docker-compose.yml, 홈서버 배포 가이드, 최종 env 템플릿을 작성하고 plan039 전체 완료 체크를 수행한다.

**범위 외**:

- 실제 서버 배포 실행, DNS 설정, 역방향 프록시 설정 변경은 이 phase에서 하지 않는다.
- 배포 가이드 문서만 작성한다.
- ai-nodes/career-os 파일을 수정하지 않는다.
  - 단, `career-os/tasks/plan039-fos-career-dashboard/index.json`의 status 필드만 갱신한다.

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
- `career-os/tasks/plan039-fos-career-dashboard/index.json`

---

## 작업 항목

### 1. Dockerfile 생성 (`~/services/fos-career/Dockerfile`)

멀티 스테이지 빌드. base: `node:20-alpine`.

스테이지:

1. `deps` — 의존성 설치 (`pnpm install --frozen-lockfile`)
2. `builder` — `pnpm run build`
3. `runner` — 빌드 산출물만 복사. non-root 사용자(`nextjs` 1001:1001)로 실행.

환경 변수:

- `CAREER_OS_ROOT`는 이미지에 하드코딩하지 않는다. `docker-compose.yml`에서 주입.
- `NODE_ENV=production`

포트: `EXPOSE 3000`

### 2. docker-compose.yml 생성 (`~/services/fos-career/docker-compose.yml`)

서비스 2개:

**fos-career** 서비스:
- build context: `.` (현재 디렉터리)
- ports: `"3000:3000"`
- volumes: `./career-os-data:/data/career-os:ro` (읽기 전용 career-os 마운트)
- environment: `CAREER_OS_ROOT=/data/career-os`
- 나머지 env는 `.env` 파일에서 로드 (`env_file: .env`)
- depends_on: mysql

**mysql** 서비스:
- image: `mysql:8.0`
- volumes: `./db/data:/var/lib/mysql`
- environment: `MYSQL_DATABASE=fos_career`, `MYSQL_USER=fos_career_user`
- env_file: .env (MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD)

네트워크: `fos-career-network` 브리지.

### 3. docker-compose.override.yml.example 생성

`~/services/fos-career/docker-compose.override.yml.example`을 작성한다.

실제 career-os 경로를 host-path로 바인딩하는 예시:

```yaml
services:
  fos-career:
    volumes:
      # 실제 career-os 경로로 교체
      - /home/bifos/ai-nodes/career-os:/data/career-os:ro
```

이 파일을 복사해 `docker-compose.override.yml`로 저장하고 경로를 수정한다.

### 4. .env.example 최종 확인

phase-01에서 만든 `.env.example`에 모든 필요 항목이 있는지 확인한다.
누락 항목이 있으면 추가한다.

필수 항목 체크리스트:

- `CAREER_OS_ROOT`
- `DATABASE_URL`
- `SESSION_SECRET`
- `ANTHROPIC_API_KEY`
- `PORT`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_PASSWORD`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_PLAIN`

### 5. 배포 가이드 작성 (`~/services/fos-career/docs/deployment.md`)

아래 내용을 담는다.

1. **전제조건** — Docker, Docker Compose, 홈서버 환경
2. **초기 설정**:
   - `docker-compose.override.yml.example`을 복사해 `docker-compose.override.yml` 생성 후 career-os 경로 수정
   - `.env.example`을 복사해 `.env` 생성 후 모든 항목 채우기
3. **최초 실행**: `docker compose up -d`
4. **MySQL 마이그레이션**: `docker compose exec fos-career pnpm drizzle-kit push`
5. **관리자 계정 생성**: `docker compose exec fos-career bun db/seed-admin.ts` (ADMIN_USERNAME, ADMIN_PASSWORD_PLAIN 환경 변수 필요)
6. **역방향 프록시 설정** — 기존 npm/Node 웹서버에서 `localhost:3000`으로 라우팅하는 방법 예시
7. **로그 확인**: `docker compose logs -f fos-career`
8. **업데이트**: `docker compose build --no-cache && docker compose up -d`
9. **백업** — `./db/data/` 디렉터리

### 6. plan039 완료 체크

```bash
cd ~/services/fos-career

# 배포 파일 존재 확인
ls Dockerfile
ls docker-compose.yml
ls docker-compose.override.yml.example
ls .env.example
ls docs/deployment.md

# TypeScript 최종 타입 확인
pnpm tsc --noEmit

# out_of_scope 위반 검사: 외부 제출 코드 없음
grep -rn "submit_application\|automate_site\|login_to_site" app/ lib/ 2>/dev/null \
  && echo "WARNING: forbidden action pattern found" \
  || echo "OK: no forbidden action patterns"

# career-os 어댑터 읽기 전용 최종 확인
grep -n "writeFile\|appendFile\|fs\.write" lib/career-os/adapter.ts 2>/dev/null \
  && echo "PHASE_FAILED: write in career-os adapter" \
  || echo "OK: adapter is read-only"

# .env가 git staging에 없음 확인
cd ~/services/fos-career
git diff --cached --name-only | grep -E "^\.env$|^\.env\." \
  && echo "PHASE_FAILED: .env staged for commit" \
  || echo "OK: .env not staged"

# secrets 하드코딩 없음
grep -rn "sk-ant-\|ANTHROPIC_API_KEY=[^$]" app/ lib/ 2>/dev/null | grep -v ".example" \
  && echo "WARNING: possible hardcoded secret" \
  || echo "OK: no hardcoded secrets"

echo "plan039 phase-05 completion check done"
```

### 7. plan039 index.json 완료 상태 갱신

`career-os/tasks/plan039-fos-career-dashboard/index.json`의 `status`를 `"completed"`, `current_phase`를 `5`로 갱신한다.

---

## 검증

보고 직전 반드시 실행한다.

```bash
cd ~/services/fos-career
pnpm tsc --noEmit
ls Dockerfile docker-compose.yml .env.example docs/deployment.md

# ai-nodes로 돌아와 index.json 검증
cd "$(git rev-parse --show-toplevel)"
python3 -m json.tool career-os/tasks/plan039-fos-career-dashboard/index.json > /dev/null \
  && echo "OK: index.json valid JSON" \
  || echo "PHASE_FAILED: index.json invalid"
```

## Blocked 조건

- phase-04가 완료되지 않아 `~/services/fos-career/app/dashboard/chat/page.tsx`가 없으면 `PHASE_BLOCKED: phase-04 not complete`를 출력하고 exit 2.
- `pnpm tsc --noEmit`이 에러를 반환하면 `PHASE_FAILED: TypeScript type check failed`를 출력하고 exit 1.
- `.env`가 git staging area에 포함되면 `PHASE_FAILED: .env must not be committed`를 출력하고 exit 1.
