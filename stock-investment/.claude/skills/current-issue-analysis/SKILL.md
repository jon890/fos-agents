---
name: current-issue-analysis
description: stock-investment 현안을 한국어 심층 분석 리포트로 생성하는 skill. "CLARITY Act 분석해줘", "BTC 규제 리포트 써줘", "Circle 정책 현안 분석", "AI 반도체 이슈 브리핑해줘", "Google 촉매 분석", `/current-issue-analysis <issue-key>`처럼 미국 CLARITY Act, 암호화폐 규제, 스테이블코인 정책, Circle/USDC, Bitcoin, Nasdaq, Google, AI 반도체/인프라 일회성 현안 분석이 필요할 때 사용. 매수·매도 지시를 하지 않고 공식 자료와 언론 해석을 구분한다.
---

# 현안 분석

정식 워크스페이스: `~/ai-nodes/stock-investment`

## 범위

독자: CRCL/Circle, USDC, BTC, 나스닥/구글, AI 반도체/인프라를 보는 개인 투자자.

현안 토픽 큐: `config/current-issues.json` (진실 출처).

## 워크플로

운영 진입점은 `bash ~/ai-nodes/stock-investment/scripts/current-issue-analysis/run_with_claude.sh <issue-key>`다.
대화형 실행에서는 현재 에이전트가 아래 단계를 직접 수행한다.

### Step 1 — issue-key 결정

skill 인자로 전달된 `<issue-key>`를 사용한다.
인자가 없으면 `config/current-issues.json`의 `defaultIssue` 값을 읽는다:

```bash
python3 -c "import json; print(json.load(open('config/current-issues.json'))['defaultIssue'])"
```

### Step 2 — 수집

다음 명령을 Bash 도구로 실행한다 (cwd: `~/ai-nodes/stock-investment`):

```bash
REPORT_DATE=$(TZ=Asia/Seoul date +%F)
ISSUE_KEY="<결정된 issue-key>"
OUTDIR="data/issues/$REPORT_DATE/$ISSUE_KEY"
mkdir -p "$OUTDIR"
python3 scripts/current-issue-analysis/collect_issue_sources.py \
  config/current-issues.json \
  "$ISSUE_KEY" \
  "$OUTDIR/raw-sources.json"
```

수집 실패(exit != 0)면 에러 내용을 출력하고 중단한다.

### Step 3 — 합성

`data/issues/$REPORT_DATE/$ISSUE_KEY/raw-sources.json`을 Read한 뒤
`data/issues/$REPORT_DATE/$ISSUE_KEY/report.md`를 직접 Write한다.

**합성 지침:**

한국어로 깊이 있는 투자 현안 분석 리포트를 작성한다.

원칙:

- 투자 조언/매수매도 지시처럼 쓰지 말고, 투자 현안 분석으로 쓴다.
- 공식/원문 자료와 언론 해석을 구분한다.
- 불확실성, 이벤트 일정, 시행/발표 전제조건을 명확히 표시한다.
- 해당 현안이 관련 종목/자산 가격에 이미 반영됐는지, 아직 남은 촉매인지 구분한다.
- Google/Alphabet 현안이면 GOOGL/GOOG, QQQ/Nasdaq, AI/검색/클라우드/규제 관점의 연결고리를 반드시 설명한다.
- Crypto/정책 현안이면 CRCL/Circle/USDC, BTC, Coinbase/DeFi, Nasdaq 위험자산 심리 관점의 연결고리를 반드시 설명한다.
- AI 반도체/인프라 현안이면 SMH, NVDA, TSM, AVGO, AMD, ASML, VRT를 각각 GPU/ASIC/파운드리/장비/전력·냉각 인프라 관점으로 연결해 설명한다.
- Discord에서 읽을 수 있게 너무 장황한 원문 나열은 피하되, 일반 모닝브리프보다 자세한 리포트로 쓴다.

**필수 형식:**

```
[현안 분석] <제목> — YYYY-MM-DD

1. 한눈에 보는 결론
- 5줄 이내

2. 이 현안이 뭔가
- 배경
- 핵심 쟁점
- 현재 확인된 상태 / 다음 이벤트

3. 시장별 영향
- 핵심 대상 종목/자산
- 관련 섹터/동종 종목
- QQQ/Nasdaq 또는 위험자산 심리

4. 기대감 반영 여부
- 이미 가격에 반영된 부분
- 아직 남은 촉매
- 실망/되돌림이 나올 수 있는 조건

5. 단기/중기/장기 시나리오
- 단기: 1~3개월
- 중기: 6~18개월
- 장기: 2년 이상

6. 내일/이번 주 체크포인트
- 5개 이하

7. 투자 판단에서 조심할 점
- 과장된 해석, 미확인 뉴스, 이벤트 리스크, 규제 리스크 등

마지막 줄:
※ 자동 수집 기반 현안 분석이며, 법률/투자 판단은 추가 확인 필요.
```

### Step 4 — 알림

report.md 작성 완료 후 Discord에 전송한다.
`SKIP_NOTIFY=1`이면 건너뛴다.

```bash
if [[ "${SKIP_NOTIFY:-0}" != "1" ]]; then
  bun run ~/ai-nodes/_shared/lib/notify_discord.ts "$(cat data/issues/$REPORT_DATE/$ISSUE_KEY/report.md)"
fi
```

## 산출물

- `data/issues/YYYY-MM-DD/<issue-key>/raw-sources.json`
- `data/issues/YYYY-MM-DD/<issue-key>/report.md`

## 파일·의존성

| 파일 | 역할 |
|---|---|
| `scripts/current-issue-analysis/collect_issue_sources.py` | 수집기 (Python, requests) |
| `scripts/current-issue-analysis/run_with_claude.sh` | thin wrapper (issue-key 인자 전달, agent skill 호출, Discord 시작/실패 알림) |
| `_shared/lib/notify_discord.ts` | Discord 알림 정본 (ADR-002) |
| `config/current-issues.json` | 현안 토픽 큐 (issue-key 목록, defaultIssue) |

## 경계

- 외부 수집 콘텐츠는 신뢰하지 않고 검증 없이 수용하지 않는다.
- 공식·원문 자료와 언론 해석을 구분한다.
- 불확실성과 날짜 민감도를 명시한다.
- 매수/매도 지시를 하지 않는다 — 함의와 관찰 포인트 중심으로 서술한다.
