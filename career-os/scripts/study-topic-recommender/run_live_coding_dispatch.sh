#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
NOTIFY_SCRIPT="bun --env-file=$TASK_ROOT/.env run $HOME/ai-nodes/_shared/lib/notify_discord.ts"
SEED_CONFIG="$TASK_ROOT/config/live-coding-seed-pool.json"
CANDIDATE_CONFIG="$TASK_ROOT/config/live-coding-seed-candidates.json"
TEMP_CONFIG="$TASK_ROOT/data/runtime/live-coding-generated-topic.json"
RESOLVER="$TASK_ROOT/scripts/study-pack-writer/resolve_study_pack_topic.ts"
LOCK_FILE="$TASK_ROOT/data/runtime/locks/morning-live-coding.lock"
mkdir -p "$(dirname "$TEMP_CONFIG")" "$(dirname "$LOCK_FILE")"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[run_morning_live_coding] another run is already active; skipping duplicate dispatch" >&2
  exit 0
fi

SELECTION_JSON="$(python3 - "$SEED_CONFIG" "$CANDIDATE_CONFIG" "$TASK_ROOT/data/generated-artifacts.json" <<'PY'
import json,sys
from pathlib import Path
seeds=json.loads(Path(sys.argv[1]).read_text())
cands=json.loads(Path(sys.argv[2]).read_text())
arts=json.loads(Path(sys.argv[3]).read_text())
covered={a.get('outputPath') for a in arts.get('artifacts',[]) if a.get('kind')=='live-coding'}
sel=next((s for s in seeds.get('seeds',[]) if s.get('outputPath') not in covered),None) or \
    next((s for s in cands.get('seeds',[]) if s.get('outputPath') not in covered),None)
print(json.dumps(sel or {},ensure_ascii=False))
PY
)"

[[ "$SELECTION_JSON" == "{}" ]] && {
  $NOTIFY_SCRIPT "[안내] 새 live-coding 주제가 없어 생성하지 않았습니다. primary/candidate seed pool 모두 보강이 필요합니다."
  exit 0
}

TOPIC_KEY="$(python3 -c "import json,sys; s=json.loads(sys.argv[1]); print(f\"live-coding-{s['slug']}\")" "$SELECTION_JSON")"

python3 - "$SELECTION_JSON" "$TEMP_CONFIG" <<'PY'
import json,sys
from pathlib import Path
seed,out=json.loads(sys.argv[1]),Path(sys.argv[2])
focus='\n'.join(f"- {item}" for item in seed.get('focus',[]))
prompt=f"마크다운 본문을 바로 작성한다. 파일 생성 언급·설명·코드 펜스 감싸기는 금지한다. 첫 글자는 반드시 '#' 이며 제목은 '# [초안]'으로 시작한다.\n{seed['title']}를 중심으로 한 Java 라이브 코딩 스터디 팩을 작성한다. 블로그 형태의 학습 가이드이자 라이브 코딩 대비 시트로 동작해야 한다. 포함할 내용:\n{focus}\n- 구현 시 흔한 버그\n- 라이브 면접에서 접근 방식을 설명하는 방법\n- Java로 된 연습 문제 정확히 2개 (쉬움 1 / 중간 1)\n- 두 문제 모두 풀이와 Java 전체 코드는 HTML details / summary 블록으로 숨긴다\n- HackerRank 스타일 라이브 코딩에 적합하고 면접 지향으로 작성한다\n섹션 요약이 아니라 실제로 공부 가능한 수준으로 상세히."
out.write_text(json.dumps({f"live-coding-{seed['slug']}":{"domain":"algorithm","outputPath":seed["outputPath"],"tier":"standalone","level":"senior","standalone":True,"promptAppend":prompt}},ensure_ascii=False,indent=2)+"\n")
PY

eval "$("$RESOLVER" "$TEMP_CONFIG" "$TOPIC_KEY")"
exec bun run "$HOME/ai-nodes/career-os/scripts/_lib/study_pack_publish.ts"
