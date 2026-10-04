# Phase 01. Access 머리말 해석과 전송

**Execution profile**: standard

## 목표

커리어 Backend client 전부와 지원서 공통 프로필 client 가 Access 환경값이 있을 때 `CF-Access-Client-Id`, `CF-Access-Client-Secret` 머리말을 보내게 한다.

**범위 외**: `career-os/plugin/` 전체(열린 plugin 2단계 작업과 겹친다), `dist/`, 서버 쪽 Access 설정.

## 컨텍스트

- 공용 HTTP 계층은 `career-os/scripts/lib/career-backend-http.ts` 의 `careerBackendRequest(options, ...)` 다. `CareerBackendHttpOptions` 가 `baseUrl`, `token`, `fetcher` 등을 받는다.
- 연결값은 `career-os/scripts/lib/career-backend-config.ts` 의 `resolveCareerBackendConnection(environment)` 가 `{ baseUrl, token }` 으로 돌려준다. token 파일은 mode 0600 을 확인하고 `validateToken` 으로 trim 한다.
- `scripts/profile/client.ts`, `scripts/candidate-context/client.ts`, `scripts/study-topic-recommender/study-library/client.ts` 는 연결값에서 `baseUrl`, `token` 을 꺼내 `careerBackendRequest` 로 넘긴다. 포지션 client(`position-recommender/career-backend/client.ts`)와 면접 연습(`interview-drill/store/index.ts`)은 연결값 객체를 그대로 넘긴다.
- `study-library/doctor.ts` 는 `fetch` 를 직접 불러 Authorization 을 붙인다.
- 지원서 공통 프로필은 `scripts/application-profile/client.ts` 의 `resolveFosAssistantConnection` 과 `readApplicationProfile` 이 맡는다.
- launchd 틀은 이미 `--env-file={{REPO_ROOT}}/career-os/.env` 로 실행하므로 새 변수를 코드 변경 없이 읽는다.

**근거 문서**: `career-os/docs/adr/ADR-140-노트북-client-는-선택적-cloudflare-access-service-token-머리말을-앱-인증과-함께-보낸다.md`, `career-os/docs/code-architecture.md`, `career-os/docs/flow.md`

## 의도 메모

- 환경 변수는 두 서비스가 따로다. 이름은 ADR-140 이 정한다.
- 값이 없으면 머리말을 보내지 않는다. 하나만 있으면 오류다.
- 오류 문구에는 변수 이름만 넣고 값을 넣지 않는다.
- ID 와 secret 에 공백과 줄바꿈이 있으면 머리말 주입 위험이 있어 `^\S+$` 로 거절한다.

## 작업 항목

### 1. `career-os/scripts/lib/access-credentials.ts` 신규

```ts
export type AccessCredentials = { clientId: string; clientSecret: string };
export function resolveAccessCredentials(
  environment: Record<string, string | undefined>,
  prefix: "CAREER_BACKEND" | "FOS_ASSISTANT",
): AccessCredentials | undefined;
export function accessHeaders(access: AccessCredentials | undefined): Record<string, string>;
```

- `${prefix}_ACCESS_CLIENT_ID`, `${prefix}_ACCESS_CLIENT_SECRET`, `${prefix}_ACCESS_CLIENT_SECRET_FILE` 을 읽는다.
- 셋 모두 비어 있으면 `undefined`. 직접 secret 과 파일이 함께 있으면 오류. ID 만 있거나 secret 만 있어도 오류.
- 파일은 mode 0600 을 확인하고 읽은 값을 trim 한다.
- `accessHeaders` 는 값이 있으면 `{ "CF-Access-Client-Id", "CF-Access-Client-Secret" }`, 없으면 `{}`.

### 2. 공용 연결과 HTTP 계층

- `CareerBackendConnection` 에 `access?: AccessCredentials` 를 더하고 `resolveCareerBackendConnection` 이 `resolveAccessCredentials(environment, "CAREER_BACKEND")` 를 채운다.
- `CareerBackendHttpOptions` 에 `access?: AccessCredentials` 를 더하고 `careerBackendRequest` 가 `accessHeaders` 를 `headers` 에 붙인다.
- `profile`, `candidate-context`, `study-library` client 는 `access` 를 필드로 보관해 `careerBackendRequest` 옵션에 넘긴다.
- `study-library/doctor.ts` 의 직접 `fetch` 헤더에 `accessHeaders(connection.access)` 를 붙이고 `SETUP_HINT` 가 Access 값을 말하게 한다.

### 3. 지원서 공통 프로필 client

- `FosAssistantConnection` 에 `access?` 를 더하고 `resolveFosAssistantConnection` 이 `"FOS_ASSISTANT"` 접두로 채운다.
- `readApplicationProfile` 의 요청 헤더에 `accessHeaders` 를 붙인다.

### 4. 테스트

- `scripts/lib/access-credentials.test.ts`: 모두 없음, 쌍이 있음, 파일 secret(0600), 파일 권한 오류, ID 만, secret 만, 직접 값과 파일 동시, 공백 값 거절. 오류 메시지에 지어낸 secret 값이 없는지 확인한다.
- `career-backend-http.test.ts`: `access` 가 있으면 요청에 두 머리말이 붙고, 없으면 붙지 않는다.
- `career-backend-config` 연결 해석: 환경값이 `access` 로 이어진다(기존 테스트 파일이 없으면 `access-credentials.test.ts` 에 포함).
- `application-profile/client.test.ts`: Access 값이 있으면 머리말이 붙고 없으면 없다. 하나만 있으면 요청 전에 실패한다.
- `study-library` doctor 테스트(기존 파일이 있으면 그 파일): Access 머리말이 붙는다.
- `agent-usage/manage_launchd.test.ts`: 설치될 plist 가 `--env-file` 로 `career-os/.env` 를 읽는지 확인하는 단언이 없으면 더한다.

### 5. 환경 예시와 문서

`career-os/.env.example`, `career-os/README.md`, `career-os/docs/code-architecture.md`, `career-os/docs/flow.md` 는 계획 커밋에서 이미 갱신했다. 구현이 이와 달라지면 같은 커밋에서 그 절을 고친다.

## 검증

```bash
bunx tsc --noEmit
bun test career-os/scripts/lib/access-credentials.test.ts career-os/scripts/lib/career-backend-http.test.ts career-os/scripts/application-profile/client.test.ts career-os/scripts/agent-usage/manage_launchd.test.ts
bun test ./career-os/scripts ./career-os/.claude/skills
```

둘 다 종료 코드 0 이어야 한다. plugin 테스트는 건드리지 않았음을 `git diff --stat main -- career-os/plugin` 이 비어 있는 것으로 확인한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/access-credentials.ts` | 신규 |
| `career-os/scripts/lib/access-credentials.test.ts` | 신규 |
| `career-os/scripts/lib/career-backend-config.ts` | 수정 |
| `career-os/scripts/lib/career-backend-http.ts` | 수정 |
| `career-os/scripts/lib/career-backend-http.test.ts` | 수정 |
| `career-os/scripts/profile/client.ts` | 수정 |
| `career-os/scripts/candidate-context/client.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/client.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/doctor.ts` | 수정 |
| `career-os/scripts/application-profile/client.ts` | 수정 |
| `career-os/scripts/application-profile/client.test.ts` | 수정 |
| `career-os/scripts/agent-usage/manage_launchd.test.ts` | 수정 |
