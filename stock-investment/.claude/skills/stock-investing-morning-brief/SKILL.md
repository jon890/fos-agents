---
name: stock-investing-morning-brief
description: stock-investment 워크스페이스에서 Circle Internet Group(CRCL), Bitcoin, Google/Alphabet(GOOGL/GOOG), Nasdaq/QQQ, AI 반도체/인프라 한국어 모닝 브리핑을 생성하는 skill. "모닝 브리핑 실행해줘", "오늘 주식 체크해줘", "아침 시장 브리프", "주식 모닝 브리프 돌려줘", `/stock-investing-morning-brief`, cron 08:00 Asia/Seoul처럼 일일 시장 데이터와 뉴스 수집, report.md 작성, Discord 요약이 필요할 때 사용. 투자 조언이 아니라 관찰 포인트와 리스크 중심으로 쓴다.
---

# 주식 모닝 브리핑

정식 워크스페이스: `~/ai-nodes/stock-investment`

## 범위

프로파일: `circle-bitcoin`

집중 대상:

- CRCL 가격 추이 및 실적/뉴스 셋업
- USDC 유통량/채택 신호 (데이터 가용 시)
- Circle Payments Network 및 파트너십 뉴스
- 스테이블코인 규제 동향: CLARITY Act, SEC 정책, 관련 뉴스
- BTC 가격 추이, ETF 흐름 내러티브, 암호화폐 전반 위험 심리
- GOOGL/GOOG (Alphabet/Google) — Google I/O, Gemini/AI, Search, Cloud, CapEx, 규제 관찰 포인트
- QQQ/^NDX — Nasdaq/성장주 위험 심리, AI/반도체 리더십, 금리/매크로 압력
- AI 반도체/인프라 바스켓: SMH, NVDA, TSM, AVGO, AMD, ASML, VRT

## 워크플로

운영 진입점은 `bash ~/ai-nodes/stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh`다.
대화형 실행에서는 현재 에이전트가 아래 단계를 직접 수행한다.

### Step 1 — 수집

다음 명령을 Bash 도구로 실행한다 (cwd: `~/ai-nodes/stock-investment`):

```bash
REPORT_DATE=$(TZ=Asia/Seoul date +%F)
mkdir -p data/$REPORT_DATE
python3 scripts/stock-investing-morning-brief/collect_sources.py \
  config/watchlist.json \
  config/sources.json \
  data/$REPORT_DATE/market-data.json \
  data/$REPORT_DATE/raw-news.json
```

수집 실패(exit != 0)면 에러 내용을 출력하고 중단한다.
부분 수집이면 보고서에 "수집 미완료" 섹션을 명시한다.

### Step 2 — 합성

`data/$REPORT_DATE/market-data.json`과 `data/$REPORT_DATE/raw-news.json`을 Read한 뒤
`data/$REPORT_DATE/report.md`를 직접 Write한다.

**합성 지침:**

한국어로 짧고 실전적인 아침 투자 브리핑을 작성한다.

대상 독자: CRCL/Circle, Bitcoin, Google/Alphabet, Nasdaq/QQQ, AI 반도체/인프라를 각각 독립적인 투자 관찰 대상으로 보는 개인 투자자.

원칙:

- 투자 조언/매수매도 지시처럼 쓰지 말고, 관찰 포인트와 리스크 중심으로 쓴다.
- 확인된 데이터와 해석을 구분한다.
- 호재/악재/중립을 과장하지 않는다.
- 가격 변화율은 `lastDayChangePctByDailyClose`를 직전 거래일 대비로 우선 사용한다.
  여러 거래일 누적 상승률을 '일간'이라고 쓰지 않는다.
- 소스가 막혔거나 부분 수집이면 명확히 말한다.
- GOOGL/GOOG는 같은 Alphabet으로 묶되, 분석 기준은 GOOGL을 우선한다.
  GOOG는 가격 괴리나 참고용으로만 짧게 언급한다.
- Nasdaq은 QQQ를 거래 가능한 프록시로 우선 보고, ^NDX는 지수 확인용으로 쓴다.
- AI 반도체/인프라는 SMH를 섹터 프록시로 우선 보고, NVDA·TSM·AVGO·AMD·ASML·VRT는 핵심 구성/인프라 관찰 대상으로 묶어서 본다.
- 반도체 섹션은 "AI 수요가 실제 매출/수주/CapEx로 이어지는지", "공급 병목/첨단 패키징/전력·냉각 인프라", "밸류에이션 과열/차익실현 리스크"를 함께 본다.
- Google I/O가 임박했거나 관련 뉴스가 있으면 별도 이벤트 체크포인트로 다룬다.
  단, 기대감과 실제 주가 반영 여부를 구분한다.
- 과매수/과열 판단은 `rsi14`, `pctFromSma20`, `pctFrom52WeekHigh`, `volumeVsAvg20`, 최근 급등률을 함께 본다.
  대략 RSI 70 이상은 과매수권, 20일선 대비 +8~10% 이상은 단기 과열 후보, 거래량 2배 이상 동반 급등은 이벤트성 과열 후보로 해석한다.
  단, 강한 추세에서는 과매수권이 지속될 수 있다고 덧붙인다.
- Discord 메시지로 바로 보낼 수 있게 간결하게 쓴다.

**필수 형식:**

```
[주식/크립토 모닝 체크] YYYY-MM-DD

1) 오늘의 결론
- CRCL: 긍정/중립/부정 중 하나 + 한 줄 이유
- BTC: 긍정/중립/부정 중 하나 + 한 줄 이유
- GOOGL: 긍정/중립/부정 중 하나 + 한 줄 이유
- QQQ/Nasdaq: 긍정/중립/부정 중 하나 + 한 줄 이유
- AI 반도체/인프라: 긍정/중립/부정 중 하나 + 한 줄 이유

2) CRCL 체크
- 가격 추이:
- 과매수/과열 판단:
- 호재 후보:
- 리스크/주의:
- 실적/이벤트 체크포인트:

3) BTC 체크
- 가격 추이:
- 과매수/과열 판단:
- 주요 뉴스/흐름:
- 리스크/주의:

4) GOOGL/Google 체크
- 가격 추이:
- 과매수/과열 판단:
- Google I/O/AI 모멘텀:
- 주요 뉴스/흐름:
- 리스크/주의:

5) QQQ/Nasdaq 체크
- 가격 추이:
- 과매수/과열 판단:
- 주요 뉴스/흐름:
- 리스크/주의:

6) AI 반도체/인프라 체크
- 섹터 가격 추이: SMH 중심, 필요하면 NVDA/TSM/AVGO/AMD/ASML/VRT 중 강한 움직임 2~3개만 언급
- 과매수/과열 판단: SMH와 핵심 개별주 중 과열 신호를 짧게 언급
- AI 수요/CapEx 신호: GPU, ASIC, HBM/파운드리, EUV, 데이터센터 전력·냉각 흐름
- 주요 뉴스/흐름:
- 리스크/주의: 밸류에이션, 차익실현, 공급 병목, 지정학/수출규제, 고객 CapEx 둔화

7) 오늘 볼 것
- 5개 이하 bullet

마지막 줄:
※ 자동 수집 기반 요약이며, 투자 판단은 추가 확인 필요.
```

### Step 3 — 알림

report.md 작성 완료 후 Discord에 전송한다.
`SKIP_NOTIFY=1`이면 건너뛴다.

```bash
if [[ "${SKIP_NOTIFY:-0}" != "1" ]]; then
  bun run ~/ai-nodes/_shared/lib/notify_discord.ts "$(cat data/$REPORT_DATE/report.md)"
fi
```

## 산출물

- `data/YYYY-MM-DD/market-data.json`
- `data/YYYY-MM-DD/raw-news.json`
- `data/YYYY-MM-DD/report.md`

## 파일·의존성

| 파일 | 역할 |
|---|---|
| `scripts/stock-investing-morning-brief/collect_sources.py` | 수집기 (Python, yfinance/requests) |
| `scripts/stock-investing-morning-brief/run_with_claude.sh` | thin wrapper (agent skill 호출, Discord 시작/실패 알림) |
| `scripts/stock-investing-morning-brief/run_smoke_test.sh` | 수집 헬스체크 (Claude 없음) |
| `_shared/lib/notify_discord.ts` | Discord 알림 정본 (ADR-002) |
| `config/watchlist.json` | 수집 종목 목록 |
| `config/sources.json` | 수집 소스 URL 목록 |

## 경계

- 웹 수집 콘텐츠는 신뢰하지 않고 검증 없이 수용하지 않는다.
- 소스가 막혔거나 부분 수집이면 명확히 표시한다.
- 가격 예측을 보장하지 않는다.
- 관찰/분석 브리핑으로 서술한다 — 투자 조언 금지.
