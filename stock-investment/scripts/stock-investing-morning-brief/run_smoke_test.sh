#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/stock-investment}"
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
REPORT_DATE="${REPORT_DATE:-smoke-$(TZ=Asia/Seoul date +%Y%m%dT%H%M%S)}"
OUTDIR="$TASK_ROOT/data/$REPORT_DATE"

mkdir -p "$OUTDIR"
python3 "$SKILL_DIR/collect_sources.py" \
  "$TASK_ROOT/config/watchlist.json" \
  "$TASK_ROOT/config/sources.json" \
  "$OUTDIR/market-data.json" \
  "$OUTDIR/raw-news.json"

echo "Smoke test passed: $OUTDIR"
