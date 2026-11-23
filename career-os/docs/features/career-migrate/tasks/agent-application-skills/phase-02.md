# Phase 02. 지원 준비 스킬 넷을 비서용 원본으로 옮기고 노트북 전용 스킬 디렉터리를 지운다

**Execution profile**: standard

## 목표

`application-package-writer`, `resume-preparer`, `resume-review`, `interview-question-prep` 를 `career-os/plugin/agent-skills/` 의 원본으로 옮겨 비서 에이전트의 셸 실행 공간에서 돌게 한다. `career-os/plugin/skills/`(노트북 전용 스킬과 `sync-profile`)를 지우고, 사본 생성기를 다른 실행 환경 전용 표현 검사기로 바꾼다.

**범위 외**: 작업본 동기화 코드와 `workspace begin|finish`, `application-profile` 실행기 삭제(phase 04). 사용량 기록(phase 03). 버전과 책임 문서(phase 05).

## 컨텍스트

- 비서용 스킬은 `career-os/plugin/agent-skills/<이름>/` 에 `SKILL.md`, `references/`, `templates/` 만 둔다. fos-assistant 가 그 밖의 파일을 복사하지 않는다(`career-os/plugin/scripts/agent-skills.test.ts` 의 상한: 스킬당 파일 20개, 파일당 100000자).
- 지금 `position-recommender`, `study-collection` 은 `plugin/skills/` 원본에서 `career-os/plugin/scripts/agent-skills.ts` 가 만든 사본이고, `interview-practice`, `career-connector` 는 `agent-skills/` 가 원본이다(`AGENT_SKILL_ORIGINALS`). `plugin/skills/` 를 지우면 모두 원본이 된다.
- 실행 환경 절의 문장은 `agent-skills/interview-practice/SKILL.md` 의 「실행 환경」 을 본으로 삼는다. 맥락 문서 절차는 `agent-skills/position-recommender/SKILL.md` 의 「시작 전: 맥락 문서」, 결과를 「내 파일」 에 넣는 절차는 같은 문서의 「결과와 공개 경계」 가 본이다.
- 맥락 문서의 기억 제목은 `career-os/docs/data-schema.md` 의 「후보자 맥락 문서」 가 갖는다: 「커리어: 현재 경력」(`career-status`), 「커리어: 역할 선호」(`position-preferences`), 「커리어: 지원 상태」(`application-state`).
- `connector.json` 의 `agent_skills.sandbox_env` 에 스킬 이름이 있어야, 셸 설정이 그 env 를 모두 넘기는 에이전트에만 스킬이 설치된다.

**요구사항**: REQ8, REQ9(스펙 DECISION2, DECISION5, DECISION7, DECISION12, DECISION22, 설계 DECISION9)

**근거 문서**: `career-os/docs/adr/ADR-141-일반-에이전트가-읽는-스킬은-plugin-의-agent-skills-에-두고-따로-올린다.md`, `career-os/docs/adr/ADR-147-후보자-맥락-문서는-비서의-기억이-프로필-원고는-작업-폴더-파일이-갖는다.md`

## 의도 메모

- 본문의 판단 기준(적합도 판정, 주장 검증 모델, 채용 리뷰, 작성 취향)은 고치지 않고 옮긴다. 바꾸는 것은 실행 환경, 데이터를 읽는 길, 결과를 전달하는 길뿐이다.
- 작업본 동기화 문장(`workspace begin|finish`)은 모두 지운다. 지원 폴더는 작업 폴더의 `applications/<회사>/<직무>/` 이고 `<CAREER_LOCAL> workspace paths --json` 이 `root` 와 `evidenceDir` 를 낸다.
- 맥락 문서 규칙은 이미 있는 비서용 스킬과 같다. 제목이 정확히 같은 기억만 쓰고, 없으면 실행기를 부르지 않고 `career-connector` 스킬의 「맥락 문서 읽고 고치기」 를 안내하고 끝내며, 같은 제목이 둘 이상이면 멈춘다. 실행기가 실패하면 웹 검색이나 직접 만든 결과로 대신하지 않는다.
- 지원서 공통 프로필(이름, 연락처, 병역, 학력, 정확한 재직 기간)은 기억 제목 「커리어: 지원서 공통 프로필」 로 읽어 작업 폴더 `context/application-profile.md` 에 옮긴다(설계 REQ8 줄). `evidence/application-form.json` 을 만들 때만 읽고, 쓰고 나면 그 파일을 지운다(연락처가 든 사본을 남기지 않는다. ADR-136 의 「뒤처질 사본이 없다」 를 지킨다). 그 제목의 기억이 없으면 지원서 입력 준비만 하지 않고, 기억 화면에서 그 제목으로 문서를 만들라고 안내한다(`career-connector` 는 이 문서를 고치지 않는다). 다른 단계는 이어 간다.
- 다른 스킬의 문서는 `skill_view` 에 스킬 이름과 `references/<파일>` 을 주어 읽는다고 적는다. 다른 스킬에 일을 넘기는 스킬(`application-package-writer` → `resume-preparer`, `resume-review` → `resume-preparer`·`application-package-writer`, `interview-question-prep` → `interview-practice`)은 실행 환경 절의 「절차는 이 문서와 이 스킬의 `references/` 가 전부다」 뒤에 「아래에서 이름으로 가리킨 다른 스킬의 문서만 예외다」 를 붙인다.
- 앞머리 `description` 에서 「Claude Code 에서만 돈다」 를 지우고, 요청 문구(「지원 준비」, 「이력서 준비」, 「이력서 평가」, 「공고별 면접 질문」)가 앞 50자 안에 오게 고쳐 쓴다. 비서의 스킬 목록이 description 을 약 50자에서 자른다.
- 실행 공간에서 할 수 없는 확인(PDF 실제 화면, PDF 쪽 번호와 해시)은 「브라우저 도구가 있으면 확인하고, 없으면 확인하지 못했다고 적는다. PDF 가 없으면 HTML 을 기준으로 검토한다」 로 바꾼다.
- 별도 검토자(하위 에이전트)에게 맡기던 검토는 「쓴 뒤 원고를 닫고, 파일을 처음부터 다시 읽어 검토한다. 독립 검토가 아니었다고 기록한다」 로 바꾼다. 실행 공간에 하위 에이전트가 없다. `resume-review` 의 「독립 검토를 실행하지 않았으면 블라인드 리뷰라고 기록하지 않는다」 는 그대로 둔다.
- 다른 스킬의 참조 문서는 `](../` 링크 대신 「`resume-preparer` 스킬의 `references/hard-review.md`」 처럼 스킬 이름과 경로로 적는다. 설치된 자리에서 상대 경로가 유지된다는 보장이 없다.
- HTML 결과는 `<CAREER_LOCAL> package report <지원 디렉터리> <파일>` 로 작업 폴더 `reports/` 에 사본을 만들고, 그 명령의 `리포트 사본:` 줄 경로를 `file_space_put` 으로 「내 파일」 에 넣는다(스펙 DECISION22). 넣기는 건너뛰지 않고, 도구가 없거나 실패하면 까닭을 최종 답의 「내 파일」 줄에 적는다. 대상은 `application-package.html`, `review/resume.html`(PDF 가 있으면 `resume.pdf` 도), `review/resume-review.html` 이다.
- `resume-review` 는 6단계 끝에 `review/resume-scorecard.md` 의 내용(검토한 파일과 버전, 문제 문장, 판정, 남은 질문)을 `review/resume-review.html` 로 직접 써서 위 방법으로 넣는다. HTML 을 만드는 실행기는 두지 않는다. 지금은 요청할 때만 만들던 리포트를 매번 만드는 것이다(REQ8 의 인수 조건).
- `interview-question-prep` 는 HTML 결과가 없다. 연습 기록과 개인 질문이 작업 폴더 SQLite 에 남고, 읽는 질문 파일이 지원 폴더의 `evidence/interview-questions.json` 이다. REQ8 의 「HTML 결과」 는 HTML 을 내는 스킬 셋에 해당한다고 읽었고 PR 본문 「결정」 에 적는다.
- `evals/` 는 비서에 복사되지 않으므로 스킬 디렉터리에서 빼 `career-os/scripts/` 아래로 옮긴다.

## 작업 항목

### 1. `career-os/plugin/agent-skills/application-package-writer/`

`plugin/skills/application-package-writer/` 의 `SKILL.md` 와 `references/` 여섯을 옮기고 아래만 고친다.

- 「실행 환경」: 비서용 문장으로 바꾼다. `CAREER_BACKEND_*`, `FOS_ASSISTANT_*` 줄을 지운다.
- 「비공개 작업본 동기화」 절을 「작업 폴더」 절로 바꾼다(`workspace paths --json`, 지원 폴더 자리).
- 맥락 문서: `get_context_document` 를 기억 절차로 바꾼다. 「커리어: 현재 경력」, 「커리어: 역할 선호」, 「커리어: 지원 상태」 셋을 읽고(`references/fit-judgment.md` 의 근거 수집 표가 셋을 쓴다) 그 표도 같은 말로 고친다.
- 공통 프로필: `application-profile get` 명령과 실패 표를 지우고 위 의도 메모의 기억 절차로 바꾼다.
- 인자 줄의 `/application-package-writer ...` 호출 예시를 「공고 링크나 회사와 직무 이름을 대화로 받는다」 로 바꾼다.
- 8단계: 세션 닫고 다시 여는 명령을 지운다. `package validate`, `package render` 뒤에 「내 파일」 에 넣는 절차를 더한다.
- `references/evidence-source-freshness.md`: 「대상 셋」 표에서 홈서버 작업본 줄을 지우고 맥락 문서와 공통 프로필을 기억으로 고친다. 「지원서 공통 프로필을 경로로 확인하지 않는 이유」 절은 기억에서 읽는다는 내용으로 줄인다. `workspace begin` 을 든 비유 문장을 지운다.
- `references/full-document-review.md`, `candidate-interview-questions.md`: 하위 에이전트와 「질문 도구」 문장을 위 의도 메모대로 고친다.

### 2. `career-os/plugin/agent-skills/resume-preparer/`

`SKILL.md` 와 `references/` 일곱을 옮기고 아래만 고친다.

- 「실행 환경」 과 1단계의 `workspace begin`, 7단계의 `workspace finish` 를 지우고 작업 폴더 문장으로 바꾼다. 명령은 `<CAREER_LOCAL>` 로 적는다.
- 4단계: `resume export` 의 stdout 에 `PDF 도구 없음` 이 나오면 PDF 없이 HTML 만 만들어진 것이다. 이때 6단계까지 하고 7단계 제출 묶음은 만들지 않으며, HTML 을 「내 파일」 에 넣고 「PDF 는 실행 공간에 도구가 없어 만들지 못했다」 고 알린다. PDF 가 만들어졌으면 PDF 와 HTML 을 함께 넣는다.
- `references/candidate-context.md`: `get_context_document`, `save_context_document`, `expectedVersion`, `nbrain`, Backend 문장을 기억 절차와 `career-connector` 안내로 바꾼다.
- `references/hard-review.md`, `resume-design.md`: 하위 에이전트 문장과 「작업본」, 「저장소 세션」 문장을 고친다.

### 3. `career-os/plugin/agent-skills/resume-review/SKILL.md`

실행 환경 문장(Codex, Claude Code)을 비서용으로 바꾼다. `](../` 링크를 모두 스킬 이름과 경로로 바꾼다(`grep -c '](\.\./'` 로 0 인지 본다). `sources/fos-study/task/` 를 `evidenceDir` 로, `korean-check` 문장을 「한국어 산출물은 문장을 다시 읽어 점검한다」 로 바꾼다. 6단계 끝에 위 의도 메모의 리포트 만들기와 「내 파일」 넣기를 더한다. 이 스킬은 맥락 문서와 실행기 가운데 `package report` 만 쓰므로 실행 환경 절(실행기 명령, 스킬 파일을 고치지 않는다)을 다른 스킬과 같은 문장으로 둔다.

### 4. `career-os/plugin/agent-skills/interview-question-prep/`

`SKILL.md` 와 `references/` 둘을 옮긴다. 작업본 준비와 끝 절을 지우고, 맥락을 기억에서 읽으며, 「4. 연습과 기록」 이 `interview-practice` 스킬의 「3. 연습과 판정」 과 「4. 기록」 을 가리키게 한다(「대화용」 낱말을 지운다). `references/source-discovery.md` 의 실행 폴더는 작업 폴더 `runs/` 아래에 만들고, `get_interview_questions` 와 `save_personal_question` 을 `<CAREER_LOCAL> interview select`, `interview personal add --file` 로 바꾼다. 같은 문서의 「수집 결과가 모두 비었을 때만 웹 검색으로 등록 출처의 공개 상태를 확인한다」 는 「실행기가 실패하면 웹으로 대신하지 않는다」 와 헷갈리지 않게, 「`collect` 가 성공했는데 후보가 0건일 때만 등록 출처가 열려 있는지 확인한다. 질문을 웹에서 지어 오지 않는다」 로 고친다.

### 5. 이미 있는 비서용 스킬 넷

`position-recommender`, `study-collection`, `interview-practice`, `career-connector` 의 「플러그인 폴더의 `skills/` 는 다른 실행 환경용 원본이니 읽지 않는다.」 를 「플러그인 폴더의 다른 파일에서 절차를 찾지 않는다.」 로 바꾼다. `agent-skills.test.ts` 의 「실행기를 부르는 스킬은 플러그인 폴더의 원본을 읽지 않고 이 스킬의 절차만 따르라고 적는다」 가 찾는 문장도 함께 바꾼다. 그 밖의 문장(스킬 파일을 고치지 않는다, 맥락 문서 규칙, 실행기 실패 규칙)은 그대로인지 `git diff` 로 확인한다.

### 6. `career-os/plugin/skills/` 삭제와 `evals` 이동

- `career-os/plugin/skills/` 전체를 지운다(`sync-profile` 과 그 폼 스크립트 포함).
- `resume-preparer/evals/evals.json`, `latest-results.json` 은 `career-os/scripts/resume-preparer/evals/` 로, `application-package-writer/evals/evals.json` 은 `career-os/scripts/application-package/evals/` 로 옮긴다. `career-os/scripts/resume-preparer/evaluate_skill.ts` 가 스킬 본문은 `plugin/agent-skills/resume-preparer`, 사례는 옮긴 자리에서 읽게 고친다.

### 7. `career-os/plugin/scripts/agent-skills.ts`

사본 생성(`SOURCE_DIRECTORY`, `AGENT_SKILL_COPIES`, `renderAgentSkill`, `writeAgentSkills`, `SHELL_ENVIRONMENT`)을 지운다. 남기는 것은 `AGENT_SKILLS_DIRECTORY`, `HOST_ONLY_PATTERNS`, `hostOnlyFindings`, `AGENT_SKILLS`(스킬 이름 여덟의 목록), `agentSkillProblems()`(목록과 디렉터리가 같은지, 스킬마다 `SKILL.md` 가 있는지, 모든 파일에 다른 실행 환경 전용 표현이 없는지)다. `--check` 없이 실행해도 검사만 한다. 파일을 쓰지 않는다.

### 8. `career-os/plugin/connector.json`

- `agent_skills.sandbox_env` 에 새 스킬 넷을 `["CLAUDE_PLUGIN_ROOT", "CAREER_WORKSPACE_ROOT"]` 로 더한다.
- `get_wanted_resume`, `update_wanted_resume` 설명의 「노트북 Claude Code 의 프로필 갱신이나 원티드 화면에서 직접 고치기를 안내합니다」 를 「원티드 화면에서 직접 고치기를 안내합니다」 로 고친다. `career-os/plugin/src/errors.ts` 의 `CAREER_WANTED_PAGE_CHANGED`, `CAREER_BROWSER_UNREACHABLE` 문구에서도 노트북 Claude Code 안내를 지운다. 도구 설명이 MCP 번들에 들어가므로 `cd career-os/plugin && bun run build` 로 번들을 다시 만든다.

### 9. 테스트

- `career-os/plugin/scripts/agent-skills.test.ts`: 「사본이 원본에서 만든 것과 같다」 를 「`agent-skills/` 의 디렉터리가 `AGENT_SKILLS` 와 같고 문제 목록이 비었다」 로 바꾼다. 맥락 문서 제목 표에 새 스킬을 더한다(`application-package-writer`: 현재 경력, 역할 선호, 지원 상태 / `resume-preparer`: 현재 경력, 역할 선호 / `interview-question-prep`: 현재 경력, 지원 상태). `resume-review` 는 맥락 문서를 직접 읽지 않으므로 표에 빈 목록으로 두고(표의 키가 전체 스킬 목록과 같아야 한다), 빈 목록인 스킬은 기억 절차 문장 검사를 건너뛴다. 「맥락 문서가 없으면 실행기를 부르지 않는다」 는 맥락 문서를 읽는 스킬에만, 「실행기가 실패하면 대신하지 않는다」 와 「스킬 파일은 고치지 않는다」 는 여덟 모두에 건다.
  새 검사: 「`plugin/skills` 디렉터리가 없다」, 「비서용 스킬은 `workspace begin`, `workspace finish`, `<CAREER_LOCAL> application-profile`, `](../` 를 담지 않는다」, 「description 앞 50자 안에 요청 문구가 있다」, 「다른 스킬 문서를 가리키는 스킬은 `skill_view` 를 적는다」, 「HTML 결과를 내는 스킬 셋이 `file_space_put` 과 `<CAREER_LOCAL> package report` 를 적는다」, 「`resume-preparer` 가 `PDF 도구 없음` 을 적는다」, 「문서에 적은 실행기 이름이 모두 번들의 실제 실행기다」(번들 `help` 출력과 대조), 「본문이 가리키는 `references/` 파일이 모두 있다」, 「`resume` 과 `package` 하위 명령이 번들 사용법에 있다」.
- `career-os/plugin/scripts/local-skills.test.ts` 를 지운다. 남길 검사는 위 새 검사로 옮겼다.
- `career-os/plugin/scripts/connector-config.test.ts`: 「원티드 도구 설명이 …」 의 `toContain("노트북 Claude Code")` 두 줄을 `not.toContain` 으로 바꾼다. `career-os/plugin/src/tools.test.ts` 나 `wanted/tools.test.ts` 가 위 오류 문구를 단언하면 맞춘다.
- `career-os/scripts/profile/sync_profile_skill_doc.test.ts` 를 지운다(검사 대상이 사라진다). 그 파일의 「`AGENTS.md` 가 `library/profiles/` 를 자리로 적지 않는다」 는 `career-os/scripts/candidate-context/skill_boundary.test.ts` 로 옮긴다.
- `skill_boundary.test.ts`: 스킬 목록에서 `sync-profile` 을 빼고 `resume-review`, `interview-question-prep` 를 더한다. `plugin/skills` 자리 탐색을 지운다. 「application-package-writer 는 공통 프로필을 CLI 로 읽게 한다」 를 「기억 제목 「커리어: 지원서 공통 프로필」 로 읽어 `context/application-profile.md` 에 옮기게 한다」 로 바꾼다. `AGENTS.md` 의 공통 프로필 줄 검사는 phase 05 가 문서를 고칠 때 함께 고친다(이 phase 에서는 그대로 통과한다).
- `application-package-writer` 의 `evals.json` 은 읽는 실행기가 없지만 스킬을 고칠 때 사람이 직접 돌려 보는 사례라 옮겨 둔다. 옮긴 `evals.json` 에 `/Users/` 경로가 없는지는 `career-os/scripts/resume-preparer/evals.test.ts`(신규)가 두 파일을 함께 본다.

### 10. 그 밖의 참조

- `career-os/public/question-bank/MAINTENANCE.md` 의 `source-discovery.md` 링크를 새 자리로 고친다.
- `career-os/plugin/src/wanted/page.ts` 머리 주석의 `skills/sync-profile/scripts` 를 「지운 노트북 스킬의 폼 스크립트」 로 고친다.
- `career-os/plugin/agent-skills/README.md`: 원본과 사본 두 갈래 표를 지우고 모두 원본이라고 적는다.

## 검증

```bash
cd career-os/plugin && bun run scripts/agent-skills.ts --check
bun test ./career-os/plugin ./career-os/scripts/candidate-context ./career-os/scripts/resume-preparer ./career-os/scripts/application-package ./career-os/scripts/profile
cd career-os/plugin && bun run typecheck
bunx tsc --noEmit -p .
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/agent-skills/application-package-writer/SKILL.md` | 신규 |
| `career-os/plugin/agent-skills/application-package-writer/references/application-quality-rubric.md` | 신규 |
| `career-os/plugin/agent-skills/application-package-writer/references/candidate-interview-questions.md` | 신규 |
| `career-os/plugin/agent-skills/application-package-writer/references/evidence-source-freshness.md` | 신규 |
| `career-os/plugin/agent-skills/application-package-writer/references/fit-judgment.md` | 신규 |
| `career-os/plugin/agent-skills/application-package-writer/references/full-document-review.md` | 신규 |
| `career-os/plugin/agent-skills/application-package-writer/references/growth-judgment.md` | 신규 |
| `career-os/plugin/agent-skills/resume-preparer/SKILL.md` | 신규 |
| `career-os/plugin/agent-skills/resume-preparer/references/candidate-context.md` | 신규 |
| `career-os/plugin/agent-skills/resume-preparer/references/claim-model.md` | 신규 |
| `career-os/plugin/agent-skills/resume-preparer/references/hard-review.md` | 신규 |
| `career-os/plugin/agent-skills/resume-preparer/references/resume-design.md` | 신규 |
| `career-os/plugin/agent-skills/resume-preparer/references/resume-taste.md` | 신규 |
| `career-os/plugin/agent-skills/resume-preparer/references/resume-writing-style.md` | 신규 |
| `career-os/plugin/agent-skills/resume-preparer/references/scoring-rubric.md` | 신규 |
| `career-os/plugin/agent-skills/resume-review/SKILL.md` | 신규 |
| `career-os/plugin/agent-skills/interview-question-prep/SKILL.md` | 신규 |
| `career-os/plugin/agent-skills/interview-question-prep/references/behavioral-scoring.md` | 신규 |
| `career-os/plugin/agent-skills/interview-question-prep/references/source-discovery.md` | 신규 |
| `career-os/plugin/agent-skills/position-recommender/SKILL.md` | 수정 |
| `career-os/plugin/agent-skills/study-collection/SKILL.md` | 수정 |
| `career-os/plugin/agent-skills/interview-practice/SKILL.md` | 수정 |
| `career-os/plugin/agent-skills/career-connector/SKILL.md` | 수정 |
| `career-os/plugin/agent-skills/README.md` | 수정 |
| `career-os/plugin/skills/**` | 삭제 |
| `career-os/scripts/resume-preparer/evals/evals.json` | 신규 |
| `career-os/scripts/resume-preparer/evals/latest-results.json` | 신규 |
| `career-os/scripts/application-package/evals/evals.json` | 신규 |
| `career-os/scripts/resume-preparer/evals.test.ts` | 신규 |
| `career-os/scripts/resume-preparer/evaluate_skill.ts` | 수정 |
| `career-os/plugin/scripts/agent-skills.ts` | 수정 |
| `career-os/plugin/scripts/agent-skills.test.ts` | 수정 |
| `career-os/plugin/scripts/local-skills.test.ts` | 삭제 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/plugin/connector.json` | 수정 |
| `career-os/plugin/dist/career-mcp.js` | 수정 (빌드) |
| `career-os/plugin/src/wanted/page.ts` | 수정 (주석) |
| `career-os/plugin/src/errors.ts` | 수정 |
| `career-os/plugin/dist/career-local.js` | 수정 (빌드) |
| `career-os/scripts/profile/sync_profile_skill_doc.test.ts` | 삭제 |
| `career-os/scripts/candidate-context/skill_boundary.test.ts` | 수정 |
| `career-os/public/question-bank/MAINTENANCE.md` | 수정 |
