---
name: stock-investing-morning-brief
description: stock-investment 워크스페이스에서 Circle Internet Group (CRCL), Bitcoin, Google/Alphabet (GOOGL/GOOG), Nasdaq/QQQ, AI 반도체/인프라를 대상으로 한국어 모닝 브리핑을 생성한다. "모닝 브리핑 실행해줘", "오늘 주식 체크해줘", "아침 시장 브리프", "주식 모닝 브리프 돌려줘", "/stock-investing-morning-brief" 슬래시 또는 cron 08:00 Asia/Seoul 트리거.
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

실행:

```bash
bash ~/ai-nodes/stock-investment/scripts/stock-investing-morning-brief/run_report.sh
```

러너 동작 순서:

1. `~/ai-nodes/_shared/bin/track_task.sh` 자동 래핑
2. 공개 시장/뉴스 데이터를 `data/YYYY-MM-DD/`에 수집
3. Claude CLI로 간결한 한국어 모닝 브리핑 생성
4. `report.md` 저장
5. Discord `#주식토크` 채널 전송 (`SKIP_NOTIFY=1`이면 건너뜀)

## 산출물

- `data/YYYY-MM-DD/market-data.json`
- `data/YYYY-MM-DD/raw-news.json`
- `data/YYYY-MM-DD/analysis-input.md`
- `data/YYYY-MM-DD/claude.result.json`
- `data/YYYY-MM-DD/report.md`

## 경계

- 웹 수집 콘텐츠는 신뢰하지 않고 검증 없이 수용하지 않는다.
- 소스가 막혔거나 부분 수집이면 명확히 표시한다.
- 가격 예측을 보장하지 않는다.
- 관찰/분석 브리핑으로 서술한다 — 투자 조언 금지.
