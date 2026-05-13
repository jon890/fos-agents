---
name: cj-foodville-coffeechat-prep
description: Prepare private CJ Foodville coffee-chat strategy and backend service/site insight reports for the candidate. Use when the user asks for CJ푸드빌/Foodville 커피챗 preparation, conversation flow, company/service interest points, backend insights from VIPS/제일제면소/CJ Foodville sites, or Claude-backed review of coffee-chat positioning. Outputs private career-os reports, not public fos-study posts.
---

# CJ Foodville Coffee Chat Prep

Use this skill to prepare a private CJ Foodville coffee-chat strategy report.

## Entrypoint

Run:

```bash
/home/bifos/ai-nodes/career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh foodville-coffeechat
```

Direct runner:

```bash
/home/bifos/ai-nodes/career-os/skills/cj-foodville-coffeechat-prep/scripts/run_foodville_coffeechat_prep.sh
```

Optional context:

```bash
FOODVILLE_CONTEXT="extra user context" run_now.sh foodville-coffeechat
```

## Outputs

- Stable strategy note: `docs/prep/cj-foodville-coffeechat-strategy.md`
- Per-run report: `data/reports/daily/YYYY-MM-DD/cj-foodville-coffeechat/report.md`
- Latest runtime report: `data/runtime/cj-foodville-coffeechat-prep.md`
- Collected site snapshots: `data/source/cj-foodville-sites/`

Do not publish to `sources/fos-study` unless the user explicitly asks. This is interview-prep/private career material.

## Workflow

1. Read `docs/prep/cj-foodville-coffeechat-strategy.md` for the baseline positioning.
2. Collect or refresh site snapshots with `scripts/collect_foodville_sites.py`.
3. Ask Claude to review:
   - coffee-chat narrative and risks
   - expected interviewer intent
   - backend insights from VIPS, 제일제면소, and CJ Foodville brand pages
   - natural questions to ask in the coffee chat
4. Keep outputs practical: conversation flow, answer angles, question list, and backend/domain observations.

## Ambiguity policy

Discuss before changing these assumptions:

- Publishing destination changes from private report to `fos-study` or blog.
- Position target changes away from CJ Foodville digital-channel backend.
- User wants scripted answer memorization instead of conversation-flow prep.
- User wants browser-login or authenticated interactions with CJ services.

If the requested change is only adding more public pages or refining output tone, proceed and note the assumption.
