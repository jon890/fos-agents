# agent-skills

fos-assistant 의 일반 에이전트에 설치하는 스킬의 사본을 둔다([ADR-141](../../docs/adr/ADR-141-일반-에이전트가-읽는-스킬은-plugin-의-agent-skills-에-두고-따로-올린다.md)).
`connector.json` 의 `agent_skills` 가 이 디렉터리를 가리키고, 플러그인을 붙인 에이전트의 셸 설정이 `sandbox_env` 의 env 를 모두 넘길 때만 그 스킬이 설치된다.

스킬 디렉터리는 직접 고치지 않는다. 원본은 `../skills/` 이고, `bun run scripts/agent-skills.ts` 가 실행 환경 문장만 바꿔 다시 만든다.
사본을 낼 스킬과 바꿀 문장은 `scripts/agent-skills.ts` 의 `AGENT_SKILL_COPIES` 가 갖고, `scripts/agent-skills.test.ts` 가 사본이 원본과 어긋나는지 본다.
사본에 다른 실행 환경 전용 표현(실행 환경 문장, 하위 에이전트, 그 환경의 도구 이름)이 남으면 `HOST_ONLY_PATTERNS` 검사가 사본 만들기를 멈춘다.
