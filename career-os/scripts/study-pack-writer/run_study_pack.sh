#!/usr/bin/env bash
set -euo pipefail

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
: "${STUDY_TOPIC:?STUDY_TOPIC is required}"
: "${STUDY_DOMAIN:?STUDY_DOMAIN is required}"
: "${OUTPUT_REL_PATH:?OUTPUT_REL_PATH is required}"

OUTDIR="${OUTDIR:-$TASK_ROOT/data/reports/daily/${REPORT_DATE:-$(date +%F)}/study-pack-$STUDY_TOPIC}"
export TASK_ROOT OUTDIR
exec bun run "$HOME/ai-nodes/career-os/scripts/_lib/study_pack_publish.ts"
