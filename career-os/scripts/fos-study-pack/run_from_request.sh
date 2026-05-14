#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
REQUEST_TEXT="${1:-}"
if [[ -z "$REQUEST_TEXT" ]]; then
  echo "usage: run_from_request.sh '<freeform study-pack request>'" >&2
  exit 1
fi

RESOLVER="$TASK_ROOT/scripts/fos-study-pack/resolve_freeform_study_pack.ts"
TOPICS_CFG="$TASK_ROOT/config/topics.json"
RUNNER="$TASK_ROOT/scripts/command-router/run_now.sh"

RESOLUTION_JSON="$("$RESOLVER" "$TOPICS_CFG" "$REQUEST_TEXT")"
MODE="$(python3 - <<'PY' "$RESOLUTION_JSON"
import json, sys
print(json.loads(sys.argv[1])['mode'])
PY
)"
TOPIC="$(python3 - <<'PY' "$RESOLUTION_JSON"
import json, sys
print(json.loads(sys.argv[1])['topic'])
PY
)"

if [[ "$MODE" == "study-pack" ]]; then
  exec bash "$RUNNER" study-pack "$TOPIC"
fi

if [[ "$MODE" == "unresolved" ]]; then
  export TOPIC_CONFIG_OVERRIDE="$TASK_ROOT/data/runtime/freeform-study-pack-topic.json"
  mkdir -p "$TASK_ROOT/data/runtime"
  python3 - <<'PY' "$RESOLUTION_JSON" "$TOPIC_CONFIG_OVERRIDE"
import json, sys
resolution = json.loads(sys.argv[1])
out_path = sys.argv[2]
requested = resolution.get('requestedText') or resolution.get('topic') or 'custom study pack'
slug = resolution['topic']
config = {
  slug: {
    "domain": "custom",
    "outputPath": f"custom/{slug}.md",
    "commitTopic": slug,
    "appendPrompt": f"다음 자유 주제를 백엔드 면접 대비용 스터디팩으로 정리한다: {requested}. 단순 요약이 아니라 개념, 실무 관점, 흔한 오해, 예시, 면접 답변 포인트까지 포함한다. 기존 문서와 겹치면 중복 설명을 줄이고 링크로 연결한다. 문서 제목은 반드시 [초안]으로 시작한다."
  }
}
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(config, f, ensure_ascii=False, indent=2)
PY
  exec bash "$RUNNER" study-pack "$TOPIC"
fi

echo "unsupported study-pack resolution mode: $MODE" >&2
python3 - <<'PY' "$RESOLUTION_JSON"
import json, sys
print(json.dumps(json.loads(sys.argv[1]), ensure_ascii=False, indent=2))
PY
exit 2
