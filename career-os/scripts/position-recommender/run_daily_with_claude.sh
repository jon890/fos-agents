#!/usr/bin/env bash
set -euo pipefail

# career-os root = 이 스크립트(career-os/scripts/<skill>/)에서 2단계 위.
# CAREER_OS_ROOT env가 있으면 우선 — 어떤 체크아웃 위치에서도 동작 (Linux 하드코딩 제거).
ROOT="${CAREER_OS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/../.." && pwd)}"
exec bun "$ROOT/scripts/position-recommender/run_daily_with_claude.ts" "$@"
