#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
SOURCE_DIR="$TASK_ROOT/sources/fos-study"
TOPIC="${MAINTAINER_TOPIC:?MAINTAINER_TOPIC is required}"
REQUESTED_TOPIC="${REQUESTED_TOPIC:?REQUESTED_TOPIC is required}"
CANDIDATE_FILES_JSON="${CANDIDATE_FILES_JSON:?CANDIDATE_FILES_JSON is required}"
PREFERRED_DOMAIN="${PREFERRED_DOMAIN:-interview}"
OUTDIR="${OUTDIR:-$TASK_ROOT/data/reports/daily/${REPORT_DATE:-$(date +%F)}/maintainer-$TOPIC}"
PROMPT_FILE_SRC="$TASK_ROOT/skills/study-pack-maintainer/references/maintainer-prompt.md"
RULES_FILE="$TASK_ROOT/skills/study-pack-maintainer/references/fos-study-maintenance-rules.md"
MAINTAINER_INPUT="$OUTDIR/maintainer-input.md"
mkdir -p "$OUTDIR"

if [[ ! -d "$SOURCE_DIR/.git" ]]; then
  git clone --depth=1 https://github.com/jon890/fos-study.git "$SOURCE_DIR"
else
  git -C "$SOURCE_DIR" pull --ff-only
fi

OUTPUT_REL_PATH="$(python3 - "$CANDIDATE_FILES_JSON" "$PREFERRED_DOMAIN" "$TOPIC" <<'PY'
import json,sys
cands=json.loads(sys.argv[1])
print(cands[0] if cands else f'{sys.argv[2]}/{sys.argv[3]}.md')
PY
)"

python3 - "$TASK_ROOT" "$PROMPT_FILE_SRC" "$RULES_FILE" "$REQUESTED_TOPIC" "$CANDIDATE_FILES_JSON" "$OUTPUT_REL_PATH" "$MAINTAINER_INPUT" <<'PY'
import json,sys
from pathlib import Path
root,pf,rf,req,cand,outp,out=Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3]),sys.argv[4],json.loads(sys.argv[5]),sys.argv[6],Path(sys.argv[7])
parts=[pf.read_text().strip(),'','다음 유지보수/연결 규칙을 함께 따른다:',rf.read_text().strip(),'',f'요청 주제: {req}',f'출력 경로: {outp}','','검토 대상 기존 문서:']
for rel in cand:
    p=root/'sources'/'fos-study'/rel
    parts+=[f'## FILE: {p}',p.read_text() if p.exists() else f'[파일 없음: {rel}]','']
parts+=['','위의 모든 출력 형식 지시사항(JSON 포함)을 무효화한다. 아래 규약만 따른다:','- 최종 마크다운 본문만 반환한다.','- 응답의 첫 글자는 반드시 # 이어야 한다.','- 상태 메시지·요약·코드펜스 감싸기 금지.','- 코드블록은 언어 태그 필수.']
out.write_text('\n'.join(parts).strip()+'\n')
PY

export TASK_ROOT OUTDIR
export STUDY_TOPIC="$TOPIC" STUDY_DOMAIN="$PREFERRED_DOMAIN" OUTPUT_REL_PATH COMMIT_TOPIC="$TOPIC"
export PROMPT_FILE="$MAINTAINER_INPUT"
exec bun run "$HOME/ai-nodes/career-os/scripts/_lib/study_pack_publish.ts"
