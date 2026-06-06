#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/apartment}"
REQUEST_TEXT="${*:-}"
REPORT_DATE="${REPORT_DATE:-$(date +%F)}"

if [[ -z "$REQUEST_TEXT" ]]; then
  REQUEST_TEXT="cron 실행: 오늘의 인테리어 추천을 생성하고, report.md 저장/레퍼런스 노트 갱신/Discord용 요약까지 출력해줘. 오늘 추천은 화이트/아이보리 기반에 밝은 오크·애쉬 우드를 20~30% 정도 섞은 레퍼런스를 우선해줘."
fi

cd "$TASK_ROOT"

stdout_file="$(mktemp)"
stderr_file="$(mktemp)"
cleanup() {
  rm -f "$stdout_file" "$stderr_file"
}
trap cleanup EXIT

set +e
claude --permission-mode bypassPermissions -p "/apartment-interior-reference-digest ${REQUEST_TEXT}" >"$stdout_file" 2>"$stderr_file"
status=$?
set -e

report_path="$TASK_ROOT/data/interior-reference-digest/$REPORT_DATE/report.md"

if [[ "$status" -ne 0 ]]; then
  echo "[apartment-interior-reference-digest] Claude runner failed (exit=$status)" >&2
  if [[ -s "$stderr_file" ]]; then
    echo "--- stderr ---" >&2
    tail -80 "$stderr_file" >&2
  fi
  if [[ -s "$stdout_file" ]]; then
    echo "--- stdout ---" >&2
    tail -80 "$stdout_file" >&2
  fi
  exit "$status"
fi

if [[ -s "$stdout_file" ]]; then
  cat "$stdout_file"
  exit 0
fi

if [[ -s "$report_path" ]]; then
  echo "[주의] Claude가 stdout 요약을 비워 종료했습니다. 리포트는 생성되어 있어 경로만 전달합니다."
  echo "리포트: $report_path"
  exit 0
fi

echo "[apartment-interior-reference-digest] Claude exited 0 but produced no stdout and no report." >&2
echo "Expected report: $report_path" >&2
if [[ -s "$TASK_ROOT/.omc/state/last-tool-error.json" ]]; then
  echo "--- last tool error ---" >&2
  cat "$TASK_ROOT/.omc/state/last-tool-error.json" >&2
fi
exit 1
