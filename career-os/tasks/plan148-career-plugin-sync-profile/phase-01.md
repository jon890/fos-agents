# Phase 01. 에이전트 사용량 수집기를 로컬 실행기 usage 로 연다

**Execution profile**: deep

## 목표

`career-os/plugin/dist/career-local.js` 에 실행기 `usage` 를 더해 에이전트 사용량 수집기(`scripts/agent-usage/collect_usage.ts`)를 저장소 없이 돌린다.
측정 파이썬 스크립트를 실행 파일 옆에서 찾지 않고 번들에 넣어 stdin 으로 넘긴다.

**범위 외**: sync-profile 스킬 이동은 Phase 02 다. 측정 규칙, 단가표, 수집 규칙은 바꾸지 않는다. `launchd` 등록(`manage_launchd.ts`)은 실행기로 열지 않는다.

## 컨텍스트

- `career-os/scripts/agent-usage/measure.ts` 의 `runAgentUsageScript()` 는 `Bun.spawn(["python3", join(import.meta.dir, "agent_usage.py"), "--json"], { stdout: "pipe", stderr: "inherit" })` 로 측정 스크립트를 실행한다. 번들하면 `import.meta.dir` 가 번들 위치라 스크립트를 찾지 못한다
- `agent_usage.py` 는 `argparse` 로 `--months`, `--json` 을 받고 `~/.claude/projects/**/*.jsonl` 과 `~/.codex/sessions/**/*.jsonl` 을 `os.path.expanduser` 로 읽는다. 자기 파일 위치를 쓰지 않는다
- `career-os/scripts/agent-usage/collect_usage.ts` 는 `async function main(args: readonly string[]): Promise<number>` 를 갖고(export 하지 않음) 맨 아래 `if (import.meta.main) process.exit(await main(process.argv.slice(2)));` 로 끝난다. 사용법 문구는 「인자는 받지 않는다」 이고 `help`, `--help`, `-h` 만 받는다. 연결값은 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN`(또는 `_FILE`)과 선택 Access 값이다. 출력은 줄마다 `<YYYY-MM> <코드>` 이고 코드는 `CREATED`, `EXISTS`, `NO_SESSIONS`, `UP_TO_DATE`, `FAILED` 다
- Backend 경로는 `career-os/scripts/profile/client.ts` 의 `listUsageSnapshots()`(`GET /api/profile/v1/usage-snapshots`, 응답 스키마 `usageSnapshotListResponseSchema`)와 `putUsageSnapshot`(`PUT /api/profile/v1/usage-snapshots/<YYYY-MM>`)이다. 응답 스키마는 `career-os/scripts/profile/contracts.ts` 에서 읽는다
- 텍스트 import 선례와 타입: `career-os/scripts/lib/text-asset.ts` 의 `textAsset`, `career-os/scripts/lib/text-assets.d.ts`(`*.css` 선언). `.py` 는 선언이 없다
- 로컬 실행기: `career-os/scripts/plugin-local/executors.ts`, `main.ts` 의 `descriptions` 와 실행기 처리. 실행기에 넘기기 전에 `process.argv` 를 바꾼다
- 기존 테스트 `career-os/scripts/agent-usage/agent_usage_script.test.ts` 는 `agent_usage.py` 를 파일 경로로 직접 실행한다. 바꾸지 않는다
- 번들을 만드는 테스트는 별도 프로세스에서 빌드한다. 같은 프로세스의 HTTP 대역이 필요하면 `Bun.spawn` 과 `await proc.exited` 를 쓴다(`Bun.spawnSync` 는 대역 응답을 막는다). 테스트 실행은 `bun --no-env-file` 이다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「sync-profile」 절과 「로컬 실행기」 절,
`career-os/docs/data-schema.md` 의 「로컬 실행기 환경 변수」 절,
`career-os/docs/adr/ADR-138-plugin-로컬-실행기는-scripts-원본을-번들해-부르고-작업본-위치는-설정으로-받는다.md`

## 의도 메모

- 파이썬 스크립트는 원본 파일 하나로 둔다. 저장소의 `launchd` 실행과 plugin 실행이 같은 내용을 쓴다
- 스크립트 내용은 stdin 으로 넘기고 `python3 - --json` 으로 실행한다. 임시 파일을 만들지 않는다

## 작업 항목

### 1. `career-os/scripts/lib/text-assets.d.ts` 수정

- `declare module "*.py" { const content: string; export default content; }` 를 더한다

### 2. `career-os/scripts/agent-usage/measure.ts` 수정

- `import agentUsageScript from "./agent_usage.py" with { type: "text" };` 와 `textAsset` 으로 스크립트 본문을 얻는다
- `runAgentUsageScript()` 는 `Bun.spawn(["python3", "-", "--json"], { stdin: new Blob([본문]), stdout: "pipe", stderr: "inherit" })` 로 실행한다. 출력 처리와 실패 문구는 그대로다
- `node:path` 의 `join` 을 더 쓰지 않으면 import 를 지운다

### 3. `career-os/scripts/agent-usage/collect_usage.ts` 수정

- `main` 을 `export` 한다. 동작은 바꾸지 않는다

### 4. 실행기 `usage`

- `executors.ts` 목록 끝에 `"usage"` 를, `main.ts` 의 `descriptions` 에 「기록이 없는 끝난 달의 에이전트 사용량을 측정해 Backend 에 올린다」 를 더한다
- 처리: `await main(rest)` 의 반환값을 종료 코드로 쓴다

### 5. 번들 재생성

`bun run --cwd career-os/plugin build` 로 `dist/career-local.js` 를 다시 만든다. `dist/career-mcp.js` 는 바뀌지 않아야 한다.

### 6. 테스트

- `career-os/scripts/agent-usage/measure.test.ts` 수정: `measure.ts` 소스에 `import.meta.dir` 와 `agent_usage.py"` 경로 문자열 조합(`join(`)이 없다. `runAgentUsageScript()` 를 `HOME` 을 빈 임시 디렉터리로 둔 별도 프로세스에서 실행하면(`bun --no-env-file -e` 로 이 함수를 불러 결과를 출력) `parseMeasurement` 가 받는 JSON 이 나오고 `months` 가 빈 배열이다
- `career-os/scripts/plugin-local/main.test.ts` 수정: `help` 에 `usage` 가 있다. help 테스트 이름의 실행기 수와 `toHaveLength(8)` 을 9 로 맞춘다
- `career-os/plugin/scripts/local-bundle.test.ts` 수정: `HOME` 을 빈 임시 디렉터리로, `CAREER_BACKEND_URL` 을 `Bun.serve` 대역으로, 40자 지어낸 token 을 준다. 대역은 `GET /api/profile/v1/usage-snapshots` 에 기록 없음 응답을 낸다. 번들의 `usage` 를 `Bun.spawn` 으로 실행하면 종료 코드 0 이고 stdout 이 `<YYYY-MM> NO_SESSIONS` 한 줄이다. 대역이 `PUT` 을 받지 않았다. 번들 안의 측정 스크립트가 실제로 돌았다는 근거다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/scripts/agent-usage/measure.test.ts ./career-os/scripts/plugin-local/main.test.ts ./career-os/plugin/scripts/local-bundle.test.ts
bun test ./career-os/scripts ./career-os/plugin ./career-os/.claude/skills
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
```

기대값: 모두 종료 코드 0.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/text-assets.d.ts` | 수정 |
| `career-os/scripts/agent-usage/measure.ts` | 수정 |
| `career-os/scripts/agent-usage/measure.test.ts` | 수정 |
| `career-os/scripts/agent-usage/collect_usage.ts` | 수정 |
| `career-os/scripts/plugin-local/executors.ts` | 수정 |
| `career-os/scripts/plugin-local/main.ts` | 수정 |
| `career-os/scripts/plugin-local/main.test.ts` | 수정 |
| `career-os/plugin/scripts/local-bundle.test.ts` | 수정 |
| `career-os/plugin/dist/career-local.js` | 수정 |
