---
name: stock-youtube-learning-digest
description: 자산제곱, 월가아재의 과학적 투자 같은 주식 유튜브 채널의 신규 영상을 매일 확인하고, 주식·경제 일반론 학습 가치가 있는 영상만 한국어로 짧게 요약해 Discord에 전달하는 stock-investment skill. 신규/유효 영상이 없으면 아무 메시지도 보내지 않는다.
---

# 주식 유튜브 학습 요약

정식 워크스페이스: `~/ai-nodes/stock-investment`

## 목적

매일 아침 지정한 주식·경제 유튜브 채널의 신규 영상을 확인한다.
단순 뉴스나 단기 매매 유도 영상은 제외하고, 개인 학습에 도움이 되는 투자 일반론·경제 구조·위험관리·의사결정 프레임워크 중심 영상만 요약한다.

## 운영 원칙

- 투자 조언, 매수·매도 지시, 가격 예측으로 쓰지 않는다.
- 확인 가능한 YouTube RSS와 자막만 사용한다.
- 자막이 없거나 너무 짧으면 내용을 추측하지 않고 제외한다.
- 신규 영상이 없거나 학습 가치가 낮으면 **stdout을 비워** Discord 알림과 토큰 비용을 아낀다.
- 메시지는 한국어, 짧은 요약, 배울 점, 주의점, 링크 중심으로 쓴다.

## 대상 채널

정의 파일: `config/youtube-learning-channels.json`

현재 기본값:

- 자산제곱 — `UCpTC-SMFjA3EDRhZIKOcKuQ`
- 월가아재의 과학적 투자 — `UCpqD9_OJNtF6suPpi6mOQCQ`

## 학습 가치 판단 기준

포함 우선:

- 투자 원칙과 행동경제학
- 위험관리와 포트폴리오 관리
- 자산배분과 장기 투자 관점
- 금리, 환율, 물가, 유동성 등 거시경제 구조
- 시장 사이클과 밸류에이션 해석
- 투자 의사결정 과정과 검증 프레임워크

낮은 우선순위 또는 제외:

- 특정 종목 단기 매수·매도 유도
- 선정적 공포·탐욕 자극 중심
- 단순 뉴스 낭독
- 근거 없는 가격 예측
- 정치 이슈만 있고 투자 일반론으로 연결되지 않는 내용
- 자막이 없어서 내용을 확인할 수 없는 영상

추가 품질 기준:

- “오늘 뭘 살까”보다 “어떤 기준으로 판단할까”를 우선한다.
- 사건 해설형 영상도 금리·환율·유동성·포트폴리오 대응 원칙으로 연결되면 포함할 수 있다.
- 같은 채널의 반복 주제는 핵심 배울 점이 새로울 때만 유효한 것으로 본다.

## 실행

```bash
cd ~/ai-nodes/stock-investment
python3 scripts/youtube-learning-digest/run_digest.py
```

검증용으로 이미 본 영상도 다시 처리하려면:

```bash
python3 scripts/youtube-learning-digest/run_digest.py --ignore-seen --lookback-hours 96
```

## 산출물

- `data/youtube-learning-digest/seen-videos.json` — 처리 이력
- `data/youtube-learning-digest/YYYY-MM-DD.md` — 메시지로 보낸 요약
- `data/youtube-learning-digest/YYYY-MM-DD-run.json` — 처리 메타데이터

## Cron 권장값

Hermes cron은 “후보 감지 스크립트 + 후보가 있을 때만 LLM 요약” 구조로 둔다.

- schedule: `20 8 * * *`
- deliver: `discord:1500817157515247706` (#주식토크)
- no_agent: `false`
- script: `stock_youtube_learning_digest.sh`
- workdir: `~/ai-nodes/stock-investment`
- enabled_toolsets: `file`

스크립트는 신규/유효 후보가 없으면 stdout을 비운다. 후보가 있으면 자막과 메타데이터를 JSON으로 출력하고, 그때만 cron agent가 고품질 한국어 요약을 작성해 Discord로 보낸다.

주의: Hermes cron 구현상 빈 stdout에서도 agent prompt 자체가 호출될 수 있으므로, 프롬프트는 빈 입력이면 빈 final을 반환하도록 되어 있다. 실제 요약 작성과 전달은 후보가 있을 때만 수행한다.

## 출력 형식

```markdown
## 오늘의 주식·경제 학습 영상

기준시각: YYYY-MM-DD HH:MM KST

### 채널명 — 영상 제목
링크: https://www.youtube.com/watch?v=...
업로드: YYYY-MM-DD HH:MM KST / 길이: MM:SS
학습 가치: 높음|보통
주제: 행동경제학/투자심리, 위험관리/포트폴리오

핵심 요약:
- ...

배울 점:
- ...

주의:
- ...

※ 자동 자막 기반 요약입니다. 투자 조언이 아니라 주식·경제 일반론 학습용 메모로만 봐주세요.
```

## 문제 해결

- `uv`가 없으면 자막 추출이 실패한다. 현재 환경에서는 `uv run --with youtube-transcript-api ...` 방식이 동작 확인됐다.
- YouTube 자막 API가 일시적으로 막히면 해당 영상은 건너뛰고 다음 날 새 영상만 다시 확인한다.
- 요약 품질이 부족하면 script-only cron 대신 “신규 후보 감지 no-agent job → 후보 있을 때 agent 요약 job” 2단계로 확장한다.
