# claude_lib.sh — sourceable helpers for runners that call the Claude CLI.
#
# Usage:
#   source "$HOME/ai-nodes/_shared/bin/claude_lib.sh"
#
# Convention: this file is sourced, not executed. No shebang on purpose.
# Designed to be safe under set -euo pipefail in the caller.
#
# See ADR-014 (career-os) for rationale and the runner integration pattern.

# claude_persist_usage <raw-claude-json-path>
#
# If TRACK_TASK_CLAUDE_USAGE_FILE is set, copy the raw Claude `--output-format json`
# envelope at <raw-claude-json-path> to that location, so that track_task.sh
# (the wrapper that exports TRACK_TASK_CLAUDE_USAGE_FILE) can read usage / cost /
# model from it.
#
# No-op if:
#   - TRACK_TASK_CLAUDE_USAGE_FILE is unset or empty (runner was not invoked
#     through track_task.sh, e.g. direct manual run).
#   - The raw JSON path does not exist or is an empty file.
#
# Failure is non-fatal: the runner has already produced the user-facing artifact
# by the time this is called, so a missing accounting write should not abort.
claude_persist_usage() {
  local raw_json="${1:-}"
  if [[ -z "$raw_json" ]]; then
    echo "[claude_lib] claude_persist_usage: missing arg <raw-json-path>" >&2
    return 0
  fi
  if [[ -z "${TRACK_TASK_CLAUDE_USAGE_FILE:-}" ]]; then
    return 0
  fi
  if [[ ! -s "$raw_json" ]]; then
    echo "[claude_lib] claude_persist_usage: raw JSON missing or empty: $raw_json" >&2
    return 0
  fi
  cp -f "$raw_json" "$TRACK_TASK_CLAUDE_USAGE_FILE" || \
    echo "[claude_lib] claude_persist_usage: failed to write $TRACK_TASK_CLAUDE_USAGE_FILE" >&2
}
