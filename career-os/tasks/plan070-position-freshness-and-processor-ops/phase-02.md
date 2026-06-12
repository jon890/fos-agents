# Phase 02 — fos-career host-side processor wrapper 추가

**Model**: sonnet
**Status**: pending

---

## 목표

fos-career의 position/application write processor를 host-side에서 안정적으로 실행할 wrapper를 추가한다.
web container는 career-os read-only mount를 유지하고, 원장 갱신은 host writable checkout에서만 수행한다.

**범위 외**: DB schema 변경, dashboard UI 변경, career-os runner 변경, 실제 pending request 처리, docs/ADR 수정.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트와 fos-career repo를 함께 확인하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-078
- `career-os/docs/flow.md`의 공고 상태 사용자 액션과 Resume Package Flow
- `career-os/docs/code-architecture.md`의 fos-career processor 경계
- `/home/bifos/services/fos-career/docs/deployment.md`
- `/home/bifos/services/fos-career/scripts/run-interview-request-processor.sh`

---

## 작업 항목

### 1. 기존 interview wrapper 패턴 복제

`/home/bifos/services/fos-career/scripts/run-interview-request-processor.sh`의 host-side 패턴을 따른다.
`.env` 로드, lock file, `CAREER_OS_APPLIER_ROOT` 기본값, `DATABASE_URL` host port 보정을 유지한다.

### 2. position action wrapper 추가

`/home/bifos/services/fos-career/scripts/run-position-action-processor.sh`를 추가한다.
기본 lock file은 `/tmp/fos-career-position-action-processor.lock` 계열로 둔다.
실행 명령은 `npm run apply:position-actions -- --limit "${POSITION_ACTION_PROCESSOR_LIMIT:-1}"` 형태로 둔다.

### 3. application action wrapper 추가

`/home/bifos/services/fos-career/scripts/run-application-action-processor.sh`를 추가한다.
기본 lock file은 `/tmp/fos-career-application-action-processor.lock` 계열로 둔다.
실행 명령은 `npm run apply:application-requests -- --limit "${APPLICATION_ACTION_PROCESSOR_LIMIT:-1}"` 형태로 둔다.

### 4. dry-run 검증 경로 보장

wrapper 자체는 real processor를 실행하는 운영 진입점이다.
검증에서는 직접 `npm run apply:* -- --dry-run`을 사용해 pending 0건 또는 dry-run 결과만 확인한다.
실제 pending row가 있으면 real wrapper를 실행하지 않고 PHASE_BLOCKED로 보고한다.

### 5. 운영 discoverability 확인

wrapper 이름과 사용법은 script `--help` 또는 wrapper 상단 변수명만으로 파악 가능해야 한다.
fos-career deployment 문서 보강이 필요하다고 판단되면 구현을 멈추지 말고 phase 보고의 follow-up으로 남긴다.
본 phase에서는 career-os docs/ADR/정책 문서를 수정하지 않는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `/home/bifos/services/fos-career/scripts/run-position-action-processor.sh` | 신규 |
| `/home/bifos/services/fos-career/scripts/run-application-action-processor.sh` | 신규 |
| `/home/bifos/services/fos-career/scripts/run-interview-request-processor.sh` | 필요 시 공통 패턴 보정만 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

bash -n /home/bifos/services/fos-career/scripts/run-position-action-processor.sh
bash -n /home/bifos/services/fos-career/scripts/run-application-action-processor.sh

cd /home/bifos/services/fos-career
set -a
[ -f .env ] && . ./.env
set +a
export DATABASE_URL="${DATABASE_URL/@bifos-db:3306/@127.0.0.1:13306}"
export CAREER_OS_APPLIER_ROOT="${CAREER_OS_APPLIER_ROOT:-/home/bifos/ai-nodes/career-os}"

npm run apply:position-actions -- --dry-run --limit 5
npm run apply:application-requests -- --dry-run --limit 5

git -C /home/bifos/services/fos-career diff --check
git -C /home/bifos/services/fos-career status --short
git -C /home/bifos/ai-nodes/career-os status --short
```

---

## 성공 기준

- 두 wrapper가 syntax check를 통과한다.
- host-side DB 보정 후 dry-run processor가 DB 연결 오류 없이 실행된다.
- web container의 career-os mount는 read-only 상태로 유지된다.
- 실제 pending request가 있으면 처리하지 않고 보고한다.
- docs/ADR/정책 문서는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- pending position/application request가 있어 dry-run 검증과 real 처리 판단이 섞인다.
- DB host/port 보정 값이 현재 운영 환경과 다르다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- wrapper가 `bifos-db` host 보정을 하지 않아 host-side 실행에서 DB 연결이 실패한다.
- wrapper가 `CAREER_OS_APPLIER_ROOT` 기본값을 writable checkout으로 잡지 않는다.
- wrapper가 web container 안 실행을 전제로 한다.
- `bash -n`, dry-run processor, `git diff --check` 중 하나가 실패한다.
