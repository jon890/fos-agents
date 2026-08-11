# Code Architecture — fos-agents 모노레포

이 문서는 fos-agents 루트의 현행 코드와 문서 구조를 설명한다.
결정의 이유와 대안 기각은 [`docs/adr/INDEX.md`](adr/INDEX.md)를 따른다.

## 모노레포 구조

`fos-agents`는 여러 독립 워크스페이스를 담는 컨테이너다.
각 최상위 워크스페이스는 자체 `AGENTS.md`와 책임 문서를 가진다.
워크스페이스 자산은 서로 교차 참조하지 않는다.

| 워크스페이스 | 가이드 | 책임 |
|---|---|---|
| `apartment/` | [`apartment/AGENTS.md`](../apartment/AGENTS.md) | 아파트 시세와 인테리어 리포트 |
| `career-os/` | [`career-os/AGENTS.md`](../career-os/AGENTS.md) | 커리어, 면접, 지원 준비 |
| `stock-investment/` | [`stock-investment/AGENTS.md`](../stock-investment/AGENTS.md) | 주식과 이슈 모니터링 |
| `travel/` | [`travel/AGENTS.md`](../travel/AGENTS.md) | 여행별 일정과 결정 로그 |
| `health-care/` | [`health-care/AGENTS.md`](../health-care/AGENTS.md) | 무릎 재활 체크인 |
| `ji-yoon-blog/` | [`ji-yoon-blog/AGENTS.md`](../ji-yoon-blog/AGENTS.md) | 지융로그 콘텐츠 운영 |
| `side-projects/` | [`side-projects/AGENTS.md`](../side-projects/AGENTS.md) | 개인 사이드 프로젝트와 외주 기회 운영 |

## 루트 디렉터리

루트에는 워크스페이스 공통 자산만 둔다.

| 경로 | 책임 |
|---|---|
| `AGENTS.md` | 모든 에이전트를 위한 공통 행동 규칙 |
| `CLAUDE.md` | `AGENTS.md` 심볼릭 링크 |
| `.agents/skills/` | Codex가 직접 탐색하는 저장소 전역 skill |
| `.claude/skills/` | 루트에서 쓰는 agent skill과 공용 참조 |
| `.claude/agents/` | repo-local agent 정의 |
| `docs/adr/` | 모노레포 레벨 ADR |
| `docs/code-architecture.md` | 현재 구조와 책임 경계 |

워크스페이스 한정 helper는 해당 워크스페이스 내부에 둔다.

## 워크스페이스 표준 트리

새 워크스페이스는 아래 구조를 기본값으로 삼는다.
워크스페이스별 ADR로 결정된 예외는 해당 워크스페이스 문서에 적는다.

```text
<workspace>/
├── AGENTS.md
├── CLAUDE.md -> AGENTS.md
├── .env
├── .env.example
├── config/
├── docs/
│   ├── prd.md
│   ├── data-schema.md
│   ├── flow.md
│   ├── code-architecture.md
│   └── adr/
│       ├── INDEX.md
│       └── ADR-NNN-slug.md
├── scripts/
│   └── <skill-name>/
├── .claude/
│   └── skills/
│       └── <skill-name>/
│           ├── SKILL.md
│           └── references/
├── data/
└── logs/
```

모든 워크스페이스는 `docs/adr/INDEX.md`와 결정별 ADR 파일을 사용한다.
현재 기술 결정이 없는 워크스페이스는 `INDEX.md`만 둔다.
travel처럼 자동화가 없는 문서 중심 워크스페이스는 `config/`, `scripts/`, `.claude/skills/`, `data/`, `logs/`가 없을 수 있다.

## Agent Guide

`AGENTS.md`가 모든 에이전트의 정식 가이드다.
`CLAUDE.md`는 `AGENTS.md`를 가리키는 심볼릭 링크로만 둔다.

```bash
cd <workspace>
ln -s AGENTS.md CLAUDE.md
```

두 파일을 따로 편집하면 drift가 생기므로, 편집 대상은 `AGENTS.md` 하나다.

## Workspace Docs

워크스페이스 `docs/`는 5문서와 ADR로 나눈다.

| 문서 | 책임 |
|---|---|
| `prd.md` | 제품 범위, 기능 표, 성공 기준 |
| `data-schema.md` | config, state, 산출물 스키마 |
| `flow.md` | 사용자 입력부터 산출물까지의 흐름 |
| `code-architecture.md` | 디렉터리 책임, skill 구조, 외부 의존성 |
| `adr/INDEX.md` | 현재 기술 결정과 개별 ADR 링크 |

같은 정의를 여러 문서에 본문으로 복제하지 않는다.

## Skills

워크스페이스 skill의 본문은 `<workspace>/.claude/skills/<skill>/SKILL.md`에 둔다.
문서에서 skill을 위임할 때는 `/<skill> [args]` 형태의 의도 표현을 쓴다.

```text
scripts/<skill-name>/
.claude/skills/<skill-name>/
├── SKILL.md
└── references/
```

`scripts/`는 실행 파일과 helper를 담고, `.claude/skills/`는 에이전트가 읽을 workflow 계약을 담는다.
실행 환경이 어떤 CLI나 서브에이전트를 쓸지는 환경이 결정한다.

## 공용 리포트 게시

`report-publisher`는 워크스페이스가 만든 공개 가능한 HTML 산출물을
Cloudflare Pages에 게시하는 Codex 전용 skill이다.

- 정본은 Codex 공식 저장소 경로인 `.agents/skills/report-publisher/`에 둔다.
- 별도의 `.codex/skills` 심볼릭 링크를 만들지 않는다.
- 게시 대상은 사용자가 명시한 HTML 파일이나 디렉터리로 제한한다.
- 원본 워크스페이스와 저장소 루트는 직접 게시하지 않는다.
- 실제 파일 전송은 공식 Wrangler를 사용한다.
- Cloudflare API MCP는 프로젝트 조회와 배포 상태 확인에만 선택적으로 사용한다.
- 게시 준비물은 임시 디렉터리에 만들고 실행 종료 시 제거한다.

각 리포트는 하나의 Pages 미리보기 분기로 게시한다.
Wrangler가 반환한 배포 고유 주소를 검증해 기본 공유 링크로 사용한다.
분기 별칭은 실제 HTTP 검증을 통과한 경우에만 안정적인 주소로 안내한다.

## Environment

비밀 값은 워크스페이스 root의 `.env`에 둔다.
`.env.example`은 필요한 key 목록만 담는다.
루트 `.env`는 만들지 않는다.

라이브러리는 `.env` 위치를 추정하지 않는다.
caller가 필요한 워크스페이스 `.env`를 명시적으로 전달한다.

## 예외

예외는 “표준 이탈”이 아니라 문서화된 결정이다.
새 예외가 필요하면 해당 워크스페이스 ADR에 결정 이유를 남긴다.

| 워크스페이스 | 예외 |
|---|---|
| `travel/` | 자동화 script와 workspace-level skill이 없는 문서 중심 워크스페이스 |

## 새 워크스페이스 추가

새 워크스페이스를 만들 때는 아래 순서로 시작한다.

```bash
WS=<workspace-name>
mkdir -p "$WS"/{docs/adr,config,scripts,data,logs}
mkdir -p "$WS"/.claude/skills
ln -s AGENTS.md "$WS"/CLAUDE.md
```

체크리스트:

- `$WS/AGENTS.md` 작성
- `$WS/CLAUDE.md` 심볼릭 링크 확인
- `$WS/docs/{prd,data-schema,flow,code-architecture}.md`와 `$WS/docs/adr/INDEX.md` 작성
- `$WS/config/`와 `.env.example` 작성
- `$WS/.gitignore`에 워크스페이스별 생성물과 비밀 파일 반영
- 루트 `README.md`, `AGENTS.md`, 이 문서의 워크스페이스 표 갱신
