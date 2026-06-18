# Code Architecture — ai-nodes 모노레포

이 문서는 ai-nodes 루트의 현행 코드와 문서 구조를 설명한다.
결정의 이유와 대안 기각은 [`docs/adr/INDEX.md`](adr/INDEX.md)를 따른다.

## 모노레포 구조

`ai-nodes`는 여러 독립 워크스페이스를 담는 컨테이너다.
각 최상위 워크스페이스는 자체 `AGENTS.md`, `docs/`, `config/`, `scripts/`, `tasks/`, `data/`, `logs/`를 가진다.
워크스페이스 자산은 서로 교차 참조하지 않는다.

| 워크스페이스 | 가이드 | 책임 |
|---|---|---|
| `apartment/` | [`apartment/AGENTS.md`](../apartment/AGENTS.md) | 아파트 시세와 인테리어 리포트 |
| `career-os/` | [`career-os/AGENTS.md`](../career-os/AGENTS.md) | 커리어, 면접, 지원 준비 자동화 |
| `stock-investment/` | [`stock-investment/AGENTS.md`](../stock-investment/AGENTS.md) | 일일 주식과 이슈 모니터링 |
| `travel/` | [`travel/AGENTS.md`](../travel/AGENTS.md) | 여행별 일정과 결정 로그 |
| `health-care/` | [`health-care/AGENTS.md`](../health-care/AGENTS.md) | 무릎 재활 체크인 |

## 루트 디렉터리

루트에는 워크스페이스 공통 자산만 둔다.

| 경로 | 책임 |
|---|---|
| `AGENTS.md` | 모든 에이전트를 위한 공통 행동 규칙 |
| `CLAUDE.md` | `AGENTS.md` 심볼릭 링크 |
| `_shared/lib/` | 워크스페이스 무관 Bun TypeScript helper |
| `_shared/types/` | 공용 TypeScript type |
| `.claude/skills/` | 저장소 전역 agent skill 정본 (`build-with-teams` 등 공용 skill 포함) |
| `.claude/agents/` | `build-with-teams` 전용 agent (`<workspace>-executor`·`<workspace>-docs-verifier`) |
| `.codex/skills/` | Codex 노출용 skill 심볼릭 링크 |
| `docs/adr/` | 모노레포 레벨 ADR |
| `docs/code-architecture.md` | 현재 구조와 책임 경계 |
| `docs/docs-style.md` | 문서 작성 형식 정책 |

`_shared/`에는 특정 워크스페이스의 `config/`, `sources/`, `data/`에 의존하는 코드를 두지 않는다.
워크스페이스 한정 helper는 `<workspace>/scripts/<skill>/` 내부에 둔다.

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
│   └── adr.md
├── scripts/
│   └── <skill-name>/
├── .claude/
│   └── skills/
│       └── <skill-name>/
│           ├── SKILL.md
│           └── references/
├── tasks/
│   └── plan{N}-<kebab-slug>/
├── data/
└── logs/
```

career-os는 `docs/adr/` 개별 파일 구조를 사용한다.
다른 워크스페이스는 아직 단일 `docs/adr.md` 구조를 사용한다.

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
| `data-schema.md` | config, runtime, 산출물, ledger 스키마 |
| `flow.md` | 사용자 입력부터 산출물까지의 흐름 |
| `code-architecture.md` | 디렉터리 책임, skill 구조, 외부 의존성 |
| `adr.md` 또는 `adr/` | 결정의 이유와 대안 기각 |

문서 형식은 [`docs/docs-style.md`](docs-style.md)를 따른다.
같은 정의를 여러 문서에 본문으로 복제하지 않는다.

## Tasks

계획 파일은 `<workspace>/tasks/plan{N}-<slug>/` 아래에 둔다.
번호는 워크스페이스별로 독립이다.

```text
tasks/
└── plan{N}-<slug>/
    ├── index.json
    ├── phase-01.md
    └── phase-NN.md
```

완료된 plan도 history 보존 목적으로 삭제하지 않는다.
구현 phase는 확정된 task 계약을 실행하는 단계다.
구현 중 문서 결정이 필요해지면 phase를 보류하고 planning으로 되돌린다.

## Skills

agent skill의 정본은 `.claude/skills/<skill>/SKILL.md`다.
Codex 노출은 `.codex/skills/<skill>` 심볼릭 링크를 사용한다.
문서에서 skill을 위임할 때는 `/<skill> [args]` 형태의 의도 표현을 쓴다.

```text
scripts/<skill-name>/
.claude/skills/<skill-name>/
├── SKILL.md
└── references/
```

`scripts/`는 실행 파일과 helper를 담고, `.claude/skills/`는 에이전트가 읽을 workflow 계약을 담는다.
실행 환경이 어떤 CLI나 서브에이전트를 쓸지는 환경이 결정한다.

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
| `career-os/` | `docs/adr/` 개별 ADR 파일 구조 |
| `travel/` | 자동화 script와 workspace-level skill이 없는 문서 중심 워크스페이스 |

## 새 워크스페이스 추가

새 워크스페이스를 만들 때는 아래 순서로 시작한다.

```bash
WS=<workspace-name>
mkdir -p "$WS"/{docs,config,scripts,tasks,data,logs}
mkdir -p "$WS"/.claude/skills
ln -s AGENTS.md "$WS"/CLAUDE.md
```

체크리스트:

- `$WS/AGENTS.md` 작성
- `$WS/CLAUDE.md` 심볼릭 링크 확인
- `$WS/docs/{prd,data-schema,flow,code-architecture,adr}.md` placeholder 작성
- `$WS/config/`와 `.env.example` 작성
- `$WS/.gitignore`에 워크스페이스별 생성물과 비밀 파일 반영
- 첫 plan을 `$WS/tasks/plan001-<slug>/`에 생성
- 루트 `README.md`, `AGENTS.md`, 이 문서의 워크스페이스 표 갱신
