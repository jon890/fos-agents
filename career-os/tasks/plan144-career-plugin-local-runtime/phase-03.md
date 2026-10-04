# Phase 03. 로컬 실행기 진입점과 번들을 만든다

**Execution profile**: deep

## 목표

`career-os/scripts/plugin-local/main.ts` 가 하위 명령으로 실행기를 고르고, plugin 빌드가 이것을 `career-os/plugin/dist/career-local.js` 하나로 번들한다.
실행기는 `workspace`, `interview`, `interview-sources`, `study`, `study-validate`, `study-sources` 여섯이다.
Claude Code 에 plugin 만 설치한 곳에서도 저장소와 `bun install` 없이 면접과 공부의 로컬 단계를 돌리려는 것이다.

**범위 외**: 이 실행기를 부르는 스킬은 Phase 04, 저장소 `interview-practice` 사본 삭제와 버전 올리기는 Phase 05 다. 공고 추천과 이력서 실행기는 다른 계획이다. 수집, 선별, 렌더링 로직 자체는 바꾸지 않는다.

## 컨텍스트

실행기가 넘기는 원본이다. 모두 `career-os/scripts/` 아래이고 직접 실행할 때의 동작은 바뀌지 않아야 한다.

| 실행기 | 원본 | 원본이 내는 것 |
| --- | --- | --- |
| `workspace` | `career-workspace/cli.ts` | `beginSkillWorkspace(context, skill)`, `finishSkillWorkspace(context, skill)`, `createCareerWorkspaceTransport(environment, environmentFile?)`, `CliContext` 타입(`root`, `transport`, `producer`) |
| `interview` | `interview-drill/drill-engine.ts` | `runDrillCli(argv, { createStore, readFile, readContextDocuments?, environment? })` |
| `interview-sources` | `interview-question-sources/cli.ts` | `runInterviewQuestionSources(command, argv)`. 옵션은 `argv` 전체에서 찾는다 |
| `study` | `study-topic-recommender/morning_reading_cli.ts` | `main()`, `reportMorningReadingError(error)`. 옵션은 `process.argv` 에서 직접 찾는다 |
| `study-validate` | `study-topic-recommender/validate_outputs.ts` | `validateMorningReadingOutputs(root)`. 실행 디렉터리는 `resolveStudyRunRoot(process.env, firstOptionValue(process.argv, "--run-dir"))` 로 정한다 |
| `study-sources` | `study-topic-recommender/manage_reading_sources.ts` | `manageReadingSources(args)`, `formatManageReadingSourcesError(error)` |

- 각 원본은 맨 아래 `if (import.meta.main)` 블록에서 출력과 종료 코드를 정한다. 번들에서 진입점이 아닌 모듈의 `import.meta.main` 은 거짓이라 그 블록은 돌지 않는다. 진입점이 같은 출력과 종료 코드를 내야 한다
- `career-workspace/cli.ts` 의 `managedSkills` 는 `application-package-writer`, `resume-preparer`, `interview-practice`, `sync-profile` 을 담고, 없는 이름이면 `TransportError(makeRemoteError("check", "INVALID_MANIFEST"))` 를 던진다. 저장소 CLI 의 `createDefaultContext` 는 `.env` 를 읽고 root 기본값이 `career-os` 다. plugin 실행기는 그 함수를 쓰지 않는다
- `createCareerWorkspaceTransport` 는 `CAREER_WORKSPACE_COMMAND` 가 있으면 명령 transport, 없고 `CAREER_WORKSPACE_SSH_TARGET` 이 있으면 SSH transport, 둘 다 없으면 호출마다 `TRANSPORT_UNAVAILABLE` 을 내는 transport 를 돌려준다
- `drill-engine.ts` 의 `createInterviewPracticeStore(environment)` 는 `career-os/scripts/interview-drill/store/index.ts` 에 있고 `CAREER_STORE` 가 `backend` 면 `resolveCareerBackendConnection(environment)` 로 연결값을 읽는다
- 기존 MCP 번들 빌드는 `career-os/plugin/scripts/build.ts` 의 `buildBundle(outdir)` 이고, `career-os/plugin/scripts/build.test.ts` 가 커밋한 `dist/career-mcp.js` 와 새 빌드를 대조한다. 빌드 결과의 공백만 있는 줄을 지우는 정규화(`/^[\t ]+$/gm`)를 같은 방식으로 쓴다
- `services/career-backend/` 아래 파일이 `zod` 를 import 한다. 그 디렉터리에 `node_modules` 가 설치된 환경에서는 다른 `zod` 가 번들에 섞일 수 있다
- Phase 02 가 공개 질문 은행을 `scripts/interview-drill/public-question-bank.ts` 의 정적 import 로 바꿨다. 그래서 `interview` 실행기는 번들 위치와 무관하게 공개 질문을 갖는다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「로컬 실행기」 절,
`career-os/docs/data-schema.md` 의 「로컬 실행기 환경 변수」 절,
`career-os/docs/flow.md` 의 「plugin 스킬이 실행하는 명령」 절,
`career-os/docs/adr/ADR-138-plugin-로컬-실행기는-scripts-원본을-번들해-부르고-작업본-위치는-설정으로-받는다.md`

## 의도 메모

- 실행기마다 번들을 따로 만들지 않는다. `zod` 와 Backend client 가 실행기 수만큼 들어간다
- `interview` 는 `select` 만 받는다. 기록과 개인 질문은 MCP 도구(`save_interview_attempt`, `save_personal_question`)가 맡는다. 저장소는 늘 Backend 다. plugin 에는 파일 저장소를 두지 않는다(ADR-137 의 「로컬 파일 모드를 두지 않는다」)
- `workspace` 의 로컬 모드는 원격에 아무것도 묻지 않는다. 기본 root 가 저장소 경로가 아니므로, 동기화 설정을 빠뜨려도 저장소의 오래된 작업본을 고치는 일은 생기지 않는다
- 실행기는 token 과 문서 본문을 출력하지 않는다. 오류 출력은 원본 CLI 의 형식을 따른다

## 작업 항목

### 1. `career-os/scripts/career-workspace/cli.ts` 수정

- `managedSkills` 에 `"interview-question-prep"` 를 더한다
- `export function isManagedSkill(skill: string | undefined): skill is string` 를 더하고 `validateManagedSkill` 이 그것을 쓰게 한다. 다른 동작은 바꾸지 않는다

### 2. `career-os/scripts/plugin-local/workspace.ts` 신규

- `export function resolvePluginWorkspace(environment: Record<string, string | undefined>, home: string): { root: string; mode: "local" | "remote" }`
  - `root` 는 `CAREER_WORKSPACE_ROOT` 를 trim 한 값을 `path.resolve` 한 것. 비었으면 `path.join(home, ".fos-career", "workspace")`
  - `mode` 는 `CAREER_WORKSPACE_COMMAND` 나 `CAREER_WORKSPACE_SSH_TARGET` 이 trim 뒤 비어 있지 않으면 `"remote"`, 아니면 `"local"`
- `export async function runPluginWorkspace(args: string[], environment = process.env, home = os.homedir()): Promise<unknown>`
  - `paths --json` → `{ schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION, action: "paths", ok: true, root, mode }`
  - `begin <skill> --json`
    - `isManagedSkill(skill)` 가 거짓이면 `TransportError(makeRemoteError("check", "INVALID_MANIFEST"))`
    - `local`: `root` 아래 `CAREER_WORKSPACE_MANAGED_ROOTS` 의 디렉터리를 `mkdir -p` 하고 `{ schemaVersion, action: "skill-begin", ok: true, skill, mode: "local", root, noChange: true }`
    - `remote`: `beginSkillWorkspace({ root, transport: createCareerWorkspaceTransport(environment), producer: { skill: "career-workspace", mode: "interactive" } }, skill)` 의 결과에 `mode: "remote"`, `root` 를 더해 낸다
  - `finish <skill> --json`: 같은 분기. `local` 은 `{ schemaVersion, action: "skill-finish", ok: true, skill, mode: "local", root, noChange: true }`, `remote` 는 `finishSkillWorkspace` 결과에 `mode`, `root` 를 더한다
  - 그 밖의 인자는 `TransportError(makeRemoteError("check", "INVALID_MANIFEST"))`
  - `.env` 를 읽지 않는다. `dotenv` 를 부르지 않는다

### 3. `career-os/scripts/study-topic-recommender/validate_outputs.ts` 수정

- `export function runValidateOutputs(argv: string[], environment = process.env)` 를 더한다. `resolveStudyRunRoot(environment, firstOptionValue(argv, "--run-dir"))` 로 정한 root 로 `validateMorningReadingOutputs` 를 부른 결과를 돌려준다
- `import.meta.main` 블록은 `runValidateOutputs(process.argv)` 를 쓰게 바꾼다. 출력과 종료 코드는 그대로다

### 4. `career-os/scripts/plugin-local/main.ts` 신규

- `export const PLUGIN_LOCAL_EXECUTORS = ["workspace", "interview", "interview-sources", "study", "study-validate", "study-sources"] as const`
- `export async function runPluginLocal(argv: string[]): Promise<number>`. `argv` 는 `process.argv.slice(2)` 모양이고 종료 코드를 돌려준다
  - 첫 인자가 없거나 `help`, `--help`, `-h` 면 실행기 목록과 한 줄 설명을 stdout 에 쓰고 0
  - 모르는 실행기면 stderr 에 사용법을 쓰고 2
  - 실행기에 넘기기 전에 `process.argv = [process.argv[0]!, process.argv[1]!, ...rest]` 로 바꾼다. `study` 와 `study-validate` 의 원본이 `process.argv` 에서 옵션을 찾기 때문이다
- 실행기별 처리. 출력과 종료 코드는 원본의 `import.meta.main` 블록과 같게 한다
  - `workspace`: `runPluginWorkspace(rest)` 결과를 `JSON.stringify(result, null, 2)` 로 stdout. `TransportError` 면 `error.result` 를, 아니면 `makeRemoteError("check", "TRANSPORT_UNAVAILABLE")` 를 한 줄 JSON 으로 stderr 에 쓰고 1
  - `interview`: 첫 인자가 `select` 가 아니면 stderr 에 「plugin 실행기는 select 만 받는다. 기록과 개인 질문은 save_interview_attempt, save_personal_question 도구로 한다.」 를 쓰고 2. `select` 면 `environment = { ...process.env, CAREER_STORE: "backend" }` 로 `runDrillCli(rest, { environment, createStore: () => createInterviewPracticeStore(environment), readFile: (path) => readFileSync(path, "utf8") })` 를 부르고 결과를 한 줄 JSON 으로 stdout. `UsageError` 는 2, 그 밖은 1. `CareerBackendHttpError` 의 `NETWORK_ERROR` 는 drill-engine 과 같은 문장을 쓴다
  - `interview-sources`: `runInterviewQuestionSources(rest[0] ?? "validate", process.argv)` 결과를 `JSON.stringify(result, null, 2)` 로. 오류는 메시지만 stderr, 1
  - `study`: `await main()` 을 부르고 오류는 `reportMorningReadingError(error)` 에 넘긴다(그 함수가 종료한다). 정상이면 `process.exitCode ?? 0`
  - `study-validate`: `runValidateOutputs(process.argv)` 결과를 `JSON.stringify(result, null, 2)` 로. `StudyRunPathError` 면 그 `exitCode`, 그 밖은 1
  - `study-sources`: `manageReadingSources(rest)` 결과가 문자열이면 그대로, 아니면 `JSON.stringify(result, null, 2)` 로. 오류는 `formatManageReadingSourcesError(error)` 를 stderr, 1
- 파일 끝에 `if (import.meta.main) process.exitCode = await runPluginLocal(process.argv.slice(2));`

### 5. `career-os/plugin/scripts/build.ts` 수정

- `export async function buildLocalBundle(outdir: string)` 를 더한다. 진입점은 `resolve(root, "../scripts/plugin-local/main.ts")`, `target: "bun"`, `format: "esm"`, `minify: true`, `naming: "career-local.js"` 다. `root` 는 기존 `buildBundle` 과 같은 plugin 디렉터리다
- `zod` 와 `zod/` 로 시작하는 import 를 저장소 루트 `node_modules` 의 `zod` 로 해석하는 Bun 빌드 plugin 을 붙인다. `services/career-backend/node_modules` 가 있어도 같은 번들이 나오게 하려는 것이다. 루트 경로는 `resolve(root, "../..")` 다
- 실패하면 `CAREER_LOCAL_BUILD_FAILED` 를 던진다. 공백 줄 정규화는 `buildBundle` 과 같다
- `import.meta.main` 블록이 `buildBundle` 다음에 `buildLocalBundle` 도 `dist` 로 부른다

### 6. `career-os/plugin/dist/career-local.js` 신규

`bun run --cwd career-os/plugin build` 로 만든다.

### 7. 테스트

- `career-os/scripts/plugin-local/workspace.test.ts` 신규
  - `resolvePluginWorkspace({}, "/home/example")` 이 `{ root: "/home/example/.fos-career/workspace", mode: "local" }`
  - `CAREER_WORKSPACE_ROOT` 가 있으면 그 경로, `CAREER_WORKSPACE_SSH_TARGET` 이나 `CAREER_WORKSPACE_COMMAND` 가 있으면 `mode: "remote"`. 공백만 있는 값은 없는 값으로 본다
  - 로컬 모드 `begin interview-question-prep --json` 이 임시 root 아래 `applications`, `library`, `state` 를 만들고 `mode: "local"` 을 낸다. `finish` 도 `mode: "local"`, `noChange: true` 다. `.career-sync/` 를 만들지 않는다
  - 실패 쪽: `begin position-recommender --json` 과 `begin` 인자 없음은 `TransportError` 이고 `result.code` 가 `INVALID_MANIFEST` 다
- `career-os/scripts/plugin-local/main.test.ts` 신규
  - `runPluginLocal(["help"])` 이 0 이고 stdout 에 여섯 실행기 이름이 모두 있다
  - `runPluginLocal(["nope"])` 이 2
  - `runPluginLocal(["interview", "record"])` 이 2 이고 stderr 에 `save_interview_attempt` 가 있다
- `career-os/plugin/scripts/local-bundle.test.ts` 신규. 커밋한 `career-os/plugin/dist/career-local.js` 를 `Bun.spawnSync` 로 `cwd` 를 임시 디렉터리에 두고 실행한다. 저장소 경로가 없는 곳에서도 도는지 보려는 것이다
  - `help` 가 0 이다
  - `workspace paths --json` 에 `CAREER_WORKSPACE_ROOT=<임시 디렉터리>` 를 주면 그 경로와 `mode: "local"` 을 낸다
  - `interview select tech --count 3` 에 `Bun.serve` 로 띄운 HTTP 대역을 `CAREER_BACKEND_URL` 로, 40자 지어낸 token 을 `CAREER_BACKEND_TOKEN` 으로 준다. 대역은 `GET /api/interview/v1/progress?drillType=tech` 에 `{ "items": [] }`, `GET /api/interview/v1/personal-questions?drillType=tech` 에 `{ "items": [] }` 로 답한다. 결과 JSON 의 `questions` 가 세 개이고 모두 `sourceScope` 가 없거나 `"public"` 이다. 공개 은행이 번들에 들어갔다는 근거다
  - 실패 쪽: 같은 명령을 연결값 없이 실행하면 종료 코드 1 이고 stderr 에 지어낸 token 문자열이 없다
- `career-os/plugin/scripts/build.test.ts` 수정: `buildLocalBundle(out)` 의 `career-local.js` 가 커밋한 `dist/career-local.js` 와 같다는 테스트를 더한다
- `career-os/scripts/career-workspace/tests/cli.test.ts` 는 고치지 않는다. 기존 테스트가 그대로 통과해야 한다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/scripts/plugin-local/workspace.test.ts ./career-os/scripts/plugin-local/main.test.ts ./career-os/plugin/scripts/local-bundle.test.ts ./career-os/plugin/scripts/build.test.ts
bun test ./career-os/scripts/plugin-local ./career-os/scripts/career-workspace ./career-os/scripts/interview-drill ./career-os/scripts/interview-question-sources ./career-os/scripts/study-topic-recommender ./career-os/plugin
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
git grep -n "dotenv" -- career-os/scripts/plugin-local && exit 1 || true
```

기대값: 모두 종료 코드 0. 마지막 줄은 아무것도 찍지 않는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/career-workspace/cli.ts` | 수정 |
| `career-os/scripts/plugin-local/workspace.ts` | 신규 |
| `career-os/scripts/plugin-local/workspace.test.ts` | 신규 |
| `career-os/scripts/plugin-local/main.ts` | 신규 |
| `career-os/scripts/plugin-local/main.test.ts` | 신규 |
| `career-os/scripts/study-topic-recommender/validate_outputs.ts` | 수정 |
| `career-os/plugin/scripts/build.ts` | 수정 |
| `career-os/plugin/scripts/build.test.ts` | 수정 |
| `career-os/plugin/scripts/local-bundle.test.ts` | 신규 |
| `career-os/plugin/dist/career-local.js` | 신규 |
