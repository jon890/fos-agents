# Phase 02. 공개 질문 은행을 정적 import 모듈 하나로 모은다

**Execution profile**: standard

## 목표

공개 질문 은행 JSON 을 정적 import 로 읽는 `career-os/scripts/interview-drill/public-question-bank.ts` 를 만들고, `drill-engine.ts` 와 plugin 의 `interview.ts` 가 이 모듈을 쓰게 한다.
Phase 03 의 로컬 실행기 번들이 실행 파일 위치로 은행 경로를 찾다가 질문 없이 도는 일을 막으려는 것이다.

**범위 외**: 로컬 실행기 진입점과 빌드는 Phase 03 이다. 질문 선별 규칙과 은행 내용은 바꾸지 않는다.

## 컨텍스트

- 지금 `career-os/scripts/interview-drill/drill-engine.ts` 의 `loadPublicTechQuestions`, `loadPublicBehavioralQuestions` 는 `repoRoot()`(`join(dirname(import.meta.path), "..", "..", "..")`) 아래 `career-os/public/question-bank/<카테고리>/questions.json` 을 `existsSync` 와 `readFileSync` 로 읽는다. 파일이 없으면 오류 없이 빈 배열이다. 번들하면 `import.meta.path` 가 번들 위치라 은행이 조용히 비게 된다
- 카테고리 순서는 `TECH_CATEGORIES` 상수 `["java-spring", "database", "cs", "operations", "system-design", "ai-platform"]` 이다
- `career-os/plugin/src/interview.ts` 는 이미 일곱 JSON 을 `import ... with { type: "json" }` 으로 읽고 `publicTechQuestions`, `publicBehavioralQuestions` 를 `as unknown as SelectableQuestion[]` 로 내보낸다. `career-os/plugin/src/contract-parity.test.ts` 와 `interview.test.ts` 가 이 두 이름을 `./interview.ts` 에서 import 한다
- `SelectableQuestion` 은 `career-os/scripts/interview-drill/question-selection.ts` 가 낸다. 이 파일은 `zod` 와 파일 시스템을 import 하지 않는다. 새 모듈도 같은 조건을 지켜 커넥터 번들에 넣을 수 있어야 한다
- 루트 `tsconfig.json` 에는 `resolveJsonModule` 이 없다. plugin `tsconfig.json` 에는 있다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「interview-practice」 절과 「fos-career 커넥터」 절의 경로 표,
`career-os/docs/adr/ADR-138-plugin-로컬-실행기는-scripts-원본을-번들해-부르고-작업본-위치는-설정으로-받는다.md`

## 의도 메모

- 은행 파일은 `career-os/scripts/question-bank-collector/validate.ts` 가 검증한다. 런타임에 다시 parse 하지 않는다
- 공개 은행을 수정하면 MCP 서버 번들과 Phase 03 의 실행기 번들을 함께 다시 만든다. 이 사실은 `code-architecture.md` 가 이미 적고 있다

## 작업 항목

### 1. `career-os/scripts/interview-drill/public-question-bank.ts` 신규

- `career-os/plugin/src/interview.ts` 의 일곱 JSON import 를 이 파일로 옮긴다. 경로는 `../../public/question-bank/<카테고리>/questions.json` 이다
- 주석은 새로 쓴다. 카테고리 순서가 공개 질문 선별 결과를 정하므로 바꾸면 노트북과 대화가 다른 질문을 고른다는 것, 은행 검증은 `question-bank-collector/validate.ts` 가 한다는 것을 적는다. 이 phase 에서 지우는 `TECH_CATEGORIES` 를 가리키지 않는다
- `export const publicTechQuestions = [...javaSpring, ...database, ...cs, ...operations, ...systemDesign, ...aiPlatform] as unknown as SelectableQuestion[];`
- `export const publicBehavioralQuestions = behavioral as unknown as SelectableQuestion[];`
- `SelectableQuestion` 만 `./question-selection.ts` 에서 `import type` 한다. 다른 import 는 두지 않는다

### 2. `career-os/scripts/interview-drill/drill-engine.ts` 수정

- `loadPublicTechQuestions`, `loadPublicBehavioralQuestions`, `TECH_CATEGORIES`, `repoRoot()` 의 은행 읽기 용도를 지운다
- `loadQuestionBank` 는 `publicTechQuestions` 또는 `publicBehavioralQuestions` 를 `as unknown as DrillQuestion[]` 로 펼쳐 쓴다. 공개, 개인, 공고별 순서는 그대로다
- `careerOsRoot()` 는 `doctor` 의 `state/interview-practice` 기본 경로가 아직 쓰므로 남긴다
- `node:fs` import 에서 더 쓰지 않는 이름을 지운다

### 3. `career-os/plugin/src/interview.ts` 수정

- 일곱 JSON import 를 지우고 `export { publicTechQuestions, publicBehavioralQuestions } from "../../scripts/interview-drill/public-question-bank.ts";` 와 같은 모듈에서의 import 로 바꾼다. 이 파일 안에서 두 값을 쓰는 곳은 그대로 동작해야 한다

### 4. 루트 `tsconfig.json` 수정

- `compilerOptions` 에 `"resolveJsonModule": true` 를 더한다

### 5. `career-os/scripts/interview-drill/public-question-bank.test.ts` 신규

- `publicTechQuestions` 의 `category` 를 처음 나온 순서대로 모은 목록이 `["java-spring", "database", "cs", "operations", "system-design", "ai-platform"]` 이다
- `publicBehavioralQuestions` 가 비어 있지 않고 모든 원소의 `category` 가 `"behavioral"` 이다
- 실패 쪽: 이 파일의 소스에 `node:fs`, `readFileSync`, `"zod"`, `import.meta` 문자열이 없다(`readFileSync(join(import.meta.dir, "public-question-bank.ts"))` 로 읽어 확인)
- 실행 위치와 무관함: 임시 디렉터리에 `Bun.build({ entrypoints: [<이 모듈을 import 해 두 배열 길이를 출력하는 임시 진입점>], target: "bun" })` 로 번들한 파일을 `Bun.spawnSync(["bun", <번들 경로>], { cwd: tmpdir() })` 로 실행하면 두 길이가 원본 import 의 길이와 같다

### 6. `career-os/plugin/dist/career-mcp.js` 재생성

`bun run --cwd career-os/plugin build` 로 다시 만든다. `build.test.ts` 가 커밋한 번들과 새 빌드를 대조한다.

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/scripts/interview-drill/public-question-bank.test.ts
bun test ./career-os/scripts/interview-drill ./career-os/plugin
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
git grep -n "question-bank\"" -- career-os/scripts/interview-drill/drill-engine.ts && exit 1 || true
```

기대값: 모두 종료 코드 0. `contract-parity.test.ts` 의 「번들한 공개 질문 은행이 CLI 와 같다」 가 바뀌지 않은 채 통과한다. 이제 두 쪽이 같은 모듈을 쓰므로 순서 보장은 새 `public-question-bank.test.ts` 가 맡는다. 마지막 줄은 아무것도 찍지 않는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/interview-drill/public-question-bank.ts` | 신규 |
| `career-os/scripts/interview-drill/public-question-bank.test.ts` | 신규 |
| `career-os/scripts/interview-drill/drill-engine.ts` | 수정 |
| `career-os/plugin/src/interview.ts` | 수정 |
| `career-os/plugin/dist/career-mcp.js` | 수정 |
| `tsconfig.json` | 수정 |
