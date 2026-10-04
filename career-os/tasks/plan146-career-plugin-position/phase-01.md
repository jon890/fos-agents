# Phase 01. 로컬 실행기에 position 을 더하고 리포트 템플릿을 번들에 넣는다

**Execution profile**: deep

## 목표

`career-os/plugin/dist/career-local.js` 에 실행기 `position` 을 더해 `position_run.ts` 의 일일 실행 하위 명령을 저장소 없이 돌리게 한다.
리포트 템플릿을 텍스트 import 로 바꿔 번들한 실행기에서도 같은 HTML 이 나오게 하고, `workspace paths` 가 프로젝트 근거 위치를 알려 주게 한다.

**범위 외**: plugin 스킬과 버전 올리기는 Phase 02 다. 수집, 판정, 렌더링 로직과 저장소 사본 스킬(`career-os/.claude/skills/position-recommender/`)은 바꾸지 않는다. 설정 진입점(`configure_position_*.ts`)은 실행기로 열지 않는다.

## 컨텍스트

- 로컬 실행기 진입점은 `career-os/scripts/plugin-local/main.ts` 의 `runPluginLocal(argv)` 이다. 실행기 이름 목록은 import 가 없는 `career-os/scripts/plugin-local/executors.ts` 의 `PLUGIN_LOCAL_EXECUTORS` 이고, `main.ts` 의 `descriptions` 가 이름마다 한 줄 설명을 갖는다. 실행기에 넘기기 전에 `process.argv` 를 `[argv0, argv1, ...rest]` 로 바꾼다
- `career-os/scripts/position-recommender/position_run.ts` 는 `export async function runPositionCommand(argv: string[], options: PositionRunOptions = {}): Promise<number>` 를 낸다. 하위 명령은 `collect`, `commit-company-tiers`, `commit-analyses`, `finalize`, `cleanup` 이다. `--help` 가 있으면 도움말을 stdout 에 쓰고 0 이다. `help` 는 하위 명령이 아니라 `PositionRunUsageError` 다. 그 파일의 `import.meta.main` 블록이 `PositionRunUsageError` 면 `positionRunHelp()` 와 메시지를 stderr 에 쓰고 2, 그 밖의 오류는 메시지만 쓰고 1 로 끝낸다. 출력의 「다음 명령: commit-analyses」 처럼 저장소 경로 없는 문장만 쓴다
- `career-os/scripts/position-recommender/render/assets.ts` 는 `new URL("./templates/", import.meta.url)` 아래 `report-parts.html`, `report.html`, `report.css` 를 `readFileSync` 로 읽는다. 번들하면 번들 위치 기준으로 찾아 실패한다
- 텍스트 import 는 런타임에 문자열을 준다(Bun 1.3.5 실측). 그러나 TypeScript 에서 `.html` 은 Bun 타입이 `HTMLBundle` 로 선언해 `string` 에 대입되지 않고, `.css` 는 선언이 없어 `TS2307` 이 난다
- `career-os/scripts/candidate-context/position-context.ts` 의 `MANAGE_COMMAND` 상수는 `career-os/scripts/candidate-context/manage_candidate_context.ts` 이고, 문서가 없을 때 이 저장소 경로를 담은 오류를 던진다. `career-os/scripts/position-recommender/position_run.test.ts` 는 「후보자 맥락 문서가 없다: position-preferences」 부분만 단언한다
- `career-os/scripts/plugin-local/workspace.ts` 의 `resolvePluginWorkspace(environment, home)` 은 `{ root, mode }` 를, `paths` 명령은 `{ schemaVersion, action: "paths", ok: true, root, mode }` 를 낸다
- 회사 근거 수집은 `fast-xml-parser` 를 쓴다. 루트 `package.json` 에 있고 plugin 빌드의 `buildLocalBundle` 이 루트 설치본으로 번들한다. 쿠팡 어댑터는 403 이면 시스템 `curl` 을 부르고, `repository-guard.ts` 는 `git` 을 부른다. 둘 다 Claude Code 를 쓰는 환경에 있다고 본다
- `bun <파일>` 은 cwd 의 `.env` 를 읽으므로 테스트도 `bun --no-env-file` 로 실행한다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「position-recommender」 절과 「로컬 실행기」 절,
`career-os/docs/data-schema.md` 의 「로컬 실행기 환경 변수」 절,
`career-os/docs/flow.md` 의 「Claude Code 에서 공고 추천」 절,
`career-os/docs/adr/ADR-138-plugin-로컬-실행기는-scripts-원본을-번들해-부르고-작업본-위치는-설정으로-받는다.md`

## 의도 메모

- 타입 무시 주석을 쓰지 않는다. `.html` 은 `unknown` 으로 받아 문자열인지 확인하는 helper 를 거치고, `.css` 는 모듈 선언을 둔다
- 오류 문장은 실행 환경에 따라 다른 경로를 가리키지 않게 한다. 문서 키와 두 저장 방법(대화의 `save_context_document` 도구, 저장소의 `manage_candidate_context.ts put`)을 함께 적는다
- 프로젝트 근거 위치는 실행기가 읽지 않는다. 스킬이 `paths` 결과로 알고 모델이 읽는다

## 작업 항목

### 1. `career-os/scripts/lib/text-asset.ts` 신규

- `export function textAsset(value: unknown, name: string): string`. `typeof value === "string"` 이면 그대로, 아니면 `Error(\`텍스트 자산이 문자열이 아니다: ${name}\`)` 를 던진다

### 2. `career-os/scripts/lib/text-assets.d.ts` 신규

- `declare module "*.css" { const content: string; export default content; }` 만 둔다

### 3. `career-os/scripts/position-recommender/render/assets.ts` 수정

- 세 템플릿을 `import reportParts from "./templates/report-parts.html" with { type: "text" };` 처럼 텍스트 import 로 읽고 `textAsset(...)` 으로 문자열을 얻는다
- `node:fs` import 와 `directory` 상수를 지운다. `loadRenderAssets()` 와 `readTemplateParts` 의 시그니처와 반환값은 그대로다

### 4. `career-os/scripts/candidate-context/position-context.ts` 수정

- `MANAGE_COMMAND` 를 지우고 오류 문장을 「후보자 맥락 문서가 없다: <키 목록>. 대화에서는 save_context_document 도구로, 저장소에서는 manage_candidate_context.ts put --key <documentKey> --file <markdownPath> --expected-version 0 --note <note> 로 만든 뒤 다시 실행한다.」 로 바꾼다

### 5. `career-os/scripts/plugin-local/workspace.ts` 수정

- `resolvePluginWorkspace` 가 `evidenceDir` 도 낸다. `CAREER_EVIDENCE_DIR` 를 trim 한 값을 `path.resolve` 한 것, 비었으면 `path.join(root, "evidence")`
- `paths` 결과에 `evidenceDir` 를 더한다. `begin`, `finish` 결과는 바꾸지 않는다

### 6. 실행기 `position`

- `career-os/scripts/plugin-local/executors.ts` 의 목록 끝에 `"position"` 을 더한다
- `career-os/scripts/plugin-local/main.ts` 의 `descriptions` 에 `position: "공고를 모아 판정과 분석을 반영하고 리포트를 만든다 (collect | commit-company-tiers | commit-analyses | finalize | cleanup) --run <dir>"` 를 더한다
- 처리: `await runPositionCommand(rest)` 의 반환값을 종료 코드로 쓴다. `PositionRunUsageError` 면 `positionRunHelp()` 와 메시지를 stderr 에 쓰고 2, 그 밖은 메시지만 stderr 에 쓰고 1. `position_run.ts` 의 메인 블록과 같은 출력이다. `PositionRunUsageError`, `positionRunHelp`, `runPositionCommand` 는 이미 export 돼 있다

### 7. 번들 재생성

`bun run --cwd career-os/plugin build` 로 `career-os/plugin/dist/career-local.js` 를 다시 만든다. `dist/career-mcp.js` 는 바뀌지 않아야 한다.

### 8. 테스트

- `career-os/scripts/lib/text-asset.test.ts` 신규: 문자열은 그대로, 문자열이 아닌 값(`{}`)은 이름을 담은 오류
- `career-os/scripts/position-recommender/render/assets.test.ts` 수정: 새 테스트 둘
  - `assets.ts` 소스에 `readFileSync`, `import.meta` 문자열이 없다
  - 임시 디렉터리에 `loadRenderAssets()` 를 불러 `templates.report` 와 `css` 의 길이를 출력하는 진입점을 두고 `Bun.build` 로 번들한 뒤, `cwd` 를 다른 임시 디렉터리로 두고 `bun --no-env-file <번들>` 로 실행하면 두 길이가 원본 import 의 길이와 같다. 진입점은 이 테스트 파일 위치 기준 절대 경로로 `assets.ts` 를 import 한다. 빌드는 `Bun.spawn(["bun", "build", ...])` 처럼 별도 프로세스에서 한다(같은 프로세스의 `Bun.build` 는 다른 테스트와 모듈 해석을 공유해 실패한 적이 있다)
- `career-os/scripts/plugin-local/workspace.test.ts` 수정: `resolvePluginWorkspace({}, "/home/example")` 의 기대값과 「공백만 있는 값은 없는 값으로 본다」 의 기대값에 모두 `evidenceDir: "/home/example/.fos-career/workspace/evidence"` 를 더하고, `CAREER_EVIDENCE_DIR` 가 있으면 그 경로를 내는 단언을 더한다
- `career-os/scripts/plugin-local/main.test.ts` 수정: `help` 출력에 `position` 이 있다. `runPluginLocal(["position", "nope"])` 이 2 다. 「help 는 여섯 실행기를…」 테스트 이름을 일곱으로 고친다
- `career-os/scripts/candidate-context/position-context.test.ts` 수정: 두 문서 가운데 하나가 404 면 오류 메시지에 `save_context_document` 와 `manage_candidate_context.ts put` 이 있고 `career-os/` 는 없다
- `career-os/plugin/scripts/local-bundle.test.ts` 수정: 번들의 `position --help` 가 0 이고 stdout 에 `commit-company-tiers` 가 있다. `workspace paths --json` 의 결과에 `evidenceDir` 가 있다
- `career-os/scripts/position-recommender/position_run.test.ts` 는 고치지 않는다. 기존 단언이 그대로 통과해야 한다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/scripts/lib/text-asset.test.ts ./career-os/scripts/position-recommender/render/assets.test.ts ./career-os/scripts/plugin-local/workspace.test.ts ./career-os/scripts/plugin-local/main.test.ts ./career-os/plugin/scripts/local-bundle.test.ts ./career-os/scripts/candidate-context/position-context.test.ts
bun test ./career-os/scripts ./career-os/plugin ./career-os/.claude/skills
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
./node_modules/.bin/prettier --check career-os/scripts/position-recommender/render/assets.ts career-os/scripts/position-recommender/render/assets.test.ts
git grep -n "career-os/scripts/candidate-context/manage_candidate_context.ts" -- career-os/scripts/candidate-context/position-context.ts && exit 1 || true
```

기대값: 모두 종료 코드 0. 마지막 줄은 아무것도 찍지 않는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/text-asset.ts` | 신규 |
| `career-os/scripts/lib/text-asset.test.ts` | 신규 |
| `career-os/scripts/lib/text-assets.d.ts` | 신규 |
| `career-os/scripts/position-recommender/render/assets.ts` | 수정 |
| `career-os/scripts/position-recommender/render/assets.test.ts` | 수정 |
| `career-os/scripts/candidate-context/position-context.ts` | 수정 |
| `career-os/scripts/candidate-context/position-context.test.ts` | 수정 |
| `career-os/scripts/plugin-local/executors.ts` | 수정 |
| `career-os/scripts/plugin-local/main.ts` | 수정 |
| `career-os/scripts/plugin-local/main.test.ts` | 수정 |
| `career-os/scripts/plugin-local/workspace.ts` | 수정 |
| `career-os/scripts/plugin-local/workspace.test.ts` | 수정 |
| `career-os/plugin/scripts/local-bundle.test.ts` | 수정 |
| `career-os/plugin/dist/career-local.js` | 수정 |
