#!/usr/bin/env bash
# run_now.sh — entry point for all task runs.
# Requires: ~/ai-nodes/_shared/bin/track_task.sh (external dependency, see AGENTS.md)
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
TRACKER="${TRACKER:-$HOME/ai-nodes/_shared/bin/track_task.sh}"
NOTIFY_SCRIPT="bun run $HOME/ai-nodes/_shared/lib/notify_discord.ts"
FORMAT_COST="$HOME/ai-nodes/_shared/lib/format_cost_summary.ts"
LOCK_DIR="$TASK_ROOT/data/runtime/locks"
MODE="${1:-baseline}"

mkdir -p "$LOCK_DIR"

# run_tracked <task-name> <label> <runner-cmd...>
#
# Wraps the runner with track_task.sh, captures the exit code, and sends a Discord
# completion / failure notification with a one-line cost summary (from
# `_shared/lib/format_cost_summary.ts`) appended. Exits with the runner's code.
#
# `label` is the human-readable subject for the notification, e.g. "${TOPIC}
# 스터디팩". The verb is auto-added: "[완료] ${label}" or "[실패] ${label} (exit N)".
run_tracked() {
  local task_name="$1"; shift
  local label="$1"; shift

  set +e
  "$TRACKER" "$TASK_ROOT" "$task_name" "$@"
  local code=$?
  set -e

  local cost_line=""
  cost_line="$(bun run "$FORMAT_COST" "$TASK_ROOT" "$task_name" 2>/dev/null || true)"

  if (( code == 0 )); then
    $NOTIFY_SCRIPT "[완료] ${label}${cost_line}" || true
  else
    $NOTIFY_SCRIPT "[실패] ${label} (exit ${code})${cost_line}" || true
  fi

  exit "$code"
}

case "$MODE" in
  baseline)
    run_tracked "career-os:baseline" "baseline gap analysis" \
      "$TASK_ROOT/skills/knowledge-gap-analyzer/scripts/run_baseline.sh"
    ;;
  daily)
    # Optional second arg: topic key from config/topic-file-map.json
    # e.g.  run_now.sh daily jpa-n+1
    # Omit to auto-select the most overdue weak spot from data/study-progress.json
    export DAILY_TOPIC="${2:-}"
    run_tracked "career-os:daily" "daily focus report" \
      "$TASK_ROOT/skills/knowledge-gap-analyzer/scripts/run_daily.sh"
    ;;
  study-pack)
    TOPIC="${2:-}"
    if [[ -z "$TOPIC" ]]; then
      echo "usage: run_now.sh study-pack <topic>" >&2
      echo "  topic keys: see config/topics.json (study-pack namespace)" >&2
      exit 1
    fi

    TOPIC_LOCK_FILE="$LOCK_DIR/study-pack-${TOPIC}.lock"
    exec 9>"$TOPIC_LOCK_FILE"
    if ! flock -n 9; then
      echo "[run_now] study-pack topic already active; skipping duplicate run for ${TOPIC}" >&2
      exit 0
    fi

    $NOTIFY_SCRIPT "[시작] ${TOPIC} 스터디팩 생성 시작"

    MAINTAINER_CONFIG="$TASK_ROOT/config/topics.json"
    PRIMARY_TOPIC_CONFIG="${TOPIC_CONFIG_OVERRIDE:-$TASK_ROOT/config/topics.json}"
    if [[ -z "${TOPIC_CONFIG_OVERRIDE:-}" ]] && ! python3 - <<'PY' "$PRIMARY_TOPIC_CONFIG" "$TOPIC"
import json, sys
from pathlib import Path
cfg = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
ns = cfg.get('study-pack', {})
sys.exit(0 if sys.argv[2] in ns else 1)
PY
    then
      CANDIDATE_PROMOTER="$TASK_ROOT/skills/topic-pool-replenisher/scripts/promote_candidate_topics.py"
      if python3 "$CANDIDATE_PROMOTER" study "$TOPIC" >/dev/null 2>&1; then
        echo "[run_now] promoted study candidate into primary config: ${TOPIC}" >&2
      fi
    fi

    if [[ -z "${TOPIC_CONFIG_OVERRIDE:-}" ]] && python3 - <<'PY' "$TASK_ROOT/config/topics.json" "$TOPIC"
import json, sys
from pathlib import Path
cfg = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
ns = cfg.get('study-pack-maintainer', {})
sys.exit(0 if sys.argv[2] in ns else 1)
PY
    then
      RESOLVER="$TASK_ROOT/skills/study-pack-maintainer/scripts/resolve_maintainer_topic.py"
      eval "$(python3 "$RESOLVER" "$MAINTAINER_CONFIG" "$TOPIC")"

      run_tracked "career-os:study-pack:$TOPIC" "${TOPIC} 스터디팩 (maintainer)" \
        "$TASK_ROOT/skills/study-pack-maintainer/scripts/run_maintainer.sh"
    fi

    RESOLVER="$TASK_ROOT/skills/study-pack-writer/scripts/resolve_study_pack_topic.py"
    TOPIC_CONFIG="${TOPIC_CONFIG_OVERRIDE:-$TASK_ROOT/config/topics.json}"
    eval "$(python3 "$RESOLVER" "$TOPIC_CONFIG" "$TOPIC")"

    run_tracked "career-os:study-pack:$TOPIC" "${TOPIC} 스터디팩" \
      "$TASK_ROOT/skills/study-pack-writer/scripts/run_study_pack.sh"
    ;;
  question-bank)
    TOPIC="${2:-}"
    if [[ -z "$TOPIC" ]]; then
      echo "usage: run_now.sh question-bank <topic>" >&2
      echo "  topic keys: see config/topics.json (question-bank namespace)" >&2
      exit 1
    fi

    RESOLVER="$TASK_ROOT/skills/experience-question-bank-writer/scripts/resolve_question_bank_topic.py"
    TOPIC_CONFIG="$TASK_ROOT/config/topics.json"
    eval "$(python3 "$RESOLVER" "$TOPIC_CONFIG" "$TOPIC")"

    run_tracked "career-os:question-bank:$TOPIC" "${TOPIC} question-bank" \
      "$TASK_ROOT/skills/experience-question-bank-writer/scripts/run_question_bank.sh"
    ;;
  recommend-topics)
    run_tracked "career-os:recommend-topics" "morning topic 추천" \
      "$TASK_ROOT/skills/study-topic-recommender/scripts/run_topic_recommendation.sh"
    ;;
  live-coding-dispatch)
    run_tracked "career-os:live-coding-dispatch" "live-coding dispatch" \
      "$TASK_ROOT/skills/study-topic-recommender/scripts/run_live_coding_dispatch.sh"
    ;;
  recommend-positions)
    run_tracked "career-os:position-recommendation" "position 추천" \
      "$TASK_ROOT/skills/position-recommender/scripts/run_position_recommendation.sh"
    ;;
  foodville-coffeechat)
    run_tracked "career-os:foodville-coffeechat" "Foodville coffeechat 준비" \
      "$TASK_ROOT/skills/cj-foodville-coffeechat-prep/scripts/run_foodville_coffeechat_prep.sh"
    ;;
  bootcamp-batch)
    run_tracked "career-os:bootcamp-batch" "부트캠프 일괄 study-pack" \
      "$TASK_ROOT/skills/study-pack-batch/scripts/run_bootcamp_batch.sh"
    ;;
  auto-question-bank)
    run_tracked "career-os:auto-question-bank" "auto question-bank refresh" \
      "$TASK_ROOT/skills/experience-question-bank-writer/scripts/run_question_bank_auto.sh"
    ;;
  replenish-topics)
    run_tracked "career-os:replenish-topics" "topic reservoir 보충" \
      "$TASK_ROOT/skills/topic-pool-replenisher/scripts/run_topic_replenishment.sh"
    ;;
  maintain-study-pack)
    TOPIC="${2:-}"
    if [[ -z "$TOPIC" ]]; then
      echo "usage: run_now.sh maintain-study-pack <topic>" >&2
      echo "  topic keys: see config/topics.json (study-pack-maintainer namespace)" >&2
      exit 1
    fi

    RESOLVER="$TASK_ROOT/skills/study-pack-maintainer/scripts/resolve_maintainer_topic.py"
    TOPIC_CONFIG="$TASK_ROOT/config/topics.json"
    eval "$(python3 "$RESOLVER" "$TOPIC_CONFIG" "$TOPIC")"

    run_tracked "career-os:maintain-study-pack:$TOPIC" "${TOPIC} 스터디팩 유지보수" \
      "$TASK_ROOT/skills/study-pack-maintainer/scripts/run_maintainer.sh"
    ;;
  master)
    TOPIC="${2:-senior-backend-master-playbook}"

    RESOLVER="$TASK_ROOT/skills/interview-master-writer/scripts/resolve_master_topic.py"
    TOPIC_CONFIG="$TASK_ROOT/config/topics.json"
    eval "$(python3 "$RESOLVER" "$TOPIC_CONFIG" "$TOPIC")"

    run_tracked "career-os:master:$TOPIC" "${TOPIC} master playbook" \
      "$TASK_ROOT/skills/interview-master-writer/scripts/run_master.sh"
    ;;
  smoke)
    run_tracked "career-os:smoke" "smoke test" \
      "$TASK_ROOT/skills/knowledge-gap-analyzer/scripts/run_smoke_test.sh"
    ;;
  *)
    echo "usage: run_now.sh [baseline | daily [topic] | study-pack <topic> | question-bank <topic> | auto-question-bank | recommend-topics | live-coding-dispatch | recommend-positions | foodville-coffeechat | bootcamp-batch | replenish-topics | maintain-study-pack <topic> | master [topic] | smoke]" >&2
    echo "  daily topic keys: see config/topic-file-map.json" >&2
    echo "  study-pack topic keys: see config/topics.json (study-pack namespace)" >&2
    echo "  question-bank topic keys: see config/topics.json (question-bank namespace)" >&2
    echo "  maintain-study-pack topic keys: see config/topics.json (study-pack-maintainer namespace)" >&2
    echo "  master topic keys: see config/topics.json (master namespace, default: senior-backend-master-playbook)" >&2
    exit 1
    ;;
esac
