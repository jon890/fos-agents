# Operation Test — 2026-05-27

## Scope

Manual operation test for `plan031-application-flow-agent` using the current live ledger and the 2026-05-27 position recommendation report.

Commands exercised:

```bash
bun scripts/application-agent/run.ts validate --ledger data/applications/ledger.jsonl
bun scripts/application-agent/run.ts ingest-position-report data/reports/daily/2026-05-27/position-recommendation/report.md --ledger data/applications/ledger.jsonl
bun scripts/application-agent/run.ts dry-run --ledger data/applications/ledger.jsonl
bun scripts/application-agent/run.ts run-once --ledger data/applications/ledger.jsonl
```

Ledger backup before ingest:

```text
data/runtime/application-agent/backups/ledger-before-2026-05-27-optest.jsonl
```

## Result

- Initial ledger validation passed with 1 existing record.
- Ingest parsed 2 positions from the 2026-05-27 markdown report.
- 2 new ledger records were added:
  - `app-software-engineer-backend-3-036794c5-nelvoi` — 당근페이, fitScore 85, high priority.
  - `app-software-engineer-backend-3-d7ff7df2-nelvoi` — 당근 광고, fitScore 75, normal priority.
- Post-ingest validation passed with 3 records.
- First `run-once` advanced 당근페이 from `discovered` to `analyzing`.
- Second `run-once` advanced 당근페이 from `analyzing` to `preparing_application`.

## Blocker Found

The next dry-run showed that the runtime would advance 당근페이 from `preparing_application` to `needs_revision` via `call_application_package_writer`, even though the `application-package-writer` and `application-reviewer` artifacts do not exist yet.

This means the current runtime is closer to:

```text
policy decision -> command suggestion -> ledger transition
```

than the intended:

```text
policy decision -> execute tool/skill -> validate artifacts -> ledger transition
```

The third `run-once` was intentionally not executed to avoid a false-positive transition.

## Recommendation

Do not register cron yet.

Before another live operation pass, implement one of these fixes:

1. Preferred: make `run-once` execute the relevant native skill commands and only update ledger after required artifacts exist.
2. Minimum guard: block `preparing_application -> needs_revision` unless expected package/review artifact paths exist and validate.

Given the product direction is a real autonomous application-flow agent, option 1 is the right next plan.
