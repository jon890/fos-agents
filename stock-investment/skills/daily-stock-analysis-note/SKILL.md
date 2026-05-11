---
name: daily-stock-analysis-note
description: Generate and publish one daily Korean blog-style AI/tech stock observation note for US/Korean equities, including narrative, earnings, outlook, risks, and watchpoints. Use for daily stock candidate analysis, blog publishing, and cron scheduling.
---

# Daily Stock Analysis Note

Generate one Korean blog-style company analysis note each morning.

## Policy

- Frame output as `관찰 후보 / 분석 후보`, never direct buy/sell advice.
- Universe: US + Korea only.
- Focus: AI real-world productivity, semiconductor, data center, power infrastructure, cloud, automation, and related software/platform companies.
- Be explicit about uncertainty; separate facts from interpretation.
- Publish the full markdown note under the local `fos-study/finance/` tree, then commit and push only the generated file.
- Send Discord only a concise summary and the published path.

## Invocation

```bash
~/ai-nodes/stock-investment/skills/daily-stock-analysis-note/scripts/run_daily_note.sh
```

Optional:

```bash
TICKER=NVDA ~/ai-nodes/stock-investment/skills/daily-stock-analysis-note/scripts/run_daily_note.sh
SKIP_NOTIFY=1 SKIP_PUSH=1 ~/ai-nodes/stock-investment/skills/daily-stock-analysis-note/scripts/run_daily_note.sh
```

## Output

- Runtime artifacts: `~/ai-nodes/stock-investment/data/daily-notes/YYYY-MM-DD/`
- Blog markdown: `~/ai-nodes/career-os/sources/fos-study/finance/investing/ai-tech-stock/YYYY-MM-DD-<ticker>.md`

## Cron

Preferred schedule: 09:00 Asia/Seoul, separated from existing 08:00 morning briefs.
