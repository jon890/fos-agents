# Phase 04. GitHub 프로필을 읽고 기록의 숫자로 검사해 커밋 하나로 올리는 도구

**Execution profile**: deep

## 목표

커넥터에 `get_github_profile` 과 `update_github_profile` 을 더하고 `check_connection` 이 GitHub token 도 확인하게 한다.
`update_github_profile` 은 숫자를 인자로 받지 않는다. Backend 의 사용량 기록으로 차트를 그리고, README 의 Tokens 배지 값이 그 합계와 다르면 GitHub 에 아무것도 쓰지 않는다.
공개 프로필에 틀린 숫자가 올라가는 것을 도구에서 막기 위해서다.

**범위 외**: 스킬 본문과 파이썬 파일 삭제는 Phase 05 다. GitHub 계정 소개(bio)는 바꾸지 않는다. 원티드와 LinkedIn 은 다루지 않는다.

## 컨텍스트

앞 phase 가 만든 것을 먼저 읽는다.

- `career-os/plugin/src/backend.ts` 의 `CareerBackend`, `CareerError`, `configuredValue`
- `career-os/plugin/src/tools.ts` 의 `toolDefinitions`, `CareerTools`, `list_usage_snapshots` 의 응답 스키마
- `career-os/plugin/src/server.ts` 의 `createServer`. `CAREER_GITHUB_PROFILE_REPO` 를 이미 검사하고 `CAREER_GITHUB_TOKEN` 은 아직 쓰지 않는다
- `career-os/scripts/agent-usage/chart.ts` 의 `selectUsageBars`, `formatBillions`, `renderUsageChart`, `readTokensBadge`, 타입 `UsageTokens`

계산 규칙과 도구의 입력, 결과, 오류 코드는 `career-os/docs/data-schema.md` 의 「fos-career 커넥터」 절이 정한다. 그 절의 표와 글자까지 맞춘다.

지금 프로필 README 의 배지 주소는 `https://img.shields.io/badge/Tokens-97.9B-...` 모양이다. 값은 `\d+\.\d` 와 `B` 다.

GitHub REST API 다. 기준 주소는 `https://api.github.com` 이고 헤더는 `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, `User-Agent: fos-career-connector` 다.

| 순서 | 요청 | 쓰는 값 |
| --- | --- | --- |
| 1 | `GET /repos/{owner}/{repo}` | 응답의 `default_branch` |
| 2 | `GET /repos/{owner}/{repo}/git/ref/heads/{branch}` | 응답의 `object.sha`. branch 끝의 커밋이다 |
| 3 | `GET /repos/{owner}/{repo}/git/commits/{커밋}` | 응답의 `tree.sha` |
| 4 | `POST /repos/{owner}/{repo}/git/blobs`, 본문 `{ "content": <README>, "encoding": "utf-8" }` | 응답의 `sha` |
| 5 | `POST /repos/{owner}/{repo}/git/blobs`, 본문 `{ "content": <SVG>, "encoding": "utf-8" }` | 응답의 `sha` |
| 6 | `POST /repos/{owner}/{repo}/git/trees`, 본문 `{ "base_tree": <3의 tree>, "tree": [{ "path": "README.md", "mode": "100644", "type": "blob", "sha": <4> }, { "path": "agent-usage.svg", "mode": "100644", "type": "blob", "sha": <5> }] }` | 응답의 `sha` |
| 7 | `POST /repos/{owner}/{repo}/git/commits`, 본문 `{ "message": <고정 문구>, "tree": <6>, "parents": [<2의 커밋>] }` | 응답의 `sha` |
| 8 | `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}`, 본문 `{ "sha": <7>, "force": false }` | |

README 를 읽을 때는 `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` 를 쓴다. 응답의 `content` 는 base64 이고 `encoding` 은 `base64` 다. 파일이 없으면 404 다.

fos-assistant 는 승인된 쓰기를 새 프로세스에서 60초 안에 실행한다. 확인 도구는 10초 안에 답해야 한다.

**근거 문서**: `career-os/docs/data-schema.md` 의 「fos-career 커넥터」 절, `career-os/docs/flow.md` 의 「fos-career 커넥터」 절, `career-os/docs/prd.md` 의 「fos-career 커넥터」 절, `career-os/docs/adr/ADR-135-fos-assistant-커넥터는-backend를-감싸고-숫자는-기록에서-직접-읽는다.md`, `career-os/docs/adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md`

## 의도 메모

- **Contents API 로 파일을 하나씩 올리지 않는다.** 파일마다 커밋이 생겨 README 와 차트 가운데 하나만 바뀐 상태가 프로필에 보인다. Git Data API 로 tree 하나에 두 파일을 넣어 커밋 하나를 만든다
- **검사를 모두 통과한 뒤에 GitHub 에 쓴다.** 입력 검사, token 유무, 기록에 없는 달, 막대가 모두 0 인지, 배지 값의 순서로 본다. 이 가운데 하나라도 실패하면 `POST` 와 `PATCH` 를 하나도 보내지 않는다
- 새 tree 가 지금 tree 와 같으면 커밋을 만들지 않는다. fos-assistant 의 실행이 「실행했는지 알 수 없음」 으로 끝난 뒤 사용자가 같은 요청을 다시 승인해도 빈 커밋이 쌓이지 않는다
- `force: false` 로 branch 를 옮긴다. 그 사이 다른 커밋이 올라왔으면 실패하게 두고 강제로 옮기지 않는다
- 커밋 문구를 인자로 받지 않는다. 승인 카드에서 볼 것을 README 와 달로 한정한다
- 요청마다 시간 제한을 5초로 둔다. 쓰기 한 번이 Backend 한 번(8초, Phase 01)과 GitHub 여덟 번을 부르므로 최악은 Backend 8초에 GitHub 요청 여덟 번의 40초를 더한 48초다. 60초 한도까지 12초가 남아 프로세스 시작과 MCP 연결을 감당한다
- blob 을 tree 의 `content` 로 한 번에 넣는 방법도 있다. blob 을 따로 만드는 쪽을 골랐다. 실패한 자리가 어느 파일인지 오류에서 구분된다
- GitHub token 과 Backend token 을 서로 다른 host 로 보내지 않는다. 테스트가 이것을 단언한다
- 테스트는 실제 GitHub 를 부르지 않는다. fetch 대역이 요청을 기록하고 정해 둔 응답을 준다. 저장소 이름과 token 은 지어낸 값(`octo-example/octo-example`, `"g".repeat(40)`)을 쓴다

## Blocked 조건

- `career-os/scripts/agent-usage/chart.ts` 가 없으면 `PHASE_BLOCKED: 차트 함수가 없다` 를 출력하고 종료한다
- `python3` 이 PATH 에 없으면 `PHASE_BLOCKED: python3 이 없어 agent-usage 테스트를 돌릴 수 없다` 를 출력하고 종료한다(검증의 `bun test career-os/scripts/agent-usage` 가 파이썬 대조와 plan139 의 수집기 테스트를 함께 돌린다)
- `career-os/plugin/src/idempotency.ts` 가 없으면 `PHASE_BLOCKED: 문서 저장 도구가 아직 없다` 를 출력하고 종료한다

## 작업 항목

### 1. `career-os/plugin/src/github.ts`

`zod` 와 `./backend.ts` 밖의 것을 import 하지 않는다.

```ts
export class GithubProfileRepo {
  constructor(config: { token: string; repo: string }, fetchImpl?: FetchLike);
  check(): Promise<void>;
  read(): Promise<{ repo: string; branch: string; readme: string | null; chartExists: boolean }>;
  commitProfile(files: { readme: string; chart: string }, message: string): Promise<{ changed: boolean; commitSha: string; branch: string }>;
}
```

- `repo` 는 `<owner>/<repo>` 다. 모양 검사는 `server.ts` 가 이미 했다
- 요청마다 `redirect: "error"`, `signal: AbortSignal.timeout(5_000)` 이다. 다시 보내지 않는다
- 응답은 쓰는 칸만 `zod` 로 읽는다. 읽지 못하면 `CAREER_INVALID_RESPONSE` 다
- 상태별 오류 코드다. 401 은 `CAREER_GITHUB_UNAUTHORIZED`, 403 과 404 는 `CAREER_GITHUB_FORBIDDEN` 이다. 409 와 422 는 8번(branch 이동)에서만 `CAREER_GITHUB_CONFLICT` 다. 1번부터 7번의 409 와 422(빈 저장소의 409, blob 과 tree 검증 실패의 422), 429, 5xx, fetch 가 던진 경우는 `CAREER_GITHUB_UNAVAILABLE` 이다. 나머지 4xx 는 `CAREER_GITHUB_FORBIDDEN` 이다.
- `check()` 는 컨텍스트 표의 1번만 부른다
- `read()` 는 1번으로 branch 를 알고, `contents/README.md` 와 `contents/agent-usage.svg` 를 읽는다. **이 두 요청의 404 는 오류가 아니다.** README 가 없으면 `readme: null`, 차트가 없으면 `chartExists: false` 다. README 의 `content` 에서 줄바꿈을 빼고 base64 를 UTF-8 글로 푼다
- `commitProfile` 은 컨텍스트 표의 1번부터 8번까지를 차례로 부른다. 6번의 `sha` 가 3번의 `tree.sha` 와 같으면 7번과 8번을 부르지 않고 `{ changed: false, commitSha: <2의 커밋>, branch }` 를 돌려준다. 다르면 8번까지 부르고 `{ changed: true, commitSha: <7>, branch }` 다

### 2. `career-os/plugin/src/tools.ts`

`CareerTools` 의 생성자가 GitHub 를 받는다.

```ts
constructor(backend: CareerBackend, github?: GithubProfileRepo);
```

`check_connection` 을 고친다.

- `github` 가 있으면 Backend 조회와 `github.check()` 를 `Promise.all` 로 함께 부른다. 둘 다 성공하면 `{ backend: "ok", github: "ok" }` 다
- `github` 가 없으면 `{ backend: "ok", github: "not_configured" }` 다
- 하나라도 실패하면 그 오류로 답한다. 결과를 `structuredContent` 에도 싣는다

`get_github_profile` 을 더한다.

- 입력은 `z.strictObject({})` 다
- `github` 가 없으면 `CAREER_GITHUB_NOT_CONFIGURED` 다. 있으면 `github.read()` 의 값을 그대로 낸다

`update_github_profile` 을 더한다.

| 칸 | 규칙 |
| --- | --- |
| `readme` | 공백만이 아닌 글. UTF-8 65,536바이트 이하 |
| `months` | `^\d{4}-(0[1-9]|1[0-2])$` 인 글의 배열. 1개에서 6개. 겹치는 값이 없다 |

입력 스키마는 `z.strictObject` 다. `total`, `tokens`, `svg` 같은 다른 키가 오면 `CAREER_INVALID_INPUT` 이다.

순서다. 앞 단계가 실패하면 뒤를 부르지 않는다.

1. 입력을 검사한다
2. `github` 가 없으면 `CAREER_GITHUB_NOT_CONFIGURED` 다. Backend 도 부르지 않는다
3. `GET /api/profile/v1/usage-snapshots` 로 기록을 읽어 `UsageTokens[]` 로 바꾼다. 달, Claude Code 토큰, Codex 토큰의 칸 이름은 Phase 01 이 `list_usage_snapshots` 에 쓴 스키마의 것이다
   - 4번 다음, 5번 앞에서 막대의 최댓값이 0 이면 GitHub 를 부르기 전에 `CAREER_INVALID_INPUT` 으로 낸다. `tools.test.ts` 에 이 경우를 더하고 `api.github.com` 요청이 0건임을 단언한다
4. `selectUsageBars(records, months)` 를 부른다. `missing` 이 비어 있지 않으면 `new CareerError("CAREER_USAGE_MONTH_MISSING", { missing })` 이다
5. `readTokensBadge(readme)` 가 `formatBillions(totalTenths)` 와 다르면 `new CareerError("CAREER_BADGE_MISMATCH", { expected: formatBillions(totalTenths), found: <읽은 값이나 null> })` 이다
6. `renderUsageChart(bars)` 로 SVG 를 만든다
7. `github.commitProfile({ readme, chart }, message)` 를 부른다. `message` 는 달이 하나면 `docs: 프로필과 에이전트 사용량 차트를 갱신한다 (2031-01)`, 여럿이면 `docs: 프로필과 에이전트 사용량 차트를 갱신한다 (2031-01~2031-06)` 모양이다. 달은 `bars` 의 첫 달과 끝 달이다
8. `{ changed, commitSha, branch, months: <bars 의 달>, total: formatBillions(totalTenths) }` 를 낸다

`CareerError` 의 `details` 는 Phase 01 의 오류 결과 모양대로 `error` 옆에 펼쳐진다. `{ "error": { "code": "CAREER_BADGE_MISMATCH", "message": "..." }, "expected": "97.9B", "found": "96.0B" }` 다.

### 3. `career-os/plugin/src/server.ts`

`configuredValue(env.CAREER_GITHUB_TOKEN)` 이 있으면 `new GithubProfileRepo({ token, repo }, fetchImpl)` 를 만들어 `CareerTools` 에 넘긴다. 없으면 넘기지 않는다. 서버는 어느 쪽이든 시작한다.

### 4. `career-os/plugin/connector.json` 에 도구 둘

```json
"get_github_profile": { "risk": "READ", "approval": "none", "title": "GitHub 프로필 읽기" },
"update_github_profile": { "risk": "WRITE", "approval": "required", "title": "GitHub 프로필 갱신" }
```

### 5. `career-os/plugin/dist/career-mcp.js` 다시 빌드

번들에 `career-os/scripts/agent-usage/chart.ts` 가 들어간다. `bun run --cwd career-os/plugin build` 의 결과를 커밋한다.

### 6. 이 phase 를 검증하는 테스트

`career-os/plugin/src/github.test.ts`

fetch 대역은 요청의 method, URL, 헤더, 본문을 배열에 기록하고 URL 과 method 로 응답을 고른다.

- `read()`: README 가 있고 차트가 없을 때 `{ readme: <푼 글>, chartExists: false }` 다. 한글이 든 README 의 base64 를 줄바꿈과 함께 주고 글이 그대로 풀리는지 본다. README 가 404 면 `readme: null` 이다
- `commitProfile()` 정상: 요청이 컨텍스트 표의 1번부터 8번 순서이고, 4번과 5번의 `content` 가 넘긴 글과 같고 `encoding` 이 `utf-8` 이다. 6번의 `base_tree` 가 3번의 tree 이고 `tree` 의 `path` 가 `README.md` 와 `agent-usage.svg` 둘뿐이다. 7번의 `parents` 가 2번의 커밋 하나다. 8번의 `force` 가 `false` 다. 결과가 `{ changed: true, commitSha: <7>, branch }` 다
- 6번의 `sha` 가 3번의 tree 와 같으면 요청이 6개뿐이고 `{ changed: false, commitSha: <2의 커밋> }` 다
- 8번이 422 면 `CAREER_GITHUB_CONFLICT`, 6번이 422 나 4번이 409 면 `CAREER_GITHUB_UNAVAILABLE`, 어느 단계든 429 면 `CAREER_GITHUB_UNAVAILABLE`, 1번이 401 이면 `CAREER_GITHUB_UNAUTHORIZED`, 404 면 `CAREER_GITHUB_FORBIDDEN`, 502 면 `CAREER_GITHUB_UNAVAILABLE` 이다
- 모든 요청의 host 가 `api.github.com` 이고 `init.redirect` 가 `"error"` 다

`career-os/plugin/src/tools.test.ts` 에 더한다. Backend 와 GitHub 를 한 fetch 대역이 host 로 나눠 답한다.

- 정상: 기록이 두 달이고 README 의 배지가 그 합계일 때 `update_github_profile` 이 성공한다. 5번 요청의 `content` 가 `renderUsageChart(selectUsageBars(...).bars)` 와 같고 4번의 `content` 가 넘긴 `readme` 와 같다. 결과의 `total` 이 합계이고 `months` 가 오름차순이다
- **배지 불일치**: README 의 배지가 합계와 0.1B 다를 때 `CAREER_BADGE_MISMATCH` 이고 `expected` 와 `found` 가 있다. `api.github.com` 으로 간 요청이 하나도 없다
- 배지가 README 에 없을 때와 둘일 때도 `CAREER_BADGE_MISMATCH` 이고 `found` 가 `null` 이다
- **없는 달**: `months` 에 기록에 없는 달이 있으면 `CAREER_USAGE_MONTH_MISSING` 이고 `missing` 에 그 달이 있다. `api.github.com` 으로 간 요청이 하나도 없다
- **숫자를 받지 않는다**: 입력에 `total: "97.9B"` 를 더하면 fetch 를 부르지 않고 `CAREER_INVALID_INPUT` 이다. `months` 가 빈 배열, 일곱 개, 겹친 값, `2031-13` 일 때도 같다
- **token 없음**: `github` 없이 만든 `CareerTools` 에서 `update_github_profile` 과 `get_github_profile` 이 `CAREER_GITHUB_NOT_CONFIGURED` 이고 fetch 를 부르지 않는다. 같은 인스턴스의 `list_profile_documents` 는 성공한다
- `check_connection` 이 `github` 가 있으면 `{ backend: "ok", github: "ok" }`, 없으면 `{ backend: "ok", github: "not_configured" }` 다. GitHub 가 401 이면 `CAREER_GITHUB_UNAUTHORIZED` 다
- Backend 로 간 요청의 `Authorization` 에 GitHub token 이 없고, `api.github.com` 으로 간 요청의 `Authorization` 에 Backend token 이 없다
- 오류 결과의 글에 두 token 이 없다

`career-os/plugin/src/server.test.ts` 를 고친다.

- `listTools()` 의 길이 단언 두 곳을 8 에서 10 으로 바꾼다
- `check_connection` 결과 단언을 `{ backend: "ok", github: "not_configured" }` 로 바꾼다. 그 테스트의 env 에는 GitHub token 이 없다

`career-os/plugin/scripts/connector-config.test.ts` 에 더한다.

- `Object.keys(connector.tools)` 의 길이가 10 이고, `WRITE` 인 도구가 `save_context_document`, `save_profile_document`, `update_github_profile` 셋뿐이며 셋 다 `approval` 이 `required` 다
- `errors` 의 키와 값이 `career-os/docs/data-schema.md` 의 「커넥터 오류 코드」 표에서 공통 어휘가 채워진 줄과 같다. 테스트가 그 문서를 읽어 표의 줄을 파싱해 대조한다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test career-os/plugin career-os/scripts/agent-usage career-os/plugin/src/github.test.ts career-os/plugin/src/tools.test.ts career-os/plugin/src/server.test.ts career-os/plugin/scripts/connector-config.test.ts
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
git diff --exit-code -- career-os/plugin/dist/career-mcp.js
! grep -rn "node:fs" career-os/plugin/src/github.ts career-os/plugin/src/tools.ts career-os/plugin/src/server.ts
```

모두 종료 코드 0 이어야 한다. `dist/career-mcp.js` 를 stage 한 뒤에 `git diff --exit-code` 를 돌린다.
테스트는 실제 Backend 와 GitHub 를 부르지 않는다. `bun test career-os/scripts/agent-usage` 가 요구하는 환경값이 있으면 그 디렉터리의 테스트 파일 머리에서 읽고 맞춘다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/src/github.ts` | 신규 |
| `career-os/plugin/src/github.test.ts` | 신규 |
| `career-os/plugin/src/tools.ts` | 수정 |
| `career-os/plugin/src/tools.test.ts` | 수정 |
| `career-os/plugin/src/server.ts` | 수정 |
| `career-os/plugin/src/server.test.ts` | 수정 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/plugin/connector.json` | 수정 |
| `career-os/plugin/dist/career-mcp.js` | 수정 |
