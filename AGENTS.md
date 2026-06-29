# AGENTS.md — ai-nodes 모노레포

모든 에이전트(Claude / Codex / Gemini 등)를 위한 공통 진입점이다.
`CLAUDE.md`는 이 파일의 심볼릭 링크다.

이 파일은 행동 규칙과 문서 라우팅만 담는다.
구조 설명은 [`docs/code-architecture.md`](docs/code-architecture.md)를 따른다.
결정의 이유는 [`docs/adr/INDEX.md`](docs/adr/INDEX.md)를 따른다.

## 읽기 순서

작업 범위에 맞는 단일 출처를 먼저 연다.
같은 정의를 여러 문서에 복제하지 않는다.

| 문서 | 책임 | 언제 보는지 |
|---|---|---|
| [`docs/code-architecture.md`](docs/code-architecture.md) | 루트와 워크스페이스 구조 | 디렉터리, skill, 공용 helper 변경 |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md) | 모노레포 결정 이유 | 공통 정책, 구조 변경, 되돌리기 어려운 결정 |
| [`docs/docs-style.md`](docs/docs-style.md) | 문서 작성 형식 | docs, ADR, AGENTS, SKILL 작성 |
| `<workspace>/AGENTS.md` | 워크스페이스별 정책 | 특정 워크스페이스 작업 시작 |

## 워크스페이스

각 워크스페이스는 독립 작업 영역이다.
작업을 시작하면 해당 워크스페이스의 `AGENTS.md`를 먼저 읽는다.

| 워크스페이스 | 가이드 | 책임 |
|---|---|---|
| `apartment/` | [`apartment/AGENTS.md`](apartment/AGENTS.md) | 아파트 시세와 인테리어 리포트 |
| `career-os/` | [`career-os/AGENTS.md`](career-os/AGENTS.md) | 커리어, 면접, 지원 준비 자동화 |
| `stock-investment/` | [`stock-investment/AGENTS.md`](stock-investment/AGENTS.md) | 일일 주식과 이슈 모니터링 |
| `travel/` | [`travel/AGENTS.md`](travel/AGENTS.md) | 여행별 일정과 결정 로그 |
| `health-care/` | [`health-care/AGENTS.md`](health-care/AGENTS.md) | 무릎 재활 체크인 |
| `ji-yoon-blog/` | [`ji-yoon-blog/AGENTS.md`](ji-yoon-blog/AGENTS.md) | 지융로그 네이버 블로그 운영, 글쓰기, 트렌드 분석 |

## 작업 경계

- 워크스페이스 간 자산을 교차 참조하지 않는다.
- 공용 helper는 워크스페이스 무관 코드만 `_shared/`에 둔다.
- 워크스페이스 한정 helper는 `<workspace>/scripts/<skill>/`에 둔다.
- 비밀 값은 각 워크스페이스의 `.env`에 둔다.
- 공개 repo에 커밋되는 문서와 task에는 private home-server 절대 경로를 쓰지 않는다.
- Discord 등 공개 또는 준공개 채널 답변에서도 private path를 그대로 드러내지 않는다.
- 보안상 민감한 설정·인증 파일은 공개 채널에 내용을 노출하지 않는다.
- 파일 도구가 보안상 민감한 파일 수정을 거부하면 `terminal`, Python, 쉘 스크립트로 우회하지 않는다.
- 직접 수정이 꼭 필요하면 파일, 변경값, 이유를 사용자에게 설명하고 명시 승인을 받은 뒤 진행한다.
- `career-os/sources/fos-study`는 별도 동기 저장소다.
  study-pack 계열 작업이 아니면 프로젝트 코드처럼 편집하지 않는다.

## 리포트 산출물

사용자가 보는 분석·추천·점검 리포트는 기본적으로 HTML 파일도 함께 만든다.

- Discord 답변에는 핵심 요약을 짧게 쓰고, 바로 열어볼 수 있는 HTML 다운로드 파일을 첨부한다.
- 공고·포지션 추천 리포트는 예외 없이 HTML을 첨부하고, HTML 안의 각 공고명에는 개별 공고 URL로 이동하는 링크를 건다.
- Discord 미리보기에는 상위 후보 5~10개와 핵심 사유를 짧게 쓰되, 각 후보의 공고 링크도 함께 포함한다.
- 워크스페이스별 허용된 `data/runtime/downloads/` 같은 다운로드 전용 경로에 HTML을 만든다.
- HTML에는 민감 정보 노출 범위를 점검하고, 공개 또는 준공개 채널에 첨부해도 되는 내용만 포함한다.
- 단순 한두 줄 답변, 중간 진행 보고, 사용자가 명시적으로 텍스트만 원한 경우는 예외로 둘 수 있다.

## Agent Skill

모든 워크스페이스는 agent skill 직접 호출을 표준으로 사용한다.
문서에서 skill을 위임할 때는 `/<skill> [args]` 형태의 의도 표현으로 적는다.

- 정본: `<workspace>/.claude/skills/<skill>/SKILL.md`
- Codex 노출: `<workspace>/.codex/skills/<skill>` 심볼릭 링크
- 실행 환경: CLI, 서브에이전트, wrapper 중 어떤 방식을 쓸지는 환경이 결정한다.
- skill 본문과 설명 문구는 한국어를 기본으로 작성한다.

## 모호함 대응

요청이나 결정점이 모호하면 즉시 드러낸다.

1. 모호함을 1-10점으로 평가한다.
2. 점수와 사유를 한 줄로 보고한다.
3. 진행 계획을 먼저 알린다.
4. 점수 3 이상이면 선택지를 제시하고 사용자 결정을 받는다.

조용히 가정하고 진행하지 않는다.
작은 결정이라도 기본값을 선택했다면 보이게 남긴다.

## Planning

planning은 Codex와 사용자가 대화로 진행한다.
planning skill의 비대화형 CLI 호출은 기본 사용하지 않는다.

- 새 결정은 구현 전에 docs 또는 ADR에 먼저 반영한다.
- task 파일은 확정된 결정을 실행 가능한 phase로 옮기는 산출물이다.
- 비대화형 agent 실행은 합의된 task/phase 구현에만 사용한다.
- 구현 중 문서 결정이 필요하면 phase를 보류하고 planning으로 되돌린다.

career-os의 `tasks/plan{N}-<slug>/` 흐름은 필요할 때 다른 워크스페이스에도 별도 결정으로 도입한다.

## 구현 실행 모델

확정된 task/phase 구현은 두 실행 모델 중 하나로 진행한다(ADR-018).

- 무인 cron·background 실행은 `plan-and-build`(`run-phases.py`)로 한다.
- 대화형 가시 협업(critic 평가 + docs-verifier 검증)은 `build-with-teams`로 한다.

`build-with-teams`의 executor·docs-verifier는 실행 워크스페이스명을 prefix로 한 전용 agent를 쓴다.
정본은 `.claude/agents/<workspace>-{executor,docs-verifier}.md`이고, 워크스페이스 환경은 `variants/<workspace>.md`가 정의한다.

## Worktree

메인 워크트리는 사용자와 Codex가 현재 상태를 확인하는 기준점이다.
다른 활성 작업과 섞일 수 있으면 별도 git worktree와 branch를 만든다.

- main 워크트리 직접 편집은 단일 active task이거나 작은 docs/process-only 변경일 때만 허용한다.
- stage는 intended files만 한다.
- phase 경계는 commit/push 경계다.
- 완료 전에는 관련 worktree에서 `git status --short`를 확인한다.
- 별도 worktree를 만들었다면 clean 상태 확인 후 `git worktree remove <path>`로 정리한다.

## Commit And PR

커밋은 관심사 단위로 나눈다.
한 커밋은 하나의 논리적 변경만 담는다.

커밋 메시지는 Conventional Commits와 한글 subject를 쓴다.

```text
<type>[(scope)]: <한글 subject>
```

- `type`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`, `build`, `ci`
- `scope`: 워크스페이스 또는 모듈명
- subject: 50자 내외, 마침표 생략
- trailer: `Co-Authored-By:`, `Signed-off-by:` 등은 영어 원문 유지

새 PR 제목과 본문은 한글로 작성한다.
GitHub UI, bot, 코드 식별자가 요구하는 고정 키워드는 원문을 유지한다.

AGENTS.md, SKILL.md, ADR, docs/flow.md처럼 에이전트 동작을 바꾸는 핵심 문서를 수정했으면 완료 보고에 반드시 수정 사실과 파일 목록을 밝힌다.
핵심 문서나 재사용 스크립트를 수정한 작업은 검증 후 관심사별로 나눠 commit/push까지 진행한다.
단, 사용자가 보류를 요청했거나 unrelated dirty 파일 때문에 안전하지 않으면 해당 이유와 남은 파일을 보고한다.

## Docs Style

문서 작성은 [`docs/docs-style.md`](docs/docs-style.md)를 따른다.
새로 작성하거나 편집한 docs, ADR, AGENTS, SKILL, task phase 파일에 적용한다.

핵심 원칙:

- 한 문장 한 줄.
- 항목 3개 이상은 목록으로 분리.
- 한 문서에는 자기 책임만 적는다.
- 구현 상세와 변경 이력은 docs 본문에 누적하지 않는다.
- 한국어 문장을 기본으로 쓰고, 코드 식별자와 경로는 원문 유지.
- 섹션 기호는 쓰지 않는다.

## fos-brain

사용자는 `~/personal/fos-brain`에 개인 지식 기반을 운영한다.
사용자의 과거 결정, 취향, 업무 방식, 학습 내용이 답에 영향을 주면 brain을 먼저 조회한다.

- brain 읽기는 필요할 때 수행한다.
- brain 쓰기는 사용자 승인 후에만 수행한다.
- public/private/work 네임스페이스를 구분한다.
- repo 문서에 충분히 남은 구현 세부나 하루짜리 실행 로그는 brain에 넣지 않는다.

## Hermes

이 repo의 일부 skill은 Hermes Agent(Nous Research) 런타임에서 실행된다.
Hermes 관련 질문에 답하기 전에는 기억이 아니라 공식 문서를 먼저 참조한다.

- 공식 문서: https://hermes-agent.nousresearch.com/docs
- Quickstart: https://hermes-agent.nousresearch.com/docs/getting-started/quickstart
- 로컬 런타임 홈은 `~/.hermes`이며 `config.yaml`, `skills/`, `gateway/`로 구성된다.
- Hermes는 skill을 description으로 트리거하므로, skill 노출·확장은 description 품질로 판단한다.

## 참고

- 구조와 새 워크스페이스 추가: [`docs/code-architecture.md`](docs/code-architecture.md)
- 모노레포 ADR: [`docs/adr/INDEX.md`](docs/adr/INDEX.md)
- 문서 형식: [`docs/docs-style.md`](docs/docs-style.md)
- planning skill: [`.claude/skills/planning/SKILL.md`](.claude/skills/planning/SKILL.md)
- plan-and-build skill: [`.claude/skills/plan-and-build/SKILL.md`](.claude/skills/plan-and-build/SKILL.md)
- build-with-teams skill: [`.claude/skills/build-with-teams/SKILL.md`](.claude/skills/build-with-teams/SKILL.md)
- workspace-audit skill: [`.claude/skills/workspace-audit/SKILL.md`](.claude/skills/workspace-audit/SKILL.md)
- docs-check skill: [`.claude/skills/docs-check/SKILL.md`](.claude/skills/docs-check/SKILL.md)
