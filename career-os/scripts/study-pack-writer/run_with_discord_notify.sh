#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHARED_NOTIFY="$ROOT_DIR/../_shared/lib/notify_discord.ts"
ENV_FILE="$ROOT_DIR/.env"
LOG_DIR="$ROOT_DIR/logs/study-pack-writer"
CLAUDE_BIN="${STUDY_PACK_WRITER_CLAUDE_BIN:-claude}"
mkdir -p "$LOG_DIR"

TOPIC="$*"
if [[ -z "${TOPIC// }" ]]; then
  echo "usage: $0 <topic-or-natural-language-request>" >&2
  exit 2
fi

RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/${RUN_ID}.log"
STARTED_AT="$(date '+%Y-%m-%d %H:%M:%S %Z')"

notify() {
  local message="$1"
  if [[ ! -f "$SHARED_NOTIFY" ]]; then
    echo "[warn] notify script not found: $SHARED_NOTIFY" >&2
    return 0
  fi
  bun --env-file="$ENV_FILE" "$SHARED_NOTIFY" "$message" >/dev/null 2>>"$LOG_FILE" || {
    echo "[warn] discord notify failed" >&2
    return 0
  }
}

short_topic() {
  python3 - "$TOPIC" <<'PY'
import sys
s = sys.argv[1].strip().replace('\n', ' ')
print(s if len(s) <= 120 else s[:117] + '...')
PY
}

TOPIC_SHORT="$(short_topic)"

notify "[시작] study-pack-writer: ${TOPIC_SHORT}"

{
  echo "[run_id] $RUN_ID"
  echo "[started_at] $STARTED_AT"
  echo "[topic] $TOPIC"
  echo "[cwd] $ROOT_DIR"
  echo "[claude_bin] $CLAUDE_BIN"
  echo "--- claude output ---"
} >"$LOG_FILE"

cd "$ROOT_DIR" || exit 1
"$CLAUDE_BIN" --permission-mode acceptEdits -p "/study-pack-writer ${TOPIC}" >>"$LOG_FILE" 2>&1
STATUS=$?

if [[ $STATUS -eq 0 ]]; then
  SHA="$(git -C "$ROOT_DIR/sources/fos-study" rev-parse --short HEAD 2>/dev/null || true)"
  notify "[완료] study-pack-writer: ${TOPIC_SHORT}${SHA:+ (fos-study ${SHA})}"
else
  TAIL="$(tail -n 20 "$LOG_FILE" | sed 's/[[:cntrl:]]//g' | tail -c 1500)"
  notify "[에러] study-pack-writer 실패: ${TOPIC_SHORT}
exit=${STATUS}
log=${LOG_FILE}

최근 로그:
${TAIL}"
fi

exit "$STATUS"
