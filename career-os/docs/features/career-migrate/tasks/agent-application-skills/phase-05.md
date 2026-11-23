# Phase 05. 플러그인 버전을 올리고 번들과 책임 문서를 맞춘다

**Execution profile**: standard

## 목표

플러그인을 0.14.0 으로 올리고 번들을 다시 만든다. 지원 준비가 비서 대화에서 돌고 노트북 전용 스킬, 작업본 동기화, Backend 사용량 기록이 없다는 것을 책임 문서와 ADR 에 반영한다.

**범위 외**: `services/career-backend` 와 그 문서 절(5단계). 운영 배포와 운영 확인(코디네이터).

## 컨텍스트

- 버전은 `career-os/plugin/.claude-plugin/plugin.json`, `career-os/plugin/package.json`, `career-os/plugin/src/server.ts` 의 서버 version 세 곳에 있다(`git log -- career-os/plugin/dist` 의 앞 버전 올림 커밋이 같은 세 곳을 고쳤다). `career-os/.claude-plugin/marketplace.json` 은 설명만 갖는다.
- 책임 문서는 `career-os/docs/flow.md`, `data-schema.md`, `code-architecture.md`, `prd.md`, `career-os/AGENTS.md`, `career-os/README.md` 다. ADR 색인은 `career-os/docs/adr/INDEX.md` 이고 대체된 결정은 상태 칸에 적는다(ADR-146, ADR-147 이 쓴 방식).
- `career-os/scripts/candidate-context/skill_boundary.test.ts` 가 `career-os/AGENTS.md` 의 공통 프로필 줄을 검사한다.

**요구사항**: REQ8, REQ9

**근거 문서**: `career-os/docs/adr/ADR-141-일반-에이전트가-읽는-스킬은-plugin-의-agent-skills-에-두고-따로-올린다.md`, `career-os/docs/adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md`, `career-os/docs/adr/ADR-147-후보자-맥락-문서는-비서의-기억이-프로필-원고는-작업-폴더-파일이-갖는다.md`

## 의도 메모

- 새 스킬 넷이 더해지고 실행기 명령이 빠지므로 마이너 버전을 올린다.
- 문서에서 지운 것의 이력을 길게 남기지 않는다. 결정의 이유는 ADR 하나에 둔다.
- Backend 를 부르는 노트북 CLI 와 Backend 절은 5단계가 지우므로 이 phase 에서 고치지 않는다. 다만 「노트북 전용 스킬이 이 CLI 를 쓴다」 처럼 사실이 아니게 된 문장은 고친다.

## 작업 항목

### 1. 버전과 번들

`plugin.json`(설명에서 「Claude Code 전용 스킬은 비서용으로 옮기기 전까지 쓰지 않는다」 문장을 지우고 지원 준비 스킬을 더한다), `package.json`, `server.ts` 를 0.14.0 으로 올리고 `cd career-os/plugin && bun run build` 를 실행한다. `marketplace.json` 의 설명을 맞춘다.

### 2. ADR

`career-os/docs/adr/ADR-148-지원-준비는-비서의-셸-실행-공간에서-하고-작업본-동기화와-노트북-전용-스킬을-두지-않는다.md`(신규): 결정(스킬 여덟이 모두 `agent-skills/` 원본, 지원 폴더와 `library/`, `state/verified-claims/` 는 작업 폴더, 공통 프로필은 기억 제목 「커리어: 지원서 공통 프로필」, Chrome 이 없으면 HTML, 사용량은 노트북 파일), 기각한 대안(사본 생성 유지, 작업본 동기화 유지), 결과. `INDEX.md` 에 줄을 더하고 대체되는 결정(작업본 동기화 ADR-108 과 그 앞뒤 결정, ADR-133 의 사용량 기록 부분, ADR-136, ADR-138 의 작업본 부분, ADR-141 의 사본 부분)을 상태 칸에 적는다. 이미 다른 ADR 이 대체했다고 적힌 줄은 다시 고치지 않는다. 어느 ADR 이 해당하는지는 `INDEX.md` 와 각 ADR 본문을 읽고 정한다.

### 3. 책임 문서

- `flow.md`: 「비공개 작업본 동기화」 절을 지운다. 이 절의 첫 문장을 검사하는 `career-os/scripts/study-topic-recommender/flow_doc.test.ts` 를 함께 지운다(검사 대상이 사라진다). 「지원서 공통 프로필」 을 기억 절차로 바꾼다. 「Claude Code 에서 …」 절 셋과 `sync-profile` 절을 지우거나 비서 대화 흐름으로 바꾼다. 「사용량 수집」 을 파일 흐름으로 바꾼다.
- `data-schema.md`: 「커리어 작업 폴더」 표에 `applications/<회사>/<직무>/`, `library/resume-logos/`, `state/verified-claims/`, 지원 준비 리포트 이름을 더한다. `context/application-profile.md` 는 쓰고 나서 지우는 사본이라고 적는다. 「후보자 맥락 문서」 표의 읽는 스킬과 공통 프로필 문장을 고친다. `sync-profile` 절의 사용량 table 설명을 「노트북 사용량 파일」(자리, 꼴, 덮어쓰지 않는 규칙)로 바꾼다. 「로컬 실행기 환경 변수」 에서 `usage` 의 Backend 값, `FOS_ASSISTANT_*`, `~/.fos-career/workspace` 문장을 고치고 `CAREER_AGENT_USAGE_FILE` 을 더한다.
- `code-architecture.md`: 「스킬 폴더」, 「비공개 작업본 동기화」, 「지원서 공통 프로필」, `sync-profile`, 실행기 표(`workspace`, `usage`, `application-profile`), `agent-skills.ts` 설명, 검증 명령 줄.
- `prd.md`, `README.md`, `career-os/AGENTS.md`: 스킬 자리와 실행 환경, 공통 프로필과 맥락 문서를 읽는 길. `AGENTS.md` 의 조회 표는 「기억 제목」 으로 적고 `read_application_profile.ts` 를 지운다.
- `career-os/scripts/candidate-context/skill_boundary.test.ts`: `AGENTS.md` 검사를 「공통 프로필 줄이 기억 제목 「커리어: 지원서 공통 프로필」 을 적고 `read_application_profile.ts` 를 적지 않는다」 로 바꾼다.
- `.claude/docs-audit-overlay.md` 와 루트 `docs/code-architecture.md` 에 `plugin/skills` 나 작업본 동기화 문장이 있으면 고친다.

### 4. 앞 계획 표시

`career-os/docs/features/career-migrate/tasks/local-interview-and-plugin/index.json` 의 `deferred` 첫 항목 `after` 에 「운영 확인이 끝나(2026-11-23) 계획 tasks/agent-application-skills 로 옮겼다」 를 적는다.

### 5. 로컬 실행 확인

빈 임시 작업 폴더에서 아래 「인수 검증 계획」 의 첫 줄을 실행하고 결과를 PR 본문에 남긴다.

## 인수 검증 계획

개발 테스트(`bun test`)는 각 phase 의 「검증」 절이 갖는다. 아래는 실제로 실행해 관측하는 사례다.

| 요구사항 | 준비 조건 | 실행 절차 | 기대 결과 | 실행 환경 | 실행 담당 | 선행 조건 | 시점 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ8 | 빈 임시 폴더를 `CAREER_WORKSPACE_ROOT` 로 준다. 그 아래 `applications/example/backend/evidence/` 에 꾸며 낸 `status.md`, `fit.md`, `strategy.md`, `resume-draft.md` 를 둔다 | `application-package-writer` 와 `resume-preparer` 스킬이 적은 순서대로 번들 실행기를 부른다: `workspace paths --json`, `package validate`, `package render`, `package report`, `resume export --html-only`, `resume check-html`, `package report` | `paths` 의 `root` 가 임시 폴더다. 지원 폴더에 `application-package.html` 과 `review/resume.html` 이, `reports/` 에 날짜가 든 사본 둘이 생긴다. `resume export` 가 `PDF 도구 없음` 을 내고 0 으로 끝난다 | 로컬 임시 폴더, `dist/career-local.js` | worker | 없음 | PR 전 |
| REQ8 | 위와 같은 폴더, Chrome 이 있는 개발 기기 | `resume export` 를 `--html-only` 없이 실행한다 | 지원 폴더에 `resume.pdf` 가 생긴다 | 로컬 임시 폴더 | worker | 없음 | PR 전 |
| REQ9 | 가짜 `HOME`(임시 폴더). 환경에 `CAREER_BACKEND_*` 가 없다 | `bun --no-env-file career-os/scripts/agent-usage/collect_usage.ts` 를 두 번 실행하고 `git ls-files career-os/plugin/skills career-os/scripts/career-workspace career-os/scripts/application-profile` 을 본다 | 두 실행 모두 연결 오류 없이 끝난다(세션 기록이 없는 가짜 HOME 이라 `NO_SESSIONS` 이거나, 기록이 있으면 첫 실행이 `CREATED`, 둘째가 `UP_TO_DATE`). 세 경로에 추적 파일이 없다 | 로컬 | worker | 없음 | PR 전 |
| REQ8 | 운영에 0.14.0 배포. 기억에 맥락 문서 셋(현재 경력, 역할 선호, 지원 상태)이 있다 | 커리어 에이전트 대화에서 지원 패키지, 이력서 준비, 이력서 검토를 한 번씩 부른다 | 결과가 작업 폴더의 지원 폴더에 남고 HTML 이 「내 파일」 에 생긴다. 이력서는 실행 공간에 Chrome 이 있으면 PDF, 없으면 HTML 이다 | 운영 | 코디네이터 | PR 머지와 배포 | 머지 뒤 |
| REQ8 | 위 지원 패키지가 만든 `evidence/interview-questions.json` | 커리어 에이전트 대화에서 공고별 면접 질문 연습을 부른다 | 그 공고의 질문이 나오고 연습 기록이 다음 대화의 복습 상태에 보인다(이 스킬은 HTML 결과가 없다) | 운영 | 코디네이터 | PR 머지와 배포 | 머지 뒤 |
| REQ8 | 기억의 「커리어: 지원 상태」 를 잠시 다른 제목으로 바꾼다 | 지원 패키지를 부른다 | 실행기를 부르지 않고 어느 제목이 없는지 알린 뒤 `career-connector` 를 안내하고 끝낸다. 웹 검색으로 대신하지 않는다 | 운영 | 코디네이터 | PR 머지와 배포 | 머지 뒤 |
| REQ8 | 기억에 「커리어: 지원서 공통 프로필」 이 없다 | 지원 패키지에서 지원서 입력 준비를 요청한다 | 지원서 입력만 준비하지 않고 그 제목의 문서를 만들라고 안내한다. 나머지 단계는 이어 간다 | 운영 | 코디네이터 | PR 머지와 배포 | 머지 뒤 |
| REQ9 | 노트북 | `launchd` 작업을 다시 설치하고 수집기를 한 번 실행한다 | Backend 를 부르지 않고 노트북 사용량 파일이 생긴다 | 노트북 | 코디네이터 | PR 머지 | 머지 뒤 |

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
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 |
| `career-os/plugin/package.json` | 수정 (버전) |
| `career-os/plugin/src/server.ts` | 수정 (버전) |
| `career-os/plugin/dist/career-local.js` | 수정 (빌드) |
| `career-os/plugin/dist/career-mcp.js` | 수정 (빌드) |
| `career-os/.claude-plugin/marketplace.json` | 수정 |
| `career-os/docs/adr/ADR-148-지원-준비는-비서의-셸-실행-공간에서-하고-작업본-동기화와-노트북-전용-스킬을-두지-않는다.md` | 신규 |
| `career-os/docs/adr/INDEX.md` | 수정 |
| `career-os/docs/flow.md` | 수정 |
| `career-os/docs/data-schema.md` | 수정 |
| `career-os/docs/code-architecture.md` | 수정 |
| `career-os/docs/prd.md` | 수정 |
| `career-os/AGENTS.md` | 수정 |
| `career-os/README.md` | 수정 |
| `career-os/scripts/candidate-context/skill_boundary.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/flow_doc.test.ts` | 삭제 |
| `career-os/docs/features/career-migrate/tasks/local-interview-and-plugin/index.json` | 수정 |
