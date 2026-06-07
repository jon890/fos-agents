# Phase 01 — Workbench Projection and Readiness Model

**Model**: sonnet
**Status**: completed

---

## 목표

fos-career에 application workbench projection을 추가해 frontdoor queue와 ledger를 "지원 준비 상태" 기준으로 합쳐 읽을 수 있게 만든다.

**범위 외**: UI 레이아웃 변경, DB schema 변경, career-os 파일 mutation, 외부 제출 자동화.

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

run-phases.py는 cwd=workspace로 phase 실행한다. 본 phase는 ai-nodes 루트와 별도 fos-career repo를 함께 참조하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다. Claude Code Bash 도구 cwd 보존으로 후속 bash 명령도 이 기준을 유지한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다:

- `career-os/docs/adr.md` — ADR-046, ADR-053, ADR-054
- `career-os/docs/prd.md` — plan039, plan052, plan053, plan054
- `career-os/docs/data-schema.md` — application workbench projection, ledger, frontdoor queue, priority fields
- `career-os/docs/flow.md` — priority flow, workbench flow
- `career-os/docs/code-architecture.md` — fos-career boundary and plan054 files

---

## 작업 항목 (4)

### 1. fos-career type model 추가

수정 대상:

- `/home/bifos/services/fos-career/lib/career-os/types.ts`

`ApplicationWorkbenchRecord`, readiness item/status, material path, blocker/risk display type을 추가한다.
record id는 `recordType:recordId` 형식의 UI key를 제공해야 한다.

### 2. adapter projection 구현

수정 대상:

- `/home/bifos/services/fos-career/lib/career-os/adapter.ts`

frontdoor queue와 ledger를 읽어 workbench records로 변환하는 함수를 추가한다.
기존 read-only helper와 priority projection helper를 재사용한다.
ledger material readiness는 `postingPath`, `fitAnalysisPath`, `applicationPackagePath`, `reviewPath`의 파일 존재 여부로 계산한다.
frontdoor record는 material path가 없을 수 있으므로 `not_started` 성격의 readiness를 반환한다.

### 3. next action과 blocker 계산

수정 대상:

- `/home/bifos/services/fos-career/lib/career-os/adapter.ts`

우선순위:

1. `userConfirmedPriority.nextAction` 또는 reason-derived action이 있으면 우선한다.
2. 없으면 `recommendationSnapshot.nextAction`.
3. 없으면 ledger/frontdoor `nextActions`.
4. 없으면 status/action stage 기반 기본 문구.

blocker는 missing application package, missing review, stale/closed source, explicit risk flags를 표시용 값으로 계산한다.
blocker는 career-os 원장 status를 바꾸지 않는다.

### 4. 정적 검증

fos-career repo에서 타입/빌드 검증을 실행한다.

```bash
cd /home/bifos/services/fos-career
npx tsc --noEmit
```

---

## Critical Files

- `/home/bifos/services/fos-career/lib/career-os/types.ts` — workbench projection type 추가
- `/home/bifos/services/fos-career/lib/career-os/adapter.ts` — read-only projection 계산

---

## 검증

보고 직전 반드시 이 bash 블록을 실행하고 raw 결과를 stdout에 남긴다.

```bash
cd /home/bifos/services/fos-career
npx tsc --noEmit
rg "ApplicationWorkbench" lib/career-os
git status --short
```

성공 기준:

- `npx tsc --noEmit` exit 0.
- `rg "ApplicationWorkbench" lib/career-os`가 새 projection type/helper를 찾는다.
- fos-career 변경 파일은 `lib/career-os/types.ts`, `lib/career-os/adapter.ts` 범위에 머문다.

---

## Blocked / Failed 조건

반드시 Bash 도구로 직접 실행하라. prose만 출력하면 success로 잘못 처리된다.

- `/home/bifos/services/fos-career`가 없거나 git repo가 아니면 `echo "PHASE_BLOCKED: fos-career repo unavailable" && exit 2`.
- `/home/bifos/ai-nodes/career-os/data`가 읽히지 않으면 `echo "PHASE_BLOCKED: career-os data unavailable" && exit 2`.
- 타입 검증이 실패하고 원인을 수정하지 못하면 `echo "PHASE_FAILED: fos-career typecheck failed" && exit 1`.

---

## Self-check

- phase는 docs를 수정하지 않는다. docs는 plan054 생성 전에 반영되어 있다.
- fos-career MySQL schema를 만들지 않는다.
- career-os 파일을 쓰지 않는다.
- commit 전 `git diff --cached --name-only`가 intended files만 포함하는지 확인한다.
