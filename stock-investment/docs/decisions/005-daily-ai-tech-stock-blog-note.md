# ADR-005: Daily AI/tech stock blog note

- Status: Accepted
- Date: 2026-05-08

## Context

The user wants one daily stock analysis candidate focused on companies likely to benefit from practical AI adoption and productivity gains. The output should be detailed enough to read like a Korean blog report, not just a compact Discord brief.

## Decision

Add a separate `daily-stock-analysis-note` workflow.

- Universe: US and Korean equities only.
- Focus: AI, semiconductors, data centers, power infrastructure, cloud, automation, and AI software/platforms.
- Tone: `관찰 후보 / 분석 후보`, not direct buy/sell recommendation.
- Full output: Korean markdown blog note.
- Publishing: write to `~/ai-nodes/career-os/sources/fos-study/investment/ai-tech-stock/`, commit, and push only the generated note.
- Runtime artifacts: `~/ai-nodes/stock-investment/data/daily-notes/YYYY-MM-DD/`.
- Schedule: around 09:00 Asia/Seoul to avoid clustering with existing 08:00 stock cron jobs.
- Keep `data/daily-notes/history.json` and penalize recently selected tickers so the same high-momentum stock is not repeatedly selected. If recent picks are all US names, give Korean names a modest rotation boost.

## Guardrails

- Separate verified data from interpretation.
- State when Korean stock data/news collection is weak.
- Do not present output as financial advice.
- Discord output should remain concise; the full blog note lives in fos-study.
