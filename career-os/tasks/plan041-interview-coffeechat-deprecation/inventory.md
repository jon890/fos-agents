# plan041 inventory — coffeechat deprecation

## 폐기

- `interview-coffeechat-prep` active native skill entrypoint.
- coffeechat default mode, coffeechat-specific prompt assumptions, and "coffeechat strategy report" routing from position recommendation.
- `config/mvp-target.json` active `primary.interview.coffeechat` object. Historical reports and ADR records remain.

## 이관

- Company site collection for interview preparation moves to `scripts/interview-prep-analyzer/collect_interview_sites.ts`.
- Reusable first-round/final-round/offer preparation guidance moves to `.claude/skills/interview-prep-analyzer/SKILL.md`.
- Supported interview stages after migration: `first-round`, `final-round`, `offer-chat`.
- The analyzer may use company sites, candidate profile, prep notes, and collected source text, but must not assume coffeechat formality, attendee role, internal referral context, or evaluation style.

## 보존

- `docs/adr.md` ADR-029/ADR-034/ADR-048 and old task directories stay as history.
- Existing `data/reports`, `data/prep`, and `data/source` artifacts are not deleted.
- `.claude/skills/interview-coffeechat-prep/` remains only as a deprecated tombstone so stale callers fail with guidance instead of silently running old behavior.
- `scripts/interview-coffeechat-prep/` remains only as a deprecated compatibility boundary.

## 확인 필요

- `docs/data-schema.md` still contains historical coffeechat schema explanation. It should be refreshed in a later schema cleanup if the new interview-prep collector becomes the only schema owner.
- Existing prep assets under `data/prep/cj-foodville*` may still contain coffeechat wording if they are historical. Do not reuse those assumptions for new first-round/final/offer reports.
- Any external cron or shell alias calling `/interview-coffeechat-prep` should be removed if discovered outside this repo.
