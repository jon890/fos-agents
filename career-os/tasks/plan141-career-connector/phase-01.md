# Phase 01. plugin 뼈대와 Backend 읽기 도구 여섯, 설정 검사 테스트

**Execution profile**: standard

## 목표

`career-os/plugin/` 에 fos-assistant 커넥터 `fos-career` 의 뼈대를 만든다.
커리어 Backend 를 읽는 MCP 도구 여섯과 확인 도구가 돌고, `connector.json` 과 `.mcp.json` 이 fos-assistant 의 카탈로그 조건을 지키는지 테스트가 검사한다.
뒤 phase 가 쓰기 도구와 GitHub 도구를 이 뼈대 위에 더한다.

**범위 외**: 쓰기 도구(Phase 03), GitHub 도구와 `check_connection` 의 GitHub 확인(Phase 04), 스킬 본문(Phase 05), 차트(Phase 02). fos-assistant 에 설치하는 일은 이 저장소 밖이다.

## 컨텍스트

본보기는 `accountbook/plugin/` 이다. 아래 파일을 먼저 끝까지 읽는다. 이 phase 의 파일은 그 파일들과 같은 모양으로 쓴다.

| 본보기 | 볼 것 |
| --- | --- |
| `accountbook/plugin/.claude-plugin/plugin.json`, `package.json`, `tsconfig.json` | manifest 와 고정한 의존성 판 |
| `accountbook/plugin/.mcp.json`, `connector.json` | 서버 정의와 `schema: 2` 선언 |
| `accountbook/plugin/scripts/build.ts`, `build.test.ts` | `Bun.build` 로 단일 파일을 만들고 빈 줄을 정리하는 방법, 커밋한 번들과 원본의 일치 검사 |
| `accountbook/plugin/scripts/connector-config.test.ts`, `mcp-config.test.ts` | manifest 일치 검사 |
| `accountbook/plugin/src/client.ts` | `configuredValue`, 오류 class, `safeError`, `redirect: "error"` 와 시간 제한 |
| `accountbook/plugin/src/server.ts`, `server.test.ts` | `createServer(env, fetchImpl)`, 시작 실패 때 stderr 에 코드 한 줄, 번들만 복사해 stdio 로 띄우는 테스트 |
| `accountbook/plugin/src/tools.ts`, `tools.test.ts` | `toolDefinitions`, `call(name, raw)`, 성공과 오류 결과의 모양 |

Backend 의 HTTP 계약이다. 정의를 열어 확인한다.

- 후보자 맥락 문서: `career-os/services/career-backend/src/candidate-context/candidate-context.controller.ts` 의 `GET api/candidate-context/v1/documents`, `GET api/candidate-context/v1/documents/:documentKey`. 문서 키는 같은 디렉터리 `schema.ts` 의 `candidateContextDocumentKeys` 넷이다
- 프로필 원고와 사용량 기록: `career-os/services/career-backend/src/profile/` 의 controller 와 schema. `GET /api/profile/v1/documents`, `GET /api/profile/v1/documents/:documentKey`, `GET /api/profile/v1/usage-snapshots` 다. 문서 키는 `wanted`, `linkedin`, `github` 다
- 인증 실패는 401 이다(`career-os/services/career-backend/src/common/auth.middleware.ts`). 없는 문서는 404 `NOT_FOUND` 다
- 오류 응답의 모양은 `{ error: { code, message, requestId } }` 다(`career-os/scripts/lib/career-backend-http.ts` 의 `responseErrorSchema`)

**이 계획서를 쓸 때 `career-os/services/career-backend/src/profile/` 과 `career-os/scripts/profile/` 이 아직 없었다.**
프로필 쪽 응답의 칸 이름은 그 파일을 열어 읽고 옮긴다. 이 문서의 요약과 코드가 다르면 코드가 맞다.

fos-assistant 가 `connector.json` 에 요구하는 것이다. 어기면 커넥터가 카탈로그에서 빠진다.

- `schema: 2` 는 `tools` 에 MCP 도구를 선언한다. 비어 있으면 안 된다. `default_tool_policy` 는 `deny` 만 받는다
- `tools.<이름>` 은 `risk`(`READ`, `SENSITIVE`, `WRITE`, `DESTRUCTIVE`, `FINANCIAL`), `approval`(`none`, `required`, `always`), `title`(80자까지)을 갖는다. `title` 이 없으면 승인 카드에 「이름 없는 동작」 으로 보인다
- `verify.tool` 은 `tools` 에 있고 `READ` 와 `none` 이어야 하며, 서버가 그 도구를 `readOnlyHint: true` 로 표시해야 한다
- `.mcp.json` 의 서버 env 이름은 `fields[].env` 와 `operator_env` 의 합과 같아야 한다
- `operator_secrets` 가 비어 있지 않으면 카탈로그에서 빠진다. 선언하지 않는다
- `toolsets` 는 `vision` 만 받는다. 이 커넥터는 사진을 받지 않으므로 `toolsets` 와 `attachments` 를 선언하지 않는다
- MCP 서버 이름은 33자까지이고 `fos_assistant` 와 같으면 안 된다. `career` 로 둔다
- 도구 결과는 응답의 첫 텍스트 칸을 JSON 으로 읽고 `structuredContent` 가 있으면 그것을 먼저 쓴다. 실패는 `isError: true` 와 `{"error": {"code": "..."}}` 다
- 확인 도구 호출의 시간 제한은 10초다
- 승인된 쓰기는 새 프로세스에서 실행된다. 도구는 프로세스 안의 상태에 기대지 않는다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「fos-career 커넥터」 절, `career-os/docs/data-schema.md` 의 「fos-career 커넥터」 절, `career-os/docs/flow.md` 의 「커리어 Backend」 절과 「fos-career 커넥터」 절, `career-os/docs/adr/ADR-135-fos-assistant-커넥터는-backend를-감싸고-숫자는-기록에서-직접-읽는다.md`, `career-os/docs/adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md`

## 의도 메모

- **`career-os/scripts/` 의 Backend client 를 import 하지 않는다.** `scripts/lib/career-backend-config.ts` 가 token 파일을 읽는 코드(`statSync`, `readFileSync`)를 갖고, `scripts/candidate-context/client.ts` 가 그것을 import 한다. 번들하면 MCP 서버가 파일을 읽는 코드를 갖게 된다. 또 `scripts/` 는 루트 package 의 `zod` 를 써서 번들에 `zod` 가 두 벌 들어가고, 커밋한 번들이 루트의 설치 상태에 따라 달라진다. `scripts/lib/career-backend-http.ts` 는 5xx 를 두 번 다시 보내 확인 도구의 10초를 넘길 수 있다. 그래서 `plugin/src/backend.ts` 를 얇게 따로 둔다
- 두 client 가 어긋나지 않는지는 번들에 들어가지 않는 테스트가 `scripts/` 의 계약을 import 해 대조한다
- `github_token` 칸에 `pattern` 을 두지 않는다. 비워 둔 선택 칸에 fos-assistant 가 `pattern` 을 적용하는지 문서로 확인하지 못했다
- `check_connection` 은 이 phase 에서 Backend 만 확인하고 `{ backend: "ok" }` 를 낸다. `github` 칸은 Phase 04 가 더한다
- 실제 Backend 를 부르지 않는다. 모든 HTTP 호출은 fetch 대역으로 검증한다
- 테스트와 fixture 에 실제 주소와 token 을 넣지 않는다. `https://career.example.com/` 과 `"x".repeat(40)` 같은 지어낸 값을 쓴다

## Blocked 조건

아래 가운데 하나라도 없으면 `PHASE_BLOCKED: 프로필 저장 모듈과 사용량 수집기가 아직 머지되지 않았다` 를 출력하고 종료한다.

```bash
# cwd: 저장소 루트
test -d career-os/services/career-backend/src/profile
test -f career-os/scripts/profile/contracts.ts
test -f career-os/scripts/profile/client.ts
test -d career-os/scripts/agent-usage
```

## 작업 항목

### 1. `career-os/plugin/.claude-plugin/plugin.json`, `package.json`, `tsconfig.json`, `bun.lock`

- `plugin.json`: `name` 은 `fos-career`, `version` 은 `0.1.0`, `description` 은 「후보자 맥락 문서와 프로필 원고를 조회하고 승인받아 저장하며 GitHub 프로필을 기록의 숫자로 갱신한다.」, `author` 는 본보기와 같다
- `package.json`: `name` 은 `fos-career`, `version` 은 `0.1.0`. `scripts`, `dependencies`, `devDependencies` 는 `accountbook/plugin/package.json` 과 같은 이름과 같은 판이다
- `tsconfig.json`: 본보기와 같다
- `bun install --cwd career-os/plugin` 으로 `bun.lock` 을 만들어 커밋한다

### 2. `career-os/plugin/.mcp.json`

`mcpServers` 아래 서버 하나 `career` 를 둔다. `command` 는 `bun`, `args` 는 `["${CLAUDE_PLUGIN_ROOT}/dist/career-mcp.js"]` 다.

```json
"env": {
  "CAREER_BACKEND_URL": "${CAREER_BACKEND_URL}",
  "CAREER_BACKEND_TOKEN": "${CAREER_BACKEND_TOKEN}",
  "CAREER_GITHUB_TOKEN": "${CAREER_GITHUB_TOKEN:-}",
  "CAREER_GITHUB_PROFILE_REPO": "${CAREER_GITHUB_PROFILE_REPO}"
}
```

### 3. `career-os/plugin/connector.json`

- `schema: 2`, `id: "fos-career"`, `title: "커리어"`, `description: "후보자 맥락 문서와 프로필 원고를 읽고 고치며 GitHub 프로필을 갱신합니다."`
- `fields` 는 둘이다
  - `{ "key": "token", "env": "CAREER_BACKEND_TOKEN", "label": "Backend token", "description": "커리어 Backend 의 token 입니다.", "secret": true, "required": true, "pattern": "^\\S{32,}$" }`
  - `{ "key": "github_token", "env": "CAREER_GITHUB_TOKEN", "label": "GitHub token", "description": "프로필 저장소 하나의 내용 읽기와 쓰기 권한만 가진 token 입니다. 비워 두면 GitHub 도구를 쓰지 않습니다.", "secret": true, "required": false }`
- `verify` 는 `{ "tool": "check_connection" }`
- `tools` 는 이 phase 의 도구 여섯이다. 모두 `"risk": "READ", "approval": "none"` 이고 `title` 을 갖는다

| 도구 | `title` |
| --- | --- |
| `check_connection` | 연결 확인 |
| `list_context_documents` | 후보자 맥락 문서 목록 |
| `get_context_document` | 후보자 맥락 문서 읽기 |
| `list_profile_documents` | 프로필 원고 목록 |
| `get_profile_document` | 프로필 원고 읽기 |
| `list_usage_snapshots` | 사용량 기록 읽기 |

- `default_tool_policy: "deny"`
- `operator_env: ["CAREER_BACKEND_URL", "CAREER_GITHUB_PROFILE_REPO"]`
- `errors` 는 `career-os/docs/data-schema.md` 의 「커넥터 오류 코드」 표에서 공통 어휘 칸이 채워진 코드 전부다. 값을 그 표와 글자까지 같게 둔다
- `toolsets`, `attachments`, `operator_secrets` 를 넣지 않는다

### 4. `career-os/plugin/src/backend.ts`

`zod` 밖의 것을 import 하지 않는다.

```ts
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export function configuredValue(value: string | undefined): string | undefined;
export class CareerError extends Error {
  constructor(code: CareerErrorCode, details?: Record<string, unknown>);
  readonly code: CareerErrorCode;
  readonly details?: Record<string, unknown>;
}
export function safeError(error: unknown): { code: string; message: string };
export class CareerBackend {
  constructor(config: { baseUrl: string; token: string }, fetchImpl?: FetchLike);
  request<T>(method: "GET" | "PUT", path: string, schema: z.ZodType<T>, body?: unknown, idempotencyKey?: string): Promise<T>;
}
```

- `configuredValue` 는 본보기와 같다. 앞뒤 공백을 떼고, 비었거나 `${` 로 시작하면 `undefined` 다
- 생성자는 `baseUrl` 을 `career-os/scripts/lib/career-backend-config.ts` 의 `parseCareerBackendOrigin` 과 같은 규칙으로 검사한다. `http:` 나 `https:` 이고 username, password, search, hash 가 없고 `pathname` 이 `/` 다. token 은 앞뒤 공백을 뗀 뒤 32자 이상이다. 어기면 `CareerError("CAREER_CONFIG")` 다
- `request` 는 `new URL(path, baseUrl)` 로 보낸다. 헤더는 `Authorization: Bearer <token>`, `Accept: application/json` 이고, 본문이 있으면 `Content-Type: application/json`, `idempotencyKey` 가 있으면 `Idempotency-Key` 다. `redirect: "error"`, `signal: AbortSignal.timeout(8_000)` 이다. **다시 보내지 않는다**
- 상태별 오류 코드다. fetch 가 던지면 `CAREER_NETWORK`, 401 과 403 은 `CAREER_UNAUTHORIZED`, 404 는 `CAREER_NOT_FOUND`, 409 는 `CAREER_VERSION_CONFLICT`, 나머지 4xx 는 `CAREER_BAD_REQUEST`, 5xx 는 `CAREER_UNAVAILABLE` 이다. 성공 응답의 JSON 을 읽지 못하거나 `schema.safeParse` 가 실패하면 `CAREER_INVALID_RESPONSE` 다
- `CareerErrorCode` 는 `career-os/docs/data-schema.md` 의 「커넥터 오류 코드」 표의 코드 전부다. 코드마다 사람에게 보일 고정 한국어 문구를 둔다. 문구에 Backend 의 응답 본문, token, 문서 본문을 넣지 않는다
- `safeError` 는 `CareerError` 가 아니면 `CAREER_INTERNAL` 과 고정 문구를 낸다

### 5. `career-os/plugin/src/tools.ts`

```ts
export const contextDocumentKeys = ["learning-interests", "position-preferences", "application-state", "career-status"] as const;
export const profileDocumentKeys = ["wanted", "linkedin", "github"] as const;
export const toolDefinitions: Record<string, { description: string; schema: z.ZodType }>;
export class CareerTools {
  constructor(backend: CareerBackend);
  call(name: string, raw: unknown): Promise<{ content: [{ type: "text"; text: string }]; isError?: true; structuredContent?: Record<string, unknown> }>;
}
```

- 입력 스키마는 모두 `z.strictObject` 다. 입력이 없는 도구는 `z.strictObject({})` 다
- `call` 은 본보기의 `AccountbookTools.call` 과 같은 순서다. 모르는 도구는 `CAREER_UNKNOWN_TOOL`, 스키마 실패는 fetch 를 부르지 않고 `CAREER_INVALID_INPUT` 이다
- 성공은 `{ content: [{ type: "text", text: JSON.stringify(value) }] }`, 실패는 `{ isError: true, content: [{ type: "text", text: JSON.stringify({ error: { code, message }, ...details }) }] }` 다

| 도구 | Backend 요청 | 결과 |
| --- | --- | --- |
| `check_connection` | `GET /api/profile/v1/documents` | `{ backend: "ok" }`. 같은 값을 `structuredContent` 에도 싣는다 |
| `list_context_documents` | `GET /api/candidate-context/v1/documents` | `{ documents: [{ documentKey, version, updatedAt }] }` |
| `get_context_document` | `GET /api/candidate-context/v1/documents/<documentKey>` | `{ document: { documentKey, body, version, note, updatedAt } }` |
| `list_profile_documents` | `GET /api/profile/v1/documents` | `{ documents: [{ documentKey, version, updatedAt }] }` |
| `get_profile_document` | `GET /api/profile/v1/documents/<documentKey>` | `{ document: { documentKey, body, version, note, updatedAt } }` |
| `list_usage_snapshots` | `GET /api/profile/v1/usage-snapshots` | `{ snapshots: [...] }` |

- 후보자 맥락의 응답 스키마는 `career-os/scripts/candidate-context/contracts.ts` 의 `candidateContextListResponseSchema`, `candidateContextGetResponseSchema` 와 같은 칸으로 이 파일에 다시 쓴다
- 프로필 원고와 사용량 기록의 응답 스키마는 `career-os/scripts/profile/contracts.ts` 를 열어 같은 칸으로 다시 쓴다. 사용량 기록 한 줄의 칸 이름을 그 파일에서 그대로 옮긴다

### 6. `career-os/plugin/src/server.ts`

```ts
export function createServer(env?: Record<string, string | undefined>, fetchImpl?: FetchLike): McpServer;
```

- `configuredValue` 로 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN`, `CAREER_GITHUB_PROFILE_REPO` 를 읽는다. `CAREER_GITHUB_PROFILE_REPO` 는 `^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$` 이어야 한다. 없거나 틀리면 `CareerError("CAREER_CONFIG")` 다
- `CAREER_GITHUB_TOKEN` 은 이 phase 에서 읽기만 하고 쓰지 않는다. 없어도 서버가 시작한다
- `new McpServer({ name: "fos-career", version: "0.1.0" })`
- 도구마다 `annotations` 를 준다. `readOnlyHint` 는 `/^(check|list|get)_/.test(name)`, `destructiveHint` 는 `/^(save|update)_/.test(name)`, `idempotentHint` 는 `true`, `openWorldHint` 는 `true` 다
- `import.meta.main` 일 때 stdio 로 연결한다. 시작에 실패하면 stderr 에 오류 코드 한 줄(`CareerError` 가 아니면 `CAREER_MCP_START_FAILED`)만 쓰고 `process.exitCode = 2` 다. 예외와 환경 변수를 직렬화하지 않는다
- 파일을 읽거나 쓰지 않는다. `node:fs` 를 import 하지 않는다

### 7. `career-os/plugin/scripts/build.ts` 와 `career-os/plugin/dist/career-mcp.js`

본보기 `build.ts` 와 같다. `naming` 은 `career-mcp.js`, 실패 오류는 `CAREER_BUILD_FAILED` 다.
`bun run --cwd career-os/plugin build` 로 만든 `dist/career-mcp.js` 를 커밋한다.

### 8. 이 phase 를 검증하는 테스트

`career-os/plugin/src/tools.test.ts`

- 정상: 도구 여섯이 위 표의 경로로 `GET` 을 보내고, `Authorization` 이 `Bearer <token>` 이고 `init.redirect` 가 `"error"` 다
- `get_context_document` 에 `{ documentKey: "wanted" }`, `get_profile_document` 에 `{ documentKey: "career-status" }` 를 주면 fetch 를 부르지 않고 `CAREER_INVALID_INPUT` 이다
- 입력에 모르는 키가 있으면 `CAREER_INVALID_INPUT` 이다
- Backend 가 401 이면 `CAREER_UNAUTHORIZED`, 404 면 `CAREER_NOT_FOUND`, 500 이면 `CAREER_UNAVAILABLE`, fetch 가 던지면 `CAREER_NETWORK` 다. 500 에서 fetch 호출 수가 1 이다
- 성공 상태인데 본문이 `{}` 이거나 `{ documents: "x" }` 면 `CAREER_INVALID_RESPONSE` 다
- 오류 결과의 글에 token 과 Backend 가 준 `error.message` 가 들어 있지 않다

`career-os/plugin/src/server.test.ts`

- `InMemoryTransport` 로 연결해 `listTools()` 의 길이가 6 이고, `check_connection` 의 결과가 `structuredContent` 와 첫 텍스트 칸 모두 `{ backend: "ok" }` 다
- `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN`, `CAREER_GITHUB_PROFILE_REPO` 가운데 하나가 `${UNSET}` 이면 `createServer` 가 `CAREER_CONFIG` 를 던진다. `CAREER_GITHUB_TOKEN` 이 `${CAREER_GITHUB_TOKEN}` 이어도 서버가 만들어진다
- `CAREER_BACKEND_URL` 이 `https://career.example.com/api` 처럼 path 를 가지면 `CAREER_CONFIG` 다
- `dist/career-mcp.js` 만 임시 디렉터리에 복사해 `StdioClientTransport` 로 띄우면 `listTools()` 의 길이가 6 이고 stderr 가 비어 있다

`career-os/plugin/src/contract-parity.test.ts`

- `contextDocumentKeys` 가 `career-os/scripts/candidate-context/contracts.ts` 의 `candidateContextDocumentKeys` 와 같다
- `profileDocumentKeys` 가 `career-os/scripts/profile/contracts.ts` 가 내보내는 프로필 문서 키 목록과 같다. 내보낸 이름은 그 파일에서 읽는다
- 번들(`dist/career-mcp.js`)의 글에 `readFileSync` 와 `statSync` 가 없다

`career-os/plugin/scripts/connector-config.test.ts`

- `schema` 가 2, `default_tool_policy` 가 `deny`, `Object.keys(connector.tools)` 가 `Object.keys(toolDefinitions)` 와 같다
- `verify.tool` 이 `tools` 에서 `READ` 와 `none` 이고 `createServer` 의 `_registeredTools[verify.tool].annotations.readOnlyHint` 가 `true` 다
- 이름이 `check_`, `list_`, `get_` 으로 시작하는 도구는 `READ` 와 `none`, `save_`, `update_` 로 시작하는 도구는 `WRITE` 와 `required` 다
- 모든 도구에 `title` 이 있고 80자 이하다
- `.mcp.json` 의 서버 env 이름이 `fields[].env` 와 `operator_env` 의 합과 같고 값이 `${이름}` 이나 `${이름:-}` 이다
- `errors` 의 값이 `credential_rejected`, `forbidden`, `invalid_input`, `unavailable` 가운데 하나다
- `connector.json` 에 `operator_secrets`, `toolsets`, `attachments` 키가 없다
- `plugin.json`, `package.json` 의 `version` 이 같다

`career-os/plugin/scripts/mcp-config.test.ts`

- `.mcp.json` 의 최상위 키가 `mcpServers` 하나이고 서버 이름이 `career` 하나다. `command` 가 `bun`, `args` 가 `["${CLAUDE_PLUGIN_ROOT}/dist/career-mcp.js"]` 다
- env 가 작업 항목 2 의 네 줄과 같다

`career-os/plugin/scripts/build.test.ts`

- 임시 디렉터리에 빌드한 `career-mcp.js` 가 커밋한 `dist/career-mcp.js` 와 글자까지 같다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test career-os/plugin career-os/plugin/scripts/build.test.ts career-os/plugin/scripts/connector-config.test.ts career-os/plugin/scripts/mcp-config.test.ts career-os/plugin/src/tools.test.ts career-os/plugin/src/server.test.ts career-os/plugin/src/contract-parity.test.ts
bun run --cwd career-os/plugin typecheck
claude plugin validate career-os/plugin
git diff --exit-code -- career-os/plugin/dist/career-mcp.js
! grep -rn "node:fs" career-os/plugin/src/backend.ts career-os/plugin/src/tools.ts career-os/plugin/src/server.ts
```

모두 종료 코드 0 이어야 한다.
`git diff --exit-code` 는 다시 빌드한 번들이 stage 한 번들과 같다는 것을 본다. `dist/career-mcp.js` 를 stage 한 뒤에 돌린다.
루트의 `bun install` 은 `contract-parity.test.ts` 가 `career-os/scripts/` 의 계약을 import 하기 때문에 필요하다.
테스트는 실제 Backend 를 부르지 않는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/.claude-plugin/plugin.json` | 신규 |
| `career-os/plugin/.mcp.json` | 신규 |
| `career-os/plugin/connector.json` | 신규 |
| `career-os/plugin/package.json` | 신규 |
| `career-os/plugin/tsconfig.json` | 신규 |
| `career-os/plugin/bun.lock` | 신규 |
| `career-os/plugin/scripts/build.ts` | 신규 |
| `career-os/plugin/scripts/build.test.ts` | 신규 |
| `career-os/plugin/scripts/connector-config.test.ts` | 신규 |
| `career-os/plugin/scripts/mcp-config.test.ts` | 신규 |
| `career-os/plugin/src/backend.ts` | 신규 |
| `career-os/plugin/src/tools.ts` | 신규 |
| `career-os/plugin/src/server.ts` | 신규 |
| `career-os/plugin/src/tools.test.ts` | 신규 |
| `career-os/plugin/src/server.test.ts` | 신규 |
| `career-os/plugin/src/contract-parity.test.ts` | 신규 |
| `career-os/plugin/dist/career-mcp.js` | 신규 |
