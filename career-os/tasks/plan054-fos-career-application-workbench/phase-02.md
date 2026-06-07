# Phase 02 — Applications List and Detail Workbench UI

**Model**: sonnet
**Status**: completed

---

## 목표

fos-career applications 화면을 raw ledger viewer에서 지원 준비 작업대 UI로 바꾼다.

**범위 외**: DB schema 변경, career-os 파일 mutation, priority request 적용 runner 변경, 외부 제출 자동화, 공개 발행.

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

- `career-os/docs/adr.md` — ADR-054
- `career-os/docs/prd.md` — plan054 scope
- `career-os/docs/flow.md` — application workbench flow
- `career-os/docs/code-architecture.md` — plan054 related fos-career files

---

## 작업 항목 (4)

### 1. applications list를 workbench projection으로 교체

수정 대상:

- `/home/bifos/services/fos-career/app/dashboard/applications/page.tsx`

phase-01의 projection helper를 사용한다.
목록은 후보별 company, role, record type, stage/status, readiness count, next action, blocker/risk flag를 스캔 가능하게 보여준다.
운영형 dashboard에 맞게 조용하고 촘촘한 레이아웃을 유지한다.

### 2. workbench summary 추가

수정 대상:

- `/home/bifos/services/fos-career/app/dashboard/applications/page.tsx`

상단에 총 후보 수, prepare-now/investigate 수, readiness incomplete 수, blocker 있는 후보 수를 표시한다.
카드는 겹겹이 중첩하지 않는다.

### 3. application detail 화면 개편

수정 대상:

- `/home/bifos/services/fos-career/app/dashboard/applications/[id]/page.tsx`

detail은 raw field dump보다 다음 순서를 우선한다.

1. 현재 stage/status와 next action.
2. readiness checklist: posting, fit analysis, application package, review.
3. blocker/risk flags.
4. material preview links or snippets.
5. raw record/debug section은 접거나 하단 보조 영역으로 유지.

### 4. 경로/빈 상태 처리

수정 대상:

- `/home/bifos/services/fos-career/app/dashboard/applications/page.tsx`
- `/home/bifos/services/fos-career/app/dashboard/applications/[id]/page.tsx`

frontdoor-only record, ledger-only record, missing material file, unknown id를 모두 깨지지 않게 처리한다.
unknown id는 적절한 not found/empty 상태를 보여준다.

---

## Critical Files

- `/home/bifos/services/fos-career/app/dashboard/applications/page.tsx` — workbench list
- `/home/bifos/services/fos-career/app/dashboard/applications/[id]/page.tsx` — workbench detail
- `/home/bifos/services/fos-career/lib/career-os/adapter.ts` — 필요 시 display helper 보강
- `/home/bifos/services/fos-career/lib/career-os/types.ts` — 필요 시 UI type 보강

---

## 검증

보고 직전 반드시 이 bash 블록을 실행하고 raw 결과를 stdout에 남긴다.

```bash
cd /home/bifos/services/fos-career
npx tsc --noEmit
npm run build
rg "readiness|next action|ApplicationWorkbench" app/dashboard/applications lib/career-os
git status --short
```

성공 기준:

- `npx tsc --noEmit` exit 0.
- `npm run build` exit 0.
- applications list/detail에서 readiness와 next action이 code path에 존재한다.
- career-os 파일은 수정하지 않는다.

---

## Blocked / Failed 조건

반드시 Bash 도구로 직접 실행하라. prose만 출력하면 success로 잘못 처리된다.

- phase-01 projection helper가 없으면 `echo "PHASE_BLOCKED: workbench projection helper missing" && exit 2`.
- build가 실패하고 원인을 수정하지 못하면 `echo "PHASE_FAILED: fos-career build failed" && exit 1`.
- UI 구현을 위해 career-os writable mutation이 필요해지면 `echo "PHASE_BLOCKED: write action requires separate bridge design" && exit 2`.

---

## Self-check

- 외부 제출, public publish, candidate-profile mutation 버튼을 만들지 않는다.
- 새 DB table을 만들지 않는다.
- operational dashboard 톤을 유지한다. 과한 hero/marketing layout을 만들지 않는다.
- commit 전 `git diff --cached --name-only`가 intended files만 포함하는지 확인한다.
