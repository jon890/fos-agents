# Phase 01. 「내 브라우저」 중계로 붙는 CDP client

**Execution profile**: standard

## 목표

fos-career MCP 서버가 `CAREER_BROWSER_URL` 의 중계 주소로 Chrome 디버깅 창구에 붙어 탭을 열고 닫고 스크립트를 돌릴 수 있게 한다. 원티드 도구의 바탕이다.

**범위 외**: 원티드 화면 지식(phase 2), 도구 등록과 선언(phase 3), 문서와 ADR(phase 4).

## 컨텍스트

**요구사항**: REQ11

**근거 문서**: `career-os/docs/features/profile-browser-sync/spec.md`, `career-os/docs/features/profile-browser-sync/design.md` 의 「책임과 경계」

- 중계 계약: 중계 주소를 Chrome 의 CDP 주소처럼 부른다. HTTP 창구 `json/version`, `json/new?<주소>`(PUT), `json/close/<탭>` 과, 응답의 `webSocketDebuggerUrl` 경로를 받은 주소의 호스트에 붙인 WebSocket 이다. `Origin` 머리를 보내지 않는다. 사람이 브라우저를 쥐면 HTTP 는 423, WebSocket 은 close code 4423 이다.
- 선례: fos-assistant 의 네이버 블로그 플러그인 `cdp.ts` 가 같은 계약을 쓴다. 다른 저장소라 가져오지 않고 같은 규칙으로 새로 쓴다(설계 DECISION3). 새 npm 의존성을 더하지 않는다. Bun 의 `fetch` 와 `WebSocket` 을 쓴다.
- 오류: `career-os/plugin/src/backend.ts` 의 `CareerError(code, details?)` 를 쓴다. `details` 는 이미 있다. 코드는 `messages` 객체의 키라야 타입이 맞는다(`CareerErrorCode = keyof typeof messages`).

## 의도 메모

- 프록시 env(`HTTP_PROXY` 등)를 요청 전에 지운다. 중계 주소는 사설 주소라 프록시를 거치면 닿지 않는다.
- WebSocket 경로가 받은 주소의 경로(접근 표식) 아래 `devtools/` 가 아니면 붙지 않는다. 표식 밖 창구로 붙는 것을 막는다.
- 사람 잠금 신호는 `CAREER_BROWSER_IN_USE` 로 바꾸고 붙어 있던 탭 id 를 `details.tab` 에 준다. 넘기기로 바꿀지는 도구가 정한다.

## 작업 항목

### 1. `career-os/plugin/src/backend.ts` 의 `messages`

`CAREER_BROWSER_UNREACHABLE`(「내 브라우저」 에 닿지 못했습니다), `CAREER_BROWSER_IN_USE`(「내 브라우저」 를 사람이 쓰고 있습니다) 두 고정 문구를 더한다. 원티드 코드 셋은 phase 3 에서 더한다.

### 2. `career-os/plugin/src/browser/cdp.ts` 신규

- `export function browserEndpoint(env: Record<string, string | undefined>): string | undefined`: `CAREER_BROWSER_URL` 의 앞뒤 공백 제거 값, 비면 `undefined`.
- `export async function httpJson(endpoint, path, { method?, timeoutMs? })`: 5초 제한, `redirect: "error"`, 423 이면 `CAREER_BROWSER_IN_USE`, 그 밖의 실패는 `CAREER_BROWSER_UNREACHABLE`.
- `export function wsUrlFor(endpoint, webSocketDebuggerUrl)`: 위 의도 메모의 경로 검사.
- `export class CdpSession`: `static connect(wsUrl, timeoutMs)`, `send(method, params, timeoutMs = 30000)`, `evaluate<T>(expression, timeoutMs)`(`Runtime.evaluate` 에 `awaitPromise: true`, `returnByValue: true`; 페이지 예외면 `{ok: false}`, 성공이면 `{ok: true, value}`), `navigate(url, timeoutMs)`(`Page.navigate` 뒤 `Page.loadEventFired` 대기), `close()`. close code 4423 이면 대기 중 명령과 이후 명령을 `CAREER_BROWSER_IN_USE`(탭 id 포함)로 끝낸다.
- `export interface BrowserLink { openTab(url): Promise<{tabId: string; session: CdpSession}>; closeTab(tabId): Promise<void> }` 와 `export function relayBrowser(endpoint): BrowserLink`. `closeTab` 은 실패(넘기기 카드가 연 탭이면 중계가 409)를 무시한다. 도구는 이 인터페이스로 탭을 다뤄 테스트가 대역을 넣을 수 있다.

### 3. `career-os/plugin/src/browser/cdp.test.ts` 신규

`Bun.serve` 로 가짜 중계를 띄운다(HTTP 창구와 WebSocket). 확인할 것:
- 정상: `relayBrowser(...).openTab` 으로 탭을 열고 `evaluate` 결과를 받는다.
- 중계 주소가 빈 값이면 `browserEndpoint` 가 `undefined` 다.
- HTTP 423 → `CAREER_BROWSER_IN_USE`, 500 과 연결 거절 → `CAREER_BROWSER_UNREACHABLE`.
- WebSocket 이 4423 으로 닫히면 대기 중 `send` 가 `CAREER_BROWSER_IN_USE` 이고 `details.tab` 이 있다.
- `wsUrlFor` 가 표식 밖 경로를 거절한다.
- 가짜 중계가 받은 요청에 `Origin` 머리가 없다.

### 4. 번들

`messages` 가 바뀌어 번들이 달라지므로 `bun run build` 로 `career-os/plugin/dist/career-mcp.js` 를 다시 만든다.

## 검증

```bash
cd career-os/plugin && bun run typecheck
cd career-os/plugin && bun test src/browser/cdp.test.ts
cd career-os/plugin && bun run build
cd career-os/plugin && bun test
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/src/backend.ts` | 수정 (오류 문구 둘) |
| `career-os/plugin/src/browser/cdp.ts` | 신규 |
| `career-os/plugin/src/browser/cdp.test.ts` | 신규 |
| `career-os/plugin/dist/career-mcp.js` | 수정 (재빌드) |
