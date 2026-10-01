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
│   ├── src/
│   ├── scripts/
│   ├── dist/accountbook-mcp.js
│   └── skills/accountbook-api/SKILL.md
├── docs/
├── scripts/accountbook-screenshot-import/
├── scripts/accountbook-weekly-import/
├── scripts/accountbook-discord-import/
├── .claude/skills/accountbook-screenshot-import/
├── .claude/skills/accountbook-weekly-import/
├── .claude/skills/accountbook-discord-import/
├── .codex/skills/accountbook-screenshot-import
├── .codex/skills/accountbook-weekly-import
├── .codex/skills/accountbook-discord-import
└── private/
```

| 경로 | 책임 |
|---|---|
| `plugin/` | `fos-accountbook` Claude Code plugin 배포 단위. 버전 0.1.0 |
| `plugin/src/client.ts` | MCP와 이미지 스크립트가 공유하는 Bearer HTTP client |
| `plugin/src/tools.ts` | MCP 도구 14개의 스키마, 가족 선택, 카테고리 이름 해석과 기간 전체 합계 |
| `plugin/src/server.ts` | `accountbook` 서버의 stdio MCP 실행 |
| `plugin/scripts/build.ts`, `plugin/dist/accountbook-mcp.js` | 의존성을 포함한 단일 실행 파일 빌드와 배포 |
| `plugin/skills/accountbook-api/` | MCP 호출 순서와 사용자 확인을 담은 단일 스킬 정본 |
| `.claude/skills/accountbook-api` | plugin 안의 정본을 찾는 링크 |
| `.claude/skills/accountbook-screenshot-import/` | 에이전트 실행 절차 정본 |
| `.claude/skills/accountbook-weekly-import/` | 입력함 탐색, 이미지 인식 반복과 조건부 무인 등록 절차 정본 |
| `.claude/skills/accountbook-discord-import/` | Hermes Discord 첨부 파일 접수와 즉시 안전 등록 절차 정본 |
| `.codex/skills/accountbook-screenshot-import` | Codex가 스킬 정본을 찾는 링크 |
| `.codex/skills/accountbook-weekly-import` | Codex가 주간 스킬 정본을 찾는 링크 |
| `.codex/skills/accountbook-discord-import` | Codex와 Hermes가 Discord 입력 스킬 정본을 찾는 링크 |
| `scripts/accountbook-screenshot-import/` | 스키마 검증, 승인 표시와 API 등록 |
| `scripts/accountbook-weekly-import/` | 입력함 작업 목록, 자동 승인 정책, 검증 후 주간 실행과 상태 전이 |
| `scripts/accountbook-discord-import/` | Discord 첨부 파일 검사와 비공개 입력함 적재 |
| `docs/` | 제품, 흐름, 저장 계약과 기술 결정 |
| `private/` 또는 `ACCOUNTBOOK_PRIVATE_DIR` | 사용자별 이미지, 거래 후보와 전송 상태 |

## 처리 경계

이미지 인식을 지원하는 에이전트는 화면 문맥을 읽고 `extracted.json`을 만든다.
화면 전체와 거래 행을 여러 번 확인할 수 있지만 최종 등록 가능 여부를 판정하지 않는다.

TypeScript script는 다음 책임을 가진다.

- 입력 스키마와 날짜를 검증한다.
- 금액을 원 단위 양의 정수로 정규화한다.
- 날짜별 수입·지출 합계를 계산해 화면 요약과 비교한다.
- batch와 후보 식별자를 만든다.
- 사용자 승인과 전송 상태를 기록한다.
- 기존 accountbook API를 호출하고 부분 성공을 복구한다.

주간 skill은 기존 화면 추출 계약으로 각 이미지의 `validated.json`까지 만든다.
그 뒤 `run_weekly_import.ts`가 모든 이미지의 선택 날짜 충돌, `weekly-safe-v1` 승인, 주간 승인 출처, 등록과 입력함 처리 완료 순서를 결정적으로 강제한다.
주간 스크립트는 기존 accountbook API 호출부를 재사용하며 이미지 인식 판단을 복제하지 않는다.

Discord 입력 스킬은 Hermes가 제공한 로컬 첨부 파일을 비공개 입력함으로 옮긴 뒤 주간 스킬을 즉시 호출한다.
첨부 파일 검사와 원자적 적재는 TypeScript 스크립트가 맡고, Discord 사용자 허용 목록과 채널 권한은 Hermes 운영 설정이 맡는다.
Discord 입력 스킬은 화면 추출, 안전 정책과 API client를 복제하지 않는다.

에이전트의 추출 결과가 상태 변경에 쓰이기 전에 결정적 검증을 거치므로 루트 [ADR-021](../../docs/adr/ADR-021-deterministic-agent-boundary.md)을 따른다.

## 외부 의존

- 이미지 입력을 지원하는 에이전트 실행 환경
- TypeScript를 직접 실행할 수 있는 Bun 또는 Node.js 22.18 이상
- 기존 루트 의존성인 `zod`와 `dotenv`
- plugin 빌드용 공식 `@modelcontextprotocol/sdk`와 `zod`. 런타임은 번들에 포함 |
- fos-accountbook-backend의 인증, 카테고리, 수입과 지출 REST API
- Discord 첨부 파일과 이미지 입력을 제공하는 Hermes Agent

화면 추출, 검증과 API 등록 스크립트는 특정 에이전트 명령줄 도구, 예약 실행기와 메시지 채널에 의존하지 않는다.
실행 환경 선택은 루트 [ADR-019](../../docs/adr/ADR-019-runtime-framework-independence.md)를 따른다.
iPhone 업로드 어댑터 또는 Hermes Discord 입력 스킬은 PNG와 보조 정보 파일을 `private/inbox/new/`에 원자적으로 전달한다.
외부 연결, 사용자 허용 목록, 채널 권한과 예약 설정은 저장소 밖 운영 책임이다.

## plugin 설치 계약

fos-assistant는 `accountbook/plugin/`을 복사하거나 마운트해 manifest, `skills/`와 `.mcp.json`을 읽는다.
Hermes profile에 MCP 서버 이름 `accountbook`을 설치하고 `${CLAUDE_PLUGIN_ROOT}`를 배포한 plugin의 절대 경로로 치환한다.
실행 명령은 `bun <plugin-root>/dist/accountbook-mcp.js`다.
기존 이미지 스킬을 호출하는 profile과 MCP 전용 profile의 실행 권한은 별개이며, 가계부 전용 에이전트에는 셸·파일 도구를 추가하지 않는다.
서버는 profile의 환경 변수만 읽으며 `.env` 파일을 탐색하지 않는다.
필수 환경 변수와 선택 변수의 의미는 [데이터 계약](data-schema.md#환경-변수)을 따른다.
`.mcp.json`은 Claude Code 형식에 따라 `mcpServers` 객체 아래에 `accountbook` 서버를 둔다.
`.mcp.json`에는 변수 참조만 두고 토큰과 공인 주소의 실제 값을 넣지 않는다.
설치기는 선택 변수 `ACCOUNTBOOK_FAMILY_UUID`가 없으면 빈 값으로 넘긴다.
실행 파일에 의존성이 포함돼 있으므로 Hermes에서 `bun install`을 실행하지 않는다.
소스를 수정한 개발자는 plugin 디렉터리에서 `bun install --frozen-lockfile`, `bun run build`를 수행하고 실행 파일도 함께 커밋한다.
번들 일치 검사와 설치 없는 stdio 초기화 테스트가 이를 검증한다.

plugin 형식은 [Claude Code 공식 plugin 참조](https://code.claude.com/docs/en/plugins-reference)를,
stdio 구현은 [MCP 공식 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x)를 따른다.

## 확장 기준

새 화면 종류는 같은 검증기 입력 스키마를 생성하는 별도 스킬 또는 추출 참조 문서로 추가한다.
OCR 모델, 작업 대기열과 LangGraph는 실제 실패 복구 요구가 현재 상태 파일과 선형 흐름을 넘어설 때 검토한다.
