## ADR-093 — Skill 호출은 agent 비종속 의도 표현으로 쓴다

Status: Accepted
Date: 2026-06-17

## 맥락

career-os skill은 `.claude/skills`를 정본으로 두고 `.codex/skills` 심볼릭 링크로도 노출한다.
따라서 같은 SKILL.md 워크플로는 Claude, Codex, Gemini 같은 여러 에이전트가 실행할 수 있어야 한다.

기존 운영 문서에는 Claude CLI 명령이 표준 호출처럼 적혀 있었다.
이 표현은 skill 계약을 특정 CLI 실행 경로와 혼동하게 만들고, 다른 에이전트가 같은 skill을 직접 실행하는 흐름과 어긋난다.

## 결정

문서와 skill 간 위임 표현은 `/<skill> [args]` 형태의 agent skill 호출 의도로 쓴다.
SKILL.md는 무엇을 하는지 정의하는 워크플로 계약이며, 특정 CLI 명령은 실행 환경별 호환 경로로만 다룬다.

Claude CLI 호환 실행 경로는 운영 runner나 legacy cron에 남을 수 있다.
다만 docs, AGENTS, TOOLS, SKILL.md 본문은 특정 CLI를 표준 호출로 박지 않는다.

scripts 계층의 실제 실행기 변경은 이번 결정의 적용 범위에서 보류한다.
`application-agent`와 `position-recommender`의 실행기 추상화는 후속 plan에서 env 주입 또는 호출 제거 중 하나로 다시 결정한다.

## 결과

새 문서를 읽는 에이전트는 workflow를 특정 제품 CLI가 아니라 SKILL.md 실행 계약으로 이해한다.
Codex는 같은 SKILL.md를 직접 수행할 수 있고, Claude CLI는 호환 실행 경로로만 남는다.

단점은 scripts 계층에 남은 Claude 실행기가 당분간 정책과 완전히 일치하지 않는다는 점이다.
이 불일치는 의도적으로 후속 plan의 열린 작업으로 남긴다.

## 적용

현재 표준 표현은 `AGENTS.md`, `TOOLS.md`, `docs/prd.md`, `docs/flow.md`, `docs/code-architecture.md`에 둔다.
과거 ADR과 완료된 task 기록의 CLI 명령은 당시 실행 이력이므로 수정하지 않는다.
