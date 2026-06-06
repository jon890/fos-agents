# Phase 02 — Controlled career-os priority request applier

**Model**: sonnet
**Status**: pending

---

## 목표

pending priority request 하나를 career-os의 기존 `confirm-priority` command로 안전하게 적용하는 controlled runner를 만든다.
runner는 stale snapshot을 차단하고, 직접 JSONL 조작 대신 career-os schema/helper 경로를 재사용한다.

**범위 외**: external job submission, candidate-profile 수정, LLM chat mutation, dashboard container writable mount, bulk auto-apply.

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
- `career-os/docs/data-schema.md` — priority fields, `_priority-history.jsonl`, `priority_action_requests`
- `career-os/docs/flow.md` — application flow and priority write-action bridge
- `career-os/docs/code-architecture.md` — priority layer and controlled runner boundary
- `career-os/scripts/application-agent/run.ts`
- `career-os/scripts/application-agent/priority_history.ts`
- `career-os/scripts/application-agent/frontdoor_queue_io.ts`
- `career-os/scripts/application-agent/ledger_io.ts`

---

## 작업 항목

### 1. request input contract 정의

career-os 쪽 runner는 fos-career DB에 직접 의존하지 않는다.
입력은 pending request JSON 파일 또는 stdin으로 받는다.

필수 필드:

- request id
- record type
- record id
- requested stage
- requested rank
- reason
- changed by
- request snapshot

### 2. stale guard 구현

현재 frontdoor queue 또는 ledger record를 읽고 request snapshot과 비교한다.
비교 대상은 최소 record id, record type, current user-confirmed priority, recommendation generated timestamp다.

불일치하면 `stale` 결과 JSON을 출력하고 career-os 파일을 쓰지 않는다.

### 3. confirm-priority 경로 재사용

유효한 request만 기존 `application-agent confirm-priority`와 같은 schema/helper 경로를 사용해 적용한다.
직접 JSONL 문자열 조작은 금지한다.

적용 후 `_priority-history.jsonl`의 최신 event id를 결과 JSON에 포함한다.

### 4. dry-run과 result JSON 지원

runner는 `--dry-run`을 지원한다.
dry-run은 검증 결과와 적용 예정 command만 출력하고 파일을 쓰지 않는다.

실행 결과는 `applied`, `stale`, `failed` 중 하나와 message, event id를 JSON으로 출력한다.

### 5. 검증 fixture 추가

작은 temp fixture로 frontdoor queue, ledger, history path를 따로 지정해 테스트한다.
실제 `data/applications/ledger.jsonl`과 `data/runtime/application-agent/frontdoor-queue.jsonl`은 검증에서 변경하지 않는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/application-agent/run.ts` | 재사용 가능한 priority confirmation helper 또는 command 확장 |
| `career-os/scripts/application-agent/apply_priority_request.ts` | 신규 controlled applier |
| `career-os/scripts/application-agent/priority_request_schema.ts` | request/result schema |
| `career-os/docs/data-schema.md` | 필요 시 request result field 보강 |

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd career-os
bun --check scripts/application-agent/run.ts
bun --check scripts/application-agent/apply_priority_request.ts
CAREER_OS_RUNTIME_ROOT="${CAREER_OS_RUNTIME_ROOT:-$HOME/ai-nodes/career-os}"
bun scripts/application-agent/run.ts validate --ledger "$CAREER_OS_RUNTIME_ROOT/data/applications/ledger.jsonl"
git diff --check
```

fixture 검증은 실제 career-os runtime files를 쓰지 않아야 한다.
검증 전후 실제 파일 checksum을 비교한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd career-os
CAREER_OS_RUNTIME_ROOT="${CAREER_OS_RUNTIME_ROOT:-$HOME/ai-nodes/career-os}"
QUEUE_FILE="$CAREER_OS_RUNTIME_ROOT/data/runtime/application-agent/frontdoor-queue.jsonl"
LEDGER_FILE="$CAREER_OS_RUNTIME_ROOT/data/applications/ledger.jsonl"
HISTORY_FILE="$CAREER_OS_RUNTIME_ROOT/data/applications/_priority-history.jsonl"
sha256sum "$QUEUE_FILE" "$LEDGER_FILE" "$HISTORY_FILE"
# temp fixture dry-run과 apply 실행
sha256sum "$QUEUE_FILE" "$LEDGER_FILE" "$HISTORY_FILE"
```

Staging self-check:

```bash
git diff --cached --name-only
```

위 출력은 intended career-os files만 포함해야 한다.

---

## 의도 메모

- career-os가 실제 mutation owner다.
- fos-career DB schema에 직접 연결하지 않으면 career-os workspace isolation을 유지할 수 있다.
- request status 갱신은 phase 03 또는 fos-career host runner가 결과 JSON을 보고 처리한다.

## Blocked 조건

- stale guard가 record identity를 안정적으로 비교할 수 없으면 `PHASE_BLOCKED: priority request snapshot contract unclear`를 출력하고 exit 2.
- 기존 `confirm-priority` helper를 우회해야만 구현 가능하면 `PHASE_BLOCKED: applier would bypass career-os priority helper`를 출력하고 exit 2.
- 실제 career-os runtime file checksum이 fixture 검증 뒤 바뀌면 `PHASE_FAILED: fixture validation mutated real career-os files`를 출력하고 exit 1.
- build 또는 schema validation이 실패하면 `PHASE_FAILED: priority request applier validation failed`를 출력하고 exit 1.
