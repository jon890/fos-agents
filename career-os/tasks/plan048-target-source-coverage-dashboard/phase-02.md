# Phase 02 — Adapter contract and configured source registry

**Model**: sonnet
**Status**: pending

---

## 목표

configured source registry, `all` semantics, source diagnostics schema, discovery mode를 collector 계약에 추가한다.

**범위 외**: 새 source adapter의 실제 fetch 구현, dashboard UI, end-to-end collector 실행.
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

- `career-os/docs/adr.md` — ADR-051
- `career-os/docs/data-schema.md` — `data/runtime/live-position-postings.md`
- `career-os/docs/code-architecture.md` — collector module boundary

---

## 작업 항목

### 1. source identifiers and discovery mode

`career-os/scripts/position-recommender/live-postings/types.ts`에 source와 discovery mode 계약을 추가한다.
Wanted는 `wanted` source 안에서 `broad`와 `target-url` discovery mode를 구분한다.

### 2. configured source registry

`career-os/scripts/position-recommender/live-postings/adapters/index.ts`에서 `all`이 등록된 모든 source를 선택하도록 바꾼다.
Toss는 `all`이면 포함한다.
기존 compatibility option은 필요하면 유지하되 `all`의 의미를 좁히지 않는다.

### 3. source diagnostics schema

수집 결과에 source별 짧은 상태, collected count, imported count, skipped count, failed count를 담을 수 있게 타입과 renderer 입력을 확장한다.
상세 실패는 runtime output에 남기고 dashboard용 diagnostics는 짧게 유지한다.

### 4. validation and commit

TypeScript 문법 검증과 JSON-free text rendering smoke를 실행한다.
성공하면 this phase intended files만 commit하고 push한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/live-postings/types.ts` | source registry, discovery mode, diagnostics contract |
| `career-os/scripts/position-recommender/live-postings/adapters/index.ts` | configured source selection and `all` semantics |
| `career-os/scripts/position-recommender/live-postings/render.ts` | brief source diagnostics rendering |
| `career-os/scripts/position-recommender/collect_live_postings.ts` | CLI compatibility only if needed |

---

## 검증

```bash
bun --check career-os/scripts/position-recommender/collect_live_postings.ts
bun --check career-os/scripts/position-recommender/live-postings/types.ts
bun --check career-os/scripts/position-recommender/live-postings/adapters/index.ts
bun --check career-os/scripts/position-recommender/live-postings/render.ts
git diff --check
```

Commit/push boundary:

```bash
git status --short
git add career-os/scripts/position-recommender/collect_live_postings.ts \
  career-os/scripts/position-recommender/live-postings/types.ts \
  career-os/scripts/position-recommender/live-postings/adapters/index.ts \
  career-os/scripts/position-recommender/live-postings/render.ts
git commit -m "feat(career-os): add source registry diagnostics contract"
git push origin main
```

보고 직전 반드시 검증 bash를 실행하고 stdout raw result를 남긴다.

---

## 의도 메모

- ADR-051의 `all` semantics와 source diagnostics를 adapter 구현 전에 고정한다.
- source failure isolation은 contract에서 먼저 표현하고, phase-03에서 adapter별로 적용한다.

## Blocked 조건

- 기존 CLI 옵션과 새 source registry가 호환되지 않아 daily runner behavior가 바뀔 위험이 있으면 `PHASE_BLOCKED: source registry compatibility decision needed` 출력 후 exit 2.
- commit 전 unrelated dirty file이 있으면 commit하지 말고 `PHASE_BLOCKED: unrelated dirty state before commit` 출력 후 exit 2.
