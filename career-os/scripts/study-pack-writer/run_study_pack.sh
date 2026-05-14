#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
SOURCE_DIR="$TASK_ROOT/sources/fos-study"
TOPIC="${STUDY_TOPIC:?STUDY_TOPIC is required}"
DOMAIN="${STUDY_DOMAIN:?STUDY_DOMAIN is required}"
OUTPUT_REL_PATH="${OUTPUT_REL_PATH:?OUTPUT_REL_PATH is required}"
COMMIT_ACTION="${COMMIT_ACTION:-update}"
COMMIT_TOPIC="${COMMIT_TOPIC:-$TOPIC}"
OUTDIR="$TASK_ROOT/data/reports/daily/${REPORT_DATE:-$(date +%F)}/study-pack-$TOPIC"
PROMPT_FILE="$TASK_ROOT/skills/study-pack-writer/references/study-pack-prompt.md"
WRITING_RULES_FILE="$TASK_ROOT/skills/study-pack-writer/references/fos-study-writing-rules.md"
PROFILE="$TASK_ROOT/config/candidate-profile.md"
OUTPUT_MD="$SOURCE_DIR/$OUTPUT_REL_PATH"
INPUT_NOTE="$OUTDIR/analysis-input.md"
RAW_RESULT_JSON="$OUTDIR/claude.result.json"
GENERATED_MD="$OUTDIR/generated.md"
LOCK_DIR="$TASK_ROOT/data/runtime/locks"
LOCK_FILE="$LOCK_DIR/fos-study-write.lock"

mkdir -p "$OUTDIR" "$LOCK_DIR"

cat > "$INPUT_NOTE" <<EOF
$(cat "$PROMPT_FILE")

다음 fos-study 작성 규칙을 함께 따른다:
$(cat "$WRITING_RULES_FILE")

토픽: $TOPIC
도메인: $DOMAIN
지원자 프로필: $PROFILE
fos-study 내부 출력 경로: $OUTPUT_REL_PATH

호출부에서 넘긴 추가 요구사항은 토픽 범위를 좁히고 참조를 정의하는 데 사용한다.
DB 관련 토픽이면 MySQL 8에서 실행 가능한 예제를 유지한다.
면접 중심 토픽이면 시니어 백엔드 관점으로 작성한다.
EOF

if [[ -n "${STUDY_APPEND_PROMPT:-}" ]]; then
  printf '\n%s\n' "$STUDY_APPEND_PROMPT" >> "$INPUT_NOTE"
fi

cat >> "$INPUT_NOTE" <<'EOF'

출력 규약 (엄수):
- 최종 마크다운 본문만 반환한다.
- 응답의 첫 글자는 반드시 '#' 이어야 한다.
- "파일을 생성했습니다" 같은 상태 메시지를 쓰지 않는다.
- 완료 노트, 요약, 리뷰 코멘트, 문서 개요 표를 포함하지 않는다.
- 응답 전체를 코드 펜스로 감싸지 않는다.
- 문서 내부의 모든 코드블록은 여는 fence에 언어를 명시한다. 예: ```java, ```bash, ```sql, ```yaml, ```json, ```text.
- bare triple backticks(``` 단독)로 코드블록을 열지 않는다.
- 작성한 내용을 설명하지 않는다. 실제 문서만 쓴다.
EOF

run_once() {
  rm -f "$RAW_RESULT_JSON"
  local code=0
  timeout 900s claude --permission-mode bypassPermissions --print \
    --output-format json \
    --no-session-persistence \
    "$(cat "$INPUT_NOTE")" \
    > "$RAW_RESULT_JSON" || code=$?
  if (( code != 0 )); then
    echo "claude CLI failed (exit ${code}) for study-pack ${TOPIC}" >&2
    return "$code"
  fi
}

EXTRACTOR="$TASK_ROOT/scripts/study-pack-writer/extract_and_validate_study_pack.ts"

extract_and_validate() {
  rm -f "$GENERATED_MD"
  "$EXTRACTOR" "$RAW_RESULT_JSON" "$GENERATED_MD"
}

attempt() {
  run_once || return 1
  bun run "$HOME/ai-nodes/_shared/lib/invoke_claude_skills.ts" persist-usage "$RAW_RESULT_JSON"
  extract_and_validate || return 1
}

if ! attempt; then
  echo "First generation failed for $TOPIC, retrying once with stricter prompt..." >&2
  cat >> "$INPUT_NOTE" <<'EOF'

재시도 지시사항:
- 이전 응답이 검증을 통과하지 못했다.
- 최종 마크다운 본문만 출력한다.
- 응답의 첫 글자는 반드시 '#' 이어야 한다.
- 제목 앞에 서문·설명·상태 노트·요약 문장·섹션 표를 넣지 않는다.
- 응답을 비워 두지 않는다.
- 문서 내부 코드블록은 반드시 언어 태그가 있는 fence로 연다. bare ```는 검증 실패다.
EOF
  if ! attempt; then
    echo "Study-pack generation failed after retry for $TOPIC" >&2
    exit 1
  fi
fi

exec 9>"$LOCK_FILE"
flock 9

if [[ ! -d "$SOURCE_DIR/.git" ]]; then
  git clone --depth=1 https://github.com/jon890/fos-study.git "$SOURCE_DIR"
else
  git -C "$SOURCE_DIR" pull --ff-only
fi

mkdir -p "$(dirname "$OUTPUT_MD")"
cp "$GENERATED_MD" "$OUTPUT_MD"

if git -C "$SOURCE_DIR" ls-files --error-unmatch "$OUTPUT_REL_PATH" >/dev/null 2>&1; then
  EFFECTIVE_ACTION="update"
  if git -C "$SOURCE_DIR" diff --quiet -- "$OUTPUT_REL_PATH"; then
    echo "No content change detected for $OUTPUT_REL_PATH"
    exit 0
  fi
else
  EFFECTIVE_ACTION="add"
fi

COMMIT_MSG="docs(${DOMAIN}): ${EFFECTIVE_ACTION} draft ${COMMIT_TOPIC} study pack"

git -C "$SOURCE_DIR" add "$OUTPUT_REL_PATH"
git -C "$SOURCE_DIR" commit -m "$COMMIT_MSG"
git -C "$SOURCE_DIR" push origin HEAD

COMMIT_HASH="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
python3 "$HOME/ai-nodes/_shared/bin/update_artifacts.py" \
  "$TASK_ROOT/data/generated-artifacts.json" \
  "$TOPIC" "$OUTPUT_REL_PATH" "$COMMIT_HASH"

echo "Committed and pushed: $COMMIT_MSG ($COMMIT_HASH)"
