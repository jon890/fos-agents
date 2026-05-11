# 007. financial-services 레퍼런스 적용 계획

## 목표

Anthropic `financial-services` 레퍼런스에서 유용한 equity research 흐름을 가져오되, 우리 stock-investment의 원칙은 유지한다.

- 매수/매도 추천이 아니라 `관찰 후보 / 분석 후보` 중심
- 개인 투자 공부용 블로그 톤
- fos-study Markdown 규칙 준수
- 유료 금융 데이터 MCP 없이도 동작하는 로컬/공개 데이터 기반 흐름 우선
- Discord에는 짧은 요약, 전체 문서는 fos-study에 발행

## 적용 우선순위

### 1단계 — Daily note 프롬프트 강화

가장 먼저 적용한다. 구현 난이도가 낮고 바로 품질 개선이 보인다.

추가할 구조:

- **핵심 thesis**: 이 종목을 왜 지금 보는지 한 문장
- **지지 근거**: thesis를 뒷받침하는 핵심 pillar 3개
- **반증 조건**: 이 thesis가 틀렸다고 볼 조건 3개
- **1–3개월 catalyst**: 실적, 제품, 매크로, 업황 지표 등
- **지표 설명**: RSI, 이동평균, 괴리율, PER, PBR 등 핵심 지표 첫 등장 시 짧은 설명
- **분류 기준**: 관찰 후보 / 분석 후보 / 보류 이유를 더 명확히 표현

참고한 Anthropic 스킬:

- `idea-generation`: 테마 기반 후보 발굴과 value chain 사고
- `thesis-tracker`: thesis, pillar, risk, catalyst 구조
- `morning-note`: 핵심 메시지를 먼저 쓰는 구조

### 2단계 — 종목별 thesis tracker 추가

단발 리포트에서 누적 관찰 체계로 확장한다.

예상 위치:

- `data/thesis-tracker/<ticker-slug>.json`

예상 필드:

```json
{
  "ticker": "000660.KS",
  "name": "SK하이닉스",
  "currentThesis": "HBM 수요와 AI 메모리 사이클이 실적 재평가를 이끈다.",
  "pillars": [],
  "risks": [],
  "catalysts": [],
  "updates": [
    {
      "date": "2026-05-11",
      "event": "주가 급등 및 과열 신호 점검",
      "impact": "strengthen | weaken | neutral",
      "notes": ""
    }
  ]
}
```

Daily note 생성 시:

- 기존 thesis가 있으면 불러온다.
- 새 데이터가 thesis를 강화/약화/중립 중 어디로 움직이는지 표시한다.
- 문서에는 `## Thesis 업데이트` 섹션을 선택적으로 추가한다.

### 3단계 — catalyst calendar 추가

종목별/테마별 앞으로 볼 이벤트를 구조화한다.

예상 위치:

- `data/catalysts.json`

예상 이벤트:

- 실적 발표일
- HBM4 양산/고객사 채택 뉴스
- NVIDIA, AMD, Google, Amazon 등 주요 고객사 capex 코멘트
- DRAM/NAND 가격 지표
- CPI/FOMC/환율 등 반도체 밸류에이션에 영향을 주는 매크로 이벤트

Daily note와 morning brief에서 함께 참조한다.

### 4단계 — earnings preview/review 모드 추가

실적 시즌 전후에는 일반 daily note보다 별도 형식이 낫다.

예상 스크립트:

- `run_earnings_preview.sh <ticker>`
- `run_earnings_review.sh <ticker>`

Preview 구성:

- 이번 실적에서 확인할 핵심 지표
- 시장이 이미 기대하는 부분
- beat/miss보다 중요한 질적 포인트
- 발표 후 thesis가 바뀔 조건

Review 구성:

- 실제 실적 vs 기대
- 가이던스 변화
- 핵심 thesis 강화/약화 여부
- 다음 catalyst

참고한 Anthropic 스킬:

- `earnings-preview`
- `earnings-analysis`

## 논의 필요한 부분

### A. Thesis tracker를 어디까지 구조화할지

선택지:

1. **가벼운 JSON 로그**
   - 장점: 구현 빠름, 자동화 쉬움
   - 단점: 사람이 읽기엔 덜 편함

2. **JSON + markdown 요약 병행**
   - 장점: 자동화와 사람이 읽는 기록 둘 다 가능
   - 단점: 파일이 늘고 관리 복잡도 증가

추천: 처음은 JSON만. 실제로 쓸 만하면 markdown 요약을 추가한다.

### B. Catalyst calendar를 수동 관리할지, 자동 수집할지

선택지:

1. **수동/반자동 관리**
   - 중요 이벤트만 우리가 직접 넣음
   - 데이터 품질이 좋고 노이즈 적음

2. **자동 수집 시도**
   - 실적 캘린더/뉴스를 자동으로 긁음
   - 누락·오탐·출처 이슈가 생길 수 있음

추천: 처음은 수동/반자동. 자동 수집은 나중에 붙인다.

### C. 리포트 섹션을 얼마나 늘릴지

현재 daily note도 이미 꽤 길다. thesis/pillar/반증조건을 추가하면 더 길어질 수 있다.

선택지:

1. **전체 문서는 길어져도 괜찮고, Discord 요약만 짧게**
2. **본문도 너무 길지 않게 핵심 섹션만 추가**

추천: daily note는 너무 장문이 되지 않게 `핵심 thesis / 반증 조건 / catalyst`만 추가하고, earnings review는 길게 쓴다.

## 추천 실행 순서

1. `daily-stock-analysis-note` 프롬프트에 thesis/pillar/반증조건/catalyst 구조 추가
2. SK하이닉스 문서에 새 구조를 시범 적용
3. `data/thesis-tracker/000660-ks.json` 초안 생성
4. 다음 리포트부터 thesis tracker를 읽고 업데이트하도록 runner 보강
5. catalyst calendar는 `config/catalysts.json`에 하이닉스/삼성전자/NVIDIA/GOOGL/QQQ 정도 핵심 종목부터 수동 초안 작성
6. earnings preview/review는 다음 실적 이벤트가 가까운 종목부터 별도 모드로 구현

## 당장 할 수 있는 첫 작업

사용자 확인 후 바로 진행할 만한 작업:

- Daily note 프롬프트에 `핵심 thesis / 지지 근거 / 반증 조건 / catalyst` 필수 구조 추가
- 하이닉스 리포트에 해당 구조를 보강해서 재발행
- 하이닉스 thesis tracker JSON 초안 생성

이 세 가지가 가장 작고 안전한 첫 단위다.
