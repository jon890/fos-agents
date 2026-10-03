# Phase 03. 문서를 저장하는 쓰기 도구 둘

**Execution profile**: standard

## 목표

커넥터에 `save_context_document` 와 `save_profile_document` 를 더한다.
대화에서 후보자 맥락 문서와 프로필 원고를 고칠 수 있게 하되, 두 도구를 `connector.json` 에 승인 필요로 선언해 사용자가 승인한 인자로만 저장되게 한다.

**범위 외**: GitHub 도구는 Phase 04, 스킬 본문은 Phase 05 다. 사용량 기록을 저장하는 도구는 만들지 않는다.

## 컨텍스트

Phase 01 이 만든 `career-os/plugin/` 위에서 일한다. `src/backend.ts` 의 `CareerBackend.request` 와 `src/tools.ts` 의 `toolDefinitions`, `CareerTools.call` 을 먼저 읽는다.

Backend 의 저장 계약이다. 아래 요약과 코드가 다르면 코드가 맞다.

- 후보자 맥락: `career-os/services/career-backend/src/candidate-context/schema.ts` 의 `candidateContextDocumentPutSchema`. `body` 는 공백만이 아니고 UTF-8 65,536바이트 이하, `note` 는 앞뒤 공백을 뗀 1자에서 500자, `expectedVersion` 은 0 이상의 정수다. 모르는 키를 거절한다(`.strict()`)
- 경로는 `PUT /api/candidate-context/v1/documents/:documentKey` 이고 응답은 `{ document: { documentKey, version, updatedAt } }` 다. 본문을 돌려주지 않는다
- `expectedVersion` 이 현재 값과 다르면 409 `VERSION_CONFLICT` 다. 새 문서는 `expectedVersion: 0` 이다
- 프로필 원고: `career-os/services/career-backend/src/profile/` 의 schema 와 controller. `PUT /api/profile/v1/documents/:documentKey` 이고 요청과 응답의 규칙이 후보자 맥락과 같다
- 모든 쓰기 요청은 `Idempotency-Key` 헤더가 필요하다(`career-os/docs/flow.md` 의 「커리어 Backend」)

노트북의 client 가 `Idempotency-Key` 를 만드는 방법이다.

- 후보자 맥락: `career-os/scripts/candidate-context/client.ts` 의 `hashKey("candidate-context", { documentKey, body, note, expectedVersion })`. `canonicalJson` 으로 키를 정렬해 직렬화한 글의 SHA-256 16진수에 `candidate-context:` 를 붙인다. `note` 는 `candidateContextPutPayloadSchema` 가 앞뒤 공백을 뗀 값이다
- 프로필 원고: `career-os/scripts/profile/client.ts` 의 `putDocument` 가 `hashKey("profile-document", { documentKey, body, note, expectedVersion })` 로 만든다. `note` 는 후보자 맥락과 같은 방식으로 앞뒤 공백을 뗀 값이다

fos-assistant 의 승인 규칙이다.

- `WRITE` 의 `approval` 은 `required` 보다 느슨할 수 없다. `none` 을 선언하면 커넥터가 카탈로그에서 빠진다
- 승인이 필요한 호출은 커넥터에 닿기 전에 막히고 승인 줄이 된다. 사용자가 승인하면 저장한 인자 그대로 새 프로세스에서 한 번 실행된다
- 직렬화한 인자가 UTF-8 16KB 를 넘으면 fos-assistant 가 호출을 거절한다. 이 한도는 커넥터의 코드가 강제하지 않는다

**근거 문서**: `career-os/docs/data-schema.md` 의 「fos-career 커넥터」 절과 「후보자 맥락 문서」 절, `career-os/docs/flow.md` 의 「후보자 맥락 문서」 절과 「fos-career 커넥터」 절, `career-os/docs/adr/ADR-134-공고-분석의-기준-버전은-position-preferences-문서-버전에서-계산한다.md`, `career-os/docs/adr/ADR-135-fos-assistant-커넥터는-backend를-감싸고-숫자는-기록에서-직접-읽는다.md`

## 의도 메모

- **`Idempotency-Key` 를 노트북의 CLI 와 같은 값으로 만든다.** 같은 내용의 저장이 두 길로 가도 Backend 가 저장한 응답을 그대로 돌려준다. 값이 달라지지 않게 테스트가 `scripts/` 의 client 가 보낸 헤더와 대조한다
- `scripts/` 의 `hashKey` 를 import 하지 않고 같은 계산을 `plugin/src/` 에 다시 쓴다. 그 파일이 token 파일을 읽는 설정 코드를 import 하기 때문이다(Phase 01 의 의도 메모)
- `position-preferences` 를 이 도구로 저장해도 안전한 것은 Backend 가 공고 분석의 기준 버전을 문서 버전에서 계산하기 때문이다(ADR-134). 그 변경이 없으면 문서만 저장되고 분석 정책이 낡은 채로 남아 수집이 멈춘다. 그래서 아래 Blocked 조건을 둔다
- 저장을 다시 보내지 않는다. 연결이 끊겨 결과를 모르면 `CAREER_NETWORK` 로 답하고, 에이전트가 문서를 다시 읽어 확인한다
- 저장 도구의 결과에 본문을 싣지 않는다. Backend 가 준 요약만 낸다

## Blocked 조건

- `career-os/plugin/src/tools.ts` 가 없으면 `PHASE_BLOCKED: plugin 뼈대가 없다` 를 출력하고 종료한다
- 아래 명령이 종료 코드 0 이면 공고 분석 정책이 아직 기준 버전을 저장하는 것이다(ADR-134 의 변경은 main 에 머지됐으므로 통과하는 것이 정상이다). `PHASE_BLOCKED: 공고 분석의 기준 버전을 문서 버전에서 계산하는 변경이 이 브랜치에 없다` 를 출력하고 종료한다

```bash
# cwd: 저장소 루트
grep -q "candidateContextVersion" career-os/services/career-backend/src/positions/schema.ts
```

## 작업 항목

### 1. `career-os/plugin/src/idempotency.ts`

```ts
export function canonicalJson(value: unknown): string;
export function idempotencyKey(prefix: string, value: unknown): string;
```

`career-os/scripts/candidate-context/client.ts` 의 `canonicalJson`, `hashKey` 와 같은 계산이다. `node:crypto` 의 `createHash("sha256")` 을 쓴다.

### 2. `career-os/plugin/src/tools.ts` 에 도구 둘

입력 스키마는 둘 다 `z.strictObject` 다.

| 칸 | 규칙 |
| --- | --- |
| `documentKey` | `save_context_document` 는 `contextDocumentKeys`, `save_profile_document` 는 `profileDocumentKeys` 가운데 하나 |
| `body` | 공백만이 아닌 글. `new TextEncoder().encode(body).length` 가 65,536 이하 |
| `note` | 앞뒤 공백을 뗀 1자에서 500자 |
| `expectedVersion` | 0 이상의 정수 |

| 도구 | Backend 요청 | `Idempotency-Key` |
| --- | --- | --- |
| `save_context_document` | `PUT /api/candidate-context/v1/documents/<documentKey>`, 본문 `{ body, note, expectedVersion }` | `idempotencyKey("candidate-context", { documentKey, body, note, expectedVersion })` |
| `save_profile_document` | `PUT /api/profile/v1/documents/<documentKey>`, 본문 `{ body, note, expectedVersion }` | `idempotencyKey("profile-document", { documentKey, body, note, expectedVersion })` |

- `note` 는 스키마가 공백을 뗀 값을 본문과 해시에 쓴다
- 결과는 `{ document: { documentKey, version, updatedAt } }` 다
- 409 는 `CAREER_VERSION_CONFLICT` 로 온다(Phase 01 의 `CareerBackend.request`). 이 phase 에서 분기를 더하지 않는다

### 3. `career-os/plugin/connector.json` 에 도구 둘

```json
"save_context_document": { "risk": "WRITE", "approval": "required", "title": "후보자 맥락 문서 저장" },
"save_profile_document": { "risk": "WRITE", "approval": "required", "title": "프로필 원고 저장" }
```

### 4. `career-os/plugin/dist/career-mcp.js` 다시 빌드

`bun run --cwd career-os/plugin build` 의 결과를 커밋한다.

### 5. 이 phase 를 검증하는 테스트

`career-os/plugin/src/tools.test.ts` 에 더한다.

- 정상: 두 도구가 위 표의 경로로 `PUT` 을 보내고 본문이 `{ body, note, expectedVersion }` 셋뿐이다. `note` 에 앞뒤 공백을 줘도 본문의 `note` 에 공백이 없다
- `Idempotency-Key` 헤더가 있고, 같은 인자로 두 번 부르면 같은 값이고 `body` 한 글자가 다르면 다른 값이다
- Backend 가 409 면 `CAREER_VERSION_CONFLICT`, fetch 가 던지면 `CAREER_NETWORK` 이고 fetch 호출 수가 1 이다
- `body` 가 공백뿐일 때, 65,537바이트일 때, `note` 가 501자일 때, `expectedVersion` 이 `-1` 이나 `1.5` 일 때, `save_context_document` 에 `documentKey: "github"` 를 줄 때, 모르는 키 `version` 을 더할 때 fetch 를 부르지 않고 `CAREER_INVALID_INPUT` 이다
- 성공 결과의 글에 `body` 로 준 글이 없다

`career-os/plugin/src/contract-parity.test.ts` 에 더한다.

- `career-os/scripts/candidate-context/client.ts` 의 `createCandidateContextClient({ origin, token, fetchImpl })` 로 `putDocument("career-status", payload)` 를 부를 때 fetch 대역이 받은 `Idempotency-Key` 가, 커넥터의 `save_context_document` 를 같은 값으로 부를 때 받은 헤더와 같다
- `career-os/scripts/profile/client.ts` 의 `createProfileClient` 로 만든 client 의 `putDocument` 를 fetch 대역으로 부를 때 받은 `Idempotency-Key` 가 `save_profile_document` 의 것과 같다
- 두 대조 모두 요청 경로와 본문도 같다

`career-os/plugin/src/server.test.ts` 를 고친다.

- `listTools()` 의 길이 단언 두 곳을 6 에서 8 로 바꾼다

`career-os/plugin/scripts/connector-config.test.ts` 는 고치지 않는다. Phase 01 의 이름 규칙 검사(`save_` 는 `WRITE` 와 `required`)와 `tools` 일치 검사가 새 도구를 본다. 이 phase 에서 통과하는지 확인한다.

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test career-os/plugin career-os/plugin/src/tools.test.ts career-os/plugin/src/contract-parity.test.ts career-os/plugin/src/server.test.ts
bun run --cwd career-os/plugin typecheck
git diff --exit-code -- career-os/plugin/dist/career-mcp.js
```

모두 종료 코드 0 이어야 한다. `dist/career-mcp.js` 를 stage 한 뒤에 `git diff --exit-code` 를 돌린다.
쓰기 도구가 승인 필요로 선언됐는지는 `connector-config.test.ts` 의 이름 규칙 검사가 단언한다.
테스트는 실제 Backend 를 부르지 않는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/src/idempotency.ts` | 신규 |
| `career-os/plugin/src/tools.ts` | 수정 |
| `career-os/plugin/src/tools.test.ts` | 수정 |
| `career-os/plugin/src/contract-parity.test.ts` | 수정 |
| `career-os/plugin/src/server.test.ts` | 수정 |
| `career-os/plugin/connector.json` | 수정 |
| `career-os/plugin/dist/career-mcp.js` | 수정 |
