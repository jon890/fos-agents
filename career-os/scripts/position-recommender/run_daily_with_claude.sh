#!/usr/bin/env bash
set -euo pipefail

ROOT="${CAREER_OS_ROOT:-/home/bifos/ai-nodes/career-os}"
REPORT_DATE="${REPORT_DATE:-$(TZ=Asia/Seoul date +%F)}"
REPORT="$ROOT/data/reports/daily/$REPORT_DATE/position-recommendation/report.md"
RUNTIME="$ROOT/data/runtime/position-recommendation.md"
NOTIFY_SCRIPT="$ROOT/../_shared/lib/notify_discord.ts"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
usage: run_daily_with_claude.sh [context]
       run_daily_with_claude.sh --validate-existing

Runs claude -p "/position-recommender ..." and verifies that today's
Asia/Seoul report and runtime mirror were freshly written.

Environment:
  POSITION_RECOMMENDER_NOTIFY=0  Skip Discord notification.
EOF
  exit 0
fi

VALIDATE_ONLY=0
if [[ "${1:-}" == "--validate-existing" ]]; then
  VALIDATE_ONLY=1
  shift
fi

DEFAULT_CONTEXT="매일 서버/backend 정규직 포지션 추천. 최신 Wanted/공식 career active/open 공고 포함. Java/Spring 서버/backend 정규직 중심. 최근 7일 position-recommendation 리포트를 읽고 반복 후보는 감점하되, 여전히 최상위인 경우 반복 유지 사유를 명시. 최소 1개 이상은 최근 7일 강력 추천에 없던 신규 후보 또는 추가 수집 대상을 포함. NHN보다 좋은 회사, 강한 성장 모멘텀, 도메인 전환 기회를 우선. 토스 계열은 최근 6개월 불합격 쿨다운으로 강력 추천/즉시 지원 액션에서 제외하고 보류/쿨다운 후보로만 짧게 언급. 특정 회사나 공고를 고정 우선하지 말고 active JD fit, 회사/규모 업사이드, 최근 반복 여부로 랭킹."
CONTEXT="${*:-$DEFAULT_CONTEXT}"

if [[ "$CONTEXT" == /position-recommender* ]]; then
  PROMPT="$CONTEXT"
else
  PROMPT="/position-recommender $CONTEXT"
fi

cd "$ROOT"
if [[ "$VALIDATE_ONLY" != "1" ]]; then
  claude --permission-mode acceptEdits -p "$PROMPT"
fi

if [[ ! -s "$REPORT" ]]; then
  echo "position-recommender stale-output: expected today's report not found: $REPORT" >&2
  exit 1
fi

first_line="$(head -n 1 "$REPORT")"
if [[ "$first_line" != "# $REPORT_DATE "* ]]; then
  echo "position-recommender stale-output: report first line is not today's date ($REPORT_DATE): $first_line" >&2
  exit 1
fi

if [[ ! -s "$RUNTIME" ]]; then
  cp "$REPORT" "$RUNTIME"
fi

runtime_first_line="$(head -n 1 "$RUNTIME")"
if [[ "$runtime_first_line" != "# $REPORT_DATE "* ]]; then
  cp "$REPORT" "$RUNTIME"
  runtime_first_line="$(head -n 1 "$RUNTIME")"
fi

if [[ "$runtime_first_line" != "# $REPORT_DATE "* ]]; then
  echo "position-recommender stale-output: runtime first line is not today's date ($REPORT_DATE): $runtime_first_line" >&2
  exit 1
fi

notify_position_recommendation() {
  if [[ "${POSITION_RECOMMENDER_NOTIFY:-1}" == "0" ]]; then
    return 0
  fi

  if [[ ! -f "$NOTIFY_SCRIPT" ]]; then
    echo "position-recommender warn: notify script not found: $NOTIFY_SCRIPT" >&2
    return 0
  fi

  local candidates
  candidates="$(awk '
    /^## 강력 추천/ { section = "strong"; print "강력 추천:"; next }
    /^## 도전 추천/ { section = "stretch"; print ""; print "도전 추천:"; next }
    /^## 보류/ { section = ""; next }
    section != "" && /^[0-9]+\. / {
      line = $0
      sub(/^[0-9]+\. /, "- ", line)
      print line
    }
  ' "$RUNTIME" | head -n 10)"

  local message
  message="$(cat <<EOF
[완료] position-recommender $REPORT_DATE
report: $REPORT
runtime: $RUNTIME

$candidates

stale guard: 통과
EOF
)"

  bun --env-file="$ROOT/.env" "$NOTIFY_SCRIPT" "$message" || \
    echo "position-recommender warn: discord notify failed" >&2
}

if [[ "$VALIDATE_ONLY" != "1" ]]; then
  notify_position_recommendation
fi

echo "OK position-recommender fresh report: $REPORT"
