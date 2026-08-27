# stock-investment 코드 아키텍처

이 문서는 현재 디렉터리 구조와 실행 책임을 설명한다.
결정의 이유는 `docs/adr/INDEX.md`를 따른다.

## 디렉터리

```text
stock-investment/
├── AGENTS.md
├── README.md
├── TOOLS.md
├── .env.example
├── config/
├── data/
├── docs/
├── logs/
├── scripts/
│   ├── current-issue-analysis/
│   ├── daily-stock-analysis-note/
│   ├── stock-investing-morning-brief/
│   └── youtube-learning-digest/
├── .claude/skills/
└── .codex/skills/
```

| 경로 | 책임 |
|---|---|
| `config/` | 사람이 관리하는 종목, 테마, 소스, 현안 큐 |
| `scripts/<skill>/` | 수집기와 결정적 후처리 스크립트 |
| `.claude/skills/<skill>/` | skill 설명과 reference |
| `.codex/skills/<skill>/` | Codex에서 사용할 skill 링크 |
| `data/` | 날짜별 실행 산출물 |
| `data/publish/` | 외부 발행 전 초안 |
| `logs/` | 필요한 경우 실행 로그 |
| `docs/` | 현재 구조, 흐름, 스키마, 결정 |

## Skill과 스크립트

| skill | scripts 경로 | 책임 |
|---|---|---|
| `stock-investing-morning-brief` | `scripts/stock-investing-morning-brief/` | 가격·뉴스 수집과 아침 브리핑 생성 |
| `current-issue-analysis` | `scripts/current-issue-analysis/` | 현안별 소스 수집과 분석 보고서 생성 |
| `daily-stock-analysis-note` | `scripts/daily-stock-analysis-note/` | 일일 종목 선택, 분석, 발행 초안 준비 |
| `stock-youtube-learning-digest` | `scripts/youtube-learning-digest/` | 투자 학습 영상 후보 요약 |

스킬은 수집기를 호출하고 로컬 파일과 종료 코드로 결과를 검증한다.
외부 전달 채널과 자동 실행 시점은 저장소 밖에서 정한다.

## 외부 의존

| 의존 | 용도 |
|---|---|
| `python3` | 가격, 뉴스, 현안 소스 수집 |
| `uv` | YouTube 자막 수집 의존성 임시 실행 |
| agent runtime | `.claude/skills` 또는 `.codex/skills` 실행 |

## 변경 기준

- 새 config 파일은 `docs/data-schema.md`에 스키마를 추가한다.
- 새 skill은 `scripts/<name>/`, `.claude/skills/<name>/`, `.codex/skills/<name>/` 관계를 맞춘다.
- 외부 저장소에 직접 쓰는 기능은 이 워크스페이스에 넣지 않는다.
