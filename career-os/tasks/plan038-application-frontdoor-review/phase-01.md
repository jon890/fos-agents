# Phase 01 — Frontdoor Queue Schema And Validator

**Model**: sonnet
**Status**: pending

---

## 목표

사용자 선택 전 추천 후보를 저장하는 `frontdoor-queue.jsonl` 스키마와 검증기를 추가한다.

**범위 외**: position-recommender report 파싱, 사용자 선택 처리, ledger 승격은 다음 phase에서 한다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase 실행한다. 본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md` — ADR-045
- `career-os/docs/data-schema.md` — `frontdoor-queue.jsonl`
- `career-os/docs/code-architecture.md` — application-flow-agent runtime
- `career-os/scripts/application-agent/ledger_schema.ts`

---

## 작업 항목

### 1. `career-os/scripts/application-agent/frontdoor_queue_schema.ts` 추가

Zod 기반 schema를 만든다. 필수 enum은 docs와 일치해야 한다.

- `status`: `collected`, `shortlisted`, `needs_user_start_approval`, `start_approved`, `promoted_to_ledger`, `rejected`, `expired`
- `sourceFreshness`: 기존 ledger enum과 동일하게 `fresh`, `stale`, `unknown`
- `selectedAt`: 승인 전 `null`, 승인 후 ISO string
- `promotedApplicationId`: 승격 전 `null`, 승격 후 ledger id

### 2. 검증 규칙 구현

- `sourceFreshness=stale`인 record는 `needs_user_start_approval` 또는 `start_approved`가 될 수 없다.
- `start_approved`는 `selectedAt`이 있어야 한다.
- `promoted_to_ledger`는 `promotedApplicationId`가 있어야 한다.
- `rank`는 양의 정수여야 한다.

### 3. JSONL read/write helper 추가

`career-os/scripts/application-agent/frontdoor_queue_io.ts`를 추가한다.

- 기본 경로: `career-os/data/runtime/application-agent/frontdoor-queue.jsonl`
- 파일이 없으면 빈 배열을 반환한다.
- write는 trailing newline을 유지한다.

### 4. validator CLI 추가

기존 `run.ts validate`와 바로 통합하지 않아도 된다. 우선 직접 실행 가능한 CLI를 제공한다.

예: `bun career-os/scripts/application-agent/frontdoor_queue_schema.ts validate`

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/application-agent/frontdoor_queue_schema.ts
bun --check career-os/scripts/application-agent/frontdoor_queue_io.ts
```

추가 파일 존재 검증:

```bash
cd "$(git rev-parse --show-toplevel)"
[ -f career-os/scripts/application-agent/frontdoor_queue_schema.ts ]
[ -f career-os/scripts/application-agent/frontdoor_queue_io.ts ]
```

## Blocked 조건

- 기존 TypeScript/zod import 패턴을 찾을 수 없으면 `PHASE_BLOCKED: application-agent schema import pattern unavailable`를 출력하고 exit 2.
- schema 검증 명령이 통과하지 않으면 `PHASE_FAILED: frontdoor queue schema validation failed`를 출력하고 exit 1.
