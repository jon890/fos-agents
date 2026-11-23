# Phase 04. 스킬을 비서용으로 옮기고 버전, 번들, 문서를 맞춘다

**Execution profile**: standard

## 목표

면접 연습과 문서·프로필 관리 스킬을 셸 실행 공간에서 도는 비서용 스킬로 옮기고, 맥락 문서를 기억에서 읽게 한다. 대화용 스킬 디렉터리를 지우고 플러그인 버전과 번들, 책임 문서를 맞춘다.

**범위 외**: 지원 준비 스킬 넷과 `plugin/skills` 삭제, `sync-profile`, 작업본 동기화, 사용량 기록(3단계).

## 컨텍스트

- 대화용 스킬 셋은 `career-os/plugin/connector-skills/` 에 있고 `career` MCP 도구만 부른다. 그 도구 대부분이 phase 03 에서 사라진다.
- 비서용 스킬은 `career-os/plugin/agent-skills/` 이고 지금은 `plugin/skills/` 원본의 사본만 있다(`career-os/plugin/scripts/agent-skills.ts`). 사본은 맥락 문서를 `get_context_document` 로 읽으라고 적는다.
- 맥락 문서 넷의 원본은 이제 그 사용자의 기억이다. 제목은 「커리어: 현재 경력」(`career-status`), 「커리어: 역할 선호」(`position-preferences`), 「커리어: 지원 상태」(`application-state`), 「커리어: 학습 관심사」(`learning-interests`)다. 프로필 원고는 작업 폴더 `library/profiles/<wanted|linkedin|github>.md` 다.

**요구사항**: REQ5, REQ6, REQ7(설계 「맥락 문서를 넘기는 절차」, 「플러그인 선언」 표, 스펙 DECISION5, DECISION19, DECISION23, DECISION25, 설계 DECISION12)

**근거 문서**: `career-os/docs/adr/ADR-141-일반-에이전트가-읽는-스킬은-plugin-의-agent-skills-에-두고-따로-올린다.md`, `career-os/docs/adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md`

## 의도 메모

- 대화용 `study-topic-recommender` 는 옮기지 않고 지운다(스펙 「PR 나눔」 2단계, 설계 DECISION12). 공부 추천은 `study-collection` 이 한다. `study-collection` 이 가리키던 그 스킬의 「2. 고르기」 기준은 `study-collection/references/execution.md` 로 옮긴다.
- 3단계가 옮길 Claude Code 전용 스킬(`application-package-writer`, `resume-preparer`, `interview-question-prep`, `sync-profile`)은 지운 도구 이름이 남아도 고치지 않는다. 노트북 스킬은 더 쓰지 않고(스펙 DECISION2) 3단계가 다시 쓴다.
- 새 두 스킬은 `agent-skills/` 가 원본이다. `plugin/skills/` 에 원본을 만들지 않는다(3단계가 그 디렉터리를 지운다). 사본 둘은 지금처럼 원본에서 만든다.
- 같은 제목의 기억이 둘 이상이면 고르지 않고 멈춘다. 문서가 2000자를 넘으면 줄이자고 제안한다(스펙 DECISION5).
- 에이전트가 맥락 문서를 고칠 때는 `memory_remember` 로 남기고, 받아들이기 전까지 다음 실행은 옛 문서를 쓴다고 알린다(스펙 DECISION23).

## 작업 항목

### 1. `career-os/plugin/agent-skills/interview-practice/SKILL.md`

실행 환경 절(사본과 같은 문장), 기억에서 「커리어: 현재 경력」 과 「커리어: 지원 상태」 읽기, `<CAREER_LOCAL> interview select`, 연습과 판정(지금 본문 그대로), `interview record`, `interview progress`, `interview personal list|add|disable`. 승인 카드와 `attemptId` 재전송 절은 지운다.

### 2. `career-os/plugin/agent-skills/career-connector/SKILL.md`

맥락 문서(기억) 읽고 고치기, 프로필 원고 파일 읽고 고치기, GitHub 프로필 갱신(README 만, 사용량 차트와 Tokens 배지를 README 에서 뺀다), 원티드 반영, `position check-exclusions`.

### 3. 사본 둘과 원본

`plugin/skills/position-recommender`, `study-collection` 의 `SKILL.md` 와 `references/execution.md` 에서 `get_context_document`, `save_context_document`, 대화용 공부 추천 도구 이름을 없애고 기억 절차(`memory_search`, `memory_read`, `memory_remember`)를 적는다. `references/` 는 교체 없이 복사되므로 원본에 직접 적는다.
`agent-skills.ts` 는 사본이 아닌 원본 스킬(`AGENT_SKILL_ORIGINALS`)을 어긋남 검사에서 「목록에 없는 디렉터리」 로 세지 않고, 사본을 다시 쓸 때 지우지 않으며, 다른 실행 환경 전용 표현 검사에 넣는다.

### 4. 선언

- `connector-skills/` 를 지운다. `.claude-plugin/plugin.json` 의 `skills` 는 `[]`.
- `connector.json` 의 `agent_skills.sandbox_env` 에 `interview-practice`, `career-connector` 를 `CLAUDE_PLUGIN_ROOT`, `CAREER_WORKSPACE_ROOT` 로 더한다.
- 버전을 0.13.0 으로 올린다(`plugin.json`, `package.json`, `server.ts`). `bun run build` 로 번들을 다시 만든다.

### 5. 테스트

`agent-skills.test.ts`, `connector-config.test.ts`, `local-skills.test.ts`, `local-bundle.test.ts`: 비서용 스킬 넷이 있고, 어느 것도 지운 도구 이름(`get_context_document`, `save_interview_attempt` 등)과 `CAREER_BACKEND_` 를 담지 않으며, 적은 실행기 명령이 실제 명령이다.

### 6. 문서

- `career-os/docs/adr/ADR-147-…md`(신규): 맥락 문서는 기억, 프로필 원고는 작업 폴더 파일, MCP 서버는 GitHub 과 원티드만. 대체되는 결정(ADR-129, 130, 131, 133, 135, 137, 139, 142, 143, 144)은 `INDEX.md` 의 상태 칸에 적는다(1단계와 같은 방식).
- `career-os/AGENTS.md` 에는 프로필 원고의 경로를 적지 않는다(`scripts/profile/sync_profile_skill_doc.test.ts` 가 막는다). 자리는 `data-schema.md` 가 갖는다.
- `career-os/docs/flow.md`, `data-schema.md`, `code-architecture.md`, `prd.md`, `AGENTS.md`, `README.md`, `plugin/agent-skills/README.md`: 면접 저장 자리, 실행기 명령, 커넥터 도구와 env 표, 스킬 자리.
- `tasks/local-sqlite-store/index.json` 의 `deferred` 첫 항목에 이 계획으로 옮겼다고 적는다.

## 인수 검증 계획

| 요구사항 | 준비 조건 | 실행 절차 | 기대 결과 | 실행 환경 | 실행 담당 | 선행 조건 | 시점 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ5 | 빈 임시 작업 폴더 | 번들 실행기로 `interview personal add`, `interview record`(pass 하나, fail 하나)를 실행하고 프로세스를 끝낸다. 새 프로세스에서 `interview progress tech`, `interview select tech`, `interview personal list tech` 를 실행한다 | 둘째 실행의 복습 상태에 앞 기록의 주제와 다음 복습일이 있고, 방금 통과한 주제는 고른 질문에서 빠지며, 저장한 개인 질문이 목록에 나온다 | 로컬 임시 폴더, `dist/career-local.js` | worker | 없음 | PR 전 |
| REQ5 | 1단계 실행기가 만든 파일(`user_version = 1`, 공고 데이터 있음) | `bun test ./career-os/scripts/lib/career-store/database.test.ts` | 면접 테이블만 더해지고 있던 공고 데이터가 남는다 | 로컬과 CI | worker | 없음 | PR 전 |
| REQ6 | 가짜 GitHub 응답 | `bun test ./career-os/plugin/src/tools.test.ts` | `update_github_profile` 이 README 한 파일만 커밋하고 `months` 를 거절한다 | 로컬과 CI | worker | 없음 | PR 전 |
| REQ5 | 임시 작업 폴더, 고정한 시계 | `bun test ./career-os/scripts/lib/career-store/interview` | 연결을 닫고 다시 연 뒤 복습일이 된 주제가 `dueForReview` 로 나온다 | 로컬과 CI | worker | 없음 | PR 전 |
| REQ6 | 임시 작업 폴더 | `bun test ./career-os/scripts/lib/career-store/context.test.ts ./career-os/plugin/scripts/agent-skills.test.ts` | 본문이 바뀌면 기준 버전이 바뀌고, 비서용 스킬이 기억에서 읽어 `context/` 에 쓰라고 적는다 | 로컬과 CI | worker | 없음 | PR 전 |
| REQ7 | 없음 | `bun test ./career-os/plugin` | 선언의 도구가 GitHub, 원티드, 연결 확인뿐이고 Backend token 칸과 `CAREER_BACKEND` 이름이 선언, `.mcp.json`, 서버 소스, 비서용 스킬에 없다 | 로컬과 CI | worker | 없음 | PR 전 |
| REQ5, REQ6, REQ7 | 운영에 0.13.0 배포 | 커리어 에이전트에서 남은 도구 목록을 보고, 기억의 「커리어: 역할 선호」 를 고친 뒤 공고 추천을 부르고, 면접 연습을 두 대화에서 한다 | 도구가 GitHub, 원티드, 연결 확인뿐이다. 공고 추천의 기준 버전이 바뀐다. 둘째 대화에 앞 연습의 복습 대상과 개인 질문이 나온다 | 운영 | 코디네이터 | PR 머지와 배포 | 머지 뒤 |

## 검증

```bash
bun test ./career-os/plugin ./career-os/scripts
cd career-os/plugin && bun run typecheck
bunx tsc --noEmit -p .
cd career-os/plugin && bun run scripts/agent-skills.ts --check
cd career-os/services/career-backend && npm ci && npx prisma generate && npm run typecheck && npm test && npm run build
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/agent-skills/interview-practice/SKILL.md` | 신규 |
| `career-os/plugin/agent-skills/career-connector/SKILL.md` | 신규 |
| `career-os/plugin/connector-skills/interview-practice/SKILL.md` | 삭제 |
| `career-os/plugin/connector-skills/career-connector/SKILL.md` | 삭제 |
| `career-os/plugin/connector-skills/study-topic-recommender/SKILL.md` | 삭제 |
| `career-os/plugin/skills/position-recommender/SKILL.md` | 수정 |
| `career-os/plugin/skills/study-collection/SKILL.md` | 수정 |
| `career-os/plugin/agent-skills/position-recommender/SKILL.md` | 수정 (생성) |
| `career-os/plugin/agent-skills/study-collection/SKILL.md` | 수정 (생성) |
| `career-os/plugin/skills/study-collection/references/execution.md` | 수정 |
| `career-os/plugin/agent-skills/study-collection/references/execution.md` | 수정 (생성) |
| `career-os/scripts/candidate-context/skill_boundary.test.ts` | 수정 |
| `career-os/plugin/agent-skills/README.md` | 수정 |
| `career-os/plugin/scripts/agent-skills.ts` | 수정 |
| `career-os/plugin/scripts/agent-skills.test.ts` | 수정 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/plugin/scripts/local-skills.test.ts` | 수정 |
| `career-os/plugin/scripts/local-bundle.test.ts` | 수정 |
| `career-os/plugin/connector.json` | 수정 |
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 |
| `career-os/plugin/package.json` | 수정 (버전) |
| `career-os/plugin/src/server.ts` | 수정 (버전) |
| `career-os/plugin/dist/career-local.js` | 수정 (빌드) |
| `career-os/plugin/dist/career-mcp.js` | 수정 (빌드) |
| `career-os/.claude-plugin/marketplace.json` | 수정 |
| `career-os/docs/adr/ADR-147-후보자-맥락-문서는-비서의-기억이-프로필-원고는-작업-폴더-파일이-갖는다.md` | 신규 |
| `career-os/docs/adr/INDEX.md` | 수정 |
| `career-os/docs/flow.md` | 수정 |
| `career-os/docs/data-schema.md` | 수정 |
| `career-os/docs/code-architecture.md` | 수정 |
| `career-os/docs/prd.md` | 수정 |
| `career-os/AGENTS.md` | 수정 |
| `career-os/README.md` | 수정 |
| `career-os/docs/features/career-migrate/tasks/local-sqlite-store/index.json` | 수정 |
