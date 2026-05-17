---
name: weekly-knee-clinic-summary
description: Use for weekly knee progress reviews, clinic-visit preparation, one-page medical context summaries, and question-list updates using Claude-quality synthesis while preserving health-care privacy boundaries.
---

# weekly-knee-clinic-summary

Create a weekly or pre-clinic Korean summary from private health-care data.

## When to use

Use this skill when the user asks for:

- 주간 무릎 경과 요약
- 병원에 가져갈 1페이지 요약
- 의사에게 물어볼 질문 업데이트
- 최근 증상 로그 기반 재진 필요성 정리

Claude or another stronger model may be useful here because synthesis quality matters more than daily repetition.

## Inputs

Read only if available:

- `health-care/data/conditions/knee-patellar-instability/current-context.md`
- `health-care/data/conditions/knee-patellar-instability/progress-log.jsonl`
- `health-care/data/conditions/knee-patellar-instability/clinic-records-ocr-*.md`
- `health-care/config/knee-running-recovery-plan.md`
- `health-care/config/public-health-care-policy.md`

Do not fail if `progress-log.jsonl` does not exist yet; say there is not enough logged progress.

## Output target

Default private artifact:

- `health-care/data/conditions/knee-patellar-instability/weekly-summaries/YYYY-MM-DD.md`

A short Discord summary may be sent after writing the private artifact. Do not send full sensitive content unless the user explicitly asks.

## Summary structure

Use concise Korean sections:

1. 이번 주 핵심 변화
2. 현재 남은 문제
3. 운동/일상에서의 반응
4. 중단/축소해야 하는 신호
5. 병원에 물어볼 질문
6. 확인 필요 / OCR 불확실성

## Safety/privacy rules

- Do not diagnose, prescribe, or replace clinician judgment.
- Clearly separate 확정 사실, 사용자 보고, OCR 기반 정보, 확인 필요.
- Keep OCR uncertainty visible; do not upgrade unclear OCR into fact.
- Public/external sharing requires explicit user confirmation.
- Do not expose raw personal identifiers, exact hospital identifiers, Discord/server/user IDs, or unnecessary private record details.
