#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
DATE="${REPORT_DATE:-$(date +%F)}"
TOPIC="${DAILY_TOPIC:-}"
_MVP="$TASK_ROOT/config/mvp-target.json"
PRIMARY_COMPANY=$(python3 -c "import json; d=json.load(open('$_MVP')); print(d['primary']['company'])")
PRIMARY_ROLE=$(python3 -c "import json; d=json.load(open('$_MVP')); print(d['primary']['role'])")
OUTDIR="$TASK_ROOT/data/reports/daily/$DATE"
PROFILE="$TASK_ROOT/config/candidate-profile.md"
PROMPT_FILE="$TASK_ROOT/skills/knowledge-gap-analyzer/references/daily-prompt.md"
SOURCE_DIR="$TASK_ROOT/sources/fos-study"
TOPIC_MAP="$TASK_ROOT/config/topic-file-map.json"
PROGRESS_FILE="$TASK_ROOT/data/study-progress.json"
TARGET_LIST="$OUTDIR/target-files.txt"
INPUT_NOTE="$OUTDIR/analysis-input.md"
REPORT_MD="$OUTDIR/report.md"
CLAUDE_JSON="$OUTDIR/claude.result.json"
FALLBACK_MD="$OUTDIR/report.fallback.md"
TARGET_BUILDER="$TASK_ROOT/scripts/knowledge-gap-analyzer/build_target_file_list.py"
TOPIC_SELECTOR="$TASK_ROOT/scripts/knowledge-gap-analyzer/select_topic.py"
mkdir -p "$OUTDIR"

# --- Git sync ---
if [[ ! -d "$SOURCE_DIR/.git" ]]; then
  git clone --depth=1 https://github.com/jon890/fos-study.git "$SOURCE_DIR"
else
  git -C "$SOURCE_DIR" pull --ff-only
fi

# --- Topic resolution ---
# DAILY_TOPIC env var takes priority; otherwise auto-select from study-progress.json
if [[ -z "$TOPIC" ]]; then
  TOPIC=$(python3 "$TOPIC_SELECTOR" "$PROGRESS_FILE")
else
  echo "Using specified topic: $TOPIC"
fi
echo "Topic: $TOPIC"

# --- Build target file list (3-5 files for the selected topic) ---
python3 "$TARGET_BUILDER" "$SOURCE_DIR" "$TARGET_LIST" \
  --topic "$TOPIC" \
  --topic-map "$TOPIC_MAP"

# --- Build analysis input note ---
# Resolve {{primary.company}}/{{role}} placeholders from mvp-target.json
bun "$TASK_ROOT/_shared/lib/build_prompt.ts" "$PROMPT_FILE" > "$OUTDIR/resolved-prompt.md"

cat > "$INPUT_NOTE" <<EOF
$(cat "$OUTDIR/resolved-prompt.md")

다음 경로의 파일을 직접 읽고 분석한다:
- 지원자 프로필: $PROFILE
- 소스 레포지토리 루트: $SOURCE_DIR
- 대상 파일 목록: $TARGET_LIST
- 오늘의 포커스 토픽: $TOPIC
EOF

# --- Claude synthesis ---
if timeout 420s claude --permission-mode bypassPermissions --print --output-format json \
  "Read $INPUT_NOTE and complete the requested analysis. Write only the final markdown report." \
  > "$CLAUDE_JSON"; then

  bun run "$HOME/ai-nodes/_shared/lib/invoke_claude_skills.ts" extract \
    "$CLAUDE_JSON" "$REPORT_MD" "${TRACK_TASK_CLAUDE_USAGE_FILE:-}"

  # --- Update study-progress.json ---
  python3 "$TASK_ROOT/scripts/knowledge-gap-analyzer/update_study_progress.py" \
    "$PROGRESS_FILE" "$TOPIC" "$TARGET_LIST"

else
  cat > "$FALLBACK_MD" <<EOF
# ${PRIMARY_COMPANY} ${PRIMARY_ROLE} Prep Daily Report

- Status: Claude synthesis failed, fallback report created
- Topic: $TOPIC
- Candidate profile: $PROFILE
- Source repository root: $SOURCE_DIR
- Target file list: $TARGET_LIST
- Note: rerun daily report after checking Claude/auth environment
EOF
  cp "$FALLBACK_MD" "$REPORT_MD"
fi

echo "Wrote: $TARGET_LIST"
echo "Wrote: $INPUT_NOTE"
echo "Wrote: $CLAUDE_JSON"
echo "Wrote: $REPORT_MD"
