#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
SOURCE_DIR="$TASK_ROOT/sources/fos-study"
FOG_GIT="$HOME/ai-nodes/career-os/scripts/_lib/fos_study_git.ts"
TOPIC="${QUESTION_BANK_TOPIC:?QUESTION_BANK_TOPIC is required}"
OUTPUT_REL_PATH="${OUTPUT_REL_PATH:?OUTPUT_REL_PATH is required}"
OUTDIR="$TASK_ROOT/data/reports/daily/${REPORT_DATE:-$(date +%F)}/question-bank-$TOPIC"
PROMPT_FILE="$TASK_ROOT/skills/experience-question-bank-writer/references/question-bank-prompt.md"
SCHEMA_FILE="$TASK_ROOT/skills/experience-question-bank-writer/references/question-bank-schema.json"
OUTPUT_MD="$SOURCE_DIR/$OUTPUT_REL_PATH"
INPUT_NOTE="$OUTDIR/analysis-input.md"
RAW_JSON="$OUTDIR/question-bank.json"
INPUT_FILES_JSON="${INPUT_FILES_JSON:?INPUT_FILES_JSON is required}"
PROMPT_APPEND="${QUESTION_BANK_APPEND_PROMPT:-}"

mkdir -p "$OUTDIR"
mkdir -p "$(dirname "$OUTPUT_MD")"

bun run "$FOG_GIT" ensure-repo --source-dir "$SOURCE_DIR"

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

parts = [prompt_file.read_text(encoding='utf-8').strip(), '', f'토픽: {topic}', f'fos-study 내부 출력 경로: {output_rel_path}', '', '선택된 입력 파일:']
for rel in input_files:
    p = root / 'sources' / 'fos-study' / rel
    parts.append(f'## FILE: {p}')
    parts.append(p.read_text(encoding='utf-8'))
    parts.append('')
if prompt_append:
    parts.append(prompt_append)
input_note.write_text('\n'.join(parts).strip() + '\n', encoding='utf-8')
PY

SCHEMA_JSON="$(python3 - <<'PY' "$SCHEMA_FILE"
from pathlib import Path
import sys
print(Path(sys.argv[1]).read_text(encoding='utf-8'))
PY
)"

run_once() {
  rm -f "$RAW_JSON"
  local code=0
  timeout 900s claude --print --no-session-persistence \
    --output-format json \
    --json-schema "$SCHEMA_JSON" \
    --permission-mode bypassPermissions \
    "$(cat "$INPUT_NOTE")" \
    > "$RAW_JSON" || code=$?
  if (( code != 0 )); then
    echo "claude CLI failed (exit ${code}) for question-bank ${TOPIC}" >&2
    return "$code"
  fi
}

attempt() {
  run_once || return 1
  bun run "$HOME/ai-nodes/_shared/lib/invoke_claude_skills.ts" persist-usage "$RAW_JSON"
  validate_and_render || return 1
}

RENDERER="$TASK_ROOT/scripts/experience-question-bank-writer/render_question_bank.ts"

validate_and_render() {
  "$RENDERER" "$RAW_JSON" "$OUTPUT_MD"
}

if ! attempt; then
  echo "First generation failed for $TOPIC, retrying once with stricter prompt..." >&2
  cat >> "$INPUT_NOTE" <<'EOF'

재시도 지시사항:
- 이전 응답이 요구된 JSON 구조를 만족하지 못했다.
- 유효한 JSON만 출력한다.
- 마크다운을 출력하지 않는다.
- 설명 텍스트를 출력하지 않는다.
- 자기소개(selfIntro)와 지원 동기/회사 핏(motivationAndFit) 섹션이 반드시 포함되어야 한다.
- 메인 질문 5개, 각 메인 질문당 꼬리 질문 5개를 정확히 맞춘다.
EOF
  if ! attempt; then
    echo "Question-bank generation failed after retry for $TOPIC" >&2
    exit 1
  fi
fi

BASENAME="$(basename "$OUTPUT_REL_PATH" .md)"

commit_status=0
bun run "$FOG_GIT" commit-file \
  --source-dir "$SOURCE_DIR" \
  --rel-path "$OUTPUT_REL_PATH" \
  --prefix "docs(interview):" \
  --message "draft ${BASENAME} question bank" \
  || commit_status=$?
if [ "$commit_status" -eq 42 ]; then
  exit 0
elif [ "$commit_status" -ne 0 ]; then
  echo "commit-file failed (exit ${commit_status})" >&2
  exit "$commit_status"
fi
bun run "$FOG_GIT" push --source-dir "$SOURCE_DIR"

COMMIT_HASH="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
python3 "$HOME/ai-nodes/_shared/bin/update_artifacts.py" \
  "$TASK_ROOT/data/generated-artifacts.json" \
  "$TOPIC" "$OUTPUT_REL_PATH" "$COMMIT_HASH" \
  --kind question-bank

echo "Committed and pushed: question-bank ${BASENAME} (${COMMIT_HASH})"
