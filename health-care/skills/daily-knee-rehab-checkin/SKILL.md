---
name: daily-knee-rehab-checkin
description: Use for health-care daily morning knee rehab check-ins, conservative patellar instability recovery reminders, and running-return guidance based on the private knee context plus the public recovery plan.
---

# daily-knee-rehab-checkin

Generate a short Korean morning check-in for the private health channel.

## Inputs

Read when available:

- `health-care/data/conditions/knee-patellar-instability/current-context.md` — private current state.
- `health-care/config/knee-running-recovery-plan.md` — public-safe staged recovery plan.
- `health-care/config/public-health-care-policy.md` — privacy boundary.

If private data is unavailable, use only the public recovery plan and say the context file was unavailable.

## Output shape

Keep the message concise and Discord-safe:

1. Say this is a daily check-in/reminder.
2. State the likely stage cautiously, e.g. “현재 기록 기준으로는 0단계/1단계에 가깝다”.
3. List 3-5 safe actions for today.
4. List what to avoid today.
5. Include 중단 기준.
6. Include 재진/상담 기준.
7. Ask one short question that helps tomorrow’s plan.

## Safety rules

- Do not diagnose, prescribe, or claim medical certainty. 한국어 안내에서도 진단/처방처럼 들리는 표현은 피한다.
- Do not tell the user to progress to running unless the documented criteria are met and clinician/physical therapist confirmation is encouraged.
- Always include 중단 기준: 빠질 듯한 느낌, 찌르는 통증, 붓기/열감 증가, 덜그럭거림 증가, 잠김/걸림, 다음날 악화.
- Prefer conservative scale-down advice over “push through”.
- Do not expose raw personal identifiers, exact hospital identifiers, Discord/server/user IDs, or unnecessary private record details.
- If symptoms appear worse than the plan’s re-evaluation criteria, recommend earlier clinic re-evaluation rather than waiting.

## Default tone

Warm, brief, and practical. No markdown tables.
