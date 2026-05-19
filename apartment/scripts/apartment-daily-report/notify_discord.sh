#!/usr/bin/env bash
set -euo pipefail
CHANNEL_ID="${DISCORD_CHANNEL_ID:-1496746450468733038}"
MESSAGE="${1:-}"
if [[ -z "$MESSAGE" ]]; then
  echo "usage: notify_discord.sh <message>" >&2
  exit 1
fi
openclaw message send --channel discord --target "channel:${CHANNEL_ID}" --message "$MESSAGE" --json >/dev/null
