#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
DATE="${REPORT_DATE:-$(date +%F)}"
TOPIC="${DAILY_TOPIC:-}"
OUTDIR="$TASK_ROOT/data/reports/daily/$DATE"
PROFILE="$TASK_ROOT/config/candidate-profile.md"
PROMPT_FILE="$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/references/daily-prompt.md"
SOURCE_DIR="$TASK_ROOT/sources/fos-study"
TOPIC_MAP="$TASK_ROOT/config/topic-file-map.json"
PROGRESS_FILE="$TASK_ROOT/data/study-progress.json"
TARGET_LIST="$OUTDIR/target-files.txt"
INPUT_NOTE="$OUTDIR/analysis-input.md"
REPORT_MD="$OUTDIR/report.md"
CLAUDE_JSON="$OUTDIR/claude.result.json"
FALLBACK_MD="$OUTDIR/report.fallback.md"
TARGET_BUILDER="$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/build_target_file_list.py"
TOPIC_SELECTOR="$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/select_topic.py"
EXTRACT="$HOME/ai-nodes/_shared/bin/extract_claude_result.py"

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
cat > "$INPUT_NOTE" <<EOF
$(cat "$PROMPT_FILE")

다음 경로의 파일을 직접 읽고 분석한다:
- 지원자 프로필: $PROFILE
- 소스 레포지토리 루트: $SOURCE_DIR
- 대상 파일 목록: $TARGET_LIST
- 오늘의 포커스 토픽: $TOPIC

지시사항:
- target-files.txt 에 나열된 마크다운 파일만 읽는다.
- target-files.txt 의 파일 경로는 소스 레포지토리 루트 기준 상대 경로다.
- .claude/** 와 비-마크다운 파일은 무시한다.
- 카카오헬스케어 케어챗 AI Agent 개발자 포지션 준비에 초점을 맞춘다.
- DB를 약점 가능성이 높은 영역으로 다루고, 스터디 노트가 이를 뒷받침하는지 검증한다.
- interview/kakao-healthcare-carechat-ai-agent.md 의 근거를 우선한다.
- 최종 리포트는 한국어로 작성한다.
EOF

# --- Claude synthesis ---
if timeout 420s claude --permission-mode bypassPermissions --print --output-format json \
  "Read $INPUT_NOTE and complete the requested analysis. Write only the final markdown report." \
  > "$CLAUDE_JSON"; then

  python3 "$EXTRACT" "$CLAUDE_JSON" "$REPORT_MD" "${TRACK_TASK_CLAUDE_USAGE_FILE:-}"

  # --- Update study-progress.json ---
  python3 "$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/update_study_progress.py" \
    "$PROGRESS_FILE" "$TOPIC" "$TARGET_LIST"

else
  cat > "$FALLBACK_MD" <<EOF
# Kakao Healthcare CareChat Java Backend Prep Daily Report

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
