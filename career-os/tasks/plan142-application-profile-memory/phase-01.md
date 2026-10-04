# Phase 01. 지원서 공통 프로필을 읽는 CLI

**Execution profile**: standard

## 목표

fos-assistant Memory 의 서비스 읽기 API 로 지원서 공통 프로필을 읽어 저장소 밖 파일에 쓰는 CLI 를 만든다.
`application-package-writer` 가 개인 스킬 `brain-search` 없이 공통 프로필을 읽게 하려는 것이다.

**범위 외**: 스킬 문서, `AGENTS.md`, `README.md`, `application_form_schema.ts` 와 경계 테스트는 Phase 02 다.
fos-assistant 저장소는 고치지 않는다. 실제 fos-assistant 를 부르지 않는다.

## 컨텍스트

**근거 문서**: `career-os/docs/flow.md` 의 「지원서 공통 프로필」 절, `career-os/docs/code-architecture.md` 의 「지원서 공통 프로필」 절, `career-os/docs/adr/ADR-136-지원서-공통-프로필은-fos-assistant-memory에서-서비스-토큰으로-읽는다.md`

- 결정: `career-os/docs/adr/ADR-136-지원서-공통-프로필은-fos-assistant-memory에서-서비스-토큰으로-읽는다.md`
- 흐름과 실패 갈래: `career-os/docs/flow.md` 의 「지원서 공통 프로필」 절. 상태별 동작 표가 이 phase 의 기대값이다.
- 모듈 책임, 환경 변수, 출력 칸: `career-os/docs/code-architecture.md` 의 「지원서 공통 프로필」 절.
- fos-assistant 계약(읽기만 한다): `GET /api/v1/service/memory-documents/{collection}/{documentKey}`, `Authorization: Bearer <서비스 토큰>`.
  - 200 본문 `{collection, documentKey, title, content, revision, updatedAt}`. `revision` 은 정수, `updatedAt` 은 ISO 시각 문자열. 머리말 `X-Service-Token-Expires-At` 에 토큰 만료 시각.
  - 401 과 403 은 본문이 없다. 404 는 `MEMORY_NOT_FOUND`, 409 는 `MEMORY_ENCRYPTION_UNAVAILABLE`. 오류 본문은 최상위 `{code, message, ...}` 이다.
  - `Origin` 머리말이 있으면 403 이다.
- 따를 기존 패턴:
  - CLI 모양: `career-os/scripts/candidate-context/manage_candidate_context.ts` (사용법 문자열, `firstOptionValue`, `import.meta.main` 블록, 오류 형식 함수).
  - origin 검사: `career-os/scripts/lib/career-backend-config.ts` 의 `parseCareerBackendOrigin` 과 같은 규칙(HTTP/HTTPS, credentials, query, hash, path 없음). 오류 문구가 `CAREER_BACKEND_URL` 을 말하므로 이 함수를 그대로 부르지 않고 `client.ts` 안에 `FOS_ASSISTANT_URL` 을 말하는 검사를 둔다.
  - 재시도와 timeout: `career-os/scripts/lib/career-backend-http.ts` 의 `careerBackendRequest` 처럼 5xx 와 연결 실패만 다시 시도한다. 그 함수는 오류 문구가 「커리어 Backend」 이고 오류 본문 모양이 달라 부르지 않는다.
  - 저장소 경로 검사: `career-os/scripts/candidate-context/repository-guard.ts` 의 `assertOutsideRepository(path, label)`. 확인한 실제 경로를 돌려준다.
  - 테스트 모양: `career-os/scripts/candidate-context/client.test.ts`(fetch 대역), `career-os/scripts/candidate-context/manage_candidate_context.test.ts`(환경 변수 저장과 복원, `Bun.serve` 대역 서버로 서브프로세스 CLI 실행).

## 의도 메모

- 문서 키와 collection 은 상수다. 환경 변수로 덮어쓰지 않는다. 들일 때 문서 키를 맞춘다(원격 검증 목록 첫 줄).
- 본문을 표준 출력으로 내는 모드를 두지 않는다. 에이전트 실행 기록에 연락처가 남는다.
- 오류 메시지에 응답 본문, `message`, 문서 본문, 토큰을 넣지 않는다. 상태 번호와 고정 문구만 넣는다.
- 토큰 길이 하한을 두지 않는다. fos-assistant 의 토큰 형식은 그쪽 계약이고, 틀리면 401 이 알린다. 빈 값만 거절한다.
- 커리어 Backend 연결값(`CAREER_BACKEND_*`)을 읽지 않는다.

## 작업 항목

### 1. `career-os/scripts/application-profile/contracts.ts`

- `export const APPLICATION_PROFILE_COLLECTION = "identity" as const;`
- `export const APPLICATION_PROFILE_DOCUMENT_KEY = "career-application-profile" as const;`
- `export const APPLICATION_PROFILE_SOURCE = "fos-assistant-memory:identity/career-application-profile" as const;` Phase 02 의 `application_form_schema.ts` 가 쓴다.
- `applicationProfileResponseSchema`: zod 객체. `collection: z.literal(APPLICATION_PROFILE_COLLECTION)`, `documentKey: z.literal(APPLICATION_PROFILE_DOCUMENT_KEY)`, `title: z.string()`, `content: z.string()`, `revision: z.number().int().positive()`, `updatedAt: z.string().min(1)`. 모르는 칸은 버린다(zod 기본).
- `export type ApplicationProfileDocument = z.infer<typeof applicationProfileResponseSchema>;`

### 2. `career-os/scripts/application-profile/client.ts`

- `export type FosAssistantConnection = { baseUrl: string; token: string };`
- `export function resolveFosAssistantConnection(environment: Record<string, string | undefined> = process.env): FosAssistantConnection`
  - `FOS_ASSISTANT_URL` 이 비면 `"FOS_ASSISTANT_URL 환경값이 필요하다. career-os/.env 에 채운다."`
  - origin 규칙을 어기면 `"FOS_ASSISTANT_URL은 credentials, query, hash, path 없는 HTTP 또는 HTTPS origin이어야 한다."`
  - `FOS_ASSISTANT_SERVICE_TOKEN` 이 trim 뒤 비면 `"FOS_ASSISTANT_SERVICE_TOKEN 환경값이 필요하다. career-os/.env 에 채운다."`
- `export class ApplicationProfileHttpError extends Error` — 읽기 전용 `status: number | null`, `code: string`. 메시지는 아래 표의 고정 문구다.

  | 조건 | `code` | 메시지 |
  | --- | --- | --- |
  | 401 | `UNAUTHORIZED` | `서비스 토큰이 거절됐다. fos-assistant 웹 화면에서 identity 를 받는 토큰을 새로 발급해 career-os/.env 의 FOS_ASSISTANT_SERVICE_TOKEN 을 바꾼다.` |
  | 403 | `FORBIDDEN` | `fos-assistant 가 요청을 거절했다. 요청에 Origin 머리말이 붙지 않았는지 CLI 를 확인한다.` |
  | 404 | 응답 `code` 가 문자열이면 그 값, 아니면 `MEMORY_NOT_FOUND` | `지원서 공통 프로필을 찾지 못했다. fos-assistant 웹 화면에서 identity 의 민감 문서 career-application-profile 이 있는지, 토큰이 identity 의 민감 읽기를 받는지 확인한다.` |
  | 409 이고 `code` 가 `MEMORY_ENCRYPTION_UNAVAILABLE` | `MEMORY_ENCRYPTION_UNAVAILABLE` | `fos-assistant 에 민감 본문을 풀 key 가 없다. fos-assistant 운영자에게 알린다.` |
  | 그 밖의 4xx | 응답 `code` 가 문자열이면 그 값, 아니면 `HTTP_ERROR` | `fos-assistant 요청이 실패했다.` |
  | 5xx 를 다 쓴 뒤 | `HTTP_ERROR` | `fos-assistant 요청이 실패했다.` |
  | 연결 실패, timeout | `NETWORK_ERROR` (`status` null) | `fos-assistant 에 연결하지 못했다.` |
  | 200 인데 JSON 이 아니거나 schema 를 어긴다 | `INVALID_RESPONSE` | `fos-assistant 응답 계약이 올바르지 않다.` |

- `export type ApplicationProfileFetch = (input: URL, init: RequestInit) => Promise<Response>;`
- `export type ReadApplicationProfileOptions = { connection?: FosAssistantConnection; fetchImpl?: ApplicationProfileFetch; timeoutMs?: number; maxRetries?: number };` 기본값은 `resolveFosAssistantConnection(process.env)`, 전역 `fetch`, `10_000`, `2`.
- `export async function readApplicationProfile(options = {}): Promise<{ document: ApplicationProfileDocument; tokenExpiresAt: string | null }>`
  - URL 은 `new URL(\`/api/v1/service/memory-documents/${APPLICATION_PROFILE_COLLECTION}/${APPLICATION_PROFILE_DOCUMENT_KEY}\`, baseUrl)`.
  - `method: "GET"`, 머리말은 `Authorization: Bearer <token>` 과 `Accept: application/json` 둘뿐. `Origin` 을 넣지 않는다.
  - `redirect: "error"`, `signal: AbortSignal.timeout(timeoutMs)`.
  - 5xx, 연결 실패, timeout 을 `maxRetries` 번까지 다시 시도한다. 다시 시도하기 전에 응답 본문을 취소한다. 4xx 는 바로 던진다.
  - `AbortSignal.timeout(timeoutMs)` 는 시도마다 새로 만든다. `career-backend-http.ts` 와 같다.
  - 200 응답의 본문을 읽다가 `SyntaxError` 가 아닌 오류(스트림 끊김)가 나면 연결 실패로 보고 `NETWORK_ERROR` 로 다시 시도한다. `SyntaxError` 와 schema 위반은 다시 시도하지 않고 `INVALID_RESPONSE` 다.
  - 실패 응답의 본문은 `code` 만 읽는다. 읽지 못해도 위 표로 판정한다.
  - `tokenExpiresAt` 은 `X-Service-Token-Expires-At` 머리말 값, 없으면 `null`.

### 3. `career-os/scripts/application-profile/read_application_profile.ts`

첫 줄 `#!/usr/bin/env bun`.

- 사용법 문자열:

  ```text
  사용법: read_application_profile.ts <get>

  로컬 명령:
    help, --help, -h

  API 명령:
    get --out <path>
      fos-assistant Memory 의 identity/career-application-profile 본문을 저장소 밖 <path> 에 쓴다.
  ```

- `export async function readApplicationProfileCli(args = process.argv.slice(2), options: ReadApplicationProfileOptions = {}): Promise<unknown>`
  - 명령이 없거나 `help`, `--help`, `-h` 면 사용법 문자열을 돌려준다. 연결값을 읽지 않는다.
  - `get` 이 아니면 사용법을 메시지로 던진다.
  - `get`: `--out` 이 없거나 비면 `"--out 값이 필요하다. 저장소 밖 경로를 준다."`. `--out` 값이 `--` 로 시작해도 같은 오류다.
  - `assertOutsideRepository(out)` 을 요청 **전에** 부른다.
  - `readApplicationProfile(options)` 를 부르고 `writeFileSync(outPath, document.content, { encoding: "utf8", mode: 0o600 })` 로 쓴다. 이미 있던 파일이면 쓰기 뒤 `chmodSync(outPath, 0o600)` 도 부른다.
  - 돌려주는 값은 `{ collection, documentKey, revision, updatedAt, tokenExpiresAt, out: outPath }` 다. `title` 과 `content` 를 담지 않는다.
- `export function formatReadApplicationProfileError(error: unknown): string` — `ApplicationProfileHttpError` 면 `` `${message} (status=${status ?? "none"}, code=${code})` ``, 다른 `Error` 면 `message`, 나머지는 `String(error)`.
- `if (import.meta.main)` 블록: 결과가 문자열이면 `process.stdout.write`, 아니면 `console.log(JSON.stringify(result, null, 2))`. 실패하면 `console.error(formatReadApplicationProfileError(error))` 뒤 `process.exit(1)`.

### 4. `career-os/.env.example`

`# 면접 연습 기록 저장소와 후보자 맥락 공급자` 블록 뒤에 아래 블록을 더한다.

```text
# 지원서 공통 프로필. fos-assistant Memory 의 identity 문서를 서비스 토큰으로 읽는다
FOS_ASSISTANT_URL=
FOS_ASSISTANT_SERVICE_TOKEN=
```

### 5. 이 phase 를 검증하는 `career-os/scripts/application-profile/client.test.ts`

fetch 대역만 쓴다. 토큰은 `"test-service-token-0001"`, origin 은 `https://assistant.example.com` 처럼 지어낸 값만 쓴다.
본문은 `"이름: 예시 사람\n연락처: 010-0000-0000"` 같은 지어낸 값이다.

| 입력 | 기대 |
| --- | --- |
| 200, 계약에 맞는 본문, 만료 머리말 `2027-01-01T00:00:00Z` | 요청 경로가 `/api/v1/service/memory-documents/identity/career-application-profile`, 메서드 `GET`, `Authorization` 이 `Bearer test-service-token-0001`, `Origin` 머리말이 없다, `redirect` 가 `"error"`. 반환 `document.revision` 과 `tokenExpiresAt` 이 응답값이다 |
| 200 인데 만료 머리말이 없다 | `tokenExpiresAt` 이 `null` |
| 401 본문 없음 | `ApplicationProfileHttpError`, `status` 401, `code` `UNAUTHORIZED`. 호출 수 1 |
| 403 본문 없음 | `code` `FORBIDDEN` |
| 404 `{code:"MEMORY_NOT_FOUND", message:"<지어낸 서버 문구>"}` | `code` `MEMORY_NOT_FOUND`. 오류 메시지에 서버 문구가 없다 |
| 409 `{code:"MEMORY_ENCRYPTION_UNAVAILABLE"}` | `code` `MEMORY_ENCRYPTION_UNAVAILABLE` |
| 503 두 번 뒤 200, `maxRetries: 2` | 성공. 호출 수 3 |
| 503 세 번, `maxRetries: 2` | `code` `HTTP_ERROR`, `status` 503 |
| fetch 가 `TypeError` 를 던진다, `maxRetries: 0` | `code` `NETWORK_ERROR`, `status` null |
| 200 인데 `documentKey` 가 `other-doc` | `code` `INVALID_RESPONSE` |
| 200 인데 본문이 JSON 이 아니다 | `code` `INVALID_RESPONSE` |
| 모든 실패 경우 | `error.message` 에 토큰 문자열과 문서 본문 문자열이 없다 |
| `resolveFosAssistantConnection({})` | `FOS_ASSISTANT_URL` 을 말하는 오류 |
| URL 이 `https://assistant.example.com/api` | origin 규칙 오류 |
| URL 은 맞고 토큰이 `"  "` | `FOS_ASSISTANT_SERVICE_TOKEN` 을 말하는 오류 |

### 6. 이 phase 를 검증하는 `career-os/scripts/application-profile/read_application_profile.test.ts`

함수 호출은 `options.connection` 과 `options.fetchImpl` 로 대역을 넘긴다. 임시 디렉터리는 `mkdtempSync(join(tmpdir(), "application-profile."))` 로 만들고 `afterEach` 에서 지운다.

| 입력 | 기대 |
| --- | --- |
| `["help"]`, 환경 변수 없음 | 사용법 문자열. fetch 호출 0 |
| `["get"]` | `--out 값이 필요하다` 오류. fetch 호출 0 |
| `["get", "--out", <이 저장소 안 경로>]` (저장소 루트는 `dirname(dirname(dirname(import.meta.dir)))`) | `저장소 밖 경로여야 한다` 오류. fetch 호출 0 |
| `["get", "--out", <임시 디렉터리>/profile.md]`, 200 | 파일 내용이 본문과 같다. 파일 권한 `0o600`. 반환값에 `content` 와 `title` 이 없고 `revision`, `updatedAt`, `tokenExpiresAt`, `out` 이 있다 |
| 같은 경로에 권한 `0o644` 파일이 이미 있다 | 쓴 뒤 권한이 `0o600` |
| `["get", "--out", <임시>/profile.md]`, 404 | `ApplicationProfileHttpError` 를 던지고 파일을 만들지 않는다 |
| `["unknown"]` | 사용법을 메시지로 던진다 |

서브프로세스 실행 하나를 둔다. `Bun.serve({ port: 0, fetch })` 대역 서버가 200 을 돌려주고, `Bun.spawn` 으로 `read_application_profile.ts get --out <임시>/profile.md` 를 `FOS_ASSISTANT_URL=http://127.0.0.1:<port>`, `FOS_ASSISTANT_SERVICE_TOKEN=test-service-token-0001` 로 실행한다.
종료 코드 0, stdout 을 JSON 으로 읽은 `documentKey` 가 `career-application-profile`, stdout 과 stderr 에 본문 문자열과 토큰 문자열이 없다.
대역 서버가 401 을 돌려주는 실행은 종료 코드 1, stderr 에 `status=401` 이 있고 토큰 문자열이 없다.
대역 서버가 받은 요청에 `origin` 머리말이 없다.

## 검증

저장소 루트에서 실행한다.

```bash
bun test ./career-os/scripts/application-profile/client.test.ts ./career-os/scripts/application-profile/read_application_profile.test.ts
bunx tsc --noEmit
bun test ./career-os/scripts
```

- 셋 다 종료 코드 0 이다.
- 첫 명령 출력에 위 두 테스트 파일이 모두 나온다.
- `git grep -n "FOS_ASSISTANT_SERVICE_TOKEN" -- career-os/.env.example` 가 한 줄을 낸다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/application-profile/contracts.ts` | 신규 |
| `career-os/scripts/application-profile/client.ts` | 신규 |
| `career-os/scripts/application-profile/read_application_profile.ts` | 신규 |
| `career-os/scripts/application-profile/client.test.ts` | 신규 |
| `career-os/scripts/application-profile/read_application_profile.test.ts` | 신규 |
| `career-os/.env.example` | 수정 |
