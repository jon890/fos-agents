# Phase 03. 원티드 도구 흐름, 등록, 선언, 연결용 지침

**Execution profile**: standard

## 목표

`get_wanted_resume`(READ)과 `update_wanted_resume`(WRITE)의 흐름을 만들고, MCP 서버·`connector.json`·`.mcp.json`·연결용 지침·`data-schema.md` 오류 표를 한 커밋에서 맞춘다. 도구 목록, 지침의 도구 이름, 오류 표를 대조하는 기존 테스트가 함께 바뀌어야 하기 때문이다.

**범위 외**: ADR, `code-architecture.md`(phase 4).

## 컨텍스트

**요구사항**: REQ1, REQ2, REQ4, REQ5, REQ6, REQ7, REQ8, REQ10, REQ12, REQ13

**근거 문서**: `career-os/docs/features/profile-browser-sync/spec.md`, `career-os/docs/features/profile-browser-sync/design.md` 의 「도구」, 「실행 흐름」, 「연결용 지침」

- 도구 등록 패턴: `career-os/plugin/src/tools.ts` 의 `toolDefinitions`(zod `schema`)와 `CareerTools.call` 분기. 생성자는 지금 `(backend, github?, now?)` 다. `withToolDescriptions` 가 `connector.json` 의 설명을 붙인다.
- `server.ts` 는 이름이 `get_` 로 시작하면 `readOnlyHint`, `update_` 면 `destructiveHint` 를 단다. `createServer` 는 `CAREER_BROWSER_URL` 이 없어도 떠야 한다(노트북).
- 결과 모양: 성공은 기존 도구처럼 텍스트 JSON 과 `structuredContent`. 넘기기는 `isError` 없이 `{status: "HUMAN_ACTION_REQUIRED", message, handoff: {code, need, tab}}` 이고 `get_wanted_resume` 만 낸다. `update_wanted_resume` 의 멈춤은 모두 `isError` 없는 `status: "stopped"` 다(스펙 DECISION18, DECISION19, DECISION24).
- 기존 테스트가 보는 것: `scripts/connector-config.test.ts`(WRITE 목록, `.mcp.json` env 와 선언의 합, 오류 표 대조, 지침 8,000자와 모든 도구 이름, 지침에 「노트북의 `sync-profile`」 문구 금지), `src/tool-metadata.test.ts`(설명이 입력 칸 이름·enum 을 모두 담음, 설명에 「개인」·「READ/WRITE」·「승인」, `outbound` 와 `grant` 를 가진 도구 목록), `scripts/mcp-config.test.ts`.

## 의도 메모

- 실행 루프는 설계 「실행 흐름」 그림 그대로다. 칸마다: 경과 45초 확인 → `readResumeScript` 로 서버 값 → 지문 대조 → `fieldValueScript` 로 화면 칸이 서버 값과 같은지 → 넣기 → 글 칸은 `readResumeScript`, 기간 칸은 편집 화면을 `navigate` 로 다시 열어 `readPeriodsScript` 로 글자 대조.
- 제목 칸을 바꾸면 그 뒤 같은 프로젝트의 칸은 새 제목으로 찾는다. 실행은 넣은 값으로 찾는 제목을 갱신한다.
- 쓰기 도구는 탭을 `finally` 에서 늘 닫는다. 읽기 도구가 넘기기로 남긴 탭은 모듈 변수에 두고 다음 호출 시작에서 닫는다.
- 지침 분량: 시작 전 본문 7,991자. 이 절을 더하려면 `career-connector/SKILL.md` 의 다음 문장을 줄인다: 「승인」 절의 「저장 도구나 `update_github_profile` 을 부르면 그 자리에서 실행되지 않고 승인 요청이 만들어진다.」 와 「승인하면 저장된 인자 그대로 한 번 실행되고 결과가 대화로 온다.」(같은 절의 다른 문장이 같은 뜻), 「읽기」 절의 다섯 도구 설명 줄을 도구 이름 나열 한 줄로(설명은 `connector.json` 이 갖는다). 다른 두 스킬은 건드리지 않는다. 대안 안내 문구에 「노트북의 `sync-profile`」 을 쓰지 않는다(테스트가 막는다). 「노트북 Claude Code 의 프로필 갱신」 처럼 쓴다.

## 작업 항목

### 1. `career-os/plugin/src/backend.ts` 의 `messages`

`CAREER_WANTED_LOGIN_REQUIRED`, `CAREER_WANTED_PAGE_CHANGED`, `CAREER_WANTED_RESUME_NOT_FOUND` 고정 문구를 더한다.

### 2. `career-os/plugin/src/wanted/tools.ts` 신규

- `export class WantedTools { constructor(browser: BrowserLink | undefined, now: () => number = Date.now) }`. `browser` 가 없으면 두 도구 모두 탭 요청 없이 `CAREER_BROWSER_UNREACHABLE` 오류.
- `getWantedResume(args)`: 지난 넘기기 탭 닫기 → `resumeKey` 가 없으면 목록 화면을 열어 `pageStateScript`(LOGIN 이면 넘기기 `login`, 탭 남김) → `listResumesScript` → 하나면 그 키로 계속, 여럿이면 `{status: "choose", resumes}`, 없으면 `CAREER_WANTED_RESUME_NOT_FOUND` → 편집 화면을 열어 `readResumeScript`(LOGIN 이면 넘기기, NOT_FOUND 면 오류)와 `readPeriodsScript` → `{status: "ok", resumeKey, resumeTitle, fields, unreadable, outOfScope}`. 화면 판정이 `OTHER` 이거나 스크립트 예외면 `CAREER_WANTED_PAGE_CHANGED` 오류. `CAREER_BROWSER_IN_USE` 면 넘기기 `human_browser`(탭이 있으면 그 탭).
- `updateWantedResume(args)`: 위 「의도 메모」 의 루프. 결과 `{status: "done" | "stopped", resumeKey, results}`. 탭 열기에서 `CAREER_BROWSER_IN_USE` 면 모든 칸 `not_inserted`(`browser_in_use`), 실행 중 4423 이면 넣던 칸 `failed`(`browser_taken`)와 남은 칸 `not_inserted`(`stopped_earlier`), 로그인 화면이면 남은 칸 `not_inserted`(`login_required`). 요청한 `resumeKey` 의 편집 화면만 연다. 첫 칸을 건드리기 전에 `readResumeScript` 가 `NOT_FOUND` 면 `CAREER_WANTED_RESUME_NOT_FOUND` 오류, 화면 판정이 `OTHER` 면 모든 칸 `not_inserted`(`page_changed`)인 `stopped` 다. 칸을 넣은 뒤에 같은 일이 생기면 그 칸 다음부터 `stopped` 와 `page_changed` 다.

### 3. `career-os/plugin/src/tools.ts`, `career-os/plugin/src/server.ts`

- `toolDefinitions` 에 두 도구(`getWantedResumeSchema`, `updateWantedResumeSchema`)를 더하고, `CareerTools` 생성자에 네 번째 선택 인자 `wanted?: WantedTools` 를 더해 `call` 에서 넘긴다. 결과가 넘기기나 `stopped` 여도 `isError` 를 달지 않는다.
- `createServer` 가 `browserEndpoint(env)` 로 `relayBrowser` 를 만들어 `WantedTools` 를 넘긴다. 값이 없으면 `new WantedTools(undefined)`.

### 4. `career-os/plugin/connector.json`, `career-os/plugin/.mcp.json`

- `owner_browser_env: "CAREER_BROWSER_URL"`, `owner_browser_login_url: "https://www.wanted.co.kr/cv/list"`.
- `get_wanted_resume`: `risk: READ`, `approval: none`, title 「원티드 이력서 읽기」. `update_wanted_resume`: `risk: WRITE`, `approval: required`, `outbound: true`, `grant: false`, title 「원티드 이력서 반영」.
- 두 설명(2000자 안)에 넣을 것: 모든 입력 칸 이름, 「개인」, 「READ」/「WRITE」, 「승인」, 결과 `status` 값(`ok`, `choose`, `done`, `stopped`, `HUMAN_ACTION_REQUIRED`), `state` 값과 `reason` 값 전부, 「16KB 를 넘을 변경은 칸을 나눠 부른다」, 「앞 호출의 칸이 모두 inserted 일 때만 다음 호출」, 화면이 바뀌었을 때의 대안(노트북 Claude Code 의 프로필 갱신, 원티드 화면에서 직접 고치기), 범위 밖 칸(기술, 링크, AI 활용 경험)은 쓰지 않고 `outOfScope` 로 읽기만 한다는 것, 같은 인자로 자동으로 다시 부르지 않는다는 것.
- `errors` 에 다섯 코드. `CAREER_WANTED_LOGIN_REQUIRED` 는 `{category: "credential_rejected", recovery: "reconnect"}`.
- `.mcp.json` 의 `env` 에 `"CAREER_BROWSER_URL": "${CAREER_BROWSER_URL:-}"`.

### 5. `career-os/plugin/connector-skills/career-connector/SKILL.md`

- frontmatter `description` 의 「원티드와 LinkedIn 사이트 반영, 사용량 측정에는 사용하지 않는다」 를 「LinkedIn 사이트 반영, 사용량 측정에는 사용하지 않는다」 로 고치고, 「원티드 프로필 반영」 을 요청 예시에 더한다.
- 「원티드 프로필 반영」 절(순서만): `get_wanted_resume`(여럿이면 고르게) → `get_profile_document` 의 `wanted` 와 비교해 다른 칸만 변경 전후 표 → 원고·사용자 문장만, 비서가 쓴 문장은 「비서 제안」, 새 사내 수치·조직명은 공개 여부를 먼저 묻기 → 범위 밖 칸은 직접 고치라고 안내 → `update_wanted_resume`(크면 나눠서) → 칸마다 결과 알림 → `login_required` 면 다시 읽어 카드 → 넣은 칸만 원고 저장 승인.
- 위 「의도 메모」 의 문장을 줄여 본문 8,000자 안에 맞춘다.

### 6. 테스트 고치기와 더하기

- `career-os/plugin/scripts/connector-config.test.ts`: WRITE 목록에 `update_wanted_resume`. `.mcp.json` env 기대값을 `fields[].env`, `operator_env`, `owner_browser_env` 의 합으로. 두 도구 설명에 「나눠」, 「노트북 Claude Code」, 「outOfScope」 가 있는지 단언.
- `career-os/plugin/src/tool-metadata.test.ts`: `outbound: true` 와 `grant` 를 가진 도구를 `update_github_profile`, `update_wanted_resume` 둘로.
- `career-os/plugin/scripts/mcp-config.test.ts`: env 기대값에 `CAREER_BROWSER_URL`.
- `career-os/plugin/src/server.test.ts`: `CAREER_BROWSER_URL` 없이 서버가 뜨고 두 도구가 등록되는지.
- `career-os/plugin/src/wanted/tools.test.ts` 신규. `BrowserLink` 대역이 스크립트 종류별로 시나리오 결과를 준다. 시나리오:
  - 읽기: 이력서 하나(칸 목록), 둘(`choose`), 0개(`CAREER_WANTED_RESUME_NOT_FOUND`), 읽기 중 로그인(넘기기 `login`, 탭 남김, 다음 호출이 그 탭을 닫음), 사람 잠금(넘기기 `human_browser`), 화면 판정 `OTHER`(`CAREER_WANTED_PAGE_CHANGED`).
  - 쓰기: 세 칸 모두 `inserted`; 둘째 칸 넣은 뒤 서버 값이 다름(`failed` `not_saved`, 셋째 `not_inserted` `stopped_earlier`); 둘째 칸 지문 다름(`not_inserted` `fingerprint_mismatch`); 화면 칸 `NO_ELEMENT`(`not_inserted` `page_changed`); 넣기 결과 `INSERT_FAIL`(`failed` `page_changed`); 실행 중 로그인(`stopped`, `login_required`, 결과에 `handoff` 없음); 탭 열기 423(`browser_in_use`); 실행 중 4423(`failed` `browser_taken`); 가짜 시계 45초 초과(`time_limit`); `browser` 없음(오류, 탭 요청 0회); 첫 칸 전 `NOT_FOUND`(오류); 둘째 칸 전 화면 `OTHER`(`stopped`, `page_changed`); 열린 편집 화면 주소가 요청한 `resumeKey` 뿐; 모든 경우 쓰기 탭이 닫힘; 결과에 `isError` 없음.

### 7. `career-os/docs/data-schema.md` 의 「커넥터 오류 코드」

다섯 줄을 더한다. 공통 어휘 칸에는 어휘 하나만 두고, `CAREER_WANTED_LOGIN_REQUIRED` 의 recovery `reconnect` 는 조건 칸에 적는다.

### 8. 버전과 번들

`career-os/plugin/package.json`, `career-os/plugin/.claude-plugin/plugin.json`, `career-os/plugin/src/server.ts` 의 `0.8.0` 을 `0.9.0` 으로 올린다. 버전 일치는 `scripts/connector-config.test.ts` 와 `src/server.test.ts` 가 이미 본다. `bun run build` 로 `career-os/plugin/dist/career-mcp.js` 를 다시 만든다.

## 검증

```bash
cd career-os/plugin && bun run typecheck
cd career-os/plugin && bun test src/wanted/tools.test.ts
cd career-os/plugin && bun test scripts/connector-config.test.ts scripts/mcp-config.test.ts src/tool-metadata.test.ts src/server.test.ts
cd career-os/plugin && bun run build
cd career-os/plugin && bun test
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/src/backend.ts` | 수정 (오류 문구 셋) |
| `career-os/plugin/src/wanted/tools.ts` | 신규 |
| `career-os/plugin/src/wanted/tools.test.ts` | 신규 |
| `career-os/plugin/src/tools.ts` | 수정 (두 도구 등록) |
| `career-os/plugin/src/server.ts` | 수정 (브라우저 연결 주입, 버전) |
| `career-os/plugin/package.json` | 수정 (버전) |
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 (버전) |
| `career-os/plugin/src/server.test.ts` | 수정 |
| `career-os/plugin/src/tool-metadata.test.ts` | 수정 |
| `career-os/plugin/connector.json` | 수정 (선언, 도구, 오류) |
| `career-os/plugin/.mcp.json` | 수정 (`CAREER_BROWSER_URL`) |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/plugin/scripts/mcp-config.test.ts` | 수정 |
| `career-os/plugin/connector-skills/career-connector/SKILL.md` | 수정 |
| `career-os/docs/data-schema.md` | 수정 (오류 코드 다섯 줄) |
| `career-os/plugin/dist/career-mcp.js` | 수정 (재빌드) |
