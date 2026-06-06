# Phase 05 — End-to-end verification and final failure summary

**Model**: haiku
**Status**: pending

---

## 목표

source collection, import, dashboard 표시를 end-to-end로 검증하고, 실패한 source가 성공한 source를 막지 않는지 최종 요약한다.

**범위 외**: 새 feature 구현, source adapter logic 변경.
이 phase는 검증과 task status update만 수행하고, intended files only로 commit/push한다.

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
- `career-os/docs/flow.md` — position collection and dashboard flow
- `career-os/docs/data-schema.md` — diagnostics fields
- `career-os/tasks/plan048-target-source-coverage-dashboard/index.json`

---

## 작업 항목

### 1. collector end-to-end smoke

Run `--source all` to a plan-specific runtime file and verify every configured source appears in diagnostics.
Confirm Wanted broad scan remains present and Toss is included when source set is `all`.

### 2. active/open evidence check

Verify every import candidate has direct posting URL, active/open status, detail evidence, source, and discovery mode.
Reject career articles, search pages, and unknown status as import candidates.

### 3. import/dashboard verification

Run the smallest available import/dashboard verification path.
If a dev server or browser check is required, run it only long enough to capture source filter and diagnostics behavior, then stop it.

### 4. failure isolation summary

Write a concise final source summary in phase stdout:

- configured sources
- successful sources
- failed sources
- imported candidate counts
- skipped candidate counts
- dashboard-visible diagnostics
- runtime-only failure details location

### 5. task status and commit

Mark `career-os/tasks/plan048-target-source-coverage-dashboard/index.json` as completed only after checks pass.
Commit/push intended verification/status files only.

---

## 검증

```bash
bun career-os/scripts/position-recommender/collect_live_postings.ts \
  --source all \
  --out career-os/data/runtime/live-position-postings.plan048-final.md
test -s career-os/data/runtime/live-position-postings.plan048-final.md
rg -n "requested_source|configured_sources|source_counts|source_diagnostics|active_evidence|discovery_mode" career-os/data/runtime/live-position-postings.plan048-final.md
! rg -n "posting_status: unknown|link_type: career_article|link_type: search_page" career-os/data/runtime/live-position-postings.plan048-final.md
git diff --check
```

Status update and commit/push boundary:

```bash
git status --short
git add career-os/data/runtime/live-position-postings.plan048-final.md \
  career-os/tasks/plan048-target-source-coverage-dashboard/index.json
git commit -m "test(career-os): verify target source coverage"
git push origin main
```

If run-phases.py writes trailing task metadata after the commit, perform one cleanup commit with only the task index metadata and push it.

보고 직전 반드시 모든 검증 bash를 실행하고 stdout raw result를 남긴다.

---

## 의도 메모

- This phase proves the dashboard can show the postings the user cares about without hiding broad Wanted coverage.
- Failed source reporting must be visible enough for operator triage but short enough for dashboard scanning.

## Blocked 조건

- A source requires private credentials or account state to verify active/open status: `PHASE_BLOCKED: source requires private credentials` 출력 후 exit 2.
- Any import candidate lacks detail evidence: `PHASE_FAILED: import candidate missing active/open evidence` 출력 후 exit 1.
- Failure in one source stops successful source output: `PHASE_FAILED: source failure isolation broken` 출력 후 exit 1.
