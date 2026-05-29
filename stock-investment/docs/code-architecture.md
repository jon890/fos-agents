# Code Architecture — stock-investment

stock-investment 워크스페이스의 **디렉터리 구조·skill 배치·외부 의존성** 단일 출처.
코드 구조 변경 또는 새 skill 추가 시 이 문서가 기준.

## 1. 디렉터리 트리 (ADR-006 분리 패턴 + ADR-003 native 전환 적용)

```
stock-investment/
├── AGENTS.md                         # 워크스페이스 가이드 (plan001 한글화)
├── CLAUDE.md → AGENTS.md             # Claude Code 자동 로드 심링크 (plan001)
├── TOOLS.md                          # 수집 도구 참고 문서
├── .env                              # 비밀 정보 (DISCORD_CHANNEL_ID 등, gitignore)
├── .env.example                      # template
│
├── config/                           # 읽기 전용 설정 JSON (6개)
│   ├── catalysts.json                # 종목별 이벤트 catalyst
│   ├── current-issues.json           # 현안 분석 토픽 큐
│   ├── daily-stock-universe.json     # daily-note 후보 종목 풀
│   ├── sources.json                  # morning-brief 뉴스·가격 소스
│   ├── theme-reports.json            # Core + Theme 구조 메타데이터
│   └── watchlist.json                # 종목 감시 프로필
│
├── data/                             # 실행 산출물 (런타임, git 미추적)
│   ├── YYYY-MM-DD/                   # morning-brief 일자별 산출물
│   ├── issues/YYYY-MM-DD/<issue>/    # current-issue-analysis 산출물
│   ├── daily-notes/
│   │   ├── YYYY-MM-DD/               # daily-stock-analysis-note 런타임 산출물
│   │   └── history.json              # 종목 선택 이력 (rotation 패널티)
│   ├── thesis-tracker/               # 종목별 투자 가설 누적 로그 (JSON)
│   └── audit/                        # workspace-audit 결과
│
├── docs/                             # 결정·정책 문서
│   ├── prd.md                        # 제품 범위·기능 명세
│   ├── data-schema.md                # config·data·logs·.env 스키마
│   ├── flow.md                       # 실행 흐름
│   ├── code-architecture.md          # 본 문서
│   └── adr.md                        # ADR 누적
│   # docs/decisions/ — plan004에서 git rm 완료
│
├── logs/                             # 실행 메타데이터
│   └── .gitkeep
│
├── scripts/                          # 실행 스크립트 (ADR-006 분리, plan002)
│   ├── stock-investing-morning-brief/
│   │   ├── run_with_claude.sh        # 운영 진입점: native skill 직접 호출 (ADR-003)
│   │   └── collect_sources.py        # Python 수집기 (유지)
│   ├── current-issue-analysis/
│   │   ├── run_with_claude.sh        # 운영 진입점: native skill 직접 호출 (ADR-003)
│   │   └── collect_issue_sources.py  # Python 수집기 (유지)
│   └── daily-stock-analysis-note/
│       ├── run_with_claude.sh        # 운영 진입점: native skill 직접 호출 (ADR-003)
│       ├── collect_daily_note_inputs.py  # Python 수집기 (유지)
│       └── sanitize_fos_study_markdown.py  # fos-study 발행 정규화 (유지)
│
├── .claude/skills/                   # Claude Code 컨텍스트 자산 (ADR-006 분리, plan002)
│   ├── stock-investing-morning-brief/
│   │   ├── SKILL.md
│   │   └── references/claude-prompt.md
│   ├── current-issue-analysis/
│   │   ├── SKILL.md
│   │   └── references/
│   └── daily-stock-analysis-note/
│       ├── SKILL.md
│       └── references/blog-note-prompt.md
│
└── tasks/                            # plan 사이클 영구 영역
    ├── plan001-workspace-standard-bootstrap/
    └── plan002-skills-folder-retirement/
```

## 2. skill 배치 패턴 (ADR-006 분리, plan002 적용 완료)

```
scripts/<name>/               # 실행 스크립트 (thin wrapper + Python 수집기)
.claude/skills/<name>/
├── SKILL.md                  # skill 설명 + frontmatter (Claude Code 자동 로드)
└── references/               # 프롬프트, 참고 자료
```

ai-nodes ADR-006 분리 표준 적용.
runner는 `scripts/<name>/`에, SKILL.md / references/는 `.claude/skills/<name>/`에 위치.

native skill 진입점:

```bash
claude -p "/stock-investing-morning-brief"
claude -p "/current-issue-analysis <issue-key>"
claude -p "/daily-stock-analysis-note"
```

## 3. 계층 책임

| 계층 | 책임 | 수정 시 영향 |
|---|---|---|
| `config/` | 종목·소스·테마·프로필 정의 | runner가 읽기 전용 참조 — config 변경으로 동작 변경 |
| `scripts/<name>/run_with_claude.sh` | thin wrapper:<br>Discord 시작/실패 알림<br>claude -p 직접 호출 (ADR-003) | 진입점 변경 + 알림 흐름 |
| `scripts/<name>/collect_*.py` | Python 수집기:<br>가격·뉴스 수집 (yfinance, requests)<br>수집 산출물 JSON 생성 | 수집 데이터 구조·소스 |
| `.claude/skills/<name>/SKILL.md + references/` | skill 설명 (frontmatter) + 프롬프트 | Claude Code 자동 로드 + 응답 품질 |
| `data/` | 런타임 산출물 (git 미추적) | 실행 결과 — 코드에 영향 없음 |
| `_shared/lib/notify_discord.ts` | Discord 알림 정본 (ADR-002) | 모든 skill 알림 |

## 4. 외부 의존성

| 의존 | 역할 | 비고 |
|---|---|---|
| `_shared/bin/track_task.sh` | (미사용) self-wrap + logs 기록 | ADR-003으로 미사용.<br>후속 모노레포 plan 폐기 예정 |
| `_shared/lib/extract_claude_result.ts` | (미사용) Claude JSON envelope 파싱 | ADR-003으로 미사용.<br>후속 모노레포 plan 폐기 예정 |
| `_shared/lib/notify_discord.ts` | Discord 알림 (openclaw 경유, 10s 타임아웃) | ADR-002 도입.<br>`DISCORD_CHANNEL_ID` 필수 |
| `claude` CLI | native skill 직접 호출 | `claude -p "/<skill>"` |
| `python3` | 수집기 스크립트 (collect_*.py) | yfinance, requests 등 |
| `bun` | notify_discord.ts 실행 | root `package.json` + `bun install` 1회 |
| `career-os/sources/fos-study` | daily-stock-analysis-note 발행 대상 | cross-workspace 단방향 쓰기 (발행 목적 예외) |
| Discord | `#주식토크` 채널 알림 | `DISCORD_CHANNEL_ID` 필요 |

## 5. 비용·실행 규율

- 광범위 풀-리포 분석 금지 — 비용 급증 방지.
- 수집 실패 시 raw 파일 보존 — 재수집 없이 수집 결과 보존.
- daily-stock-analysis-note: `data/daily-notes/history.json` rotation으로 동일 종목 반복 분석 방지.

## 6. 결정 문서 경로

- 워크스페이스 ADR: `docs/adr.md`
- 모노레포 ADR: `../docs/adr.md` (ai-nodes/docs/adr.md)
- 분리 패턴 표준: 모노레포 ADR-006
- 5문서 책임 영역 청사진: `../docs/workspace-structure.md` 2번·6번
