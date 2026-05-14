#!/usr/bin/env bash
# run_master.sh — generate a senior-backend interview master playbook and publish it to fos-study.
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
SOURCE_DIR="$TASK_ROOT/sources/fos-study"
TOPIC="${MASTER_TOPIC:?MASTER_TOPIC is required}"
OUTPUT_REL_PATH="${OUTPUT_REL_PATH:?OUTPUT_REL_PATH is required}"
INPUT_FILES_JSON="${INPUT_FILES_JSON:?INPUT_FILES_JSON is required}"
PROMPT_APPEND="${MASTER_APPEND_PROMPT:-}"

OUTDIR="$TASK_ROOT/data/reports/daily/${REPORT_DATE:-$(date +%F)}/master-$TOPIC"
PROMPT_FILE="$TASK_ROOT/skills/interview-master-writer/references/master-prompt.md"
OUTPUT_MD="$SOURCE_DIR/$OUTPUT_REL_PATH"
INPUT_NOTE="$OUTDIR/analysis-input.md"
RAW_RESULT_JSON="$OUTDIR/claude.result.json"
EXTRACTOR="$TASK_ROOT/scripts/study-pack-writer/extract_and_validate_study_pack.ts"

mkdir -p "$OUTDIR"
mkdir -p "$(dirname "$OUTPUT_MD")"

if [[ ! -d "$SOURCE_DIR/.git" ]]; then
  git clone --depth=1 https://github.com/jon890/fos-study.git "$SOURCE_DIR"
else
  git -C "$SOURCE_DIR" pull --ff-only
fi

python3 - "$TASK_ROOT" "$INPUT_FILES_JSON" "$INPUT_NOTE" "$PROMPT_FILE" "$TOPIC" "$OUTPUT_REL_PATH" "$PROMPT_APPEND" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
input_files = json.loads(sys.argv[2])
input_note = Path(sys.argv[3])
prompt_file = Path(sys.argv[4])
topic = sys.argv[5]
output_rel_path = sys.argv[6]
prompt_append = sys.argv[7]

parts = [
    prompt_file.read_text(encoding="utf-8").strip(),
    "",
    f"토픽: {topic}",
    f"fos-study 내부 출력 경로: {output_rel_path}",
    "",
    "선택된 입력 파일:",
]
for rel in input_files:
    p = root / "sources" / "fos-study" / rel
    parts.append(f"## FILE: {p}")
    if p.exists():
        parts.append(p.read_text(encoding="utf-8"))
    else:
        parts.append(f"[파일 없음: {rel}]")
    parts.append("")
if prompt_append:
    parts.append(prompt_append)
input_note.write_text("\n".join(parts).strip() + "\n", encoding="utf-8")
PY

run_once() {
  rm -f "$RAW_RESULT_JSON"
  local code=0
  timeout 900s claude --permission-mode bypassPermissions --print \
    --output-format json \
    --no-session-persistence \
    "$(cat "$INPUT_NOTE")" \
    > "$RAW_RESULT_JSON" || code=$?
  if (( code != 0 )); then
    echo "claude CLI failed (exit ${code}) for interview-master ${TOPIC}" >&2
    return "$code"
  fi
}

extract_and_validate() {
  "$EXTRACTOR" "$RAW_RESULT_JSON" "$OUTPUT_MD"
}

attempt() {
  run_once || return 1
  bun run "$HOME/ai-nodes/_shared/lib/invoke_claude_skills.ts" persist-usage "$RAW_RESULT_JSON"
  extract_and_validate || return 1
}

if ! attempt; then
  echo "First generation failed for interview-master ${TOPIC}, retrying once with stricter prompt..." >&2
  cat >> "$INPUT_NOTE" <<'EOF'

재시도 지시사항:
- 이전 응답이 검증을 통과하지 못했다.
- 최종 마크다운 본문만 출력한다.
- 응답의 첫 글자는 반드시 '#' 이어야 한다.
- 제목 앞에 서문·설명·상태 노트·요약 문장·섹션 표를 넣지 않는다.
- 응답을 비워 두지 않는다.
EOF
  if ! attempt; then
    echo "Interview-master generation failed after retry for ${TOPIC}" >&2
    exit 1
  fi
fi

if git -C "$SOURCE_DIR" ls-files --error-unmatch "$OUTPUT_REL_PATH" >/dev/null 2>&1; then
  EFFECTIVE_ACTION="update"
  if git -C "$SOURCE_DIR" diff --quiet -- "$OUTPUT_REL_PATH"; then
    echo "No content change detected for $OUTPUT_REL_PATH"
    exit 0
  fi
else
  EFFECTIVE_ACTION="add"
fi

BASENAME="$(basename "$OUTPUT_REL_PATH" .md)"
COMMIT_MSG="docs(interview): ${EFFECTIVE_ACTION} draft ${BASENAME}"

git -C "$SOURCE_DIR" add "$OUTPUT_REL_PATH"
git -C "$SOURCE_DIR" commit -m "$COMMIT_MSG"
git -C "$SOURCE_DIR" push origin HEAD

COMMIT_HASH="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
python3 "$HOME/ai-nodes/_shared/bin/update_artifacts.py" \
  "$TASK_ROOT/data/generated-artifacts.json" \
  "$TOPIC" "$OUTPUT_REL_PATH" "$COMMIT_HASH" \
  --kind interview-master

echo "Committed and pushed: $COMMIT_MSG ($COMMIT_HASH)"
