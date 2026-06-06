# Phase 01 — fos-career pending priority request queue

**Model**: sonnet
**Status**: pending

---

## 목표

fos-career priority detail 화면에서 사용자가 확정한 priority 변경을 career-os에 직접 쓰지 않고, fos-career MySQL pending queue에만 저장한다.
이 phase는 안전한 요청 생성까지가 목표이며 career-os JSONL 파일은 수정하지 않는다.

**범위 외**: career-os `frontdoor-queue.jsonl`, `ledger.jsonl`, `_priority-history.jsonl` mutation, writable mount 추가, external job site action, LLM chat mutation, candidate-profile 수정.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes repo root와 fos-career repo를 함께 확인하므로 첫 bash에서 repo root로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md` — ADR-053
- `career-os/docs/prd.md` — priority write-action bridge
- `career-os/docs/data-schema.md` — `priority_action_requests`
- `career-os/docs/flow.md` — request creation flow
- `career-os/docs/code-architecture.md` — fos-career read-only mount boundary
- `career-os/tasks/plan053-priority-write-action-design/index.json`

fos-career repo에서는 다음을 확인한다.

- `AGENTS.md`
- `docs/deployment.md`
- `db/schema.ts`
- `lib/db/session.ts`
- `lib/career-os/adapter.ts`
- `app/dashboard/priority/[recordType]/[recordId]/page.tsx`

---

## 작업 항목

### 1. fos-career branch/worktree 준비

`FOS_CAREER_ROOT="${FOS_CAREER_ROOT:-$HOME/services/fos-career}"`를 기본 repo로 사용한다.
main worktree가 clean이고 원격 main과 맞는지 확인한 뒤, 별도 branch 또는 worktree에서 구현한다.

권장 branch: `feat/priority-action-requests`.

### 2. DB schema와 migration 추가

fos-career가 소유하는 `priority_action_requests` table을 추가한다.

필수 필드:

- request id
- admin user id
- record type
- record id
- requested stage
- requested rank
- reason
- status
- request snapshot JSON
- applied event id
- error message
- created/updated timestamp

상태 enum은 `pending`, `applied`, `rejected`, `failed`, `stale`만 허용한다.
마이그레이션은 additive SQL만 사용한다.

### 3. 요청 생성 API 추가

`POST /api/priority/actions`를 추가한다.

필수 동작:

- `getSession()`과 `validateSession()`으로 관리자 세션을 확인한다.
- request body의 `recordType`, `recordId`, `requestedStage`, `requestedRank`, `reason`을 검증한다.
- `getPriorityRecordDetail()`로 career-os read-only snapshot을 다시 읽는다.
- 같은 record에 pending request가 있으면 새 row를 만들지 않고 409를 반환한다.
- 요청 row와 `audit_logs`의 `priority.request_created`를 함께 저장한다.
- career-os 파일은 쓰지 않는다.

### 4. detail UI에 확인 form 추가

priority detail 화면에 stage/rank/reason 확인 form을 추가한다.
form은 request 생성만 수행한다.

표시해야 할 상태:

- 현재 recommendation priority
- 현재 user-confirmed priority
- 제출하려는 stage/rank/reason
- 이미 pending request가 있으면 pending 상태와 생성 시각

### 5. read-only 경계 검증

구현 후 docker compose mount는 read-only 그대로여야 한다.
`docker-compose.yml`과 override example에서 `/data/career-os:ro`가 유지되는지 확인한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `db/schema.ts` | `priorityActionRequests` table 추가 |
| `db/migrations/*priority_action_requests.sql` | additive migration |
| `app/api/priority/actions/route.ts` | pending request 생성 API |
| `app/dashboard/priority/[recordType]/[recordId]/page.tsx` | confirmation form과 pending 표시 |
| `lib/career-os/types.ts` | action request UI에 필요한 타입 보강 |

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git diff --check
cd career-os
bun --check scripts/application-agent/run.ts
CAREER_OS_RUNTIME_ROOT="${CAREER_OS_RUNTIME_ROOT:-$HOME/ai-nodes/career-os}"
bun scripts/application-agent/run.ts validate --ledger "$CAREER_OS_RUNTIME_ROOT/data/applications/ledger.jsonl"
```

fos-career 검증:

```bash
FOS_CAREER_ROOT="${FOS_CAREER_ROOT:-$HOME/services/fos-career}"
cd "$FOS_CAREER_ROOT"
npm run build
git diff --check
rg -n "/data/career-os:ro" docker-compose.yml docker-compose.override.yml.example
git status --short
```

Staging self-check:

```bash
git diff --cached --name-only
```

위 출력은 intended fos-career files만 포함해야 한다.

---

## 의도 메모

- ADR-053은 request 생성과 career-os 적용을 분리한다.
- 이 phase는 pending queue만 만들기 때문에 안전한 작은 구현 slice다.
- 실제 priority mutation은 phase 02에서 별도로 검증한다.

## Blocked 조건

- pending request 저장을 위해 career-os writable mount가 필요하다고 판단되면 `PHASE_BLOCKED: pending request design requires unsafe career-os write access`를 출력하고 exit 2.
- Next.js API route 구현 전에 현재 버전의 route handler 패턴을 확인할 수 없으면 `PHASE_BLOCKED: Next route handler contract unclear`를 출력하고 exit 2.
- additive migration으로 표현할 수 없는 DB 변경이 필요하면 `PHASE_BLOCKED: priority request queue needs destructive migration`을 출력하고 exit 2.
- build가 실패하면 `PHASE_FAILED: fos-career build failed`를 출력하고 exit 1.
