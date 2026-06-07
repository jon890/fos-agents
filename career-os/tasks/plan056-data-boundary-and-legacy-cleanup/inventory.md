# plan056 phase-01 data inventory

Date: 2026-06-07
Worktree: `/home/bifos/ai-nodes-worktrees/plan056-phase01/career-os`

## Scope

Inventory command:

```bash
find data -maxdepth 3 -type f | sort
```

Observed files:

- `data/runtime/live-position-postings.plan048-final.md`
- `data/runtime/live-position-postings.plan048-smoke.md`

Observed directories:

- `data/`
- `data/runtime/`

`data/applications`, `data/reports`, `data/source`, and `data/private` are not present in this checkout at max depth 3. They are still part of the documented data boundary and are ignored by `.gitignore` through the `**/data/` rule unless files are explicitly tracked.

## Boundary Classification

### data/applications

Classification: private application preparation data.

Current inventory: no files present in this checkout.

Basis:

- `docs/data-schema.md` defines `data/applications/` as untracked private storage for job-specific application state, custom application packages, evidence/drift review, and digest inputs.
- `AGENTS.md` separates frontdoor queue candidates from ledger/application preparation and requires user review before final resume packages, external submission, or publishing.
- plan055 overlaps with this boundary because its required application package artifacts are `posting.md`, `fit-analysis.md`, `application-package.md`, `resume-draft.md`, `cover-letter.md`, `submission-checklist.md`, and `review.md`. Those artifacts belong under private application-specific paths when generated.

Action note: keep as private/untracked. Do not copy file bodies into task docs. If future cleanup finds generated resume package files here, classify by path and artifact type only.

### data/reports

Classification: generated report artifacts.

Current inventory: no files present in this checkout.

Basis:

- `docs/data-schema.md` documents `data/reports/baseline/YYYY-MM-DD/` and `data/reports/daily/YYYY-MM-DD/` as baseline/daily execution outputs.
- `docs/code-architecture.md` treats `data/reports/` as generated baseline/daily/position execution results, not hand-authored durable policy.

Retention/archive candidates:

- Keep recent baseline/daily reports that are still referenced by config, task decisions, application packages, or active interview prep.
- Archive or prune stale generated reports that have no live reference and are superseded by docs, ADRs, fos-study output, or current private application artifacts.
- Treat deletion as a later phase decision only; phase-01 records candidates, not moves or removals.

### data/runtime

Classification: mutable runtime state, normally untracked, with explicit tracked exceptions.

Current inventory:

- `data/runtime/live-position-postings.plan048-final.md`
- `data/runtime/live-position-postings.plan048-smoke.md`

Tracked exception status:

- `git ls-files --stage` reports both plan048 files as tracked `100644`.
- `git check-ignore -v` does not report either plan048 file as ignored, because tracked files remain in the index.

Basis:

- `docs/data-schema.md` and `docs/code-architecture.md` define `data/runtime/` as mutable state for topic inventory, feed cache, locks, position recommendations, application-agent eval artifacts, and similar generated state.
- The two plan048 files are historical tracked runtime exceptions and should be reviewed separately instead of generalized into a tracked-runtime rule.

Action note: keep these two files listed explicitly in later cleanup decisions:

- `data/runtime/live-position-postings.plan048-final.md`
- `data/runtime/live-position-postings.plan048-smoke.md`

### data/source

Classification: collected external notes/source material.

Current inventory: no files present in this checkout.

Basis:

- `docs/data-schema.md` documents `data/source/` as collected external notes and untracked data.
- `docs/code-architecture.md` places external collection notes here, separate from `sources/fos-study/`, which is the public study repository source tree.

Action note: treat as untracked source cache/input. If future files contain company, posting, or interview material, classify by path and source role without quoting content.

### data/private

Classification: private-only data boundary.

Current inventory: no files present in this checkout.

Basis:

- The phase requires `data/private` to be inventoried as a boundary.
- `.gitignore` ignores `data/private` through the broad `**/data/` rule.
- It is not documented as an active structured directory in the current `docs/data-schema.md`; if introduced later, it should be documented before becoming a standard storage owner.

Action note: no cleanup action available in this checkout. If later found, default to private/untracked until docs assign a narrower owner.

## Summary

- Actual max-depth-3 inventory contains only the two plan048 tracked runtime exception files.
- No `data/applications`, `data/reports`, `data/source`, or `data/private` files are present in this worktree checkout.
- `data/applications` remains the expected private owner for plan055 resume package artifacts when those artifacts exist.
- `data/reports` cleanup should be retention/archive based, not immediate deletion.
- The plan048 runtime exception files are confirmed tracked and must be handled as named exceptions in later phases.
