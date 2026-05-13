#!/usr/bin/env bash
# run_baseline.sh — single-call baseline gap analysis using curated core file set.
# ADR-003: chunking removed (10 files fit in one context window).
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
DATE="${REPORT_DATE:-$(date +%F)}"
OUTDIR="$TASK_ROOT/data/reports/baseline/$DATE"
PROFILE="$TASK_ROOT/config/candidate-profile.md"
PROMPT_FILE="$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/references/baseline-prompt.md"
SOURCE_DIR="$TASK_ROOT/sources/fos-study"
TARGET_LIST="$OUTDIR/target-files.txt"
INPUT_NOTE="$OUTDIR/analysis-input.md"
REPORT_MD="$OUTDIR/report.md"
STDERR_LOG="$OUTDIR/claude.stderr.log"
CLAUDE_JSON="$OUTDIR/claude.result.json"
FALLBACK_MD="$OUTDIR/report.fallback.md"
CORE_LIST="$TASK_ROOT/config/baseline-core-files.json"
EXTRACT="$HOME/ai-nodes/_shared/bin/extract_claude_result.py"

mkdir -p "$OUTDIR"

# --- Git sync ---
if [[ ! -d "$SOURCE_DIR/.git" ]]; then
  git clone --depth=1 https://github.com/jon890/fos-study.git "$SOURCE_DIR"
else
  git -C "$SOURCE_DIR" pull --ff-only
fi

python3 -c "
import json, sys
data = json.load(open('$CORE_LIST'))
print('\n'.join(f['path'] for f in data['files']))
" > "$TARGET_LIST"

# --- Build analysis input note ---
cat > "$INPUT_NOTE" <<EOF
$(cat "$PROMPT_FILE")

다음 경로의 파일을 직접 읽고 분석한다:
- 지원자 프로필: $PROFILE
- 소스 레포지토리 루트: $SOURCE_DIR
- 대상 파일 목록: $TARGET_LIST

지시사항:
- target-files.txt 에 나열된 마크다운 파일만 읽는다.
- target-files.txt 의 파일 경로는 소스 레포지토리 루트 기준 상대 경로다.
- .claude/** 와 비-마크다운 파일은 무시한다.
- 카카오헬스케어 케어챗 AI Agent 개발자 포지션 준비에 초점을 맞춘다.
- DB를 약점 가능성이 높은 영역으로 다루고, 스터디 노트가 이를 뒷받침하는지 검증한다.
- interview/kakao-healthcare-carechat-ai-agent.md 의 근거를 우선한다.
- 최종 리포트는 한국어로 작성한다.
- 신뢰도를 최대화하기 위해 baseline은 큐레이션된 core 파일 세트 내에서만 분석한다.
EOF

# --- Claude synthesis (single call, ADR-003) ---
if timeout 420s claude --permission-mode bypassPermissions --print --output-format json \
  "Read $INPUT_NOTE and complete the requested analysis. Write only the final markdown report." \
  > "$CLAUDE_JSON" 2>> "$STDERR_LOG"; then

  python3 "$EXTRACT" "$CLAUDE_JSON" "$REPORT_MD" "${TRACK_TASK_CLAUDE_USAGE_FILE:-}"

else
  cat > "$FALLBACK_MD" <<EOF
# Kakao Healthcare CareChat Java Backend Prep Baseline Report

- Status: Claude synthesis failed, fallback report created
- Candidate profile: $PROFILE
- Source repository root: $SOURCE_DIR
- Target file list: $TARGET_LIST
- Note: rerun baseline after checking Claude/auth environment
EOF
  cp "$FALLBACK_MD" "$REPORT_MD"
fi

echo "Wrote: $TARGET_LIST"
echo "Wrote: $INPUT_NOTE"
echo "Wrote: $CLAUDE_JSON"
echo "Wrote: $REPORT_MD"
