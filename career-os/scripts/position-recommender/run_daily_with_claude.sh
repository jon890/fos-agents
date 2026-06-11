#!/usr/bin/env bash
set -euo pipefail

ROOT="${CAREER_OS_ROOT:-/home/bifos/ai-nodes/career-os}"
exec bun "$ROOT/scripts/position-recommender/run_daily_with_claude.ts" "$@"
