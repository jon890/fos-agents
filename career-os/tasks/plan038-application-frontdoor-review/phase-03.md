# Phase 03 — User Selection And Ledger Promotion

**Model**: sonnet
**Status**: pending

---

## 목표

사용자가 "N번 준비 시작"으로 선택한 frontdoor 후보만 ledger로 승격하는 명령을 추가한다.

**범위 외**: 상세 분석/공부자료 생성 실행은 phase-04에서 연결한다. 실제 제출, 외부 사이트 입력, 대시보드 UI는 하지 않는다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

- `career-os/docs/adr.md` — ADR-045
- `career-os/docs/flow.md` — Application Frontdoor Queue
- `career-os/docs/data-schema.md` — ledger + frontdoor queue
- `career-os/scripts/application-agent/ledger_schema.ts`
- `career-os/scripts/application-agent/ledger_io.ts`
- `career-os/scripts/application-agent/ingest_position_report.ts`

---

## 작업 항목

### 1. `promote_frontdoor_candidate.ts` 추가

CLI 예:

```bash
bun career-os/scripts/application-agent/promote_frontdoor_candidate.ts --rank 1
bun career-os/scripts/application-agent/promote_frontdoor_candidate.ts --queue-id frontdoor-kakaopay-server-144295
```

### 2. 사용자 선택 상태 전이

- 선택 후보를 `start_approved`로 바꾸고 `selectedAt`을 기록한다.
- ledger 승격 성공 후 `promoted_to_ledger`와 `promotedApplicationId`를 기록한다.

### 3. ledger 중복 방지

같은 URL 또는 같은 external id가 ledger에 있으면 새 record를 만들지 않는다. 기존 ledger id를 `promotedApplicationId`로 연결한다.

TossPlace Applied AI Engineer는 이미 ledger에 있는 fixture이므로 중복 생성 없이 연결되는지 검증한다.

### 4. applicationDir / nextActions 생성

신규 승격 후보는 기존 ledger schema에 맞춰 `applicationDir`, `postingPath`, `fitAnalysisPath`, `applicationPackagePath`, `reviewPath`, `nextActions`를 만든다.

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/application-agent/promote_frontdoor_candidate.ts
bun career-os/scripts/application-agent/run.ts validate
```

TossPlace 중복 방지 검증:

```bash
cd "$(git rev-parse --show-toplevel)"
before=$(grep -c "tossplace-applied-ai-engineer-7746700003" career-os/data/applications/ledger.jsonl || true)
bun career-os/scripts/application-agent/promote_frontdoor_candidate.ts --queue-id frontdoor-tossplace-applied-ai-engineer-7746700003 || true
after=$(grep -c "tossplace-applied-ai-engineer-7746700003" career-os/data/applications/ledger.jsonl || true)
test "$before" = "$after"
```

## Blocked 조건

- ledger schema와 호환되는 신규 record를 만들 수 없으면 `PHASE_FAILED: promoted ledger record violates schema`를 출력하고 exit 1.
- 같은 rank에 여러 active 후보가 매칭되면 `PHASE_BLOCKED: ambiguous frontdoor rank selection`를 출력하고 exit 2.
