#!/usr/bin/env bash
set -euo pipefail

ROOT="${CAREER_OS_ROOT:-/home/bifos/ai-nodes/career-os}"
REPORT_DATE="${REPORT_DATE:-$(TZ=Asia/Seoul date +%F)}"
REPORT="$ROOT/data/reports/daily/$REPORT_DATE/position-recommendation/report.md"
RUNTIME="$ROOT/data/runtime/position-recommendation.md"
LIVE_POSTINGS="$ROOT/data/runtime/live-position-postings.md"
NOTIFY_SCRIPT="$ROOT/../_shared/lib/notify_discord.ts"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
usage: run_daily_with_claude.sh [context]
       run_daily_with_claude.sh --validate-existing

Runs claude -p "/position-recommender ..." and verifies that today's
Asia/Seoul report and runtime mirror were freshly written.

Environment:
  POSITION_RECOMMENDER_NOTIFY=0  Skip Discord notification.
  POSITION_RECOMMENDER_NOTIFY_DRY_RUN=1  Print the Discord message instead of sending it.
EOF
  exit 0
fi

VALIDATE_ONLY=0
if [[ "${1:-}" == "--validate-existing" ]]; then
  VALIDATE_ONLY=1
  shift
fi

DEFAULT_CONTEXT="매일 서버/backend 정규직 포지션 추천. 최신 Wanted/공식 career active/open 개별 공고만 강력 추천/도전 추천에 포함. 회사명, 채용 홈, 기술블로그, 뉴스, 탐색 링크만 있는 lead는 추천 티어에 올리지 말고 추가 수집 대상에만 분리. Java/Spring 서버/backend 정규직 중심이되, 사용자는 AI 서비스/AI Transformation(AX)/AI Agent/AI 플랫폼에도 관심이 많으므로 서버·플랫폼 개발 전이가 분명한 AI 포지션은 별도 추천 레인으로 적극 탐색. 최근 7일 position-recommendation 리포트를 읽고 반복 후보는 감점하되, 동일 개별 active 공고가 여전히 최상위인 경우 반복 유지 사유를 명시. 최소 1개 이상은 최근 7일 강력 추천에 없던 신규 개별 active 공고를 포함하고, 없으면 신규 active 공고 부족이라고 명시. NHN보다 좋은 회사, 강한 성장 모멘텀, 도메인 전환 기회를 우선하되 개별 공고 JD fit이 없으면 추천하지 않음. 레브잇/올웨이즈/다니엘프로젝트/리아드코퍼레이션/피닉스랩/와그(WAUG)는 사용자가 크게 지원해보고 싶은 회사가 아니라고 판단했으므로 강력 추천/도전 추천/즉시 지원 액션에서 제외. 토스 계열은 최근 6개월 불합격 쿨다운으로 강력 추천/즉시 지원 액션에서 제외하고 보류/쿨다운 후보로만 짧게 언급. 특정 회사나 공고를 고정 우선하지 말고 active JD fit, 회사/규모 업사이드, AI 전환/백엔드 코어 커리어 서사, 최근 반복 여부로 랭킹."
CONTEXT="${*:-$DEFAULT_CONTEXT}"

if [[ "$CONTEXT" == /position-recommender* ]]; then
  PROMPT="$CONTEXT"
else
  PROMPT="/position-recommender $CONTEXT"
fi

cd "$ROOT"
if [[ "$VALIDATE_ONLY" != "1" ]]; then
  COLLECT_ARGS=(
    "$ROOT/scripts/position-recommender/collect_live_postings.ts"
    --source "${POSITION_RECOMMENDER_SOURCE:-wanted}"
    --max-wanted "${POSITION_RECOMMENDER_WANTED_LIMIT:-120}"
    --output "$LIVE_POSTINGS"
  )
  if [[ "${POSITION_RECOMMENDER_INCLUDE_TOSS_ARTICLES:-0}" == "1" ]]; then
    COLLECT_ARGS+=(--include-toss-articles)
  fi
  bun "${COLLECT_ARGS[@]}"
  if ! grep -q "link_type: direct_posting" "$LIVE_POSTINGS"; then
    echo "position-recommender live-postings: no direct postings collected: $LIVE_POSTINGS" >&2
  fi
  if ! grep -Eq "posting_status: (active|open)" "$LIVE_POSTINGS"; then
    echo "position-recommender live-postings: no active/open postings collected: $LIVE_POSTINGS" >&2
  fi
  if grep -Eq "link_type: (career_article|search_page)|posting_status: unknown|opened_at: unknown" "$LIVE_POSTINGS"; then
    echo "position-recommender live-postings: non-active or non-direct lead leaked into active-only snapshot: $LIVE_POSTINGS" >&2
    exit 1
  fi
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

validate_direct_posting_recommendations() {
  awk '
    function flush_candidate() {
      if (section == "" || title == "") {
        reset_candidate()
        return
      }
      if (posting_link !~ /^https?:\/\//) {
        print "position-recommender invalid recommendation: " section " item lacks direct posting link: " title > "/dev/stderr"
        bad = 1
      }
      if (explore_link != "" && explore_link != "-") {
        print "position-recommender invalid recommendation: " section " item has explore link in recommendation tier: " title > "/dev/stderr"
        bad = 1
      }
      if (evidence !~ /개별 공고 (active|open) 확인/) {
        print "position-recommender invalid recommendation: " section " item lacks direct active/open evidence: " title > "/dev/stderr"
        bad = 1
      }
      reset_candidate()
    }
    function reset_candidate() {
      title = ""
      posting_link = ""
      explore_link = ""
      evidence = ""
    }
    /^## 강력 추천/ {
      flush_candidate()
      section = "strong"
      next
    }
    /^## 도전 추천/ {
      flush_candidate()
      section = "stretch"
      next
    }
    /^## / {
      flush_candidate()
      section = ""
      next
    }
    section != "" && /^(### )?[0-9]+\. / {
      flush_candidate()
      line = $0
      sub(/^(### )?[0-9]+\. /, "", line)
      title = line
      next
    }
    section != "" && title != "" && /^[[:space:]]*- 공고 링크:/ {
      line = $0
      sub(/^[[:space:]]*- 공고 링크:[[:space:]]*/, "", line)
      posting_link = line
      next
    }
    section != "" && title != "" && /^[[:space:]]*- 탐색 링크:/ {
      line = $0
      sub(/^[[:space:]]*- 탐색 링크:[[:space:]]*/, "", line)
      explore_link = line
      next
    }
    section != "" && title != "" && /^[[:space:]]*- 링크 근거 수준:/ {
      line = $0
      sub(/^[[:space:]]*- 링크 근거 수준:[[:space:]]*/, "", line)
      evidence = line
      next
    }
    END {
      flush_candidate()
      exit bad
    }
  ' "$RUNTIME"
}

validate_direct_posting_recommendations

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
    function flush_candidate() {
      if (section == "" || title == "") return
      if (section == "strong" && strong_count >= 3) {
        reset_candidate()
        return
      }
      if (section == "stretch" && stretch_count >= 2) {
        reset_candidate()
        return
      }
      if (section == "strong") {
        strong_count++
        item_no = strong_count
      }
      if (section == "stretch") {
        stretch_count++
        item_no = stretch_count
      }
      print item_no ". " title
      print "   지원: " format_link(link)
      print "   이유: " (summary != "" ? summary : "-")
      print "   확인: " (check != "" ? check : "-")
      print "   다음: " (action != "" ? action : "-")
      reset_candidate()
    }
    function format_link(value) {
      if (value ~ /^https?:\/\//) return "<" value ">"
      return "-"
    }
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:],，]+$/, "", value)
      return value
    }
    function first_sentence(value) {
      value = trim(value)
      sentence_end = index(value, ". ")
      if (sentence_end > 0) value = substr(value, 1, sentence_end)
      return value
    }
    function first_list_item(value) {
      value = trim(value)
      sub(/^\([0-9]+\)[[:space:]]*/, "", value)
      split(value, parts, /\([0-9]+\)/)
      return trim(parts[1])
    }
    function reset_candidate() {
      title = ""
      summary = ""
      link = ""
      check = ""
      action = ""
    }
    /^## 강력 추천/ {
      flush_candidate()
      section = "strong"
      print "강력 추천:"
      next
    }
    /^## 도전 추천/ {
      flush_candidate()
      section = "stretch"
      print ""
      print "도전 추천:"
      next
    }
    /^## / {
      flush_candidate()
      section = ""
      next
    }
    section != "" && /^(### )?[0-9]+\. / {
      flush_candidate()
      line = $0
      sub(/^(### )?[0-9]+\. /, "", line)
      title = line
      next
    }
    section != "" && title != "" && /^[[:space:]]*- (공고|탐색) 링크:/ {
      line = $0
      sub(/^[[:space:]]*- (공고|탐색) 링크:[[:space:]]*/, "", line)
      if (link == "" || link == "-") link = line
      next
    }
    section != "" && title != "" && /^[[:space:]]*- 왜 맞는가:/ {
      line = $0
      sub(/^[[:space:]]*- 왜 맞는가:[[:space:]]*/, "", line)
      summary = first_sentence(line)
      next
    }
    section != "" && title != "" && /^[[:space:]]*- 확인해야 할 모호점:/ {
      line = $0
      sub(/^[[:space:]]*- 확인해야 할 모호점:[[:space:]]*/, "", line)
      check = first_list_item(line)
      next
    }
    section != "" && title != "" && /^[[:space:]]*- 준비 액션:/ {
      line = $0
      sub(/^[[:space:]]*- 준비 액션:[[:space:]]*/, "", line)
      action = first_sentence(line)
      next
    }
    END { flush_candidate() }
  ' "$RUNTIME")"

  local message
  message="$(cat <<EOF
오늘 포지션 추천 ($REPORT_DATE)

$candidates

전체 리포트: \`$REPORT\`
검증: 오늘 날짜 리포트 + 개별 active 공고 링크 확인 완료
EOF
)"

  if [[ "${POSITION_RECOMMENDER_NOTIFY_DRY_RUN:-0}" == "1" ]]; then
    printf '%s\n' "$message"
    return 0
  fi

  bun --env-file="$ROOT/.env" "$NOTIFY_SCRIPT" "$message" || \
    echo "position-recommender warn: discord notify failed" >&2
}

if [[ "$VALIDATE_ONLY" != "1" || "${POSITION_RECOMMENDER_NOTIFY_DRY_RUN:-0}" == "1" ]]; then
  notify_position_recommendation
fi

echo "OK position-recommender fresh report: $REPORT"
