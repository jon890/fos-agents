---
name: interview-coffeechat-prep
description: Deprecated tombstone. Do not use for new work. Coffeechat-specific automation was retired by ADR-048; use interview-prep-analyzer for first-round, final-round, and offer-stage interview preparation.
---

# Deprecated: Interview Coffeechat Prep

This skill is intentionally retired.

Do not generate company-specific coffeechat strategy reports from this entrypoint. Coffeechat formats vary by company, attendee, purpose, and formality level, so the old automation created too much risk of assuming context the user did not confirm.

## Replacement

Use `/interview-prep-analyzer` for reusable interview preparation:

- `first-round`: company and role context, candidate positioning, likely questions, answer risks, reverse questions.
- `final-round`: decision-maker concerns, leadership/ownership evidence, high-risk follow-ups.
- `offer-chat`: constraints, negotiation prep, expectations, and questions to clarify.

If the user explicitly asks about a coffeechat, do not run automation. Ask for the company, attendee/context if known, and purpose of the conversation, then treat it as an unstructured interview-prep note through `/interview-prep-analyzer` only after those facts are available.

Historical details are kept in `docs/adr.md` ADR-029, ADR-034, and ADR-048.
