#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_ROOT="${TASK_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
REPORT_DATE="${REPORT_DATE:-$(TZ=Asia/Seoul date +%F)}"

# Load workspace env if present.
ENV_FILE="${STOCK_ENV_FILE:-$TASK_ROOT/.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

cd "$TASK_ROOT"

stdout_file="$(mktemp)"
stderr_file="$(mktemp)"
cleanup() {
  rm -f "$stdout_file" "$stderr_file"
}
trap cleanup EXIT

set +e
claude --permission-mode bypassPermissions -p "/stock-investing-morning-brief" >"$stdout_file" 2>"$stderr_file"
status=$?
set -e

report_path="$TASK_ROOT/data/$REPORT_DATE/report.md"

if [[ "$status" -ne 0 ]]; then
  echo "[stock-investing-morning-brief] Claude runner failed (exit=$status)" >&2
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

echo "[stock-investing-morning-brief] Claude exited 0 but produced no stdout and no report." >&2
echo "Expected report: $report_path" >&2
exit 1
