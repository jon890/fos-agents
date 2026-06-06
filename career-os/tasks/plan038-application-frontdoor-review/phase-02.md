# Phase 02 — Queue Generation From Position Recommendation

**Model**: sonnet
**Status**: pending

---

## 목표

`/position-recommender` 산출물에서 추천 후보 순위를 읽어 `frontdoor-queue.jsonl`을 생성/갱신한다.

**범위 외**: 사용자 선택, ledger 승격, 상세 분석 실행은 하지 않는다.

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
- `career-os/docs/data-schema.md` — `frontdoor-queue.jsonl`
- `career-os/scripts/application-agent/ingest_position_report.ts`
- `career-os/data/runtime/position-recommendation.md`
- `career-os/data/reports/daily/2026-06-06/position-recommendation/report.md`

---

## 작업 항목

### 1. `career-os/scripts/application-agent/frontdoor_queue_builder.ts` 추가

position recommendation markdown에서 후보를 추출해 queue record를 만든다. 기존 `ingest_position_report.ts`의 ID/URL 추출 패턴을 재사용한다.

### 2. CLI 제공

예:

```bash
bun career-os/scripts/application-agent/frontdoor_queue_builder.ts \
  --report career-os/data/runtime/position-recommendation.md \
  --out career-os/data/runtime/application-agent/frontdoor-queue.jsonl
```

### 3. 기존 queue와 병합

같은 URL 또는 같은 external id 후보가 있으면 기존 record를 갱신하고, 사용자 결정 상태인 `start_approved`, `promoted_to_ledger`, `rejected`는 덮어쓰지 않는다.

### 4. AI 3개 seed 후보 처리

초기 검증 대상 3개를 queue에 반영한다.

- KakaoPay AI track: `카카오페이 서버 개발자 (144295)` — 별도 AI 전용 URL 확인 전 임시 후보.
- KakaoPay Securities AI/workplatform: `카카오페이증권 워크플랫폼 백엔드 개발자 (시니어)`.
- TossPlace AI: `TossPlace Applied AI Engineer`.

TossPlace는 이미 ledger에 있을 수 있으므로 phase-02에서는 queue record만 만들고 ledger는 수정하지 않는다.

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/application-agent/frontdoor_queue_builder.ts
bun career-os/scripts/application-agent/frontdoor_queue_builder.ts \
  --report career-os/data/runtime/position-recommendation.md \
  --out career-os/data/runtime/application-agent/frontdoor-queue.jsonl
```

후보 존재 검증:

```bash
cd "$(git rev-parse --show-toplevel)"
grep -n "카카오페이" career-os/data/runtime/application-agent/frontdoor-queue.jsonl
grep -n "카카오페이증권" career-os/data/runtime/application-agent/frontdoor-queue.jsonl
grep -n "TossPlace" career-os/data/runtime/application-agent/frontdoor-queue.jsonl
```

## Blocked 조건

- 로컬 report에서 KakaoPay AI 전용 공고가 별도로 확인되지 않으면 `카카오페이 서버 개발자 (144295)`를 임시 후보로 유지하고 계속 진행한다. 이는 blocked가 아니다.
- 3개 seed 중 TossPlace를 제외한 2개 후보 URL을 전혀 추출할 수 없으면 `PHASE_BLOCKED: required frontdoor seed postings unavailable`를 출력하고 exit 2.
