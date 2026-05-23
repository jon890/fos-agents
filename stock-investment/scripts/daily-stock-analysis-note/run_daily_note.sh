#!/usr/bin/env bash
set -euo pipefail

if [[ "${TRACK_TASK_WRAPPED:-0}" != "1" ]]; then
  export TRACK_TASK_WRAPPED=1
  TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/stock-investment}"
  TRACKER="${TRACKER:-$HOME/ai-nodes/_shared/bin/track_task.sh}"
  exec "$TRACKER" "$TASK_ROOT" "stock-investment:daily-stock-note" "$0" "$@"
fi

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/stock-investment}"
CAREER_ROOT="${CAREER_ROOT:-$HOME/ai-nodes/career-os}"
FOS_STUDY="${FOS_STUDY:-$CAREER_ROOT/sources/fos-study}"
REPORT_DATE="${REPORT_DATE:-$(TZ=Asia/Seoul date +%F)}"
TICKER_ARG="${TICKER:-${1:-}}"
TICKER_ARG="${TICKER_ARG:-}" 
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
WS_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTDIR="$TASK_ROOT/data/daily-notes/$REPORT_DATE"
UNIVERSE="$TASK_ROOT/config/daily-stock-universe.json"
SELECTED_JSON="$OUTDIR/selected.json"
RAW_JSON="$OUTDIR/raw-inputs.json"
HISTORY_JSON="$TASK_ROOT/data/daily-notes/history.json"
THESIS_DIR="$TASK_ROOT/data/thesis-tracker"
CATALYSTS_JSON="$TASK_ROOT/config/catalysts.json"
ANALYSIS_INPUT="$OUTDIR/analysis-input.md"
CLAUDE_JSON="$OUTDIR/claude.result.json"
DRAFT_MD="$OUTDIR/report.md"
PROMPT_FILE="$WS_ROOT/.claude/skills/daily-stock-analysis-note/references/blog-note-prompt.md"
COLLECTOR="$SKILL_DIR/collect_daily_note_inputs.py"
SANITIZER="$SKILL_DIR/sanitize_fos_study_markdown.py"
EXTRACT="$HOME/ai-nodes/_shared/lib/extract_claude_result.ts"
NOTIFIER="$TASK_ROOT/scripts/stock-investing-morning-brief/notify_discord.sh"

push_fos_study() {
  if git -C "$FOS_STUDY" push; then
    return 0
  fi

  local branch
  branch="$(git -C "$FOS_STUDY" symbolic-ref --quiet --short HEAD)"
  echo "[daily-stock-note] git push failed; rebasing origin/$branch and retrying once" >&2
  git -C "$FOS_STUDY" pull --rebase origin "$branch"
  git -C "$FOS_STUDY" push
}

mkdir -p "$OUTDIR"
python3 "$COLLECTOR" "$UNIVERSE" "$SELECTED_JSON" "$RAW_JSON" "${TICKER_ARG:--}" "$HISTORY_JSON" 2>/tmp/daily-stock-note-collector.err || {
  if [[ -s /tmp/daily-stock-note-collector.err ]]; then cat /tmp/daily-stock-note-collector.err >&2; fi
  exit 1
}

TICKER="$(python3 - <<'PY' "$SELECTED_JSON"
import json,sys
print(json.load(open(sys.argv[1],encoding='utf-8'))['selected']['ticker'])
PY
)"
NAME="$(python3 - <<'PY' "$SELECTED_JSON"
import json,sys
print(json.load(open(sys.argv[1],encoding='utf-8'))['selected']['name'])
PY
)"
SLUG="$(printf '%s' "$TICKER" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//')"
BLOG_REL="finance/investing/ai-tech-stock/${REPORT_DATE}-${SLUG}.md"
BLOG_MD="$FOS_STUDY/$BLOG_REL"
THESIS_JSON="$THESIS_DIR/$SLUG.json"

{
  cat "$PROMPT_FILE"
  printf '\n\n기준일: %s Asia/Seoul\n' "$REPORT_DATE"
  printf '\nselected.json:\n```json\n'
  cat "$SELECTED_JSON"
  printf '\n```\n\nraw-inputs.json:\n```json\n'
  cat "$RAW_JSON"
  printf '\n```\n'
  if [[ -f "$THESIS_JSON" ]]; then
    printf '\n\nthesis-tracker.json:\n```json\n'
    cat "$THESIS_JSON"
    printf '\n```\n'
  fi
  if [[ -f "$CATALYSTS_JSON" ]]; then
    printf '\n\ncatalyst-calendar.json:\n```json\n'
    python3 - <<'PY' "$CATALYSTS_JSON" "$TICKER"
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
ticker = sys.argv[2]
data = json.loads(path.read_text(encoding='utf-8'))
events = [e for e in data.get('events', []) if e.get('ticker') in {ticker, 'QQQ', '^NDX'}]
print(json.dumps({'policy': data.get('policy', {}), 'events': events}, ensure_ascii=False, indent=2))
PY
    printf '\n```\n'
  fi
} > "$ANALYSIS_INPUT"

if timeout "${CLAUDE_TIMEOUT_SECONDS:-240}" claude --permission-mode bypassPermissions --print --output-format json "$(cat "$ANALYSIS_INPUT")" > "$CLAUDE_JSON"; then
  bun run "$EXTRACT" "$CLAUDE_JSON" "$DRAFT_MD" "${TRACK_TASK_CLAUDE_USAGE_FILE:-}"
else
  cat > "$DRAFT_MD" <<EOF
# [초안] $REPORT_DATE $NAME($TICKER) 관찰 노트

Claude 리포트 생성에 실패했습니다.

- selected: $SELECTED_JSON
- raw inputs: $RAW_JSON

> 면책: 이 글은 개인 공부용 기업 분석 노트이며 투자 권유가 아닙니다.
EOF
fi

if [[ -x "$SANITIZER" ]]; then
  "$SANITIZER" "$DRAFT_MD"
fi

mkdir -p "$(dirname "$BLOG_MD")"
cp "$DRAFT_MD" "$BLOG_MD"

PUSH_STATUS="skipped"
if [[ "${SKIP_PUSH:-0}" != "1" ]]; then
  git -C "$FOS_STUDY" add "$BLOG_REL"
  if git -C "$FOS_STUDY" diff --cached --quiet -- "$BLOG_REL"; then
    PUSH_STATUS="no-change"
  else
    git -C "$FOS_STUDY" commit -m "docs(finance): add ${REPORT_DATE} ${SLUG} ai tech stock note" -- "$BLOG_REL"
    push_fos_study
    PUSH_STATUS="pushed"
  fi
fi

if [[ "${SKIP_HISTORY:-0}" != "1" ]]; then
  python3 - <<'PY' "$HISTORY_JSON" "$REPORT_DATE" "$TICKER" "$NAME" "$BLOG_REL" "$PUSH_STATUS" "$SELECTED_JSON"
import json, sys
from pathlib import Path
history_path = Path(sys.argv[1])
report_date, ticker, name, blog_rel, push_status, selected_path = sys.argv[2:8]
try:
    selected = json.loads(Path(selected_path).read_text(encoding='utf-8'))['selected']
except Exception:
    selected = {}
try:
    history = json.loads(history_path.read_text(encoding='utf-8')) if history_path.exists() else {'entries': []}
except Exception:
    history = {'entries': []}
entries = [e for e in history.get('entries', []) if not (e.get('date') == report_date and e.get('ticker') == ticker)]
entries.append({
    'date': report_date,
    'ticker': ticker,
    'name': name,
    'market': selected.get('market'),
    'blogPath': blog_rel,
    'pushStatus': push_status,
})
history_path.parent.mkdir(parents=True, exist_ok=True)
history_path.write_text(json.dumps({'entries': entries[-120:]}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PY
fi

if [[ "${SKIP_NOTIFY:-0}" != "1" && -x "$NOTIFIER" ]]; then
  SUMMARY="$(python3 - <<'PY' "$DRAFT_MD" "$TICKER" "$NAME" "$BLOG_REL" "$PUSH_STATUS"
import sys,re
text=open(sys.argv[1],encoding='utf-8').read()
ticker,name,rel,status=sys.argv[2:6]
# Grab first useful conclusion paragraph after heading.
m=re.search(r'## 한 줄 결론\s*(.+?)(?:\n## |\Z)', text, re.S)
conclusion=re.sub(r'\s+',' ',m.group(1)).strip() if m else ''
if len(conclusion)>600: conclusion=conclusion[:600].rstrip()+'…'
print(f"[오늘의 AI/기술주 분석 후보] {name}({ticker})")
if conclusion: print(conclusion)
print(f"전체 글: {rel}")
print(f"발행 상태: {status}")
PY
)"
  "$NOTIFIER" "$SUMMARY" || true
fi

echo "Selected: $NAME ($TICKER)"
echo "Wrote: $DRAFT_MD"
echo "Published: $BLOG_MD"
echo "Push status: $PUSH_STATUS"
