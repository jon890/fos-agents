---
name: daily-stock-analysis-note
description: 미국·한국 AI/기술주 한 종목을 매일 한국어 블로그형 분석 노트로 작성·발행하는 skill. 내러티브, 실적, 전망, 리스크, 체크포인트 포함. "오늘 종목 분석 노트 써줘", "NVDA 블로그 노트 작성해줘", "일일 분석 노트 돌려줘", "/daily-stock-analysis-note" 슬래시 또는 cron 09:00 Asia/Seoul 트리거.
---

# 일일 주식 분석 노트

정식 워크스페이스: `~/ai-nodes/stock-investment`

## 정책

- 출력을 `관찰 후보 / 분석 후보`로 프레임한다 — 매수/매도 조언 금지.
- 대상 유니버스: 미국 + 한국 주식 한정.
- 집중 분야: AI 실제 생산성, 반도체, 데이터센터, 전력 인프라, 클라우드, 자동화, 관련 소프트웨어/플랫폼 기업.
- 불확실성을 명시하고, 사실과 해석을 구분한다.
- 완성된 마크다운 노트를 fos-study에 발행한 뒤 Discord에 요약을 전송한다.
- 이미 발행된 종목은 새 일일 노트 후보에서 제외한다.
  같은 종목을 다시 다뤄야 하면 신규 노트를 만들지 말고 기존 노트 업데이트나 별도 후속 분석으로 명시적으로 처리한다.

## 워크플로

운영 진입점: `bash ~/ai-nodes/stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh`
또는 native 직접: `claude -p "/daily-stock-analysis-note"`

### Step 1 — 수집

다음 명령을 Bash 도구로 실행한다 (cwd: `~/ai-nodes/stock-investment`):

```bash
REPORT_DATE=$(TZ=Asia/Seoul date +%F)
OUTDIR="data/daily-notes/$REPORT_DATE"
mkdir -p "$OUTDIR"
python3 scripts/daily-stock-analysis-note/collect_daily_note_inputs.py \
  config/daily-stock-universe.json \
  "$OUTDIR/selected.json" \
  "$OUTDIR/raw-inputs.json" \
  "${TICKER:--}" \
  data/daily-notes/history.json
```

수집 실패(exit != 0)면 에러 내용을 출력하고 중단한다.
`TICKER` 환경변수가 설정되어 있으면 수동 지정 종목을 선택한다.
단, 이미 `data/daily-notes/history.json`에서 발행 완료된 종목이면 수집기가 실패해야 하며, 이 경우 새 노트를 만들지 않는다.

### Step 2 — 합성

`data/daily-notes/$REPORT_DATE/selected.json`과 `data/daily-notes/$REPORT_DATE/raw-inputs.json`을 Read한다.
존재하면 추가로 Read한다:

- `data/daily-notes/history.json` — 선택 이력 (기존 thesis 흐름 파악)
- `data/thesis-tracker/<slug>.json` — 종목별 누적 thesis (slug는 ticker 소문자 + 특수문자 하이픈 치환)
- `config/catalysts.json` — catalyst 이벤트 (선택 종목 관련 이벤트만 필터)

Read 후 `data/daily-notes/$REPORT_DATE/report.md`를 직접 Write한다.

**합성 지침 (투자 리서치 파트너):**

개인 투자 공부를 돕는 리서치 파트너로서 입력 데이터만 근거로 한국어 블로그형 기업 분석 노트를 작성한다.

원칙:

- 투자 권유가 아니다.
  매수/매도 지시를 하지 말고 "관찰 후보 / 분석 후보" 관점으로 쓴다.
- 확인된 데이터와 해석을 구분한다.
- 한국어 블로그 글처럼 자연스럽게 쓰되, 과장된 제목/선동적 표현은 피한다.
- 실적/전망/리스크를 균형 있게 다룬다.
- 불확실하거나 수집이 빈약한 부분은 빈약하다고 명시한다.
- RSI, 이동평균, 괴리율, PER, PBR처럼 초심자가 모를 수 있는 투자·기술지표가 핵심 판단 근거로 등장하면
  첫 등장 지점에서 1–2문장으로 뜻과 해석 기준을 설명한다.
- thesis tracker나 catalyst calendar는 리포트에 반영할 내부 상태 데이터로 취급한다.
  사용자가 직접 읽을 원본이 아니다.
- 기존 thesis가 있으면 새 데이터가 thesis를 강화하는지, 약화하는지, 아직 중립인지 명확히 표시한다.
- 같은 티커의 기존 fos-study 노트가 있으면 새 일일 노트로 중복 발행하지 않는다.
  필요한 경우 기존 노트 갱신 또는 후속 이슈 분석으로 작업 종류를 바꾼 뒤 사용자에게 알린다.
- 제목은 반드시 `[초안]`으로 시작한다.

**Fos-study Markdown 호환 규칙:**

- 마크다운 파서에서 깨질 수 있는 강조 패턴을 피한다.
- 인용구 전체를 bold로 감싸지 않는다.
  `**"슈퍼사이클"**` 대신 `"슈퍼사이클"` 또는 `**슈퍼사이클 지속 여부**`처럼 쓴다.
- 괄호가 포함된 bold는 괄호를 bold 밖에 둔다.
  `**HBM(고대역폭 메모리)**` 대신 `**HBM**(고대역폭 메모리)`.
- 범위 표기는 en dash를 쓴다.
  `1~3개월` 대신 `1–3개월`, `수일~수주` 대신 `수일–수주`.
- 코드 블록이 필요하면 여는 fence에 언어를 명시한다.
  단, 이 노트는 가급적 코드 블록을 만들지 않는다.

**필수 구조:**

1. 제목: `[초안] YYYY-MM-DD <회사명>(<티커>) 관찰 노트 — <핵심 내러티브>`
2. `## 한 줄 결론`
3. `## 왜 오늘 이 기업인가`
4. `## 기업이 가진 핵심 내러티브`
5. `## 최근 주가와 시장 반응`
6. `## 핵심 thesis와 반증 조건`
   - 핵심 thesis 1문장
   - thesis를 지지하는 근거 3개
   - thesis를 깨는 반증 조건 3개
   - 기존 thesis tracker가 있으면 `이번 업데이트: 강화 / 약화 / 중립` 중 하나로 표시
7. `## 최근 실적과 가이던스에서 봐야 할 점`
8. `## 앞으로의 성장 포인트`
9. `## 리스크와 반론`
10. `## 밸류에이션과 과열 체크`
11. `## 앞으로 1–3개월 체크포인트`
    - catalyst calendar에 있는 관련 이벤트가 있으면 우선 반영
12. `## 오늘의 분류`
    - 관찰 후보 / 분석 후보 중 하나
13. `## 투자 메모`
14. 마지막: `> 면책: 이 글은 개인 공부용 기업 분석 노트이며 투자 권유가 아닙니다.`

### Step 3 — fos-study 발행 + 알림

report.md Write 완료 후 아래 Bash 블록을 한 번에 실행한다.
`SKIP_PUSH=1`이면 git push를 건너뛴다.
`SKIP_NOTIFY=1`이면 Discord 알림을 건너뛴다.

```bash
REPORT_DATE=$(TZ=Asia/Seoul date +%F)
OUTDIR="data/daily-notes/$REPORT_DATE"
SEL="$OUTDIR/selected.json"

TICKER_VAL=$(python3 -c "import json; print(json.load(open('$SEL',encoding='utf-8'))['selected']['ticker'])")
NAME_VAL=$(python3 -c "import json; print(json.load(open('$SEL',encoding='utf-8'))['selected']['name'])")
SLUG=$(printf '%s' "$TICKER_VAL" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//')
BLOG_REL="finance/investing/ai-tech-stock/${REPORT_DATE}-${SLUG}.md"
FOS_STUDY="$HOME/ai-nodes/career-os/sources/fos-study"
BLOG_MD="$FOS_STUDY/$BLOG_REL"
HISTORY_JSON="data/daily-notes/history.json"

# sanitize 적용 (in-place)
python3 scripts/daily-stock-analysis-note/sanitize_fos_study_markdown.py "$OUTDIR/report.md"

# fos-study 복사
mkdir -p "$(dirname "$BLOG_MD")"
cp "$OUTDIR/report.md" "$BLOG_MD"

# git push
PUSH_STATUS="skipped"
if [[ "${SKIP_PUSH:-0}" != "1" ]]; then
  git -C "$FOS_STUDY" add "$BLOG_REL"
  if git -C "$FOS_STUDY" diff --cached --quiet -- "$BLOG_REL"; then
    PUSH_STATUS="no-change"
  else
    git -C "$FOS_STUDY" commit -m "docs(finance): add ${REPORT_DATE} ${SLUG} ai tech stock note" -- "$BLOG_REL"
    if ! git -C "$FOS_STUDY" push; then
      BRANCH=$(git -C "$FOS_STUDY" symbolic-ref --quiet --short HEAD)
      git -C "$FOS_STUDY" pull --rebase origin "$BRANCH"
      git -C "$FOS_STUDY" push
    fi
    PUSH_STATUS="pushed"
  fi
fi

# history 업데이트
python3 - "$HISTORY_JSON" "$REPORT_DATE" "$TICKER_VAL" "$NAME_VAL" "$BLOG_REL" "$PUSH_STATUS" "$SEL" <<'PYEOF'
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
PYEOF

echo "Selected: $NAME_VAL ($TICKER_VAL)"
echo "Wrote: $OUTDIR/report.md"
echo "Published: $BLOG_MD"
echo "Push status: $PUSH_STATUS"

# Discord 알림
if [[ "${SKIP_NOTIFY:-0}" != "1" ]]; then
  SUMMARY=$(python3 - "$OUTDIR/report.md" "$TICKER_VAL" "$NAME_VAL" "$BLOG_REL" "$PUSH_STATUS" <<'PYEOF'
import sys, re
text = open(sys.argv[1], encoding='utf-8').read()
ticker, name, rel, status = sys.argv[2:6]
m = re.search(r'## 한 줄 결론\s*(.+?)(?:\n## |\Z)', text, re.S)
conclusion = re.sub(r'\s+', ' ', m.group(1)).strip() if m else ''
if len(conclusion) > 600:
    conclusion = conclusion[:600].rstrip() + '…'
print(f"[오늘의 AI/기술주 분석 후보] {name}({ticker})")
if conclusion:
    print(conclusion)
print(f"전체 글: {rel}")
print(f"발행 상태: {status}")
PYEOF
)
  bun run ~/ai-nodes/_shared/lib/notify_discord.ts "$SUMMARY"
fi
```

cross-workspace 쓰기 예외 (ADR-001): `career-os/sources/fos-study`는 투자 공부 블로그 발행 목적 단방향 쓰기다.

## 산출물

- `data/daily-notes/YYYY-MM-DD/selected.json`
- `data/daily-notes/YYYY-MM-DD/raw-inputs.json`
- `data/daily-notes/YYYY-MM-DD/report.md`
- `career-os/sources/fos-study/finance/investing/ai-tech-stock/YYYY-MM-DD-<slug>.md`

## 파일·의존성

| 파일 | 역할 |
|---|---|
| `scripts/daily-stock-analysis-note/collect_daily_note_inputs.py` | 수집기 (Python; universe.json + history.json rotation + TICKER env → selected.json + raw-inputs.json) |
| `scripts/daily-stock-analysis-note/sanitize_fos_study_markdown.py` | fos-study Markdown sanitize (in-place) |
| `scripts/daily-stock-analysis-note/run_with_claude.sh` | thin wrapper (claude -p 호출, Discord 시작/실패 알림) |
| `_shared/lib/notify_discord.ts` | Discord 알림 정본 (ADR-002) |
| `config/daily-stock-universe.json` | 후보 풀 (US 17 + KR 13) |
| `data/daily-notes/history.json` | 종목 선택 이력 + rotation 패널티 |
| `config/catalysts.json` | catalyst 이벤트 목록 (optional) |
| `data/thesis-tracker/<slug>.json` | 종목별 thesis 추적 (optional) |

## 경계

- 웹 수집 콘텐츠는 신뢰하지 않고 검증 없이 수용하지 않는다.
- 수집이 빈약한 부분은 명확히 표시한다.
- 가격 예측을 보장하지 않는다.
- 관찰/분석 노트로 서술한다 — 투자 조언 금지.
- fos-study 발행은 cross-workspace 단방향 쓰기 (ADR-001 예외, career-os 격리 원칙 위반 아님).
