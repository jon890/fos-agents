#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/apartment}"
SKILL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="${CONFIG_FILE:-$TASK_ROOT/config/interior-reference-digest.json}"
DECISION_FILE="${DECISION_FILE:-$TASK_ROOT/docs/interior/lucky-5-1004-interior-decisions.md}"
DECISION_QUEUE_FILE="${DECISION_QUEUE_FILE:-$TASK_ROOT/docs/interior/lucky-5-1004-decision-queue.md}"
REFERENCE_FILE="${REFERENCE_FILE:-$TASK_ROOT/docs/interior/interior-references.md}"
REPORT_DATE="${REPORT_DATE:-$(date +%F)}"
OUTDIR="${OUTPUT_ROOT:-$TASK_ROOT/data/interior-reference-digest}/$REPORT_DATE"
REQUEST_MD="$OUTDIR/request.md"
REPORT_MD="$OUTDIR/report.md"

mkdir -p "$OUTDIR"

cat > "$REQUEST_MD" <<EOF
# 오늘의 인테리어 추천 요청

Run the apartment interior reference recommendation workflow.

Inputs:
- Config: $CONFIG_FILE
- Decision note: $DECISION_FILE
- Decision queue: $DECISION_QUEUE_FILE
- Reference notebook: $REFERENCE_FILE
- Output report: $REPORT_MD

Required behavior:
1. Read the config, decision note, decision queue, and recent 7 days of previous reports if present.
2. Use web_search/web_fetch to find current interior references.
3. Prioritize 오늘의집, 네이버 블로그, and local/interior portfolio pages.
4. Score candidates against the config rubric.
5. Write the markdown digest to $REPORT_MD.
6. Append strong reference candidates to the reference notebook with stable R-00X IDs.
7. Do not auto-confirm decisions in the decision note; only list decision candidates unless the user explicitly confirmed.
8. If delivering to Discord, send only a concise summary with 3-5 recommendations and exactly three decision questions for today.
9. The three decision questions must come from the `다음 남은 질문` section in the decision queue. Do not repeat the same topic from the recent 7 days of reports. Do not ask again about items under `클리어 완료` or marked 결정/방향 결정/현장 확인 후 최종 결정 unless today's evidence materially changes the decision. Each question must include short A/B/C options and a recommendation.

Do not contact vendors or request quotes.
EOF

cat > "$REPORT_MD" <<EOF
# 오늘의 인테리어 추천

- 날짜: $REPORT_DATE
- 상태: 준비됨

이 파일은 runner가 만든 자리표시자입니다. 실제 추천 리포트는 OpenClaw agent가 $REQUEST_MD 를 읽고 web_search/web_fetch로 후보를 조사한 뒤 덮어써야 합니다.
EOF

echo "$REQUEST_MD"
echo "$REPORT_MD"
