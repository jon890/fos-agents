#!/usr/bin/env bash
# Run static workspace audit and emit a dated markdown report.
#
# Usage:
#   run_audit.sh <workspace>
#   run_audit.sh --all
#
# Intended to be called by the active Claude session (via the /workspace-audit
# skill). Pure data gathering: no LLM calls, no track_task wrapping. The active
# session is responsible for surfacing findings to the user and driving any
# follow-up investigation via OMC subagents.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
# skills/workspace-audit/ -> skills/ -> ai-nodes/
ROOT="$(cd "$SKILL_DIR/../.." && pwd)"

usage() {
  cat <<EOF
usage: run_audit.sh <workspace>
       run_audit.sh --all

  <workspace>  name of a subdir under ~/ai-nodes
  --all        audit every workspace with an AGENTS.md or skills/ marker
EOF
}

if [[ $# -lt 1 || "$1" == "-h" || "$1" == "--help" ]]; then
  usage
  [[ $# -lt 1 ]] && exit 1 || exit 0
fi

audit_one() {
  local ws_root="$1"
  local ws_name
  ws_name="$(basename "$ws_root")"

  # Session-local stash. No permanent disk artifacts under the workspace tree:
  # if a finding is worth preserving, the active Claude session lifts it into
  # docs/decisions/ as an ADR. The stash survives the function return so the
  # Phase 2 analyst can read the JSONs; it is replaced on the next run.
  local stash="/tmp/workspace-audit-${ws_name}"
  rm -rf "$stash"
  mkdir -p "$stash"

  echo "[workspace-audit] $ws_name — static"
  python3 "$SCRIPT_DIR/audit_static.py" "$ws_root" > "$stash/static.json"

  echo "[workspace-audit] $ws_name — health"
  python3 "$SCRIPT_DIR/audit_health.py" "$ws_root" > "$stash/health.json"

  echo "[workspace-audit] $ws_name — consistency"
  python3 "$SCRIPT_DIR/audit_consistency.py" "$ws_root" > "$stash/consistency.json"

  python3 "$SCRIPT_DIR/render_report.py" "$ws_root" "$stash" "$stash/report.md"

  echo "[workspace-audit] phase JSONs + report → $stash (session-only)"
}

if [[ "$1" == "--all" ]]; then
  rc=0
  while IFS= read -r ws; do
    [[ -z "$ws" ]] && continue
    echo "===== $ws ====="
    if ! audit_one "$ROOT/$ws"; then
      echo "[workspace-audit] FAILED for $ws" >&2
      rc=1
    fi
  done < <(python3 "$SCRIPT_DIR/discover_workspaces.py" "$ROOT")
  exit "$rc"
fi

WS_ROOT="$ROOT/$1"
if [[ ! -d "$WS_ROOT" ]]; then
  echo "[workspace-audit] workspace not found: $WS_ROOT" >&2
  exit 1
fi

audit_one "$WS_ROOT"
