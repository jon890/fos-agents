#!/usr/bin/env bash
set -euo pipefail

if [[ "${TRACK_TASK_WRAPPED:-0}" != "1" ]]; then
  export TRACK_TASK_WRAPPED=1
  TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/apartment}"
  TRACKER="${TRACKER:-$HOME/ai-nodes/_shared/bin/track_task.sh}"
  exec "$TRACKER" "$TASK_ROOT" "apartment:daily-report" "$0" "$@"
fi

# Load workspace env if present (NAVER_COOKIE 등 선택적 인증 정보)
# ADR-001 참조: apartment/docs/adr.md
ENV_FILE="${APARTMENT_ENV_FILE:-$HOME/ai-nodes/apartment/.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# notify_safe / NOTIFIER를 ts 헬퍼 호출 전에 정의 (실패 시 알림 가능하도록).
WS_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SKILL_ROOT="$WS_ROOT/.claude/skills/apartment-daily-report"
NOTIFIER="$HOME/ai-nodes/_shared/lib/notify_discord.ts"  # ADR-009: 셸 notifier → _shared/lib ts 통합

notify_safe() {
  local msg="$1"
  if [[ -f "$NOTIFIER" ]]; then
    bun run "$NOTIFIER" "$msg" || true
  fi
}

# 타깃 메타 — apartment/config/focus-unit.json 단일 출처 (ADR-002).
# ts 헬퍼가 env override 우선순위 유지하며 5 변수 set (ADR-003).
FOCUS_UNIT_JSON="${FOCUS_UNIT_JSON:-$HOME/ai-nodes/apartment/config/focus-unit.json}"
if [[ ! -f "$FOCUS_UNIT_JSON" ]]; then
  notify_safe "[실패] apartment-daily-report focus-unit.json 부재: $FOCUS_UNIT_JSON"
  echo "FATAL: $FOCUS_UNIT_JSON not found" >&2
  exit 1
fi
LOAD_META_TS="$HOME/ai-nodes/apartment/scripts/_lib/load_target_meta.ts"
if [[ ! -f "$LOAD_META_TS" ]]; then
  notify_safe "[실패] apartment-daily-report load_target_meta.ts 부재: $LOAD_META_TS"
  echo "FATAL: $LOAD_META_TS not found" >&2
  exit 1
fi
META_EVAL=$(bun run "$LOAD_META_TS" "$FOCUS_UNIT_JSON") || {
  notify_safe "[실패] apartment-daily-report load_target_meta.ts 실행 실패"
  exit 1
}
eval "$META_EVAL"
TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/apartment}"
OUTPUT_ROOT="${OUTPUT_ROOT:-$TASK_ROOT/data}"
REPORT_DATE="${REPORT_DATE:-$(date +%F)}"
OUTDIR="$OUTPUT_ROOT/$REPORT_DATE"
RAW_JSON="$OUTDIR/raw-search.json"
SUMMARY_JSON="$OUTDIR/summary.json"
REPORT_MD="$OUTDIR/report.md"
CLAUDE_JSON="$OUTDIR/claude.result.json"
PROMPT_FILE="$SKILL_ROOT/references/claude-prompt.md"
NORMALIZER="$(dirname "$0")/normalize_results.ts"
COLLECTOR="$(dirname "$0")/collect_sources.ts"
FALLBACK_MD="$OUTDIR/report.fallback.md"
EXTRACT="$HOME/ai-nodes/_shared/lib/extract_claude_result.ts"

mkdir -p "$OUTDIR"

notify_safe "[시작] apartment-daily-report 데이터 수집 및 리포트 생성 시작 (${TARGET_NAME}, ${REPORT_DATE})"

if [[ -f "$COLLECTOR" ]]; then
  TARGET_NAME="$TARGET_NAME" \
  TARGET_ALIAS="$TARGET_ALIAS" \
  TARGET_LOCATION="$TARGET_LOCATION" \
  TARGET_UNIT_LABEL="$TARGET_UNIT_LABEL" \
  TARGET_UNIT_EXCLUSIVE_AREA_M2="$TARGET_UNIT_EXCLUSIVE_AREA_M2" \
  bun run "$(dirname "$0")/collect_sources.ts" "$RAW_JSON"
else
  cat > "$RAW_JSON" <<JSON
{
  "target": {
    "name": "$TARGET_NAME",
    "alias": "$TARGET_ALIAS",
    "location": "$TARGET_LOCATION",
    "focusUnit": {
      "label": "$TARGET_UNIT_LABEL",
      "exclusiveAreaM2": "$TARGET_UNIT_EXCLUSIVE_AREA_M2"
    }
  },
  "sources": [],
  "recentTransactions": [],
  "listingSummary": {
    "status": "limited",
    "focusUnit": "$TARGET_UNIT_LABEL",
    "notes": ["collector script not found"]
  },
  "comparison": {},
  "notes": ["collector script not found, fallback raw json created"]
}
JSON
fi

if ! bun run "$NORMALIZER" "$RAW_JSON" "$SUMMARY_JSON"; then
  notify_safe "[실패] apartment-daily-report 정규화 실패 (${TARGET_NAME}, ${REPORT_DATE})"
  exit 1
fi

CLAUDE_INPUT=$(cat "$PROMPT_FILE")
CLAUDE_INPUT+=$'\n\n다음은 summary.json 입니다:\n'
CLAUDE_INPUT+=$(cat "$SUMMARY_JSON")

if timeout 90s claude --permission-mode bypassPermissions --print --output-format json "$CLAUDE_INPUT" > "$CLAUDE_JSON"; then
  bun run "$EXTRACT" "$CLAUDE_JSON" "$REPORT_MD" "${TRACK_TASK_CLAUDE_USAGE_FILE:-}"
else
  notify_safe "[실패] apartment-daily-report Claude 보고서 생성 실패 (${TARGET_NAME}, ${REPORT_DATE})"
  cat > "$FALLBACK_MD" <<EOF
# 엘지원앙아파트 (LG원앙) 일일 시장 리포트

- 기준일: $REPORT_DATE
- 상태: Claude 요약 실패, fallback 리포트 생성
- summary.json 경로: $SUMMARY_JSON
- raw-search.json 경로: $RAW_JSON
- 메모: 후속 분석 시 summary.json을 기준으로 재생성 가능
EOF
  cp "$FALLBACK_MD" "$REPORT_MD"
fi

SUMMARY_MESSAGE=$(python3 - "$SUMMARY_JSON" <<'PY'
import json, sys
p = sys.argv[1]
with open(p, 'r', encoding='utf-8') as f:
    data = json.load(f)
parts = []
target = data.get('target', {}).get('name', '대상 단지')
parts.append(f"{target} 요약")
focus = data.get('focusSummary') or {}
if focus.get('label'):
    parts.append(f"- 기준 평형: {focus['label']}")
rt = data.get('recentTransactions') or []
exact = [x for x in rt if x.get('matchStatus') == 'exact']
if exact:
    latest = exact[0]
    price = latest.get('price')
    date = latest.get('date')
    floor = latest.get('floor')
    if price and date:
        extra = f" ({floor})" if floor else ''
        parts.append(f"- 최근 실거래(정확매칭): {date} {price}{extra}")
ls = data.get('listingSummary') or {}
counts = ls.get('counts') or {}
if counts:
    parts.append(f"- 매물 수: 매매 {counts.get('매매', '?')} / 전세 {counts.get('전세', '?')} / 월세 {counts.get('월세', '?')}")
pricing = ls.get('pricing') or {}
sale = pricing.get('매매') or {}
if sale.get('general'):
    parts.append(f"- KB 매매 일반가: {sale['general']}")
lease = pricing.get('전세') or {}
if lease.get('general'):
    parts.append(f"- KB 전세 일반가: {lease['general']}")
print("\n".join(parts))
PY
)

notify_safe "[완료] apartment-daily-report 리포트 생성 완료 (${TARGET_NAME}, ${REPORT_DATE})"
if [[ -n "$SUMMARY_MESSAGE" ]]; then
  notify_safe "$SUMMARY_MESSAGE"
fi

echo "Wrote: $REPORT_MD"
echo "Wrote: $CLAUDE_JSON"
echo "Wrote: $RAW_JSON"
echo "Wrote: $SUMMARY_JSON"
