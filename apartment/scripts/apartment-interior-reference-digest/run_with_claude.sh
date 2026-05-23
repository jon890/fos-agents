#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/apartment}"
REQUEST_TEXT="${*:-}"

if [[ -z "$REQUEST_TEXT" ]]; then
  REQUEST_TEXT="cron 실행: 오늘의 인테리어 추천을 생성하고, report.md 저장/레퍼런스 노트 갱신/Discord용 요약까지 출력해줘."
fi

cd "$TASK_ROOT"
exec claude --permission-mode bypassPermissions -p "/apartment-interior-reference-digest ${REQUEST_TEXT}"
