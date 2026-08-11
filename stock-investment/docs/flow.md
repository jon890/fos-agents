# Flow — stock-investment

이 문서는 현재 실행 흐름을 설명한다.
실행 결과는 로컬 파일, 표준 출력, 종료 코드로 판단한다.

## 공통 흐름

```text
사용자 요청 또는 예약 실행
  -> skill 선택
  -> config 읽기
  -> 수집기 실행
  -> raw JSON 저장
  -> 분석 리포트 작성
  -> 표준 출력으로 요약 반환
```

실패 시에는 부분 산출물과 stderr를 확인한다.
외부 전달은 이 저장소의 책임이 아니다.

## Morning Brief

진입점:

```bash
bash stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh
```

흐름:

1. `config/watchlist.json`과 `config/sources.json`을 읽는다.
2. `collect_sources.py`가 가격과 뉴스 raw JSON을 만든다.
3. skill이 raw JSON을 읽고 `data/YYYY-MM-DD/report.md`를 쓴다.
4. 최종 요약을 표준 출력으로 반환한다.

검증:

```bash
bash stock-investment/scripts/stock-investing-morning-brief/run_smoke_test.sh
```

## Current Issue Analysis

진입점:

```bash
bash stock-investment/scripts/current-issue-analysis/run_with_claude.sh <issue-key>
```

흐름:

1. `<issue-key>`가 없으면 `config/current-issues.json`의 기본 issue를 사용한다.
2. `collect_issue_sources.py`가 해당 issue의 소스를 수집한다.
3. raw JSON은 `data/issues/YYYY-MM-DD/<issue-key>/raw-sources.json`에 저장한다.
4. 분석 리포트는 `data/issues/YYYY-MM-DD/<issue-key>/report.md`에 저장한다.

## Daily Stock Analysis Note

진입점:

```bash
bash stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
TICKER=NVDA bash stock-investment/scripts/daily-stock-analysis-note/run_with_claude.sh
```

흐름:

1. `config/daily-stock-universe.json`에서 후보를 읽는다.
2. `data/daily-notes/history.json`으로 이미 다룬 종목을 보정한다.
3. `collect_daily_note_inputs.py`가 선택 종목과 raw input을 만든다.
4. 리포트는 `data/daily-notes/YYYY-MM-DD/report.md`에 저장한다.
5. 외부 발행 전 초안은 `data/publish/` 아래에 만든다.

외부 저장소 반영은 별도 승인된 발행 단계에서 처리한다.
