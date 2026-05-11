#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
REPORT_DATE="${REPORT_DATE:-$(date +%F)}"
OUTDIR="$TASK_ROOT/data/reports/daily/$REPORT_DATE/position-recommendation"
RUNTIME_OUT="$TASK_ROOT/data/runtime/position-recommendation.md"
PROMPT_FILE="$TASK_ROOT/skills/position-recommender/references/position-recommendation-prompt.md"
PROFILE="$TASK_ROOT/config/candidate-profile.md"
DECISION_CRITERIA="$TASK_ROOT/config/position-decision-criteria.md"
RAW_RESULT_JSON="$OUTDIR/claude.result.json"
INPUT_NOTE="$OUTDIR/input.md"
REPORT_MD="$OUTDIR/report.md"
EXTRACTOR="$TASK_ROOT/skills/position-recommender/scripts/extract_position_report.py"

mkdir -p "$OUTDIR" "$TASK_ROOT/data/runtime"

cat > "$INPUT_NOTE" <<EOF2
$(cat "$PROMPT_FILE")

후보자 프로필:
$(cat "$PROFILE")

포지션 추천 의사결정 축:
$(if [[ -f "$DECISION_CRITERIA" ]]; then cat "$DECISION_CRITERIA"; else echo "없음"; fi)

추가 요청/맥락:
${POSITION_CONTEXT:-없음}

실제 채용공고/커리어 페이지 수집 스냅샷:
$(if [[ -n "${POSITION_POSTINGS_FILE:-}" && -f "${POSITION_POSTINGS_FILE}" ]]; then cat "${POSITION_POSTINGS_FILE}"; else echo "없음"; fi)

참고 가능한 로컬 문서 경로 후보:
- sources/fos-study/resume/2603_김병태_이력서_v4.md
- sources/fos-study/task/ai-service-team/README.md
- sources/fos-study/task/ai-service-team/rag-vector-search-batch.md
- sources/fos-study/task/ai-service-team/webtoon-maker-ai-pipeline.md
- sources/fos-study/task/nsc-slot/README.md
- sources/fos-study/task/sb-dev-team/README.md
- sources/fos-study/task/the-future-company/README.md

필요하면 위 경로명을 근거로 언급하되, 파일을 직접 읽지 못한 세부 내용은 단정하지 않는다.

출력 규약:
- 최종 마크다운 본문만 반환한다.
- 첫 글자는 반드시 '#'.
- 상태 메시지나 파일 생성 설명을 쓰지 않는다.
EOF2

rm -f "$RAW_RESULT_JSON"
timeout 900s claude --permission-mode bypassPermissions --print \
  --output-format json \
  --no-session-persistence \
  "$(cat "$INPUT_NOTE")" \
  > "$RAW_RESULT_JSON"

python3 "$EXTRACTOR" "$RAW_RESULT_JSON" "$REPORT_MD"
cp "$REPORT_MD" "$RUNTIME_OUT"
cat "$RUNTIME_OUT"
