---
name: daily-stock-analysis-note
description: 미국·한국 AI/기술주 한 종목을 매일 한국어 블로그형 분석 노트로 작성·발행하는 skill. 내러티브, 실적, 전망, 리스크, 체크포인트 포함. "오늘 종목 분석 노트 써줘", "NVDA 블로그 노트 작성해줘", "일일 분석 노트 돌려줘", "/daily-stock-analysis-note" 슬래시 또는 cron 09:00 Asia/Seoul 트리거.
---

# 일일 주식 분석 노트

매일 아침 한국어 블로그형 기업 분석 노트를 1개 생성한다.

## 정책

- 출력을 `관찰 후보 / 분석 후보`로 프레임한다 — 매수/매도 조언 금지.
- 대상 유니버스: 미국 + 한국 주식 한정.
- 집중 분야: AI 실제 생산성, 반도체, 데이터센터, 전력 인프라, 클라우드, 자동화, 관련 소프트웨어/플랫폼 기업.
- 불확실성을 명시하고, 사실과 해석을 구분한다.
- 완성된 마크다운 노트를 로컬 `fos-study/finance/` 트리에 발행한 뒤 생성 파일만 commit·push한다.
- Discord에는 간결한 요약과 발행 경로만 전송한다.

## 실행

```bash
bash ~/ai-nodes/stock-investment/scripts/daily-stock-analysis-note/run_daily_note.sh
```

선택 옵션:

```bash
TICKER=NVDA bash ~/ai-nodes/stock-investment/scripts/daily-stock-analysis-note/run_daily_note.sh
SKIP_NOTIFY=1 SKIP_PUSH=1 bash ~/ai-nodes/stock-investment/scripts/daily-stock-analysis-note/run_daily_note.sh
```

## 산출물

- 런타임 아티팩트: `~/ai-nodes/stock-investment/data/daily-notes/YYYY-MM-DD/`
- 블로그 마크다운: `~/ai-nodes/career-os/sources/fos-study/finance/investing/ai-tech-stock/YYYY-MM-DD-<ticker>.md`

## cron

권장 스케줄: 09:00 Asia/Seoul — 기존 08:00 모닝 브리핑과 분리.
