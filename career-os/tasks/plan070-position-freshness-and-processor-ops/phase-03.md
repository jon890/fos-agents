# Phase 03 — 통합 검증과 plan 완료

**Model**: haiku
**Status**: pending

---

## 목표

plan070의 runner refresh와 host-side processor wrapper가 함께 동작하는지 검증하고, task 상태를 완료로 정리한다.

**범위 외**: 새 기능 추가, 추천 알고리즘 변경, dashboard UI 변경, 실제 지원 제출, docs/ADR 수정.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-078
- `career-os/docs/flow.md`의 position daily와 공고 상태 사용자 액션 흐름
- `career-os/docs/code-architecture.md`의 runner/processor 경계
- `career-os/tasks/plan070-position-freshness-and-processor-ops/phase-01.md`
- `career-os/tasks/plan070-position-freshness-and-processor-ops/phase-02.md`

---

## 작업 항목

### 1. task index 상태 확인

`career-os/tasks/plan070-position-freshness-and-processor-ops/index.json`이 valid JSON인지 확인한다.
phase 1과 phase 2가 완료 상태인지 확인한다.
완료 상태가 아니면 PHASE_BLOCKED로 보고한다.

### 2. career-os 통합 검증

runner와 application-agent helper의 type check를 실행한다.
frontdoor queue schema와 ledger schema를 검증한다.
현재 runtime recommendation 기준으로 queue builder temp 검증을 반복한다.

### 3. fos-career 검증

fos-career wrapper syntax check를 실행한다.
host-side DB 보정 후 position/application processor dry-run을 실행한다.
fos-career typecheck 또는 build를 실행한다.

### 4. 운영 경계 확인

`docker inspect fos-career-app`로 career-os mount가 read-only인지 확인한다.
`docker ps`에서 `bifos-db` host port가 `127.0.0.1:13306`으로 열려 있는지 확인한다.

### 5. index 완료 처리

검증이 끝나면 `index.json`의 `status`, `current_phase`, phase statuses, `updated_at`을 완료 상태로 갱신한다.
phase 실행 harness가 commitSha를 후기록할 수 있으므로 마지막에 working tree 상태를 보고한다.

### 6. final commit과 push

career-os repo에서 plan070 task 상태 변경만 stage해 `task(career-os): plan070 실행 완료 기록`으로 commit한다.
fos-career repo에 unpushed phase 2 commit이 있으면 함께 push한다.
career-os repo도 push한다.
unrelated apartment 변경은 stage하지 않는다.

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

python3 -m json.tool career-os/tasks/plan070-position-freshness-and-processor-ops/index.json >/tmp/plan070-index.json

bun --check career-os/scripts/position-recommender/run_daily_with_claude.ts
bun --check career-os/scripts/application-agent/frontdoor_queue_builder.ts
bun --check career-os/scripts/application-agent/priority_recommendation.ts
bun career-os/scripts/application-agent/frontdoor_queue_schema.ts career-os/data/runtime/application-agent/frontdoor-queue.jsonl
bun career-os/scripts/application-agent/run.ts validate

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
npx tsc --noEmit

cd /home/bifos/ai-nodes
docker inspect fos-career-app --format '{{json .Mounts}}' | python3 -m json.tool | tee /tmp/plan070-fos-career-mounts.json
rg -n '"RW": false|"Destination": "/data/career-os"' /tmp/plan070-fos-career-mounts.json
docker ps --format '{{.Names}}\t{{.Ports}}' | rg 'bifos-db.*127\\.0\\.0\\.1:13306'

git -C career-os diff --check
git -C /home/bifos/services/fos-career diff --check
git -C career-os status --short
git -C /home/bifos/services/fos-career status --short
```

---

## 성공 기준

- phase 1과 phase 2가 완료 상태다.
- career-os runner/helper 검증이 통과한다.
- fos-career wrapper와 processor dry-run 검증이 통과한다.
- web container read-only mount가 유지된다.
- `index.json`이 completed로 정리된다.
- career-os task 완료 기록이 commit/push된다.
- fos-career wrapper commit이 push된다.
- docs/ADR/정책 문서는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- phase 1 또는 phase 2가 완료되지 않았다.
- pending request가 있어 dry-run 검증과 real 처리 판단이 섞인다.
- docker health나 mount 확인이 현재 환경에서 불가능하고 운영 결론에 영향을 준다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- 검증 명령을 실행하지 않고 성공 처리했다.
- web container가 writable career-os mount를 사용한다.
- `index.json`이 invalid JSON이거나 completed 상태로 정리되지 않았다.
- 완료 기록 또는 wrapper commit이 push되지 않았다.
- docs/ADR/정책 문서를 수정했다.
- `git diff --check`가 실패한다.
