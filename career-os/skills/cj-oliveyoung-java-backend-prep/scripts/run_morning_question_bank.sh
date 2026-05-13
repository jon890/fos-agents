#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
NOTIFY_SCRIPT="$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/notify_discord.sh"
TOPIC="${QUESTION_BANK_TOPIC_OVERRIDE:-experience-qbank-ai-service-team}"
OUTPUT_PATH="$(python3 - <<"PY" "$TASK_ROOT/config/topics.json" "$TOPIC"
import json, sys
from pathlib import Path
topics_cfg=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(topics_cfg['question-bank'][sys.argv[2]]["outputPath"])
PY
)"
"$NOTIFY_SCRIPT" "[시작] ${TOPIC} 면접 질문팩 업데이트 시작"
set +e
bash "$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh" question-bank "$TOPIC"
code=$?
set -e
if (( code == 0 )); then
  "$NOTIFY_SCRIPT" "[완료] ${TOPIC} 면접 질문팩 업데이트 완료 (${OUTPUT_PATH})"
else
  "$NOTIFY_SCRIPT" "[실패] ${TOPIC} 면접 질문팩 업데이트 실패 (exit ${code})"
  exit "$code"
fi
