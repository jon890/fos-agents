# Phase 05. 스킬, 플러그인 선언, 번들, 문서와 인수 검증

**Execution profile**: standard

## 목표

비서용 스킬 둘이 새 실행 방식을 안내하고, 플러그인 선언이 그 스킬에 Backend 값을 요구하지 않으며, 번들과 책임 문서가 코드와 맞는다. 로컬에서 임시 작업 폴더로 두 번 실행해 인수 조건을 확인한다.

**범위 외**: `connector.json` 의 `fields`, `tools`, `operator_env` 와 `.mcp.json`(다음 계획). `career-os/plugin/connector-skills/`. 운영의 예약 작업 등록과 Hermes cron 삭제(운영 단계).

## 컨텍스트

- 비서용 스킬 사본 `career-os/plugin/agent-skills/` 는 직접 고치지 않는다. 원본은 `career-os/plugin/skills/` 이고 `career-os/plugin/scripts/agent-skills.ts` 가 사본을 만든다. 원본을 고친 뒤 사본을 다시 만든다.
- `connector.json` 의 `agent_skills.sandbox_env` 가 스킬마다 실행 공간에 요구하는 환경 변수 이름이다. 에이전트의 셸 설정이 그 이름을 모두 넘길 때만 스킬이 설치된다.
- 플러그인 폴더를 바꾸면 `career-os/plugin/package.json` 과 `career-os/plugin/.claude-plugin/plugin.json` 의 버전을 함께 올리고 `career-os/plugin/dist/` 번들을 다시 빌드한다.

**요구사항**: REQ1, REQ3, REQ4(스펙 DECISION19, 22, 24)

**근거 문서**: `career-os/docs/adr/ADR-141-일반-에이전트가-읽는-스킬은-plugin-의-agent-skills-에-두고-따로-올린다.md`, `career-os/docs/adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md`

## 의도 메모

- 이 계획에서 맥락 문서의 원본은 Backend 다. 스킬은 에이전트가 `get_context_document` 로 읽은 본문을 `context/<키>.md` 에 그대로 쓰게 한다. 다음 계획이 이 한 단계만 기억 읽기로 바꾼다.
- `sandbox_env` 에서 Backend 이름을 빼고 `CAREER_WORKSPACE_ROOT` 를 넣는다. 운영의 에이전트 셸 설정이 이 이름을 넘기지 않으면 두 스킬이 설치되지 않으므로 PR 본문의 운영 확인 항목에 적는다.

## 작업 항목

### 1. 스킬 원본과 사본

`career-os/plugin/skills/position-recommender/`, `career-os/plugin/skills/study-collection/` 의 `SKILL.md` 와 `references/` 에서 아래를 고치고 `bun run scripts/agent-skills.ts` 로 사본을 다시 만든다.

- Backend 주소와 token 요구를 지우고 작업 폴더 SQLite 를 쓴다고 적는다.
- 첫 단계로 맥락 문서를 `context/` 에 쓴다. 문서가 없으면 실행기를 부르지 않고 문서를 먼저 쓰라고 안내하고 끝낸다.
- 실행 폴더는 작업 폴더 `runs/` 아래에 만든다.
- 리포트는 `reports/` 의 파일을 `file_space_put` 으로 「내 파일」 에 넣는다.
- 정책이 없을 때(`POLICY_NOT_CONFIGURED`)의 설정 명령, 제외 규칙과 회사 선호를 바꾸는 명령을 적는다.
- 실행기가 `CAREER_STORE_BUSY`, `CAREER_STORE_CORRUPT` 로 끝났을 때 결과 글 첫 줄에 적을 문장.

### 2. 플러그인 선언과 버전, 번들

- `career-os/plugin/connector.json` 의 `agent_skills.sandbox_env`: `position-recommender` 는 `CLAUDE_PLUGIN_ROOT`, `CAREER_WORKSPACE_ROOT`, `CAREER_EVIDENCE_DIR`, `study-collection` 은 `CLAUDE_PLUGIN_ROOT`, `CAREER_WORKSPACE_ROOT`.
- 버전을 `0.11.0` 으로 올린다(`package.json`, `.claude-plugin/plugin.json`).
- `cd career-os/plugin && bun run build` 로 `dist/` 를 다시 만든다.

### 2-1. 선언과 사본 검사 테스트

`career-os/plugin/scripts/agent-skills.test.ts`, `connector-config.test.ts`, `local-bundle.test.ts`, `local-skills.test.ts` 가 `sandbox_env` 와 사본, 번들의 실행기 목록을 본다. 바뀐 선언에 맞춰 기대값을 고치고, 사본에 `CAREER_BACKEND` 이름이 남으면 실패하는 검사를 `agent-skills.test.ts` 에 더한다.

### 3. 예약 작업 지시문

`career-os/docs/features/career-migrate/schedule-prompts.md` 에 운영이 등록할 두 지시문(공고 추천, 공부 추천)을 적는다. 스킬을 부르고, 실패는 결과 글 첫 줄에 적고, 추천할 것도 실패도 없으면 답 전체를 `[SILENT]` 로 끝낸다.

### 4. 책임 문서

- `career-os/docs/flow.md`: 공고 추천과 공부 추천 흐름의 저장 자리와 맥락 문서 전달, 실행 폴더, 리포트 위치.
- `career-os/docs/data-schema.md`: 작업 폴더 배치(`state/career.sqlite`, `context/`, `runs/`, `reports/`)와 기준 버전 형식.
- `career-os/docs/code-architecture.md`: `scripts/lib/career-store/` 의 책임과 Backend 가 아직 갖는 것.
- `career-os/AGENTS.md`, `career-os/README.md`: 낡은 문장만 고친다.

## 인수 검증 계획

| 요구사항 | 준비 조건 | 실행 절차 | 기대 결과 | 실행 환경 | 실행 담당 | 선행 조건 | 시점 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ1 | 빈 임시 작업 폴더, `context/` 에 두 문서, 분석 정책 설정 | `CAREER_BACKEND_URL` 없이 번들 `career-local.js position` 으로 수집 대역 입력을 넣어 `finalize` 까지 실행 | 종료 코드 0, `state/career.sqlite` 와 `reports/<날짜>-position.html` 이 생긴다 | 로컬 임시 폴더 | worker | 없음 | PR 전 |
| REQ3 | 위 실행이 끝난 같은 작업 폴더, 제외 규칙 한 건 추가 | 같은 공고에 한 건만 본문을 바꿔 두 번째 실행 | 분석 큐에 바뀐 공고만 든다. 제외한 공고가 후보에 없다. 첫 실행 추천은 다시 만들어지지 않는다 | 로컬 임시 폴더 | worker | REQ1 통과 | PR 전 |
| REQ4 | 빈 임시 작업 폴더, `context/learning-interests.md`, 소스 한 건 | 로컬 피드 대역으로 수집 → 추천 저장 → 게시 기록, 다시 수집과 후보 조회 | 두 번째 수집이 저장된 커서 버전에서 시작한다. 고른 자료가 후보에 없다. 추천 실행과 게시 기록이 조회된다 | 로컬 임시 폴더 | worker | 없음 | PR 전 |
| REQ1, REQ3, REQ4 | 운영 커리어 에이전트, 셸 설정에 `CAREER_WORKSPACE_ROOT` | 대화에서 두 스킬을 한 번씩 부른다 | 작업 폴더 SQLite 가 갱신되고 리포트가 「내 파일」 에 생긴다. 실행 공간에 `bun` 이 있고 `bun:sqlite` 가 돈다 | 운영 실행 공간 | 코디네이터 | 플러그인 배포 | PR 뒤(운영 단계 4) |

자동 테스트 대응: REQ3 은 `career-os/scripts/position-recommender/two-run.test.ts`, REQ4 는 `career-os/scripts/study-topic-recommender/two-run.test.ts` 가 같은 절차를 본다. 위 표의 PR 전 행은 번들 파일을 실제로 실행해 확인하고 결과를 PR 본문에 남긴다.

## 검증

```bash
cd career-os/plugin && bun run scripts/agent-skills.ts --check
cd career-os/plugin && bun run typecheck
bun test ./career-os/plugin ./career-os/scripts/agent-usage ./career-os/scripts/interview-drill ./career-os/scripts/plugin-local
bun test ./career-os/scripts
bunx tsc --noEmit -p .
cd career-os/services/career-backend && npm run typecheck
grep -n "CAREER_BACKEND" career-os/plugin/agent-skills -r ; test $? -eq 1
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/skills/position-recommender/SKILL.md` | 수정 |
| `career-os/plugin/skills/position-recommender/references/failures.md` | 수정 |
| `career-os/plugin/skills/study-collection/SKILL.md` | 수정 |
| `career-os/plugin/skills/study-collection/references/execution.md` | 수정 |
| `career-os/plugin/skills/study-collection/references/source-management.md` | 수정 |
| `career-os/plugin/agent-skills/position-recommender/SKILL.md` | 수정 (생성) |
| `career-os/plugin/agent-skills/position-recommender/references/failures.md` | 수정 (생성) |
| `career-os/plugin/agent-skills/study-collection/SKILL.md` | 수정 (생성) |
| `career-os/plugin/agent-skills/study-collection/references/execution.md` | 수정 (생성) |
| `career-os/plugin/agent-skills/study-collection/references/source-management.md` | 수정 (생성) |
| `career-os/plugin/scripts/agent-skills.ts` | 수정 (바꿀 문장이 달라지면) |
| `career-os/plugin/connector.json` | 수정 |
| `career-os/plugin/package.json` | 수정 (버전) |
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 (버전) |
| `career-os/plugin/dist/career-local.js` | 수정 (빌드) |
| `career-os/plugin/dist/career-mcp.js` | 수정 (빌드, 내용이 달라질 때만) |
| `career-os/docs/features/career-migrate/schedule-prompts.md` | 신규 |
| `career-os/docs/flow.md` | 수정 |
| `career-os/docs/data-schema.md` | 수정 |
| `career-os/docs/code-architecture.md` | 수정 |
| `career-os/AGENTS.md` | 수정 |
| `career-os/README.md` | 수정 |
| `career-os/plugin/scripts/agent-skills.test.ts` | 수정 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/plugin/scripts/local-bundle.test.ts` | 수정 |
| `career-os/plugin/scripts/local-skills.test.ts` | 수정 |
