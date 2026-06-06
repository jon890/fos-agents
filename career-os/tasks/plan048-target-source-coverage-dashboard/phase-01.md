# Phase 01 — Read-only source architecture and target URL discovery validation

**Model**: sonnet
**Status**: pending

---

## 목표

현재 collector와 dashboard 입력 구조를 읽기 전용으로 검증하고, KakaoPay, KakaoPay Securities, Toss, Wanted target URL 후보의 공식 listing/detail 경로를 확인한다.

**범위 외**: 파일 수정, collector 실행, import 실행, dashboard 코드 수정.
이 phase는 commit/push를 만들지 않는다.

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
- `career-os/docs/code-architecture.md` — position-recommender collector 구조
- `career-os/docs/flow.md` — `/position-recommender` 흐름
- `career-os/docs/data-schema.md` — `data/runtime/live-position-postings.md`

---

## 작업 항목

### 1. current collector inventory

아래 파일을 읽고 source adapter 계약, registry, diagnostics, renderer, validator 책임을 요약한다.

- `career-os/scripts/position-recommender/collect_live_postings.ts`
- `career-os/scripts/position-recommender/live-postings/types.ts`
- `career-os/scripts/position-recommender/live-postings/adapters/index.ts`
- `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts`
- `career-os/scripts/position-recommender/live-postings/adapters/toss.ts`
- `career-os/scripts/position-recommender/live-postings/render.ts`
- `career-os/scripts/position-recommender/live-postings/validator.ts`

### 2. official source discovery validation

공식 public page만 확인한다.
KakaoPay official careers/GreetingHR, KakaoPay Securities official careers, Toss careers job detail, Wanted detail URL의 listing/detail 경로를 기록한다.
private credential, 개인 계정 상태, 비공개 인증 정보는 기록하지 않는다.

### 3. source feasibility matrix

각 source별로 다음을 분류해 phase-01 stdout에만 남긴다.

- source key proposal
- listing entrypoint
- detail page URL pattern
- active/open evidence 후보
- failure mode
- implementation risk

### 4. dirty state 방어

phase 종료 전 worktree가 깨끗한지 확인한다.
읽기 전용 phase이므로 변경이 있으면 실패로 끝낸다.

---

## 검증

```bash
git status --porcelain
test "$(git status --porcelain | wc -l | tr -d ' ')" = "0"
```

보고 직전 반드시 위 bash 블록을 실행하고 raw count를 함께 출력한다.
변경이 있으면 `PHASE_FAILED: read-only phase produced changes`를 출력하고 exit 1.

---

## 의도 메모

- ADR-051에 따라 seed 파일을 만들지 않고 adapter-owned entrypoint를 우선한다.
- 이 phase의 discovery 결과는 phase-03 source adapter 구현의 입력이다.
- 실패한 source가 있어도 matrix에 실패 모드를 남기고 다른 source 조사를 계속한다.

## Blocked 조건

- 공식 listing/detail URL이 로그인 또는 비공개 인증 없이는 확인 불가하면 `PHASE_BLOCKED: official source requires private auth or user decision` 출력 후 exit 2.
- public page가 접근 가능하지만 schema가 불명확하면 blocked가 아니라 phase-03에서 defensive parsing 대상으로 남긴다.
