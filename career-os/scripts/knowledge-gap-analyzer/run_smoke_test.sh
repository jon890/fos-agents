#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
DATE="${REPORT_DATE:-$(date +%F)}"
_MVP="$TASK_ROOT/config/mvp-target.json"
PRIMARY_COMPANY=$(python3 -c "import json; d=json.load(open('$_MVP')); print(d['primary']['company'])")
PRIMARY_ROLE=$(python3 -c "import json; d=json.load(open('$_MVP')); print(d['primary']['role'])")
OUTDIR="$TASK_ROOT/data/reports/baseline/$DATE/smoke-test"
PROFILE="$TASK_ROOT/config/candidate-profile.md"
PROMPT_FILE="$TASK_ROOT/skills/knowledge-gap-analyzer/references/baseline-prompt.md"
SOURCE_DIR="$TASK_ROOT/sources/fos-study"
TARGET_LIST="$OUTDIR/target-files.txt"
INPUT_NOTE="$OUTDIR/analysis-input.md"
REPORT_MD="$OUTDIR/report.md"
STDERR_LOG="$OUTDIR/claude.stderr.log"
STDOUT_LOG="$OUTDIR/claude.stdout.log"
CLAUDE_JSON="$OUTDIR/claude.result.json"
FALLBACK_MD="$OUTDIR/report.fallback.md"
mkdir -p "$OUTDIR"

cat > "$TARGET_LIST" <<EOF
database/index.md
database/mysql/transaction-lock.md
database/mysql/mysql-architecture.md
java/spring/jpa-transaction.md
architecture/distributed-transaction.md
EOF

# Resolve {{primary.company}}/{{role}} placeholders from mvp-target.json
bun "$HOME/ai-nodes/_shared/lib/build_prompt.ts" "$PROMPT_FILE" > "$OUTDIR/resolved-prompt.md"

cat > "$INPUT_NOTE" <<EOF
$(cat "$OUTDIR/resolved-prompt.md")

다음 경로의 파일을 직접 읽고 분석한다:
- 지원자 프로필: $PROFILE
- 소스 레포지토리 루트: $SOURCE_DIR
- 대상 파일 목록: $TARGET_LIST
EOF

if timeout 300s claude --permission-mode bypassPermissions --print --output-format json "Read $INPUT_NOTE and complete the requested analysis. Write only the final markdown report." > "$CLAUDE_JSON" 2> "$STDERR_LOG"; then
  cp "$CLAUDE_JSON" "$STDOUT_LOG"
  bun run "$HOME/ai-nodes/_shared/lib/invoke_claude_skills.ts" extract \
    "$CLAUDE_JSON" "$REPORT_MD" "${TRACK_TASK_CLAUDE_USAGE_FILE:-}"
else
  cat > "$FALLBACK_MD" <<EOF
# ${PRIMARY_COMPANY} ${PRIMARY_ROLE} Prep Smoke Test Report

- Status: Claude synthesis failed, fallback report created
- Candidate profile: $PROFILE
- Source repository root: $SOURCE_DIR
- Target file list: $TARGET_LIST
- stderr log: $STDERR_LOG
EOF
  cp "$FALLBACK_MD" "$REPORT_MD"
fi

echo "Wrote: $TARGET_LIST"
echo "Wrote: $INPUT_NOTE"
echo "Wrote: $STDOUT_LOG"
echo "Wrote: $STDERR_LOG"
echo "Wrote: $CLAUDE_JSON"
echo "Wrote: $REPORT_MD"
