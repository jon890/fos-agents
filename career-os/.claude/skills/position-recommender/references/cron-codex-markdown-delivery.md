# Cron Codex Markdown delivery checklist

Use this when a scheduled Hermes/Codex run asks for a daily position recommendation and explicitly names `report.md` plus `data/runtime/position-recommendation.md` as deliverables.

## Execution pattern

1. Load the canonical `position-recommender` skill and required context files first.
2. Try live collection with the available TypeScript runtime (`bun` first, otherwise Node 22+):
   - `node scripts/position-recommender/collect_live_postings.ts`
3. Read the new `data/runtime/live-position-postings.md` diagnostics and use only entries with:
   - `link_type: direct_posting`
   - `posting_status: active` or `posting_status: open`
   - an individual posting URL.
4. If the caller only requires Markdown outputs, it is acceptable to write the dated `report.md` directly instead of forcing the JSON renderer path, provided live collection succeeded or the caller explicitly allowed an existing active-only snapshot.
5. Mirror the report byte-for-byte to `data/runtime/position-recommendation.md`.
6. Still generate a simple HTML copy under `data/runtime/downloads/position-recommendation-full-YYYY-MM-DD.html`; each URL in the report should become an `<a href>` link.
7. Verify before final response:
   - dated report exists and is non-empty
   - runtime markdown exists and is byte-identical (`cmp` or equivalent)
   - download HTML exists and has posting links
   - final Discord-style response stays within the caller's requested line budget.
   - if the caller asks for a 30-70 line Discord output, keep only the final delivered summary in that range; the saved `report.md` can remain a full detailed report.
8. If a referenced optional/migrated skill file is missing, mention that limitation once and continue from the canonical career-os skill/context; do not fail the daily recommendation for that alone.

## Reporting notes

- If live collection succeeded, say so briefly with `direct_active_or_open_postings` and `source_counts`.
- If a requested optional/migrated context file is missing, state the limitation once and continue with canonical career-os sources; do not fail the daily report for that alone.
- Do not expose tool-guard details, approval mechanics, or long internal command transcripts in the user-facing summary.
- Include report paths when the cron caller explicitly asks for them, even though ordinary Discord preview text normally avoids internal paths.
