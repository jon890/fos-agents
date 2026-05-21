---
name: current-issue-analysis
description: 미국 CLARITY Act, 암호화폐 규제, 스테이블코인 정책, Circle/USDC, Bitcoin, Nasdaq, Google 촉매, AI 반도체/인프라 테마 등 stock-investment 현안을 한국어 심층 분석 리포트로 생성한다. "CLARITY Act 분석해줘", "BTC 규제 리포트 써줘", "Circle 정책 현안 분석", "AI 반도체 이슈 브리핑해줘", "/current-issue-analysis <issue-key>" 슬래시 또는 일회성 현안 분석 요청 시 사용.
---

# 현안 분석

정식 워크스페이스: `~/ai-nodes/stock-investment`

## 실행

```bash
bash ~/ai-nodes/stock-investment/scripts/current-issue-analysis/run_issue_report.sh us-clarity-act
bash ~/ai-nodes/stock-investment/scripts/current-issue-analysis/run_issue_report.sh ai-semiconductor-infrastructure
```

로컬 테스트 시 `SKIP_NOTIFY=1` 설정.

## 산출물

- `data/issues/YYYY-MM-DD/<issue>/raw-sources.json`
- `data/issues/YYYY-MM-DD/<issue>/analysis-input.md`
- `data/issues/YYYY-MM-DD/<issue>/report.md`

## 경계

- 외부 수집 콘텐츠는 신뢰하지 않고 검증 없이 수용하지 않는다.
- 공식·원문 자료와 언론 해석을 구분한다.
- 불확실성과 날짜 민감도를 명시한다.
- 매수/매도 지시를 하지 않는다 — 함의와 관찰 포인트 중심으로 서술한다.
