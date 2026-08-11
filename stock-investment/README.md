# stock-investment

주식, 암호화폐, AI 인프라 시장을 매일 관찰하고 한국어 분석 노트를 만드는 워크스페이스다.
거래 자동화가 아니라 개인 학습과 의사결정 보조용 기록을 만든다.

## 범위

- 관심 종목과 테마의 아침 브리핑
- 주요 이슈별 심층 분석
- 하루 1개 종목 분석 노트와 블로그 초안 준비
- 투자 가설과 종목 선택 이력 누적

하지 않는 일:

- 매수·매도 주문
- 투자 자문처럼 단정하는 표현
- 다른 워크스페이스나 외부 저장소 직접 발행
- 비밀값이나 계정 정보를 문서에 기록

## 구조

| 경로 | 용도 |
|---|---|
| `config/` | watchlist, 뉴스 소스, 현안 큐, 종목 후보 |
| `scripts/` | 수집기와 thin wrapper |
| `.claude/skills/` | agent skill 정본 |
| `.codex/skills/` | Codex 노출용 skill 링크 |
| `data/` | 실행 산출물 |
| `data/publish/` | 외부 발행 전 초안 |
| `docs/` | 현재 구조, 흐름, 스키마, 결정 이력 |

## 설정

```bash
cp stock-investment/.env.example stock-investment/.env
```

필요한 비밀값은 `.env`나 실행 환경의 secret 저장소에 둔다.
문서와 로그에는 값을 쓰지 않는다.

Python 수집기는 `python3`와 필요한 패키지를 사용한다.
YouTube 학습 요약은 필요 시 `uv`로 임시 의존성을 실행한다.

## 실행

```bash
# 아침 브리핑
bash stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh

# 특정 현안 분석
bash stock-investment/scripts/current-issue-analysis/run_with_claude.sh us-clarity-act

# 일일 종목 분석
bash stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh

# 종목 수동 지정
TICKER=NVDA bash stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
```

agent skill을 직접 호출할 수 있는 환경에서는 아래 이름을 사용한다.

- `/stock-investing-morning-brief`
- `/current-issue-analysis <issue-key>`
- `/daily-stock-analysis-note`
- `/stock-youtube-learning-digest`

## 검증

```bash
# 수집기 smoke
bash stock-investment/scripts/stock-investing-morning-brief/run_smoke_test.sh

# 셸 문법
bash -n stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh
bash -n stock-investment/scripts/current-issue-analysis/run_with_claude.sh
bash -n stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
```

문서 구조와 산출물 계약은 `stock-investment/docs/code-architecture.md`, `stock-investment/docs/data-schema.md`, `stock-investment/docs/flow.md`를 확인한다.
