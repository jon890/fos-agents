#!/usr/bin/env bash
set -euo pipefail
CHANNEL_ID="${DISCORD_CHANNEL_ID:-1496746450468733038}"
MEDIA="${1:-}"
MESSAGE="${2:-}"
if [[ -z "$MEDIA" ]]; then
  echo "usage: notify_discord_media.sh <media-path> [message]" >&2
  exit 1
fi
args=(openclaw message send --channel discord --target "channel:${CHANNEL_ID}" --media "$MEDIA" --json)
if [[ -n "$MESSAGE" ]]; then
  args+=(--message "$MESSAGE")
fi
"${args[@]}" >/dev/null
