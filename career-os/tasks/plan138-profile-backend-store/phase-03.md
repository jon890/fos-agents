# Phase 03. `scripts/profile/` 에 계약과 client 와 `manage_profile.ts` 를 만든다

**Execution profile**: standard

## 목표

`career-os/scripts/profile/` 에 `/api/profile/v1` 의 zod 계약, HTTP client, CLI `manage_profile.ts` 를 만든다.
사람과 스킬과 사용량 수집기가 같은 계약으로 프로필 원고와 사용량 기록을 읽고 쓰기 위해서다.

이 phase 가 끝나면 아래 명령이 동작한다.

```bash
bun career-os/scripts/profile/manage_profile.ts documents list
bun career-os/scripts/profile/manage_profile.ts documents get --key github
bun career-os/scripts/profile/manage_profile.ts documents put --key github --file <markdownPath> --expected-version 1 --note "<변경 이유>"
bun career-os/scripts/profile/manage_profile.ts usage list
bun career-os/scripts/profile/manage_profile.ts usage put --month 2026-09 --claude-tokens 1200 --codex-tokens 300 --unpriced-tokens 0 --measured-on 2026-10-01 --source MEASURED
```

**범위 외**: `sync-profile` 스킬이 이 CLI 를 쓰게 고치는 일, 사용량 수집기, 옛 기록의 이전, fos-assistant 커넥터는 이 plan 밖이다.
Backend 코드는 Phase 01 과 Phase 02 가 끝냈고 이 phase 에서 고치지 않는다.

## 컨텍스트

본보기는 `career-os/scripts/candidate-context/` 다. 같은 구조로 만든다.

| 무엇 | 따를 곳 |
| --- | --- |
| zod 계약 | `career-os/scripts/candidate-context/contracts.ts`. Backend 의 `schema.ts` 를 import 하지 않고 같은 규칙을 다시 적는다 |
| client | `career-os/scripts/candidate-context/client.ts` 의 `CandidateContextClient`. 생성자 옵션 `{ origin, token, fetchImpl, timeoutMs, maxRetries }`, 옵션이 없으면 `resolveCareerBackendConnection(process.env)` |
| 연결값 | `career-os/scripts/lib/career-backend-config.ts` 의 `resolveCareerBackendConnection`. `CAREER_BACKEND_URL` 과, `CAREER_BACKEND_TOKEN` 이나 `CAREER_BACKEND_TOKEN_FILE` 중 하나를 읽는다 |
| HTTP | `career-os/scripts/lib/career-backend-http.ts` 의 `careerBackendRequest(options, method, path, body, idempotencyKey, schema)` 와 `CareerBackendHttpError(status, code, message, requestId?)` |
| 멱등 키 | `career-os/scripts/candidate-context/client.ts` 가 export 하는 `hashKey(prefix, value)`. 접두사 뒤에 정규화한 JSON 의 SHA-256 hex 를 붙인다 |
| 저장소 안 경로 거절 | `career-os/scripts/candidate-context/repository-guard.ts` 의 `assertOutsideRepository(path, label = "--out"): string`. 대상 경로가 어느 git 저장소 안이든, 이미 있는 symlink 든 거절하고 확인한 실제 경로를 돌려준다 |
| CLI | `career-os/scripts/candidate-context/manage_candidate_context.ts`. `firstOptionValue`(`career-os/scripts/lib/cli.ts`)로 옵션을 읽고, 문자열 결과는 `process.stdout.write` 로 줄바꿈 없이, 나머지는 `JSON.stringify(result, null, 2)` 로 낸다. 실패하면 메시지를 표준 오류로 내고 종료 코드 1 이다 |
| 테스트 | `career-os/scripts/candidate-context/client.test.ts`, `manage_candidate_context.test.ts`. `bun:test`, 가짜 `fetch`, `Bun.serve` 가짜 서버, `Bun.spawn` 으로 CLI 실행 |

HTTP 계약은 `career-os/docs/flow.md` 의 「프로필 HTTP 계약」 절이 정답이다. 기억이나 이 파일의 요약이 그 절과 다르면 그 절을 따른다.

- `GET /api/profile/v1/documents` 는 `{ documents: [{ documentKey, version, updatedAt }] }`
- `GET /api/profile/v1/documents/:documentKey` 는 `{ document: { documentKey, body, version, note, updatedAt } }`, 없으면 `404`
- `PUT /api/profile/v1/documents/:documentKey` 는 요청 `{ body, note, expectedVersion }`, 응답 `{ document: { documentKey, version, updatedAt } }`, version 이 다르면 `409 VERSION_CONFLICT`
- `GET /api/profile/v1/usage-snapshots` 는 `{ snapshots: [기록] }`
- `PUT /api/profile/v1/usage-snapshots/:month` 는 응답 `{ snapshot: 기록, created }`. 기록이 이미 있고 `replace` 가 참이 아니면 `200` 으로 저장돼 있던 기록과 `created: false` 가 온다

**근거 문서**: `career-os/docs/flow.md` 의 「프로필 HTTP 계약」 절,
`career-os/docs/code-architecture.md` 의 「프로필 저장 CLI」 절과 「실행 코드를 두 자리 중 어디에 두나」 절,
`career-os/docs/data-schema.md` 의 「프로필 원고 table」 절과 「에이전트 사용량 기록 table」 절,
`career-os/docs/adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md`

## 의도 메모

- `repository-guard.ts` 를 복사하지 않고 `../candidate-context/repository-guard.ts` 에서 import 한다. 판정 규칙이 두 벌이 되면 한쪽만 고쳐진다. `hashKey` 도 `../candidate-context/client.ts` 에서 import 한다.
- `career-os/scripts/candidate-context/` 의 파일은 고치지 않는다. 같은 디렉터리의 `position-policy.ts` 와 `manage_candidate_context.ts` 는 다른 작업이 고치는 중이다.
- 멱등 키 접두사는 `profile-document` 와 `profile-usage` 다. 지금 쓰이는 접두사는 `candidate-context`, `analysis-policy-sync`, `source` 와 공부 추천 client 의 것들이고 이 둘과 겹치지 않는다. 다른 접두사로 바꾸려면 `git grep -n "hashKey(" -- career-os/scripts` 로 겹치지 않는지 먼저 확인한다.
- `usage put` 은 측정값을 파일이 아니라 옵션으로 받는다. 숫자는 개인 본문이 아니고, 수집기는 CLI 가 아니라 `ProfileClient` 를 직접 부른다.
- `usage put` 이 `created: false` 를 받아도 종료 코드는 0 이다. 처음 값을 지킨 정상 결과다. 출력의 `created` 로 구분한다.
- `--replace` 를 `--note` 없이 주면 요청을 보내기 전에 거절한다. Backend 도 `400` 으로 거절하지만 사람이 고칠 것은 인자다.
- 오류 출력에 원고 본문을 담지 않는다. 상태, code, requestId 만 낸다.
- CLI 는 `.env` 를 스스로 읽지 않는다. `manage_candidate_context.ts` 와 같이 환경값이 이미 있다고 보고, 필요하면 호출하는 쪽이 `bun --env-file=career-os/.env` 로 넘긴다.

## 작업 항목

### 1. `career-os/scripts/profile/contracts.ts` 신규

```ts
export const profileDocumentKeys = ["wanted", "linkedin", "github"] as const;
export const profileDocumentKeySchema = z.enum(profileDocumentKeys);
export type ProfileDocumentKey = z.infer<typeof profileDocumentKeySchema>;

export const profileDocumentPutPayloadSchema;   // { body, note, expectedVersion }
export const profileDocumentSchema;             // { documentKey, body, version, note, updatedAt }
export const profileDocumentListResponseSchema; // { documents: [{ documentKey, version, updatedAt }] }
export const profileDocumentGetResponseSchema;  // { document }
export const profileDocumentPutResponseSchema;  // { document: { documentKey, version, updatedAt } }

export const usageSnapshotSources = ["MEASURED", "BACKFILLED"] as const;
export const usageMonthSchema;                  // /^\d{4}-(0[1-9]|1[0-2])$/
export const usageSnapshotPutPayloadSchema;
export const usageSnapshotSchema;
export const usageSnapshotListResponseSchema;   // { snapshots: [usageSnapshot] }
export const usageSnapshotPutResponseSchema;    // { snapshot, created: boolean }
```

타입은 각 스키마에서 `z.infer` 로 export 한다(`ProfileDocument`, `ProfileDocumentPutPayload`, `UsageSnapshot`, `UsageSnapshotPutPayload`, `UsageSnapshotPutResponse` 등).

- 문서 계약은 `candidate-context/contracts.ts` 와 같은 규칙이다. `body` 는 `trim()` 뒤 비면 거절하고 UTF-8 65,536 바이트를 넘으면 거절한다. `note` 는 `trim()` 뒤 1자 이상 500자 이하, `expectedVersion` 은 0 이상의 정수다
- `usageSnapshotPutPayloadSchema`: `claudeTokens`, `codexTokens`, `unpricedTokens`(0 이상의 안전한 정수), `claudeCostUsd`, `codexCostUsd`(선택, `null` 가능. Backend 와 같은 `z.number().nonnegative().max(9_999_999_999.99).multipleOf(0.01).nullable().optional()`. 곱셈으로 소수 자리를 검사하지 않는다. `0.07*100` 이 `7.000000000000001` 이다), `sessions`(선택, `null` 가능, 0 이상의 정수), `measuredOn`(`YYYY-MM-DD` 이고 달력에 있는 날짜), `source`, `note`(선택, `trim()` 뒤 1자 이상 500자 이하), `replace`(선택, boolean). `replace === true` 인데 `note` 가 없으면 거절한다
- `usageSnapshotSchema`: `month`, `claudeTokens`, `codexTokens`, `claudeCostUsd`(number 나 `null`), `codexCostUsd`(number 나 `null`), `sessions`(number 나 `null`), `unpricedTokens`, `measuredOn`, `source`, `note`(string 이나 `null`), `createdAt`, `updatedAt`

### 2. `career-os/scripts/profile/client.ts` 신규

```ts
export const PROFILE_API_BASE_PATH = "/api/profile/v1";
export type ProfileFetch = (input: URL, init: RequestInit) => Promise<Response>;
export interface ProfileClientOptions { origin?: string; token?: string; fetchImpl?: ProfileFetch; timeoutMs?: number; maxRetries?: number }

export class ProfileClient {
  constructor(options?: ProfileClientOptions);
  listDocuments(): Promise<ProfileDocumentListResponse>;
  getDocument(key: string): Promise<ProfileDocument>;
  putDocument(key: string, payload: ProfileDocumentPutPayload): Promise<ProfileDocumentPutResponse>;
  listUsageSnapshots(): Promise<UsageSnapshot[]>;
  putUsageSnapshot(month: string, payload: UsageSnapshotPutPayload): Promise<UsageSnapshotPutResponse>;
}
export function createProfileClient(options?: ProfileClientOptions): ProfileClient;
```

- 생성자는 `CandidateContextClient` 와 같다. `origin` 과 `token` 은 둘 다 주거나 둘 다 주지 않는다. 기본 timeout 은 10,000 ms, 기본 재시도는 2 다
- 키, 달, payload 는 요청을 보내기 전에 zod 로 검사한다. 실패하면 요청을 보내지 않고 예외를 던진다
- `putDocument` 의 멱등 키: `hashKey("profile-document", { documentKey, body, note, expectedVersion })`
- `putUsageSnapshot` 의 멱등 키: `hashKey("profile-usage", { month, payload })`. `payload` 는 zod 로 검사한 값이다
- `putUsageSnapshot` 은 `created` 가 `false` 여도 예외를 던지지 않고 응답을 그대로 돌려준다

### 3. `career-os/scripts/profile/manage_profile.ts` 신규

첫 줄은 `#!/usr/bin/env bun` 이다. `export async function manageProfile(args = process.argv.slice(2)): Promise<unknown>` 와
`export function formatManageProfileError(error: unknown): string` 을 둔다. `import.meta.main` 일 때만 실행한다.

| 명령 | 동작 | 출력 |
| --- | --- | --- |
| 인자 없음, `help`, `--help`, `-h` | 연결값 없이 사용법 문자열을 낸다. `사용법:` 으로 시작한다 | 문자열 |
| `documents list` | `listDocuments` | 요약 배열 JSON |
| `documents get --key <k> [--out <path>]` | `--out` 이 있으면 요청 전에 `assertOutsideRepository(out)` 로 검사한다. `--out` 이 없으면 본문을 줄바꿈을 더하지 않고 그대로 낸다. 있으면 그 경로에 본문을 쓰고 요약을 낸다 | 본문 문자열, 또는 `{ documentKey, version, updatedAt, out }` |
| `documents put --key <k> --file <markdownPath> --expected-version <n> --note <note>` | 파일을 UTF-8 로 읽어 본문으로 보낸다 | `{ documentKey, version, updatedAt }` |
| `usage list` | `listUsageSnapshots` | 기록 배열 JSON |
| `usage put --month <YYYY-MM> --claude-tokens <n> --codex-tokens <n> --unpriced-tokens <n> --measured-on <YYYY-MM-DD> --source <MEASURED\|BACKFILLED> [--claude-cost-usd <n>] [--codex-cost-usd <n>] [--sessions <n>] [--note <note>] [--replace]` | `putUsageSnapshot` | `{ snapshot, created }` |

- 첫 인자가 `documents` 나 `usage` 가 아니거나 둘째 인자가 위 표에 없으면 사용법을 메시지로 예외를 던진다
- `--key` 가 `wanted`, `linkedin`, `github` 가 아니면 요청 전에 거절하고 메시지에 세 키를 적는다
- 필수 옵션이 없으면 `--<이름> 값이 필요하다.` 로 거절한다
- `--expected-version`, 토큰 셋, `--sessions` 는 `Number(...)` 로 바꾼 뒤 정수와 범위를 검사한다. `--claude-cost-usd`, `--codex-cost-usd` 는 `Number.isFinite` 만 보고 나머지는 contracts 의 zod 에 맡긴다. 숫자가 아니면 요청 전에 거절한다
- `--replace` 는 값이 없는 옵션이다. `args.includes("--replace")` 로 읽는다. `--replace` 가 있는데 `--note` 가 없으면 요청 전에 거절한다
- 주지 않은 `--claude-cost-usd`, `--codex-cost-usd`, `--sessions`, `--note` 는 payload 에 넣지 않는다
- `documents get` 의 `404` 는 `문서가 없다: <key>. documents put --expected-version 0 으로 새 문서를 만든다.` 로 바꾼다
- `documents put` 의 `409` 는 `문서가 바뀌었다. documents get 으로 다시 조회하고 변경을 검토한 뒤 명령을 다시 실행한다.` 로 바꾼다
- `formatManageProfileError` 는 `CareerBackendHttpError` 면 `<message> (status=<status>, code=<code>, requestId=<id>)` 를 낸다. `requestId` 가 없으면 그 칸을 뺀다. 본문을 담지 않는다

### 4. 이 phase 를 검증하는 `career-os/scripts/profile/client.test.ts` 신규

가짜 `fetchImpl` 을 넘겨 `new ProfileClient({ origin: "https://career.example.com", token: "x".repeat(32), fetchImpl, maxRetries: 0 })` 로 만든다.

- `putDocument("github", payload)` 가 `PUT /api/profile/v1/documents/github` 로 본문을 보내고 `Idempotency-Key` 가 `profile-document:` 로 시작한다
- 같은 입력은 같은 키, `expectedVersion` 이 다르면 다른 키다
- `409` 응답이 `CareerBackendHttpError` 로 나오고 `status`, `code`, `requestId` 를 담는다
- 없는 문서 키와 공백뿐인 본문은 요청 전에 거절한다. 가짜 `fetch` 호출 수가 0 이다
- `getDocument` 가 본문을 돌려주고 `listDocuments` 가 요약 목록을 돌려준다
- `putUsageSnapshot("2026-09", payload)` 가 `PUT /api/profile/v1/usage-snapshots/2026-09` 로 보내고 `Idempotency-Key` 가 `profile-usage:` 로 시작한다. 값이 다른 payload 는 다른 키다
- 응답이 `created: false` 여도 예외 없이 `{ snapshot, created: false }` 를 돌려준다
- 달 `2026-13`, 음수 토큰, `replace: true` 에 `note` 가 없는 payload 는 요청 전에 거절한다
- 비용과 세션 수가 `null` 인 기록을 담은 `GET usage-snapshots` 응답을 읽는다
- 계약에 없는 모양의 성공 응답(`snapshots` 가 배열이 아니다)은 `CareerBackendHttpError` 의 `INVALID_RESPONSE` 로 나온다

### 5. 이 phase 를 검증하는 `career-os/scripts/profile/manage_profile.test.ts` 신규

`manage_candidate_context.test.ts` 의 `useApi`, `tempDir`, `runCli` 와 같은 도우미를 이 파일 안에 둔다. `afterEach` 에서 `globalThis.fetch` 와 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN`, `CAREER_BACKEND_TOKEN_FILE` 을 되돌리고 임시 디렉터리를 지운다.
본문과 숫자는 지어낸 예시만 쓴다.

- `[]`, `["help"]`, `["--help"]`, `["-h"]` 가 연결값 없이 `사용법:` 을 담은 문자열을 내고 `fetch` 를 부르지 않는다
- 없는 묶음(`["policy", "list"]`)과 없는 명령(`["documents", "delete"]`)은 예외다
- 없는 `--key` 와 `--file` 없는 `documents put` 은 요청 전에 거절한다
- 저장소 안 `--out`(`<저장소 루트>/career-os/tmp-profile.md`)은 요청 전에 거절하고 메시지에 `저장소 밖` 이 있다
- 이미 있는 symlink 를 `--out` 으로 주면 가리키는 곳과 관계없이 거절한다
- cwd 가 저장소 밖이어도 저장소 안 `--out` 은 종료 코드 1 이고, 저장소 밖 `--out` 은 종료 코드 0 이며 파일 내용이 본문과 같다. `Bun.serve` 가짜 서버와 `Bun.spawn` 으로 확인한다
- `documents get` 을 `--out` 없이 실행하면 표준 출력이 본문 그대로다. 끝 줄바꿈이 늘지 않는다
- `documents get` 의 `404` 가 `--expected-version 0` 을 안내한다
- `documents put` 이 파일 본문을 `{ body, note, expectedVersion }` 로 보내고 요약만 돌려준다
- `documents put` 의 `409` 가 다시 조회하라고 안내하고, `formatManageProfileError` 의 출력에 파일 본문이 없다
- `usage put` 이 옵션을 `{ claudeTokens, codexTokens, unpricedTokens, measuredOn, source }` 로 보내고, 주지 않은 선택 옵션은 본문에 없다
- `usage put` 에 `--claude-cost-usd 12.34 --codex-cost-usd 5.6 --sessions 7` 을 주면 본문에 숫자로 들어간다
- `usage put` 에 `--claude-cost-usd 0.07 --codex-cost-usd 0.29` 를 주면 client 가 거절하지 않고 요청이 본문에 그 값을 담아 나간다
- `usage put --replace` 를 `--note` 없이 주면 요청 전에 거절한다. `--replace --note "<사유>"` 는 본문에 `replace: true` 와 `note` 를 담는다
- `usage put` 이 `created: false` 응답을 받으면 `Bun.spawn` 으로 실행한 CLI 의 종료 코드가 0 이고 표준 출력 JSON 의 `created` 가 `false` 다
- `--claude-tokens abc` 와 `--month 2026-13` 은 요청 전에 거절한다
- `usage list` 가 기록 배열을 돌려준다

## 검증

```bash
# cwd: 저장소 루트
bun install
bun test ./career-os/scripts/profile/client.test.ts ./career-os/scripts/profile/manage_profile.test.ts
bun test ./career-os/scripts/candidate-context/ ./career-os/scripts/lib/career-backend-naming.test.ts ./career-os/scripts/lib/cli-contract.test.ts
bunx tsc --noEmit
git diff --check
```

모두 종료 코드 0 이어야 한다. 이 phase 의 테스트는 가짜 `fetch` 와 `Bun.serve` 가짜 서버를 쓰므로 MySQL 과 실행 중인 Backend 가 필요 없다.
환경값도 필요 없다. 테스트가 `CAREER_BACKEND_URL` 과 `CAREER_BACKEND_TOKEN` 을 스스로 넣고 되돌린다.
둘째 명령은 함께 쓰는 `repository-guard.ts` 와 `hashKey` 의 기존 테스트, 그리고 추적 파일 전체에서 옛 Backend 이름을 찾는 `career-backend-naming.test.ts` 다.

```bash
# cwd: 저장소 루트
git diff --stat -- career-os/scripts/candidate-context career-os/services/career-backend
bun career-os/scripts/profile/manage_profile.ts help
```

첫 명령의 출력이 비어 있어야 한다. 둘째 명령은 연결값 없이 종료 코드 0 으로 `사용법:` 으로 시작하는 글을 내야 한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/profile/contracts.ts` | 신규 |
| `career-os/scripts/profile/client.ts` | 신규 |
| `career-os/scripts/profile/manage_profile.ts` | 신규 |
| `career-os/scripts/profile/client.test.ts` | 신규 |
| `career-os/scripts/profile/manage_profile.test.ts` | 신규 |
