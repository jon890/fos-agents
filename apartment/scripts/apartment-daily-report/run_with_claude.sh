#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/apartment}"
REPORT_DATE="${REPORT_DATE:-$(date +%F)}"

# Load workspace env if present (NAVER_COOKIE 등 선택적 인증 정보)
ENV_FILE="${APARTMENT_ENV_FILE:-$HOME/ai-nodes/apartment/.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

NOTIFIER="$HOME/ai-nodes/_shared/lib/notify_discord.ts"
notify_safe() {
  local msg="$1"
  if [[ -f "$NOTIFIER" ]]; then
    bun run "$NOTIFIER" "$msg" || true
  fi
}

cd "$TASK_ROOT"

notify_safe "[시작] apartment-daily-report 데이터 수집 및 리포트 생성 시작 (${REPORT_DATE})"

stdout_file="$(mktemp)"
stderr_file="$(mktemp)"
cleanup() {
  rm -f "$stdout_file" "$stderr_file"
}
trap cleanup EXIT

set +e
claude --permission-mode bypassPermissions -p "/apartment-daily-report" >"$stdout_file" 2>"$stderr_file"
status=$?
set -e

report_path="$TASK_ROOT/data/$REPORT_DATE/report.md"

if [[ "$status" -ne 0 ]]; then
  echo "[apartment-daily-report] Claude runner failed (exit=$status)" >&2
  notify_safe "[실패] apartment-daily-report Claude runner 실패 (exit=$status, ${REPORT_DATE})"
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

echo "[apartment-daily-report] Claude exited 0 but produced no stdout and no report." >&2
echo "Expected report: $report_path" >&2
if [[ -s "$TASK_ROOT/.omc/state/last-tool-error.json" ]]; then
  echo "--- last tool error ---" >&2
  cat "$TASK_ROOT/.omc/state/last-tool-error.json" >&2
fi
exit 1
