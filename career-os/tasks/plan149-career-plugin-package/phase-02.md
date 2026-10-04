# Phase 02. application-package-writer 를 plugin 스킬로 옮긴다

**Execution profile**: standard

## 목표

저장소 스킬 `career-os/.claude/skills/application-package-writer/` 의 문서(`SKILL.md`, `references/`, `evals/`)를 `career-os/plugin/skills/application-package-writer/` 로 옮기고, 저장소 경로와 저장소 세션을 전제한 문장을 plugin 로컬 실행기와 MCP 도구를 부르는 문장으로 바꾼다.
phase 01 이 만든 `package`, `application-profile`, `workspace` 실행기를 이 스킬이 부른다.

**범위 외**: `resume-preparer` 저장소 사본 삭제와 `resume-preparer` evals 이동, 문서 갱신(phase 03).

## 컨텍스트

- 대화용과 Claude Code 전용 스킬의 자리는 `career-os/docs/adr/ADR-139-plugin-의-대화용-스킬과-claude-code-전용-스킬을-디렉터리로-나눈다.md` 가 정한다. 로컬 실행기를 부르는 스킬이므로 `career-os/plugin/skills/` 에 두고 본문 첫머리에 Claude Code 에서만 돈다고 적는다.
- 선례는 `career-os/plugin/skills/resume-preparer/SKILL.md` 다. `## 실행 환경` 절이 실행기 명령 `bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js"` 와 `<CAREER_LOCAL>` 표기를 설명한다. 이 스킬의 `SKILL.md` 도 같은 절을 같은 문장으로 둔다. 연결값 환경 변수(`CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN`)에 더해 지원서 공통 프로필을 읽는 `FOS_ASSISTANT_URL`, `FOS_ASSISTANT_SERVICE_TOKEN` 이 셸 환경에 있어야 한다고 적는다.
- `career-os/plugin/scripts/local-skills.test.ts` 가 `plugin/skills/*` 의 모든 스킬을 검사한다: 앞머리 `name` 이 디렉터리 이름과 같고 `description` 이 1024자 이하, 본문에 `bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js"` 와 `Claude Code 에서만` 이 있고, `career-local.js` 를 부르는 줄이 모두 `bun --no-env-file "` 를 쓰고, 문서 어디에도 `career-os/`, `git rev-parse`, `--env-file` 이 없고, `<CAREER_LOCAL> <이름>` 의 이름이 `PLUGIN_LOCAL_EXECUTORS` 에 있고, 본문이 가리키는 `references/*.md` 가 있다. 이 테스트의 맨 위 `skills` 목록 단언(「Claude Code 전용 스킬이 다섯 있다」)과 `resume-preparer`, `position-recommender` 용 개별 `describe` 가 선례다.
- plugin 안의 문서는 plugin 밖을 가리키는 `](../` 링크를 두지 않는다(`resume-preparer` 용 `describe` 가 단언한다). 저장소 문서(`flow.md`, ADR, `AGENTS.md`)로 가는 링크도 같다.
- 개인 맥락은 파일 경로가 아니라 MCP 도구로 읽는다. `career-os/plugin/skills/resume-preparer/references/candidate-context.md` 가 그 표현의 선례다. `manage_candidate_context.ts` 를 문서에 두지 않는다(그 스킬의 테스트가 금지한다).
- 이 스킬은 `resume-preparer` 를 부른다. 같은 plugin 안의 스킬이므로 링크 없이 스킬 이름으로 가리킨다.

**근거 문서**: `career-os/docs/flow.md` 의 「비공개 작업본 동기화」, 「지원서 공통 프로필」, 「application-package-writer」, `career-os/docs/code-architecture.md` 의 「로컬 실행기」.

## 의도 메모

- 저장소 스킬이 하던 일 가운데 저장소 세션에서만 가능한 것은 없다. 근거 원본 최신화 검사(`check_evidence_sources.ts`)와 검토 화면 렌더, 질문 검증, 공통 프로필 조회가 모두 실행기가 됐다.
- `evidence-source-freshness.md` 는 `resume-preparer` 도 함께 따르는 문서였다. plugin 의 `resume-preparer` 는 이 문서를 링크하지 않는다(`plugin/skills/resume-preparer/SKILL.md` 가 근거 원본이 오래됐으면 알린다고만 적는다). 이 문서는 `application-package-writer` 의 references 에 두고, plugin 의 `resume-preparer` 가 부르는 순서(지원 준비 중 이어 부름)에서는 이미 검사를 마쳤다고 본문에 한 줄 적는다.
- evals 의 입력에 저장소 경로나 실행 환경 식별자가 들어 있으면 지어낸 값으로 바꾼다.

## 작업 항목

### 1. 파일을 옮긴다

`git mv` 로 옮긴다.

- `career-os/.claude/skills/application-package-writer/SKILL.md` 를 `career-os/plugin/skills/application-package-writer/SKILL.md` 로.
- `career-os/.claude/skills/application-package-writer/references/` 의 여섯 파일을 `career-os/plugin/skills/application-package-writer/references/` 로.
- `career-os/.claude/skills/application-package-writer/evals/evals.json` 을 `career-os/plugin/skills/application-package-writer/evals/evals.json` 으로.

### 2. 옮긴 문서를 plugin 규칙에 맞게 고친다

`SKILL.md` 와 `references/*.md` 에서 아래를 바꾼다. 바꾸기 전에 `grep -n "career-os\|bun \|\.env\|\.\./\|저장소\|sources/fos-study\|PERSONAL_ROOT\|manage_candidate_context\|application-package-writer/scripts\|read_application_profile\|flow.md" career-os/plugin/skills/application-package-writer -r` 로 모든 자리를 찾는다.

- 앞머리 `description` 끝에 `Claude Code 에서만 돈다.` 를 더한다. 1024자를 넘기지 않는다.
- `## 실행 환경` 절을 「목표」 앞에 둔다. 위 「컨텍스트」 대로 쓴다.
- 「비공개 작업본 동기화」 절의 `flow.md` 링크를 지우고 명령으로 바꾼다. 시작은 `<CAREER_LOCAL> workspace begin application-package-writer --json`, 끝은 `<CAREER_LOCAL> workspace finish application-package-writer --json` 이다. 결과의 `root` 아래 `applications/<company>/<role>/` 가 지원 디렉터리다. `<CAREER_LOCAL> workspace paths --json` 이 `root` 와 `evidenceDir` 를 낸다. 끝 명령을 언제 실행하는지(8단계를 마쳤을 때와 중간에 멈출 때)를 한 문장으로 적는다. `begin` 이 실패하면 기존 로컬 파일로 작업을 이어가지 않는다는 문장을 유지한다.
- 「근거 원본 최신화 확인」 절은 `<CAREER_LOCAL> package check-sources` 를 부른다. 프로젝트 근거 디렉터리는 `evidenceDir` 이다. 지원서 공통 프로필은 `<CAREER_LOCAL> application-profile get --out "${TMPDIR:-/tmp}/career-application-profile.md"` 로 읽고 쓰고 나서 `rm` 으로 지운다고 적는다. 실패별 다음 행동을 담았던 `flow.md` 링크는, 스킬 본문에 한 줄로 줄인 표(상황과 다음 행동)로 대신한다. 상황은 환경 변수 없음, 401, 403, 404, 409, 5xx 와 연결 실패이고, 다음 행동은 `career-os/docs/flow.md` 「지원서 공통 프로필」 표의 것을 그대로 옮긴다(저장소 경로가 든 문구는 뺀다). 경력과 경험 경계는 MCP 도구 `get_context_document` 의 `career-status` 로 읽는다고 적는다.
- 「실행 흐름」 표 앞의 「아래 명령은 모두 저장소 루트에서 실행한다」 문단을 지원 디렉터리(작업본 `root` 기준)에서 실행한다는 말로 고친다. `resume-preparer` 와 같은 자리여야 근거 경로가 같게 풀린다는 이유는 유지한다.
- 8단계의 두 명령을 `<CAREER_LOCAL> package validate <지원 디렉터리>`, `<CAREER_LOCAL> package render <지원 디렉터리>` 로 바꾸고, 질문 검증 명령(`bun career-os/scripts/interview-drill/application_question_schema.ts ...`)을 `<CAREER_LOCAL> package question-schema <지원 디렉터리>` 로 바꾼다. 표의 `[이력서 제출 준비](../resume-preparer/SKILL.md)` 링크는 `resume-preparer` 스킬 이름으로 바꾼다.
- `sources/fos-study` 를 가리키는 문장은 「프로젝트 근거 디렉터리(`evidenceDir`)」 로 바꾼다. 회사와 프로젝트별로 실제 한 일을 읽는 자리라는 설명은 유지한다.
- `[...](references/....md)` 같은 같은 스킬 안의 상대 링크는 그대로 둔다. `references/*.md` 안의 `](../../../..` 로 시작하는 저장소 문서 링크(ADR, `CLAUDE.md`)는 링크를 지우고 필요한 사실을 문장에 풀어 쓴다. 후보자에게 묻기 전에 기록을 조회하는 규칙은 `career-os/AGENTS.md` 의 「후보자에게 묻기 전에 기록을 조회한다」 가 소유하므로, plugin 문서에는 그 규칙의 핵심(본인 사실은 묻기 전에 공통 프로필과 후보자 맥락 문서를 조회하고, 조회해서 없으면 묻는다)을 두 문장으로 옮긴다.
- 「산출물 계약」 절에서 `career-os/docs/code-architecture.md`, `data-schema.md` 를 가리키는 문장은 저장소 문서 이름을 쓰지 않고 이 스킬이 소유하는 내용으로 바꾼다. 「준비 상태 세 줄의 허용값과 뜻」 은 이 스킬의 `references/application-quality-rubric.md` 의 「판정」 이 소유한다고 적는다(`career-os/docs/data-schema.md` 의 「적합도 판정과 점수」 가 같은 문서를 가리키므로 순환하지 않는다).
- `references/evidence-source-freshness.md` 를 새 동작에 맞게 다시 쓴다. 대상 표에서 `fos-study` 의 위치를 `CAREER_EVIDENCE_DIR`(없으면 작업본의 `evidence/`)로, 확인 명령을 `<CAREER_LOCAL> package check-sources` 로(`--no-fetch` 설명 유지), 후보자 맥락 문서 조회를 `get_context_document` 로, 공통 프로필 조회를 `<CAREER_LOCAL> application-profile get --out` 으로 바꾼다. 판정별 다음 행동 표, 종료 코드 표, 당길 때의 함정은 유지하되 `ln -s` 와 `PERSONAL_ROOT` 안내는 `CAREER_EVIDENCE_DIR` 안내로 바꾼다. 「이 문서를 `application-package-writer` 와 `resume-preparer` 가 함께 따른다」 는 문장은 `application-package-writer` 가 따르고 `resume-preparer` 는 이 스킬을 거쳐 온 경우 검사를 이미 마쳤다고 본다는 문장으로 바꾼다.

### 3. 이 스킬을 부르는 쪽을 고친다

- `career-os/plugin/skills/resume-preparer/SKILL.md` 의 「저장소 세션의 `application-package-writer`로 먼저 만든다고 안내하고 끝낸다」 를 plugin 의 `application-package-writer` 스킬로 먼저 만든다는 안내로 바꾼다. `description` 과 본문의 같은 취지 문장을 모두 찾는다(`grep -n "application-package-writer" career-os/plugin/skills/resume-preparer -r`).
- `career-os/scripts/candidate-context/skill_boundary.test.ts` 의 「application-package-writer 는 공통 프로필을 CLI 로 읽게 한다」 테스트는 저장소 사본을 읽는다. `skillDirectory("application-package-writer")` 로 plugin 사본을 찾게 바꾸고, 기대 문구를 `<CAREER_LOCAL> application-profile get --out` 으로 바꾼다. `career-os/AGENTS.md` 를 읽는 테스트는 그대로 둔다. 목록 `candidateContextSkills` 의 이름은 그대로 두어 plugin 사본의 금지어 검사를 계속 받게 한다.

### 4. 테스트

`career-os/plugin/scripts/local-skills.test.ts` 를 고친다.

- 맨 위 목록 단언의 이름과 개수를 여섯(`application-package-writer` 포함)으로 고친다. 테스트 제목의 「다섯」 도 고친다.
- `describe("application-package-writer", ...)` 를 더한다. 본문이 `<CAREER_LOCAL> package check-sources`, `<CAREER_LOCAL> package validate`, `<CAREER_LOCAL> package render`, `<CAREER_LOCAL> package question-schema`, `<CAREER_LOCAL> application-profile get --out`, `workspace begin application-package-writer`, `workspace finish application-package-writer` 를 모두 적는지, 문서 어디에도 `brain-search`, `brain-add`, `private brain`, `manage_candidate_context.ts`, `read_application_profile.ts`, `sources/fos-study`, `PERSONAL_ROOT` 가 없는지, plugin 밖을 가리키는 `](../` 링크가 없는지 확인한다.
- 이 스킬이 쓰는 `references/` 여섯이 모두 있고 각각 본문(`SKILL.md`)이나 다른 reference 에서 한 번 이상 가리켜지는지 확인한다.
- `evals/evals.json` 이 올바른 JSON 이고 문자열 어디에도 `/Users/` 가 없는지 확인한다.

## 검증

저장소 루트에서 실행한다.

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd career-os/plugin && bun install && cd ../.. && bun test ./career-os/plugin ./career-os/scripts/candidate-context ./career-os/scripts/plugin-local
export PATH="$HOME/.bun/bin:$PATH" && bunx tsc --noEmit
! git grep -n "career-os/\|\-\-env-file\|manage_candidate_context\|read_application_profile\|sources/fos-study\|PERSONAL_ROOT" -- career-os/plugin/skills/application-package-writer
test ! -e career-os/.claude/skills/application-package-writer
```

기대값: 모두 종료 코드 0 이다. 마지막 줄은 저장소 사본이 남지 않았다는 확인이다(`git mv` 뒤 빈 디렉터리가 남지 않는다).

## 변경 파일

| 파일 | 변경 |
| --- | --- |
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 삭제 |
| `career-os/.claude/skills/application-package-writer/references/**` | 삭제 |
| `career-os/.claude/skills/application-package-writer/evals/evals.json` | 삭제 |
| `career-os/plugin/skills/application-package-writer/SKILL.md` | 신규 |
| `career-os/plugin/skills/application-package-writer/references/application-quality-rubric.md` | 신규 |
| `career-os/plugin/skills/application-package-writer/references/candidate-interview-questions.md` | 신규 |
| `career-os/plugin/skills/application-package-writer/references/evidence-source-freshness.md` | 신규 |
| `career-os/plugin/skills/application-package-writer/references/fit-judgment.md` | 신규 |
| `career-os/plugin/skills/application-package-writer/references/full-document-review.md` | 신규 |
| `career-os/plugin/skills/application-package-writer/references/growth-judgment.md` | 신규 |
| `career-os/plugin/skills/application-package-writer/evals/evals.json` | 신규 |
| `career-os/plugin/skills/resume-preparer/SKILL.md` | 수정 |
| `career-os/plugin/scripts/local-skills.test.ts` | 수정 |
| `career-os/scripts/candidate-context/skill_boundary.test.ts` | 수정 |
