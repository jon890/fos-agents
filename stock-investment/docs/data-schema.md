# Data Schema — stock-investment

이 문서는 현재 config와 산출물 스키마를 설명한다.
비밀값은 `.env`나 실행 환경의 secret 저장소에 둔다.

## config

| 파일 | 책임 |
|---|---|
| `config/watchlist.json` | 기본 감시 종목과 프로필 |
| `config/sources.json` | 뉴스·가격 수집 소스 |
| `config/current-issues.json` | 현안 분석 큐와 기본 issue |
| `config/daily-stock-universe.json` | 일일 종목 분석 후보 풀 |
| `config/catalysts.json` | 관심 이벤트와 촉매 |
| `config/theme-reports.json` | core 섹션과 테마별 분석 정책 |
| `config/youtube-learning-channels.json` | 학습 영상 후보 소스 |

## data

| 경로 | 생성자 | 내용 |
|---|---|---|
| `data/YYYY-MM-DD/market-data.json` | `collect_sources.py` | 가격 데이터 |
| `data/YYYY-MM-DD/raw-news.json` | `collect_sources.py` | 뉴스 수집 결과 |
| `data/YYYY-MM-DD/report.md` | `stock-investing-morning-brief` | 아침 브리핑 |
| `data/issues/YYYY-MM-DD/<issue-key>/raw-sources.json` | `collect_issue_sources.py` | 현안 소스 수집 결과 |
| `data/issues/YYYY-MM-DD/<issue-key>/report.md` | `current-issue-analysis` | 현안 분석 리포트 |
| `data/daily-notes/YYYY-MM-DD/selected.json` | `collect_daily_note_inputs.py` | 선택 종목과 근거 |
| `data/daily-notes/YYYY-MM-DD/raw-inputs.json` | `collect_daily_note_inputs.py` | 선택 종목 raw input |
| `data/daily-notes/YYYY-MM-DD/report.md` | `daily-stock-analysis-note` | 일일 종목 분석 |
| `data/daily-notes/history.json` | `daily-stock-analysis-note` | 종목 선택 이력 |
| `data/publish/*.md` | `daily-stock-analysis-note` | 외부 발행 전 초안 |
| `data/thesis-tracker/<ticker-slug>.json` | 수동 또는 후속 자동화 | 종목별 투자 가설 |

## `.env`

`.env.example`은 템플릿이다.
실제 값은 커밋하지 않는다.

허용되는 값의 예:

- 외부 API token
- 로컬 실행 옵션
- 실행 환경별 override

금지:

- 토큰 값을 문서에 복사
- 계정, 세션, 쿠키를 리포트에 포함
- 다른 워크스페이스의 비밀값 참조
