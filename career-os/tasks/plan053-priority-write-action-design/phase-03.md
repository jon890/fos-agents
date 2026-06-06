# Phase 03 — Integration validation and task completion

**Model**: haiku
**Status**: completed

---

## 목표

plan053의 pending request queue와 controlled applier가 read-only mount 경계를 유지하는지 통합 검증하고 task를 완료 처리한다.
검증은 destructive DB operation이나 실제 priority mutation 없이 수행한다.

**범위 외**: production priority request apply, external job submission, candidate-profile 수정, fos-study 발행.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 bash에서 repo root로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md` — ADR-053
- `career-os/docs/data-schema.md` — priority action request schema
- `career-os/docs/flow.md` — request/apply/recovery flow
- `career-os/docs/code-architecture.md` — bridge boundary
- `career-os/tasks/plan053-priority-write-action-design/index.json`

---

## 작업 항목

### 1. docs와 task 정합성 확인

ADR-053, PRD, data schema, flow, code architecture가 같은 결정을 가리키는지 확인한다.
중복 본문이 과하게 늘어난 경우 포인터 중심으로 줄인다.

### 2. career-os validation 실행

application-agent schema와 priority command가 깨지지 않았는지 확인한다.

### 3. fos-career validation 실행

fos-career build와 migration 파일 존재, read-only mount 유지, pending API auth boundary를 확인한다.

### 4. no direct write grep

fos-career 코드가 `frontdoor-queue.jsonl`, `ledger.jsonl`, `_priority-history.jsonl`에 write API를 호출하지 않는지 grep한다.
read-only adapter read path는 허용한다.

### 5. task status 완료 처리

검증이 모두 통과하면 `career-os/tasks/plan053-priority-write-action-design/index.json`을 `completed`로 갱신한다.
실패하면 status를 완료로 바꾸지 않는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan053-priority-write-action-design/index.json` | 완료 상태 갱신 |
| `career-os/docs/*` | 검증 중 발견된 작은 drift만 수정 |

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd career-os
bun --check scripts/application-agent/run.ts
CAREER_OS_RUNTIME_ROOT="${CAREER_OS_RUNTIME_ROOT:-$HOME/ai-nodes/career-os}"
bun scripts/application-agent/run.ts validate --ledger "$CAREER_OS_RUNTIME_ROOT/data/applications/ledger.jsonl"
git diff --check
```

fos-career 검증:

```bash
FOS_CAREER_ROOT="${FOS_CAREER_ROOT:-$HOME/services/fos-career}"
cd "$FOS_CAREER_ROOT"
npm run build
git diff --check
rg -n "writeFile|appendFile|frontdoor-queue\\.jsonl|ledger\\.jsonl|_priority-history\\.jsonl" app lib db
git status --short
```

Mount 검증:

```bash
FOS_CAREER_ROOT="${FOS_CAREER_ROOT:-$HOME/services/fos-career}"
cd "$FOS_CAREER_ROOT"
rg -n "/data/career-os:ro|CAREER_OS_ROOT" docker-compose.yml docker-compose.override.yml.example docs/deployment.md
```

Staging self-check:

```bash
git diff --cached --name-only
git status --short
```

---

## 의도 메모

- plan053은 mutation을 가능하게 하기보다 mutation 경계를 검증 가능하게 만드는 plan이다.
- 첫 배포는 pending request creation까지만 해도 충분히 안전한 가치가 있다.
- 실제 apply는 explicit runner와 stale guard 검증 뒤 별도 운영한다.

## Blocked 조건

- fos-career build가 실패하면 `PHASE_FAILED: fos-career build failed`를 출력하고 exit 1.
- fos-career에서 career-os JSONL direct write path가 발견되면 `PHASE_FAILED: direct career-os write path found in fos-career`를 출력하고 exit 1.
- read-only mount가 사라졌거나 writable mount가 필요해졌으면 `PHASE_BLOCKED: read-only career-os mount boundary broken`을 출력하고 exit 2.
- 실제 production priority mutation 없이는 검증할 수 없는 상태라면 `PHASE_BLOCKED: integration requires unsafe production mutation`을 출력하고 exit 2.
