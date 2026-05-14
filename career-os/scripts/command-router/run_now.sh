#!/usr/bin/env bash
# run_now.sh — entry point for all task runs.
# Requires: ~/ai-nodes/_shared/bin/track_task.sh (external dependency, see AGENTS.md)
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
TRACKER="${TRACKER:-$HOME/ai-nodes/_shared/bin/track_task.sh}"
NOTIFY_SCRIPT="bun --env-file=$HOME/ai-nodes/career-os/.env run $HOME/ai-nodes/_shared/lib/notify_discord.ts"
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
      "$TASK_ROOT/scripts/knowledge-gap-analyzer/run_baseline.sh"
    ;;
  daily)
    # Optional second arg: topic key from config/topic-file-map.json
    # e.g.  run_now.sh daily jpa-n+1
    # Omit to auto-select the most overdue weak spot from data/study-progress.json
    export DAILY_TOPIC="${2:-}"
    run_tracked "career-os:daily" "daily focus report" \
      "$TASK_ROOT/scripts/knowledge-gap-analyzer/run_daily.sh"
    ;;
  recommend-topics)
    run_tracked "career-os:recommend-topics" "morning topic 추천" \
      "$TASK_ROOT/scripts/study-topic-recommender/run_topic_recommendation.sh"
    ;;
  live-coding-dispatch)
    run_tracked "career-os:live-coding-dispatch" "live-coding dispatch" \
      "$TASK_ROOT/scripts/study-topic-recommender/run_live_coding_dispatch.sh"
    ;;
  recommend-positions)
    run_tracked "career-os:position-recommendation" "position 추천" \
      "$TASK_ROOT/scripts/position-recommender/run_position_recommendation.sh"
    ;;
  foodville-coffeechat)
    run_tracked "career-os:foodville-coffeechat" "Foodville coffeechat 준비" \
      "$TASK_ROOT/scripts/cj-foodville-coffeechat-prep/run_foodville_coffeechat_prep.sh"
    ;;
  replenish-topics)
    run_tracked "career-os:replenish-topics" "topic reservoir 보충" \
      "$TASK_ROOT/scripts/topic-pool-replenisher/run_topic_replenishment.sh"
    ;;
  smoke)
    run_tracked "career-os:smoke" "smoke test" \
      "$TASK_ROOT/scripts/knowledge-gap-analyzer/run_smoke_test.sh"
    ;;
  *)
    echo "usage: run_now.sh [baseline | daily [topic] | recommend-topics | live-coding-dispatch | recommend-positions | foodville-coffeechat | replenish-topics | smoke]" >&2
    echo "  daily topic keys: see config/topic-file-map.json" >&2
    echo "  study-pack / interview-asset (Q&A + master playbook): native skill 진입점 (claude -p '/<skill> <topic>') 사용 — ai-nodes ADR-002" >&2
    exit 1
    ;;
esac
