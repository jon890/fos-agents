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
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  echo "[workspace-audit] $ws_name — static"
  python3 "$SCRIPT_DIR/audit_static.py" "$ws_root" > "$tmp/static.json"

  echo "[workspace-audit] $ws_name — health"
  python3 "$SCRIPT_DIR/audit_health.py" "$ws_root" > "$tmp/health.json"

  echo "[workspace-audit] $ws_name — consistency"
  python3 "$SCRIPT_DIR/audit_consistency.py" "$ws_root" > "$tmp/consistency.json"

  local today
  today="$(date +%Y-%m-%d)"
  local out="$ws_root/data/audit/$today.md"
  python3 "$SCRIPT_DIR/render_report.py" "$ws_root" "$tmp" "$out"

  # Persist phase JSONs so the active session can feed them to the analyst subagent.
  local last_run="$ws_root/data/audit/.last-run"
  mkdir -p "$last_run"
  cp "$tmp/static.json"      "$last_run/static.json"
  cp "$tmp/health.json"      "$last_run/health.json"
  cp "$tmp/consistency.json" "$last_run/consistency.json"
  echo "[workspace-audit] phase JSONs → $last_run"
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
