# Phase 03. 커리어 MCP 서버에 GitHub, 원티드, 연결 확인만 남긴다

**Execution profile**: standard

## 목표

커리어 Backend 를 부르는 MCP 도구와 Backend token 칸, Backend 주소를 플러그인 선언과 서버에서 함께 지운다. GitHub 프로필 갱신은 README 만 쓴다.

**범위 외**: 스킬 본문과 버전, 번들(phase 04). `services/career-backend` 와 Backend 를 부르는 노트북 CLI(`scripts/candidate-context`, `scripts/profile`, `scripts/agent-usage`)는 건드리지 않는다.

## 컨텍스트

- 도구 정의는 `career-os/plugin/src/tools.ts`, 서버는 `server.ts`, 선언은 `career-os/plugin/connector.json`, `.mcp.json` 이다. `tool-metadata.ts` 가 도구 이름이 선언과 같은지 시작할 때 대조한다.
- PR #230 의 GitHub 단추 연결(`oauth`, `CAREER_GITHUB_TOKEN_URL`, `github-token.ts`)은 그대로 둔다.
- `.mcp.json` 의 env 는 `fields[].env`, `operator_env`, `owner_browser_env`, `oauth.token_env` 의 합과 같아야 한다(fos-assistant `hermes/connectors/README.md`). `verify.tool` 은 `readOnlyHint` 가 참인 도구여야 한다.

**요구사항**: REQ7, REQ6 의 도구 부분(설계 「플러그인 선언」 표, 스펙 DECISION6, DECISION25)

**근거 문서**: `career-os/docs/adr/ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md`, `career-os/docs/adr/ADR-145-비서-웹의-프로필-사이트-반영은-mcp-서버가-내-브라우저-중계로-한다.md`

## 의도 메모

- `agent-usage.svg` 파일을 프로필 저장소에서 지우지 않는다. 도구는 README 한 파일만 쓴다. README 에서 차트와 Tokens 배지를 빼는 것은 스킬이 안내한다.
- `check_connection` 은 GitHub 이 없어도 성공한다. 결과에서 `backend` 칸을 뺀다.
- Cloudflare Access 머리말(ADR-143, ADR-144)은 Backend 요청에만 쓰였으므로 함께 지운다.

## 작업 항목

### 1. `career-os/plugin/src/`

- `backend.ts` 를 `errors.ts` 로 바꾼다: `CareerError`, `safeError`, `configuredValue`, `FetchLike` 와 남는 도구의 오류 문구만 둔다. `CareerBackend` 를 지운다.
- `tools.ts`: 도구 다섯(`check_connection`, `get_github_profile`, `update_github_profile`, `get_wanted_resume`, `update_wanted_resume`). `update_github_profile` 의 입력은 `readme`, `expectedBranch`, `expectedHead` 이고 결과는 `changed`, `commitSha`, `branch` 다.
- `github.ts`: `commitProfile` 이 README 한 파일만 쓴다. `read` 결과에서 `chartExists` 를 뺀다.
- `server.ts`: `CAREER_GITHUB_PROFILE_REPO` 만 필수다. Backend 주소, token, Access 머리말을 읽지 않는다.
- `interview.ts`, `positions.ts`, `study.ts`, `study-fixtures.ts`, `idempotency.ts`, `seoul-date.ts` 와 그 테스트, `contract-parity.test.ts` 를 지운다. 번들에 파일을 읽는 코드가 없다는 검사와 공개 질문 은행 대조는 남는 테스트로 옮기지 않는다(은행은 이제 로컬 실행기만 읽는다).

### 2. `career-os/plugin/connector.json`, `career-os/plugin/.mcp.json`

설계 「플러그인 선언」 표대로 `fields`(`github_token` 만), `tools`(다섯), `operator_env`(`CAREER_GITHUB_PROFILE_REPO`), `errors`(남는 도구의 코드), `description` 을 고친다. `.mcp.json` 에서 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN` 을 지운다.

### 3. `career-os/docs/data-schema.md` 의 「커넥터 오류 코드」 표

`connector-config.test.ts` 가 `errors` 를 이 표와 대조하므로 같은 phase 에서 남는 코드만 두게 고친다.

### 4. 테스트

`tools.test.ts`, `server.test.ts`, `github.test.ts`, `tool-metadata.test.ts`, `plugin/scripts/connector-config.test.ts`, `mcp-config.test.ts` 를 고친다. 「선언의 도구가 다섯뿐이다」, 「선언과 `.mcp.json`, 서버 소스에 `CAREER_BACKEND` 가 없다」, 「`check_connection` 은 token 없이 `github: not_configured` 로 성공한다」, 「`update_github_profile` 은 `months` 를 거절하고 README 한 파일만 커밋한다」 를 둔다.

## 검증

```bash
bun test ./career-os/plugin/src ./career-os/plugin/scripts/connector-config.test.ts ./career-os/plugin/scripts/mcp-config.test.ts
cd career-os/plugin && bun run typecheck
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/src/errors.ts` | 신규 |
| `career-os/plugin/src/backend.ts` | 삭제 |
| `career-os/plugin/src/tools.ts` | 수정 |
| `career-os/plugin/src/server.ts` | 수정 |
| `career-os/plugin/src/github.ts` | 수정 |
| `career-os/plugin/src/github-token.ts` | 수정 |
| `career-os/plugin/src/interview.ts` | 삭제 |
| `career-os/plugin/src/positions.ts` | 삭제 |
| `career-os/plugin/src/study.ts` | 삭제 |
| `career-os/plugin/src/study-fixtures.ts` | 삭제 |
| `career-os/plugin/src/idempotency.ts` | 삭제 |
| `career-os/plugin/src/seoul-date.ts` | 삭제 |
| `career-os/plugin/src/interview.test.ts` | 삭제 |
| `career-os/plugin/src/position-exclusions.test.ts` | 삭제 |
| `career-os/plugin/src/research.test.ts` | 삭제 |
| `career-os/plugin/src/study.test.ts` | 삭제 |
| `career-os/plugin/src/study-recommendations.test.ts` | 삭제 |
| `career-os/plugin/src/contract-parity.test.ts` | 삭제 |
| `career-os/plugin/src/tools.test.ts` | 수정 |
| `career-os/plugin/src/server.test.ts` | 수정 |
| `career-os/plugin/src/github.test.ts` | 수정 |
| `career-os/plugin/src/tool-metadata.test.ts` | 수정 |
| `career-os/plugin/src/wanted/tools.ts` | 수정 (import) |
| `career-os/plugin/src/browser/cdp.ts` | 수정 (import) |
| `career-os/plugin/connector.json` | 수정 |
| `career-os/plugin/.mcp.json` | 수정 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/plugin/scripts/mcp-config.test.ts` | 수정 |
| `career-os/plugin/src/browser/cdp.test.ts` | 수정 (import) |
| `career-os/plugin/src/wanted/tools.test.ts` | 수정 (import) |
| `career-os/docs/data-schema.md` | 수정 (오류 코드 표) |
