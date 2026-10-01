# Code Architecture: accountbook

## 디렉터리

```text
accountbook/
├── AGENTS.md
├── README.md
├── .env.example
├── plugin/
│   ├── .claude-plugin/plugin.json
│   ├── .mcp.json
│   ├── connector.json
│   ├── src/
│   ├── scripts/
│   ├── dist/accountbook-mcp.js
│   └── skills/accountbook-api/SKILL.md
├── docs/
└── .claude/skills/accountbook-api
```

| 경로 | 책임 |
|---|---|
| `plugin/` | `fos-accountbook` Claude Code plugin 배포 단위. 버전 0.2.0 |
| `plugin/connector.json` | fos-assistant 연결 화면이 읽는 입력 칸, 확인 도구와 오류 대응 |
| `plugin/src/client.ts` | Bearer HTTP client와 응답 스키마 |
| `plugin/src/tools.ts` | MCP 도구 16개의 스키마, 가족 선택, 카테고리 이름 해석과 기간 전체 합계 |
| `plugin/src/screenshot-contracts.ts` | 화면 추출 입력 스키마 |
| `plugin/src/screenshot-validation.ts` | 일별 합계 계산과 후보 식별자 생성 |
| `plugin/src/screenshot-tools.ts` | 화면 가져오기 미리보기, 기존 기록 대조와 순차 등록 |
| `plugin/src/server.ts` | `accountbook` 서버의 stdio MCP 실행 |
| `plugin/scripts/build.ts`, `plugin/dist/accountbook-mcp.js` | 의존성을 포함한 단일 실행 파일 빌드와 배포 |
| `plugin/skills/accountbook-api/` | 화면 읽기 규칙, MCP 호출 순서와 사용자 확인을 담은 단일 스킬 정본 |
| `.claude/skills/accountbook-api` | plugin 안의 정본을 찾는 링크 |
| `docs/` | 제품, 흐름, 데이터 계약과 기술 결정 |

## 처리 경계

이미지 인식을 지원하는 에이전트는 화면 문맥을 읽고 날짜별 거래를 추출한다.
화면 전체와 거래 행을 여러 번 확인할 수 있지만 등록 가능 여부를 판정하지 않는다.

MCP 도구는 다음 책임을 가진다.

- 입력 스키마와 날짜를 검증한다.
- 날짜별 수입·지출 합계를 원 단위 정수로 계산해 화면 요약과 비교한다.
- 카테고리 이름을 UUID로 해석한다.
- 해당 날짜의 기존 수입·지출을 조회해 같은 날짜, 금액, 설명의 기록을 찾는다.
- 추출 내용의 해시로 묶음 ID와 후보 식별자를 만든다.
- 사용자가 확인한 묶음 ID와 등록 요청의 내용이 같은지 확인한 뒤 순서대로 등록한다.

에이전트의 추출 결과가 상태 변경에 쓰이기 전에 결정적 검증을 거치므로 루트 [ADR-021](../../docs/adr/ADR-021-deterministic-agent-boundary.md)을 따른다.
MCP 서버는 파일을 읽거나 쓰지 않는다([ADR-005](adr/ADR-005-screenshot-import-as-mcp-tools.md)).

## 외부 의존

- 이미지 입력을 지원하는 에이전트 실행 환경
- 런타임 Bun
- plugin 빌드용 공식 `@modelcontextprotocol/sdk`와 `zod`. 런타임은 번들에 포함
- fos-accountbook-backend의 인증, 카테고리, 수입과 지출 REST API

MCP 도구는 특정 에이전트 명령줄 도구와 메시지 채널에 의존하지 않는다.
실행 환경 선택은 루트 [ADR-019](../../docs/adr/ADR-019-runtime-framework-independence.md)를 따른다.

## plugin 설치 계약

fos-assistant는 `accountbook/plugin/`을 복사하거나 마운트해 manifest, `connector.json`, `skills/`와 `.mcp.json`을 읽는다.
사용자별 profile에 MCP 서버 이름 `accountbook`을 설치하고 `${CLAUDE_PLUGIN_ROOT}`를 배포한 plugin의 절대 경로로 치환한다.
실행 명령은 `bun <plugin-root>/dist/accountbook-mcp.js`다.
가계부 전용 에이전트에는 셸과 파일 쓰기 도구를 추가하지 않는다.
화면 가져오기를 쓰려면 실행 환경이 그 에이전트에 사진을 전달하고 이미지를 보는 도구를 열어야 한다.
`connector.json`의 `toolsets: ["vision"]`과 `attachments: true`가 그 요청이다.
서버는 profile의 환경 변수만 읽으며 `.env` 파일을 탐색하지 않는다.
필수 환경 변수와 선택 변수의 의미는 [데이터 계약](data-schema.md#환경-변수)을 따른다.
`.mcp.json`은 Claude Code 형식에 따라 `mcpServers` 객체 아래에 `accountbook` 서버를 둔다.
`.mcp.json`에는 변수 참조만 두고 토큰과 공인 주소의 실제 값을 넣지 않는다.
`.mcp.json`의 서버 env는 `connector.json`의 `fields[].env`와 `operator_env`의 합과 같아야 한다.
실행 파일에 의존성이 포함돼 있으므로 설치한 환경에서 `bun install`을 실행하지 않는다.
소스를 수정한 개발자는 plugin 디렉터리에서 `bun install --frozen-lockfile`, `bun run build`를 수행하고 실행 파일도 함께 커밋한다.
번들 일치 검사와 설치 없는 stdio 초기화 테스트가 이를 검증한다.

plugin 형식은 [Claude Code 공식 plugin 참조](https://code.claude.com/docs/en/plugins-reference)를,
stdio 구현은 [MCP 공식 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x)를 따른다.

## 확장 기준

새 화면 종류는 같은 `days` 입력을 만드는 추출 규칙을 스킬에 더한다.
무인 등록이나 다른 입력 경로는 같은 MCP 도구 위에 더하고 검증 규칙을 복제하지 않는다.
