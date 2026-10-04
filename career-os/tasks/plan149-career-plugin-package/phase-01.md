# Phase 01. 지원 패키지 실행 코드를 scripts 로 옮기고 로컬 실행기 둘을 더한다

**Execution profile**: standard

## 목표

`application-package-writer` 의 실행 코드(근거 원본 최신화 검사, 제출 문서 유출 검사, 검토 화면 렌더, 적합도 점수)와 템플릿을 스킬 번들에서 `career-os/scripts/application-package/` 로 옮기고, plugin 로컬 실행기 `career-local.js` 에 `package` 와 `application-profile` 실행기를 더한다.
plugin 만 설치한 곳에서 저장소 없이 돌게 하려는 것이다.

**범위 외**: plugin 스킬 문서(phase 02), 저장소 스킬 사본 삭제와 문서 정리(phase 03).

## 컨텍스트

- 실행기 배치의 결정은 `career-os/docs/adr/ADR-138-plugin-로컬-실행기는-scripts-원본을-번들해-부르고-작업본-위치는-설정으로-받는다.md` 다. 원본은 `career-os/scripts/` 에 두고, 번들은 실행 파일 옆의 파일을 런타임에 찾지 않고, `.env` 를 탐색하지 않는다.
- 선례는 `career-os/scripts/resume-preparer/export_resume.ts` 의 템플릿 텍스트 import(`import x from './templates/resume.css' with { type: 'text' }` 와 `career-os/scripts/lib/text-asset.ts` 의 `textAsset`)와 `career-os/scripts/plugin-local/main.ts` 의 `resume` 실행기다.
- 지금 `career-os/.claude/skills/application-package-writer/scripts/` 의 코드는 `import.meta.dir` 기준으로 `templates/` 를 읽고(`render/constants.ts` 의 `TEMPLATE_DIRECTORY`, `render/layout.ts` 의 `readTemplate`), `../../../../scripts/lib/cli.ts` 를 상대 import 하고, `check_evidence_sources.ts` 는 `career-os/.env` 의 `PERSONAL_ROOT` 와 저장소 루트 기준 경로를 쓴다. 이 셋이 설치한 곳에서 실패하는 지점이다.
- `career-os/scripts/resume-preparer/validate_submission_bundle.ts` 가 `.claude/skills/application-package-writer/scripts/package_contract.ts` 의 `STATUS_FILE` 을 import 한다. 새 위치로 고친다.
- `career-os/scripts/plugin-local/executors.ts` 의 `PLUGIN_LOCAL_EXECUTORS` 는 import 가 없는 목록이고, `main.ts` 의 `descriptions: Record<Executor, string>` 이 모든 실행기에 설명을 요구한다. 새 실행기를 목록과 설명과 `switch` 에 모두 더해야 타입 검사를 통과한다.
- 지원서 공통 프로필 CLI 는 `career-os/scripts/application-profile/read_application_profile.ts` 의 `readApplicationProfileCli(args)` 다. `get --out <경로>` 만 받고 `--out` 이 git 저장소 안이면 거절한다. 연결값은 셸 환경 변수 `FOS_ASSISTANT_URL`, `FOS_ASSISTANT_SERVICE_TOKEN` 에서 읽는다.
- 포지션별 면접 질문 파일 검증은 `career-os/scripts/interview-drill/application_question_schema.ts` 의 `import.meta.main` 블록이 한다(`loadApplicationInterviewQuestions` 를 부르고 JSON 을 출력하며 실패하면 종료 코드 1, 인자가 없으면 2).
- bun 은 PATH 에 없을 수 있다. `export PATH="$HOME/.bun/bin:$PATH"` 를 먼저 실행한다.

**근거 문서**: `career-os/docs/code-architecture.md` 의 「application-package-writer」 와 「로컬 실행기」, `career-os/docs/flow.md` 의 「지원서 공통 프로필」, `career-os/docs/data-schema.md` 의 「로컬 실행기 환경 변수」.

## 의도 메모

- 실행 코드를 `plugin/` 아래로 옮기지 않고 `scripts/application-package/` 로 옮긴다. 기각한 대안과 이유는 ADR-138 의 「대안 기각」이 갖는다.
- 근거 원본 검사의 원본 목록에서 `PERSONAL_ROOT` 와 `career-os/sources/fos-study` 를 뺀다. 대신 `${CAREER_EVIDENCE_DIR}` 와 `${CAREER_EVIDENCE_DIR}/..` 두 자리를 순서대로 본다. 저장소에서는 `CAREER_EVIDENCE_DIR` 가 `fos-study` 의 `task/` 를 가리키므로 그 상위가 Git 저장소 루트다. 기존의 「그 자리가 Git 저장소의 루트일 때만 인정한다」 판정(`isRepositoryRoot`)은 그대로 둔다. 상위 모노레포의 `.git` 을 물려받은 평범한 디렉터리를 원본으로 오인하지 않으려는 것이다.
- `package check-sources` 는 `CAREER_EVIDENCE_DIR` 가 없을 때 `workspace paths` 와 같은 값(`scripts/plugin-local/workspace.ts` 의 `resolvePluginWorkspace` 가 낸 `evidenceDir`)으로 환경을 채워 넘긴다. 실행기가 두 곳에서 다른 기본값을 쓰지 않게 한다.
- 검사 결과가 `unavailable` 일 때 안내문(`remedy`)은 `ln -s` 와 `PERSONAL_ROOT` 대신 `CAREER_EVIDENCE_DIR` 를 Git 저장소의 루트나 그 바로 아래 디렉터리로 지정하라고 안내한다.
- `.env` 를 읽는 `loadWorkspaceEnvironment` 와 `dotenv` import 를 지운다. 환경은 `process.env` 만 쓴다.

## 작업 항목

### 1. 파일을 옮긴다

`git mv` 로 옮겨 이력을 잇는다.

- `career-os/.claude/skills/application-package-writer/scripts/` 아래 모든 파일을 `career-os/scripts/application-package/` 로 옮긴다. `render/` 하위 디렉터리를 그대로 둔다.
- `career-os/.claude/skills/application-package-writer/templates/` 의 두 파일을 `career-os/scripts/application-package/templates/` 로 옮긴다.

### 2. 옮긴 코드를 설치한 곳에서 돌게 고친다

- `../../../../scripts/lib/cli.ts` 를 쓰는 import 를 모두 `../lib/cli.ts` 로 고친다.
- `render_application_package.ts` 의 `../../../../scripts/resume-preparer/validate_submission_bundle.ts` import 를 `../resume-preparer/validate_submission_bundle.ts` 로 고친다.
- `career-os/scripts/resume-preparer/validate_submission_bundle.ts` 의 `package_contract.ts` import 를 `../application-package/package_contract.ts` 로 고친다.
- `render/constants.ts` 의 `TEMPLATE_DIRECTORY` 와 `render/layout.ts` 의 `readTemplate(name)` 이 파일을 읽지 않게 한다. 두 템플릿(`application-package.html`, `application-package.css`)을 `with { type: "text" }` 로 import 하고 `textAsset` 으로 문자열을 확정한 뒤, `readTemplate(name)` 이 이름으로 그 문자열을 돌려주게 한다. 모르는 이름이면 오류를 낸다. `readTemplate` 의 시그니처는 그대로 두어 `render_application_package.ts` 와 테스트의 호출을 바꾸지 않는다. `TEMPLATE_DIRECTORY` 를 쓰는 곳을 `grep -rn TEMPLATE_DIRECTORY career-os/scripts` 로 모두 찾아 고친다.
- `check_evidence_sources.ts` 를 고친다.
  - `EVIDENCE_SOURCES` 의 원본 하나는 이름 `fos-study` 를 유지하고 `paths` 를 `["${CAREER_EVIDENCE_DIR}", "${CAREER_EVIDENCE_DIR}/.."]` 로 바꾼다. `affects`, `branch` 는 그대로다.
  - `findRepositoryRoot`, `loadWorkspaceEnvironment`, `dotenv` import, `join` 이 쓸모없어지면 그 import, `CheckOptions.repositoryRoot` 와 CLI 의 `<repository-root>` 위치 인자를 지운다. 상대 경로 스펠링이 없으므로 `resolveSourcePath` 의 상대 경로 분기도 지운다(절대 경로 스펠링은 남겨도 된다).
  - `checkEvidenceSources` 는 `env`(없으면 `process.env`)만으로 환경 변수 경로를 푼다.
  - `remedy(spec)` 의 안내문을 위 「의도 메모」 대로 바꾼다. 경로나 사용자 이름 같은 실행 환경 식별자를 문구에 넣지 않는다.
  - 파일 맨 위 주석에서 `PERSONAL_ROOT` 와 `career-os/.env` 를 말하는 문장을 현재 동작에 맞게 고친다.

### 3. `package` 실행기를 만든다

`career-os/scripts/application-package/cli.ts` 를 새로 만든다. `runPackageCommand(args: string[], environment?: Record<string, string | undefined>): Promise<number>` 를 내보낸다. 첫 인자가 하위 명령이다.

| 하위 명령 | 하는 일 | 출력과 종료 코드 |
| --- | --- | --- |
| `check-sources [--no-fetch]` | `checkEvidenceSources({ env, fetch })` | 결과 JSON 을 출력한다. `passed` 가 참이면 0, 아니면 1. 옵션이 틀리면 2 |
| `validate <application-directory>` | `validateApplicationPackage` | 결과 JSON 을 출력한다. `passed` 가 참이면 0, 아니면 1 |
| `render <application-directory> [output-path]` | `renderApplicationPackage` | 만든 HTML 경로를 출력한다. 유출 검사가 실패해 던지면 메시지를 stderr 에 쓰고 1 |
| `question-schema <application-directory>` | `loadApplicationInterviewQuestions` | `application_question_schema.ts` 의 `import.meta.main` 블록과 같은 JSON 을 출력한다. 실패는 1, 인자 없음은 2 |

- 모르는 하위 명령이나 인자 없음은 사용법을 stderr 에 쓰고 2 로 끝난다(`career-os/scripts/plugin-local/main.ts` 의 `runResume` 와 같다).
- `question-schema` 가 `application_question_schema.ts` 의 `import.meta.main` 블록을 복제하지 않게, 그 블록의 본문을 `export function runApplicationQuestionSchemaCli(inputPath: string | undefined): number` 로 빼고 `import.meta.main` 블록은 그것을 부르게 한다. 출력과 종료 코드는 그대로다.
- `cli.ts` 는 `process.exit` 를 부르지 않고 종료 코드를 돌려준다.

### 4. `plugin-local` 에 실행기 둘을 더한다

- `career-os/scripts/plugin-local/executors.ts` 의 목록 끝에 `"package"`, `"application-profile"` 을 더한다.
- `career-os/scripts/plugin-local/main.ts` 의 `descriptions` 에 두 실행기의 한 줄 설명을 더하고 `switch` 에 분기를 더한다.
  - `package`: `runPackageCommand(rest, { ...process.env, CAREER_EVIDENCE_DIR: resolvePluginWorkspace(process.env, os.homedir()).evidenceDir })` 를 부르고 그 종료 코드를 돌려준다.
  - `application-profile`: `readApplicationProfileCli(rest)` 의 결과를 `console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2))` 로 출력하고 0 으로 끝난다. 던지면 메시지를 stderr 에 쓰고 1 로 끝난다. 사용법 오류(`get` 이 아닌 하위 명령)는 `read_application_profile.ts` 의 `import.meta.main` 블록이 하는 것과 같은 종료 코드를 낸다. 그 블록을 읽고 맞춘다. 본문과 토큰을 로그에 싣지 않는다.
- `help` 출력은 `descriptions` 에서 만들어지므로 따로 고칠 것이 없다.

### 5. 테스트

- 옮긴 테스트(`check_evidence_sources.test.ts`, `fit_score.test.ts`, `render_application_package.test.ts`, `validate_application_package.test.ts`)의 import 와 새 시그니처를 고친다. `check_evidence_sources.test.ts` 는 `PERSONAL_ROOT`, 저장소 루트 상대 경로, `.env` 를 전제한 단언을 `CAREER_EVIDENCE_DIR` 기준으로 다시 쓴다. 지어낸 임시 저장소로 아래를 확인한다: 증거 디렉터리의 상위가 저장소 루트면 `up_to_date`, 환경 변수가 없으면 `unavailable` 과 이유 문구, 증거 디렉터리가 상위 모노레포의 `.git` 만 물려받은 평범한 디렉터리면 `unavailable`(기존 「오인」 회귀 테스트를 유지), 원격이 앞서 있으면 `behind`.
- `career-os/scripts/application-package/cli.test.ts` 를 새로 만든다. 지어낸 임시 지원 디렉터리로 `validate`(깨끗한 문서는 0, 내부 경로가 든 `evidence/resume-draft.md` 는 1), `render`(`application-package.html` 이 생기고 경로를 출력), 모르는 하위 명령(2), `question-schema`(올바른 파일은 0, 틀린 파일은 1)를 확인한다.
- `career-os/scripts/plugin-local/main.test.ts` 를 고친다. help 가 실행기 열한 개를 모두 보여 주도록 개수 단언(`toHaveLength(9)` 와 제목의 「아홉」)을 11 로 바꾸고, `package` 와 `application-profile` 이름이 출력에 있다는 단언을 더한다. `package` 의 모르는 하위 명령이 2 로 끝나고 stderr 에 사용법이 나오는 단언과 `application-profile` 의 `get` 아닌 하위 명령이 실패하는 단언을 더한다.
- `plugin/scripts/` 와 `scripts/` 에서 실행기 개수를 상수로 단언하는 다른 테스트가 있는지 `grep -rn "PLUGIN_LOCAL_EXECUTORS\|toHaveLength(9)" career-os/scripts career-os/plugin/scripts career-os/plugin/src` 로 찾아 같이 고친다.

### 6. plugin 번들을 다시 만든다

```bash
export PATH="$HOME/.bun/bin:$PATH"
cd career-os/plugin && bun install && bun run build
```

`dist/career-local.js` 가 바뀐 것을 확인하고 커밋에 담는다. `dist/career-mcp.js` 는 바뀌지 않아야 한다. 바뀌면 `git diff --stat` 로 이유를 확인한다.

## 검증

저장소 루트에서 실행한다. 각 줄은 앞 줄이 실패하면 멈춘다.

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd career-os/plugin && bun install && bun run build && cd ../.. && git diff --stat -- career-os/plugin/dist/career-mcp.js
export PATH="$HOME/.bun/bin:$PATH" && bun test ./career-os/scripts/application-package ./career-os/scripts/plugin-local ./career-os/scripts/resume-preparer ./career-os/scripts/interview-drill ./career-os/scripts/application-profile ./career-os/plugin
export PATH="$HOME/.bun/bin:$PATH" && bunx tsc --noEmit
! git grep -n "PERSONAL_ROOT\|dotenv" -- career-os/scripts/application-package ':!*.test.ts'
! git grep -n "TEMPLATE_DIRECTORY\|\.\./\.\./\.\./\.\./scripts" -- career-os/scripts/application-package ':!*.test.ts'
```

기대값: 첫 줄의 `git diff --stat` 출력이 비어 있다. 나머지는 종료 코드 0 이다.

## 변경 파일

| 파일 | 변경 |
| --- | --- |
| `career-os/.claude/skills/application-package-writer/scripts/**` | 삭제 |
| `career-os/.claude/skills/application-package-writer/templates/**` | 삭제 |
| `career-os/scripts/application-package/application_form_schema.ts` | 신규 |
| `career-os/scripts/application-package/check_evidence_sources.ts` | 신규 |
| `career-os/scripts/application-package/check_evidence_sources.test.ts` | 신규 |
| `career-os/scripts/application-package/cli.ts` | 신규 |
| `career-os/scripts/application-package/cli.test.ts` | 신규 |
| `career-os/scripts/application-package/fit_score.ts` | 신규 |
| `career-os/scripts/application-package/fit_score.test.ts` | 신규 |
| `career-os/scripts/application-package/package_contract.ts` | 신규 |
| `career-os/scripts/application-package/render_application_package.ts` | 신규 |
| `career-os/scripts/application-package/render_application_package.test.ts` | 신규 |
| `career-os/scripts/application-package/validate_application_package.ts` | 신규 |
| `career-os/scripts/application-package/validate_application_package.test.ts` | 신규 |
| `career-os/scripts/application-package/render/actions.ts` | 신규 |
| `career-os/scripts/application-package/render/constants.ts` | 신규 |
| `career-os/scripts/application-package/render/files.ts` | 신규 |
| `career-os/scripts/application-package/render/fit.ts` | 신규 |
| `career-os/scripts/application-package/render/layout.ts` | 신규 |
| `career-os/scripts/application-package/render/markdown.ts` | 신규 |
| `career-os/scripts/application-package/render/status.ts` | 신규 |
| `career-os/scripts/application-package/render/types.ts` | 신규 |
| `career-os/scripts/application-package/templates/application-package.css` | 신규 |
| `career-os/scripts/application-package/templates/application-package.html` | 신규 |
| `career-os/scripts/resume-preparer/validate_submission_bundle.ts` | 수정 |
| `career-os/scripts/interview-drill/application_question_schema.ts` | 수정 |
| `career-os/scripts/plugin-local/executors.ts` | 수정 |
| `career-os/scripts/plugin-local/main.ts` | 수정 |
| `career-os/scripts/plugin-local/main.test.ts` | 수정 |
| `career-os/plugin/dist/career-local.js` | 수정 |
