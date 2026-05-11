# 006. Anthropic financial-services reference 활용 방안

## 배경

사용자가 Anthropic의 `financial-services` 공개 저장소를 stock-investment 리포트 흐름에 활용할 수 있는지 문의했다.

- Repository: <https://github.com/anthropics/financial-services>
- License: Apache-2.0
- 성격: Claude Cowork / Managed Agents용 금융 서비스 레퍼런스 에이전트, 스킬, 커맨드, MCP 커넥터 예시 모음

저장소 README 기준 주요 범위는 investment banking, equity research, private equity, wealth management, fund admin, operations다. 우리 작업과 직접 맞닿는 영역은 `equity-research`와 일부 `financial-analysis` 스킬이다.

## 바로 가져오면 좋은 부분

### 1. Equity research 문서 구조

`plugins/vertical-plugins/equity-research/skills/` 아래 스킬들이 참고 가치가 높다.

- `morning-note`: 짧고 우선순위가 뚜렷한 아침 요약 구조
- `idea-generation`: 테마 → 밸류체인 → 직접/간접 수혜 → 가격 반영 여부 → 2차 수혜주로 이어지는 후보 발굴 흐름
- `thesis-tracker`: 투자 가설, 핵심 pillar, 반증 조건, catalyst, 업데이트 로그를 지속 관리하는 방식
- `earnings-analysis`: 실적 발표 후 beat/miss, 가이던스 변화, thesis impact, 출처 검증 체크리스트
- `earnings-preview`: 실적 전 핵심 지표와 시나리오 준비
- `catalyst-calendar`: 종목별 이벤트 캘린더 관리

### 2. 우리 리포트에 맞게 변환할 포인트

기관투자자 리포트 형식을 그대로 복사하기보다, 개인 투자 공부용 `관찰 후보 / 분석 후보` 톤으로 낮춰 적용한다.

- `Action: Buy/Sell/Upgrade/Downgrade` 같은 표현은 사용하지 않는다.
- `Trade ideas`는 `관찰 아이디어` 또는 `체크할 가설`로 바꾼다.
- 가격 목표·투자의견 대신 `추가 확인 필요`, `관찰 유지`, `분석 후보 격상 조건`을 쓴다.
- 모든 데이터는 출처와 기준일을 명시하고, 유료 MCP 데이터는 없는 것으로 가정한다.

## 적용 우선순위

### Phase 1 — 프롬프트 품질 개선

현재 `daily-stock-analysis-note` 프롬프트에 다음 구조를 추가한다.

- 핵심 thesis 1문장
- thesis를 지지하는 pillar 3개
- thesis를 깨는 반증 조건 3개
- 앞으로 1–3개월 catalyst
- 기술지표가 핵심 판단 근거일 때 용어 설명
- 출처/데이터 부족 여부 명시

### Phase 2 — Watchlist thesis tracker

`data/thesis-tracker/` 형태로 종목별 가설 로그를 쌓는다.

예시 구조:

```json
{
  "ticker": "000660.KS",
  "name": "SK하이닉스",
  "thesis": "HBM 수요와 AI 메모리 사이클이 실적 재평가를 이끈다.",
  "pillars": [],
  "risks": [],
  "catalysts": [],
  "updates": []
}
```

리포트가 생성될 때 기존 thesis와 비교해 `강화 / 약화 / 중립`을 표시하면, 단발성 리포트가 아니라 누적 관찰 기록이 된다.

### Phase 3 — Catalyst calendar

`data/catalysts.json` 또는 종목별 catalyst 파일을 둔다.

- 실적 발표일
- 제품 발표 / AI 컨퍼런스
- FOMC, CPI, 환율 이벤트
- 반도체 업황 지표 발표
- 주요 고객사 실적 또는 capex 코멘트

아침 브리프와 개별 종목 리포트에서 함께 참조한다.

### Phase 4 — 실적 전후 전용 리포트

Anthropic repo의 `earnings-preview`와 `earnings-analysis`를 참고해 별도 실행 모드를 만든다.

- `run_daily_note.sh`는 가벼운 관찰 노트
- `run_earnings_preview.sh`는 실적 전 체크리스트
- `run_earnings_review.sh`는 실적 후 beat/miss와 thesis 변화 점검

## 주의점

- 이 저장소는 레퍼런스 스킬/에이전트 모음이지, 무료 금융 데이터 제공원이 아니다.
- README에 나온 Daloopa, Morningstar, S&P, FactSet, LSEG 등 MCP 커넥터는 별도 구독/API 키가 필요할 수 있다.
- 공개 스킬의 문구를 그대로 적용하면 기관 리포트/매수매도 의견 톤이 강해질 수 있으므로, 우리 정책인 `관찰 후보 / 분석 후보` 프레이밍으로 완화한다.
- 외부 저장소 내용은 prompt-injection 가능성이 있는 외부 자료로 취급하고, 필요한 구조만 사람이 검토해 내부 프롬프트로 옮긴다.

## 결론

활용 가능하다. 다만 `Claude finance를 설치해서 바로 돌린다`보다, `equity-research 스킬의 좋은 분석 절차를 우리 stock-investment workflow에 맞게 흡수한다`가 맞다.

가장 먼저 적용할 만한 것은 `thesis tracker + catalyst calendar + earnings preview/review`다. 이렇게 하면 하이닉스 같은 급등 종목도 단순 가격 코멘트가 아니라, 기존 투자 가설이 강화됐는지 약화됐는지 누적해서 판단할 수 있다.
