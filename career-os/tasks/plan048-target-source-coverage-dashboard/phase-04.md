# Phase 04 — Import and dashboard source controls

**Model**: sonnet
**Status**: pending

---

## 목표

source filter와 brief diagnostics가 import/dashboard 경로에서 보이게 한다.
collector 상세 실패는 runtime output에 남기고, dashboard는 source별 짧은 상태만 보여준다.

**범위 외**: 새 source adapter fetch 구현, final end-to-end verification.
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

- `career-os/docs/adr.md` — ADR-045, ADR-046, ADR-051
- `career-os/docs/flow.md` — frontdoor queue and dashboard flow
- `career-os/docs/data-schema.md` — live snapshot, frontdoor queue, ledger fields
- fos-career repo docs or README if present

---

## 작업 항목

### 1. import source metadata

Position recommendation or live snapshot ingest must preserve `source`, `discovery_mode`, `active_evidence`, diagnostics summary, and canonical URL/hash identity.
Deduplicate by URL first and hash second.

### 2. source filter API or reader contract

Dashboard data readers should expose configured source list, source counts, and source diagnostics without exposing detailed failure text.
Use repo-relative paths inside the fos-career repo when editing dashboard files.

### 3. dashboard source filter control

Add a source filter to the positions dashboard.
Default view should show every configured source.
Filter state should not hide diagnostics that explain a selected source has zero importable postings.

### 4. diagnostics display

Show brief source diagnostics near the positions list.
Detailed failures stay in runtime output and are not copied into dashboard UI.

### 5. commit

Commit/push only intended career-os and fos-career files for this phase.
If both repos are touched, commit/push each repo separately and report both SHAs.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/application-agent/ingest_position_report.ts` | source metadata preservation if this import path is used |
| `career-os/scripts/application-agent/frontdoor_queue.ts` | source metadata preservation if this queue path is used |
| `career-os/data/runtime/live-position-postings.plan048-smoke.md` | read-only input evidence from phase-03 |
| `app/dashboard/...` | fos-career repo-relative dashboard source filter and diagnostics UI |
| `lib/...` | fos-career repo-relative reader/API support if needed |

---

## 검증

Career-os checks:

```bash
bun --check career-os/scripts/application-agent/run.ts
bun --check career-os/scripts/application-agent/ingest_position_report.ts
bun --check career-os/scripts/application-agent/frontdoor_queue.ts
git -C career-os diff --check
```

fos-career checks, if fos-career files are changed:

```bash
npm run lint
npm run build
```

Commit/push boundary:

```bash
git status --short
git add career-os/scripts/application-agent career-os/data/runtime/live-position-postings.plan048-smoke.md
git commit -m "feat(career-os): preserve source diagnostics for position import"
git push origin main
```

If fos-career is touched, run its own `git status --short`, add intended files only, commit, and push from that repo.

보고 직전 반드시 검증 bash를 실행하고 stdout raw result를 남긴다.

---

## 의도 메모

- Dashboard source filter is a read/display feature, not a new external action.
- The dashboard should help the user see source coverage quality without turning detailed collector failures into UI noise.
- Do not expose private absolute paths, private credentials, or account-specific runtime metadata.

## Blocked 조건

- fos-career repo has unrelated dirty state before edits: `PHASE_BLOCKED: fos-career dirty state before dashboard edits` 출력 후 exit 2.
- career-os repo has unrelated dirty state before commit: `PHASE_BLOCKED: career-os dirty state before commit` 출력 후 exit 2.
