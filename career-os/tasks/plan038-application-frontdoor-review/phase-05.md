# Phase 05 — Integration Validation And Task Completion

**Model**: haiku
**Status**: pending

---

## 목표

plan038 전체 변경을 검증하고, AI 3개 후보의 frontdoor queue → 사용자 선택 → ledger 승격 경로가 안전하게 동작하는지 확인한다.

**범위 외**: plan039 대시보드, 관리자 로그인, 외부 사이트 제출 자동화는 하지 않는다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

- `career-os/docs/adr.md` — ADR-045
- `career-os/docs/prd.md` — plan038 범위
- `career-os/docs/data-schema.md` — frontdoor queue + ledger
- `career-os/docs/flow.md` — Application Frontdoor Queue
- `career-os/docs/code-architecture.md` — planned modules
- `career-os/tasks/plan038-application-frontdoor-review/index.json`

---

## 작업 항목

### 1. TypeScript 검증

plan038에서 추가/수정한 TypeScript 파일에 대해 `bun --check`를 실행한다.

### 2. queue 생성 smoke

`data/runtime/position-recommendation.md`에서 queue를 생성하고, AI 3개 후보가 포함되는지 확인한다.

### 3. ledger 승격 smoke

한 신규 후보를 dry-run 또는 test fixture 방식으로 승격 검증한다. TossPlace Applied AI Engineer는 이미 ledger에 있으므로 중복 record가 생기지 않는지 확인한다.

### 4. application-agent validate

기존 ledger validate를 실행한다. 기존 enum mismatch가 남아 있으면 plan038 변경으로 새로 생긴 문제인지 기존 문제인지 구분해 보고한다.

### 5. index.json 완료 처리

모든 검증이 통과하면 `career-os/tasks/plan038-application-frontdoor-review/index.json`의 `status`를 `completed`로 바꾸고 phase status를 모두 `completed`로 바꾼다.

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/application-agent/frontdoor_queue_schema.ts
bun --check career-os/scripts/application-agent/frontdoor_queue_io.ts
bun --check career-os/scripts/application-agent/frontdoor_queue_builder.ts
bun --check career-os/scripts/application-agent/promote_frontdoor_candidate.ts
bun career-os/scripts/application-agent/run.ts validate
```

후보 smoke:

```bash
cd "$(git rev-parse --show-toplevel)"
bun career-os/scripts/application-agent/frontdoor_queue_builder.ts \
  --report career-os/data/runtime/position-recommendation.md \
  --out career-os/data/runtime/application-agent/frontdoor-queue.jsonl
grep -n "카카오페이" career-os/data/runtime/application-agent/frontdoor-queue.jsonl
grep -n "카카오페이증권" career-os/data/runtime/application-agent/frontdoor-queue.jsonl
grep -n "TossPlace" career-os/data/runtime/application-agent/frontdoor-queue.jsonl
```

git 안전 검증:

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short
```

dirty worktree가 있으면 unrelated 변경을 커밋하지 말고 보고한다.

## Blocked 조건

- AI 3개 후보 중 2개 이상을 queue에서 식별하지 못하면 `PHASE_BLOCKED: frontdoor seed candidate validation failed`를 출력하고 exit 2.
- ledger validate 실패가 plan038 변경으로 새로 생긴 문제면 `PHASE_FAILED: plan038 introduced ledger validation failure`를 출력하고 exit 1.
