---
name: knee-progress-intake
description: Use when the user reports knee symptoms, swelling, instability, range of motion, walking/stairs, exercises done, or next-day reactions and wants the health-care private context updated.
---

# knee-progress-intake

Structure the user’s knee progress report into private health-care data.

## Inputs

- User report from the current conversation.
- `health-care/data/conditions/knee-patellar-instability/current-context.md` if available.
- `health-care/docs/data-schema.md` for the `progress-log.jsonl` schema.

## Data targets

Private data only:

- Append to `health-care/data/conditions/knee-patellar-instability/progress-log.jsonl`.
- Update `health-care/data/conditions/knee-patellar-instability/current-context.md` only when the new report changes the current state.

Never move these details into `docs/`, `config/`, or public skill files.

## `progress-log.jsonl` entry fields

Use one JSON object per line:

- `date`: `YYYY-MM-DD`
- `pain`: string or null
- `instability`: string or null
- `swelling_heat`: string or null
- `range_of_motion`: string or null
- `walking_stairs`: string or null
- `actions`: string array
- `next_day_reaction`: string or null
- `red_flags`: string array
- `source`: usually `user_report`
- `created_at`: ISO-8601 timestamp

Use null when the user did not mention a field. Do not invent values.

## Current context update rules

Separate these clearly:

- 확정 사실: user directly stated it or a reliable record already says it.
- 사용자 보고: subjective symptoms, today’s reaction, perceived stability.
- 확인 필요: OCR ambiguity, medical interpretation, or anything requiring clinician review.

If a report contains red flags, do not silently normalize it; call out that re-evaluation may be safer.

## Safety/privacy rules

- Do not diagnose or prescribe.
- Do not infer medical conclusions beyond the user’s report.
- Do not store raw platform IDs, hospital registration numbers, or unnecessary personal identifiers.
- If a public/private boundary is ambiguous, ask before writing outside `data/`.
