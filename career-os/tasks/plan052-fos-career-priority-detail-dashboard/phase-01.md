# Phase 01 — Read-only priority detail route

**Model**: sonnet
**Status**: pending

---

## 목표

fos-career priority list에서 frontdoor queue와 ledger record를 같은 방식으로 열 수 있는 read-only detail route를 추가한다.
화면은 action priority와 fit/gap 판단을 한 번에 검토하기 위한 것이며, career-os 데이터나 dashboard DB를 쓰지 않는다.

**범위 외**: priority write UI, user confirmation action, DB migration, importer change, external job site submission, LLM recommendation refresh.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes repo root와 fos-career repo를 함께 확인하므로 첫 bash에서 repo root로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/prd.md` — fos-career dashboard scope
- `career-os/docs/flow.md` — Position Priority + Posting/Fit Analysis Workflow
- `career-os/docs/code-architecture.md` — Position priority layer
- `career-os/docs/data-schema.md` — position priority fields and priority history
- `career-os/tasks/plan052-fos-career-priority-detail-dashboard/index.json`

---

## 작업 항목

### 1. fos-career branch/worktree 준비

`FOS_CAREER_ROOT="${FOS_CAREER_ROOT:-$HOME/services/fos-career}"`를 기본 repo로 사용한다.
main worktree가 clean이고 원격 main과 맞는지 확인한 뒤, 별도 branch 또는 worktree에서 구현한다.

권장 branch: `feat/priority-detail-dashboard`.

### 2. adapter contract 확장

fos-career의 career-os adapter에 record type/id 기반 helper를 추가한다.

필요한 동작:

- frontdoor queue와 ledger를 모두 검색한다.
- effective priority는 `userConfirmedPriority`가 있으면 우선한다.
- priority history는 해당 record id만 최신순으로 제공한다.
- ledger record는 기존 `postingPath`, `fitAnalysisPath`, `applicationPackagePath`, `reviewPath`를 read-only로 읽을 수 있어야 한다.
- frontdoor queue record는 `recommendationSnapshot` 안의 posting/fit/gap/preparation action 정보를 표시한다.

### 3. priority detail route 추가

fos-career에 `/dashboard/priority/[recordType]/[recordId]` route를 추가한다.

화면 필수 영역:

- record header: company, role, record type, source URL.
- priority summary: effective action stage, rank, source, next action, latest timestamps.
- recommendation snapshot detail: posting analysis, fit summary/evidence, gap summary/gaps/risk flags.
- preparation actions with approval requirement indicator.
- evidence links.
- priority history timeline.
- ledger-only raw files: posting, fit analysis, application package, review if present.

목록 page의 record link는 frontdoor queue도 detail route로 연결하고, external source URL은 detail 안 evidence/source link로 유지한다.

### 4. 검증과 PR 준비

검증은 직접 실행 가능한 명령으로 확인한다.

```bash
cd "$FOS_CAREER_ROOT"
npm run build
git diff --check
```

가능하면 실행 중인 container 또는 local server로 다음을 smoke 한다.

```bash
curl -sS -I http://127.0.0.1:16000/
curl -sS -I http://127.0.0.1:16000/dashboard/priority
```

인증이 필요한 route의 307 redirect는 정상이다.
세션 쿠키를 안전하게 얻을 수 있는 환경이면 detail route가 200이고 HTML에 record title과 priority summary가 있는지도 확인한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `app/dashboard/priority/page.tsx` | list row link를 detail route로 변경 |
| `app/dashboard/priority/[recordType]/[recordId]/page.tsx` | 신규 detail route |
| `lib/career-os/adapter.ts` | record lookup/detail helper |
| `lib/career-os/types.ts` | 필요한 detail type 보강 |

---

## 검증

보고 직전 반드시 본 bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --check career-os/scripts/application-agent/priority_dashboard_view.ts
bun career-os/scripts/application-agent/priority_dashboard_view.ts --dry-run
git diff --check
```

fos-career 검증:

```bash
FOS_CAREER_ROOT="${FOS_CAREER_ROOT:-$HOME/services/fos-career}"
cd "$FOS_CAREER_ROOT"
npm run build
git diff --check
git status --short
```

Staging self-check:

```bash
git diff --cached --name-only
```

위 출력은 intended fos-career files만 포함해야 한다.

---

## 의도 메모

- ADR-052의 read-only dashboard 원칙을 유지한다.
- summary list는 빠른 scan에 좋지만, priority 판단 근거를 보려면 record별 detail이 필요하다.
- write action은 read-only mount 안전 설계를 먼저 끝낸 뒤 별도 plan에서 다룬다.

## Blocked 조건

- detail view를 만들기 위해 career-os write access나 DB migration이 필요하다고 판단되면 `PHASE_BLOCKED: priority detail requires write-action design`을 출력하고 exit 2.
- frontdoor queue와 ledger id routing이 충돌해 stable URL을 만들 수 없으면 `PHASE_BLOCKED: record identity contract unclear`를 출력하고 exit 2.
- build가 실패하면 `PHASE_FAILED: fos-career build failed`를 출력하고 exit 1.
