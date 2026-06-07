# Phase 03 — Validation, Deploy Smoke, and Completion

**Model**: haiku
**Status**: pending

---

## 목표

plan054 구현 결과를 검증하고 fos-career 배포 smoke를 통과시킨 뒤 task 상태를 정리한다.

**범위 외**: 새 기능 추가, UI 대규모 재설계, 외부 제출 자동화, career-os 데이터 mutation.

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

run-phases.py는 cwd=workspace로 phase 실행한다. 본 phase는 ai-nodes 루트와 별도 fos-career repo를 함께 참조하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다. Claude Code Bash 도구 cwd 보존으로 후속 bash 명령도 이 기준을 유지한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다:

- `career-os/docs/adr.md` — ADR-054
- `career-os/docs/prd.md` — plan054 scope
- `career-os/docs/flow.md` — workbench flow
- `career-os/tasks/plan054-fos-career-application-workbench/index.json`

---

## 작업 항목 (5)

### 1. fos-career 검증

실행:

```bash
cd /home/bifos/services/fos-career
npx tsc --noEmit
npm run build
```

둘 다 exit 0이어야 한다.

### 2. read-only boundary 검증

실행:

```bash
cd /home/bifos/services/fos-career
rg "writeFile|appendFile|createWriteStream|unlink|rename" lib/career-os app/dashboard/applications || true
```

workbench path에서 career-os file write로 의심되는 코드가 없어야 한다.
fos-career 자체 DB/session/audit write는 이 검사 범위가 아니다.

### 3. container rebuild/restart

기존 fos-career 배포 방식을 확인한 뒤 같은 방식으로 rebuild/restart한다.
service/container 이름은 기존 repo 설정을 따른다.
unknown이면 먼저 `docker compose ps`와 `docker ps --format`으로 확인하고, 임의 새 container를 만들지 않는다.

### 4. HTTP smoke

실행:

```bash
curl -I -sS http://127.0.0.1:16000/ | head -n 1
curl -I -sS http://127.0.0.1:16000/dashboard/applications | head -n 1
curl -I -sS http://127.0.0.1:16000/dashboard/priority | head -n 1
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | rg 'fos-career|NAMES'
```

인증이 필요한 dashboard route는 unauth 307 redirect여도 정상이다.
로그인 세션이 있는 검증 도구가 이미 repo에 있으면 authenticated smoke도 함께 실행한다.

### 5. task 상태와 git 정리

`career-os/tasks/plan054-fos-career-application-workbench/index.json`을 completed로 갱신한다.
phase status도 completed로 맞춘다.
fos-career와 career-os 양쪽에서 intended changes만 commit/push한다.
unrelated dirty file은 stage하지 않는다.

---

## Critical Files

- `/home/bifos/services/fos-career` — 구현/배포 검증 대상 repo
- `career-os/tasks/plan054-fos-career-application-workbench/index.json` — task completion metadata

---

## 검증

보고 직전 반드시 이 bash 블록을 실행하고 raw 결과를 stdout에 남긴다.

```bash
cd /home/bifos/services/fos-career
npx tsc --noEmit
npm run build
curl -I -sS http://127.0.0.1:16000/ | head -n 1
curl -I -sS http://127.0.0.1:16000/dashboard/applications | head -n 1
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | rg 'fos-career|NAMES'
git status --short

cd /home/bifos/ai-nodes/career-os
python3 -m json.tool tasks/plan054-fos-career-application-workbench/index.json >/dev/null
git status --short
```

성공 기준:

- fos-career typecheck/build exit 0.
- `/` returns 200-class or expected successful response.
- protected dashboard routes return expected redirect or authenticated 200.
- container is healthy.
- career-os task index is valid JSON and completed.
- unrelated apartment dirty file is not staged or modified by this task.

---

## Blocked / Failed 조건

반드시 Bash 도구로 직접 실행하라. prose만 출력하면 success로 잘못 처리된다.

- fos-career build가 실패하면 `echo "PHASE_FAILED: fos-career build failed" && exit 1`.
- deploy command가 확인되지 않으면 `echo "PHASE_BLOCKED: fos-career deploy command unclear" && exit 2`.
- smoke에서 container unhealthy면 `echo "PHASE_FAILED: fos-career container unhealthy after deploy" && exit 1`.
- intended files 외 변경이 stage되면 `echo "PHASE_FAILED: unrelated files staged" && exit 1`.

---

## Self-check

- phase-03은 새 기능을 추가하지 않고 검증/배포/상태 정리만 한다.
- run-phases.py trailing `commitSha` 변경이 남으면 별도 cleanup commit으로 정리한다.
- final report에는 fos-career commit, career-os task commit, smoke 결과, 남은 warning을 포함한다.
