#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
SOURCE_DIR="$TASK_ROOT/sources/fos-study"
CONFIG="$TASK_ROOT/config/topics.json"
TOPIC_CONFIG="$TASK_ROOT/config/topics.json"
RESOLVER="$TASK_ROOT/skills/study-pack-writer/scripts/resolve_study_pack_topic.py"
RUNNER="$TASK_ROOT/skills/study-pack-writer/scripts/run_study_pack.sh"
OUTDIR="$TASK_ROOT/data/reports/daily/${REPORT_DATE:-$(date +%F)}/bootcamp"
SUMMARY="$TASK_ROOT/data/runtime/bootcamp-summary.md"
mkdir -p "$OUTDIR" "$TASK_ROOT/data/runtime"

mapfile -t SELECTED < <(python3 - <<'PY' "$CONFIG" "$TOPIC_CONFIG" "$SOURCE_DIR"
import json, sys
from pathlib import Path
topics_data=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
cfg=topics_data['bootcamp']
topics=topics_data['study-pack']
source=Path(sys.argv[3])
rec_n=int(cfg.get('dailyRecommendCount',10))
# Recommend queue: first ungenerated, then generated/review topics.
items=[]
for key in cfg.get('topics',[]):
    entry=topics.get(key)
    if not entry: continue
    out=entry.get('outputPath','')
    exists=(source/out).exists() if out else False
    items.append((key, exists, out, entry.get('domain','unknown')))
items.sort(key=lambda x: (x[1],))
for key, exists, out, domain in items[:rec_n]:
    print(f"{key}\t{int(exists)}\t{domain}\t{out}")
PY
)

RECOMMEND_KEYS=()
GENERATE_KEYS=()
GENERATE_N=$(python3 - <<'PY' "$CONFIG"
import json, sys
print(json.loads(open(sys.argv[1], encoding='utf-8').read())['bootcamp'].get('dailyGenerateCount',5))
PY
)
for row in "${SELECTED[@]}"; do
  key="${row%%$'\t'*}"
  rest="${row#*$'\t'}"
  exists="${rest%%$'\t'*}"
  RECOMMEND_KEYS+=("$key")
  if [[ "$exists" == "0" && ${#GENERATE_KEYS[@]} -lt $GENERATE_N ]]; then
    GENERATE_KEYS+=("$key")
  fi
done

{
  echo "# 오늘의 부트캠프 추천 (${TASK_ROOT##*/})"
  echo
  echo "기준: 서버/백엔드 직무, F&B/e-Commerce 도메인 설계, 그리고 기본기 보완."
  echo
  echo "## 추천 주제 10개"
  idx=1
  for row in "${SELECTED[@]}"; do
    IFS=$'\t' read -r key exists domain out <<< "$row"
    title="$key"
    if [[ -f "$TOPIC_CONFIG" ]]; then
      title=$(python3 - <<'PY' "$TOPIC_CONFIG" "$key"
import json, sys
topics_data=json.loads(open(sys.argv[1], encoding='utf-8').read())
e=topics_data['study-pack'].get(sys.argv[2],{})
print(e.get('commitTopic') or sys.argv[2])
PY
)
    fi
    status="신규 생성 후보"
    [[ "$exists" == "1" ]] && status="복습/심화 후보"
    echo "- ${idx}) **${title}**"
    echo "  - tag: ${status}"
    echo "  - domain: ${domain}"
    echo "  - file: ${out}"
    idx=$((idx+1))
  done
  echo
  echo "## 오늘 자동 생성할 스터디팩 ${#GENERATE_KEYS[@]}개"
  if [[ ${#GENERATE_KEYS[@]} -eq 0 ]]; then
    echo "- 신규 생성 후보가 부족해서 오늘은 추천만 합니다."
  else
    for key in "${GENERATE_KEYS[@]}"; do
      echo "- ${key}"
    done
  fi
} > "$SUMMARY"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "[bootcamp-batch] DRY_RUN=1; skipping generation" >&2
else
  for topic in "${GENERATE_KEYS[@]}"; do
    echo "[bootcamp-batch] generating $topic" >&2
    eval "$(python3 "$RESOLVER" "$TOPIC_CONFIG" "$topic")"
    TASK_ROOT="$TASK_ROOT" "$RUNNER"
  done
fi

{
  echo
  echo "## 생성 완료"
  if [[ "${DRY_RUN:-0}" == "1" ]]; then
    echo "- DRY_RUN: 실제 생성은 건너뜀"
  elif [[ ${#GENERATE_KEYS[@]} -eq 0 ]]; then
    echo "- 생성 없음"
  else
    for topic in "${GENERATE_KEYS[@]}"; do
      out=$(python3 - <<'PY' "$TOPIC_CONFIG" "$topic"
import json, sys
topics_data=json.loads(open(sys.argv[1], encoding='utf-8').read())
print(topics_data['study-pack'].get(sys.argv[2],{}).get('outputPath',''))
PY
)
      echo "- ${topic} → ${out}"
    done
  fi
  echo
  echo "## 오늘의 1순위"
  if [[ ${#RECOMMEND_KEYS[@]} -gt 0 ]]; then
    echo "- ${RECOMMEND_KEYS[0]}"
  fi
} >> "$SUMMARY"

cat "$SUMMARY"
