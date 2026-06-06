# Phase 03 — Target source adapters and detail evidence

**Model**: sonnet
**Status**: pending

---

## 목표

Wanted target URL detail path, Toss inclusion for `all`, KakaoPay GreetingHR, KakaoPay Securities official adapter를 구현한다.
모든 seed/official listing 후보는 detail page를 fetch하고 active/open evidence를 기록한 뒤에만 import 후보가 된다.

**범위 외**: dashboard UI, application ledger/frontdoor import, final end-to-end verification.
이 write phase는 intended files only로 commit/push한다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase 실행한다.
본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 bash에서 repo root로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다:

- `career-os/docs/adr.md` — ADR-043, ADR-047, ADR-051
- `career-os/docs/flow.md` — source coverage expansion flow
- `career-os/docs/data-schema.md` — live snapshot fields and diagnostics
- phase-01 stdout or saved run summary from this task execution

---

## 작업 항목

### 1. Wanted target URL path

`career-os/scripts/position-recommender/live-postings/adapters/wanted.ts` 안에 broad scan과 target URL detail verification을 분리한 internal functions를 둔다.
source key는 `wanted`를 유지하고 discovery mode로 구분한다.

### 2. Toss all behavior

`all` configured source set에서 Toss adapter가 포함되게 한다.
Toss article은 direct posting으로 import하지 않고, job detail page에서 JD와 apply evidence가 확인된 항목만 유지한다.

### 3. KakaoPay official careers/GreetingHR adapter

KakaoPay official careers/GreetingHR listing entrypoint와 detail page fetch를 source adapter로 추가한다.
adapter 내부에 known target URL이 필요하면 code-owned source-local list로 둔다.

### 4. KakaoPay Securities official adapter

KakaoPay Securities official careers listing/detail fetch를 source adapter로 추가한다.
active/open evidence와 direct posting URL이 없으면 diagnostics로만 남긴다.

### 5. failure isolation and dedupe

한 adapter 실패가 전체 collection 실패로 이어지지 않게 source-level try/catch와 diagnostics를 정리한다.
dedupe/upsert는 URL 우선, URL 불안정 source는 stable hash 보조를 사용한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts` | broad vs target-url detail verification |
| `career-os/scripts/position-recommender/live-postings/adapters/toss.ts` | `all` inclusion behavior and detail evidence |
| `career-os/scripts/position-recommender/live-postings/adapters/kakaopay.ts` | new official/GreetingHR adapter |
| `career-os/scripts/position-recommender/live-postings/adapters/kakaopay-securities.ts` | new official adapter |
| `career-os/scripts/position-recommender/live-postings/adapters/index.ts` | registry |
| `career-os/scripts/position-recommender/live-postings/validator.ts` | active/open and dedupe support |

---

## 검증

```bash
bun --check career-os/scripts/position-recommender/collect_live_postings.ts
find career-os/scripts/position-recommender/live-postings -name '*.ts' -print0 | xargs -0 -n1 bun --check
git diff --check
```

Run a collector smoke only after the adapter code is complete:

```bash
bun career-os/scripts/position-recommender/collect_live_postings.ts \
  --source all \
  --out career-os/data/runtime/live-position-postings.plan048-smoke.md
test -s career-os/data/runtime/live-position-postings.plan048-smoke.md
rg -n "source_diagnostics|source_counts|active_evidence|discovery_mode" career-os/data/runtime/live-position-postings.plan048-smoke.md
```

Commit/push boundary:

```bash
git status --short
git add career-os/scripts/position-recommender/collect_live_postings.ts \
  career-os/scripts/position-recommender/live-postings \
  career-os/data/runtime/live-position-postings.plan048-smoke.md
git commit -m "feat(career-os): collect target official sources"
git push origin main
```

보고 직전 반드시 검증 bash를 실행하고 stdout raw result를 남긴다.

---

## 의도 메모

- source adapter가 entrypoint와 known target URL을 소유한다.
- 모든 official listing/seed 후보는 detail page fetch와 active/open evidence가 있어야 import 후보가 된다.
- smoke output은 implementation evidence로 남기되, daily runtime 파일을 덮어쓰지 않는다.

## Blocked 조건

- official source가 public fetch를 막아 active/open evidence를 얻을 수 없으면 `PHASE_BLOCKED: official detail evidence unavailable` 출력 후 exit 2.
- smoke output에 career article, search page, unknown status가 import 후보로 섞이면 `PHASE_FAILED: non-importable lead leaked into snapshot` 출력 후 exit 1.
- commit 전 unrelated dirty file이 있으면 commit하지 말고 `PHASE_BLOCKED: unrelated dirty state before commit` 출력 후 exit 2.
