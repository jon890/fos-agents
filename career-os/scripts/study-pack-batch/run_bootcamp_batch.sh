#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
SOURCE_DIR="$TASK_ROOT/sources/fos-study"
TOPIC_CONFIG="$TASK_ROOT/config/topics.json"
RESOLVER="$TASK_ROOT/scripts/study-pack-writer/resolve_study_pack_topic.ts"
OUTDIR_BASE="$TASK_ROOT/data/reports/daily/${REPORT_DATE:-$(date +%F)}/bootcamp"
SUMMARY="$TASK_ROOT/data/runtime/bootcamp-summary.md"
mkdir -p "$OUTDIR_BASE" "$TASK_ROOT/data/runtime"

mapfile -t GENERATE_KEYS < <(python3 - "$TOPIC_CONFIG" "$SOURCE_DIR" <<'PY'
import json,sys
from pathlib import Path
data=json.loads(Path(sys.argv[1]).read_text())
cfg=data['bootcamp']
src=Path(sys.argv[2])
n=int(cfg.get('dailyGenerateCount',5))
keys=[k for k in cfg.get('topics',[]) if data['study-pack'].get(k) and not (src/data['study-pack'][k].get('outputPath','')).exists()]
for k in keys[:n]:print(k)
PY
)

{ echo "# bootcamp-batch $(date +%F)"; for k in "${GENERATE_KEYS[@]+"${GENERATE_KEYS[@]}"}"; do echo "- $k"; done; } > "$SUMMARY"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "[bootcamp-batch] DRY_RUN=1; skipping generation" >&2
  cat "$SUMMARY"; exit 0
fi

for topic in "${GENERATE_KEYS[@]+"${GENERATE_KEYS[@]}"}"; do
  echo "[bootcamp-batch] generating $topic" >&2
  eval "$("$RESOLVER" "$TOPIC_CONFIG" "$topic")"
  TASK_ROOT="$TASK_ROOT" OUTDIR="$OUTDIR_BASE/$topic" \
    bun run "$HOME/ai-nodes/career-os/scripts/_lib/study_pack_publish.ts"
done

{ echo "## 생성 완료"; for k in "${GENERATE_KEYS[@]+"${GENERATE_KEYS[@]}"}"; do echo "- $k"; done; } >> "$SUMMARY"
cat "$SUMMARY"
