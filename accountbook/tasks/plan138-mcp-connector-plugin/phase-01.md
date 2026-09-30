# Phase 01. 가계부 MCP plugin과 연동 토큰 인증

**Execution profile**: standard

## 목표

셸과 파일 도구 없이 가계부를 관리하는 단일 MCP 스킬을 제공하고 이미지 등록의 인증과 상태를 사용자별로 분리한다.

**범위 외**: 가계부 backend와 fos-assistant 설치기, 운영 API 호출, PR 생성.

## 컨텍스트

공용 client는 `accountbook/plugin/src/client.ts`이며 기존 submit_import.ts와 run_weekly_import.ts가 이를 재사용한다.
설계는 코디네이터가 plugin 배치와 번들 배포, 선택 ACCOUNTBOOK_PRIVATE_DIR 계약으로 승인했다.

**근거 문서**: `accountbook/docs/code-architecture.md`의 plugin 설치 계약, `accountbook/docs/data-schema.md`의 MCP 계약, `accountbook/docs/flow.md`의 대화형 MCP 기록 관리, `accountbook/docs/adr/ADR-004-mcp-connector-plugin.md`.

## 의도 메모

- MCP SDK를 직접 구현하지 않고 공식 SDK를 번들에 포함한다.
- Hermes에서는 Bun 패키지를 설치하지 않는다.
- 수정과 삭제는 사용자 확인 뒤에만 실행하며 네트워크 실패 뒤 변경을 자동 재전송하지 않는다.

## 작업 항목

### 1. MCP plugin과 기존 인증, 사용자별 경로

12개 MCP 도구의 스키마와 Bearer HTTP client, stdio 서버를 만들고 단일 accountbook-api 스킬을 묶는다.
기존 이미지 등록은 ACCOUNTBOOK_API_TOKEN을 사용하고 과거 인증 파일을 읽거나 갱신하지 않는다.
resolve_private_root.ts로 profile 환경을 읽어 기존 이미지 스킬의 모든 작업 경로에 전달한다.

### 2. Bun 테스트와 배포 검증

`accountbook/plugin/src/tools.test.ts`는 가족 선택, 카테고리 이름 해석, CRUD, 변경 확인, 오류 코드와 profile 격리를 검증한다.
`accountbook/plugin/src/server.test.ts`는 실제 MCP 프로토콜과 설치 없는 stdio 초기화를 검증한다.
`accountbook/plugin/scripts/build.test.ts`는 원본과 dist 일치를 검사한다.
`accountbook/scripts/accountbook-screenshot-import/resolve_private_root.test.ts`는 기본값과 사용자별 경로를 검사한다.
`accountbook/scripts/accountbook-screenshot-import/submit_import.test.ts`와 `accountbook/scripts/accountbook-weekly-import/weekly_pipeline.test.ts`는 연동 토큰으로 정상 등록과 불명확한 POST 복구를 검증한다.

## 검증

```bash
bun run --cwd accountbook/plugin build
bun test ./accountbook/plugin/src/tools.test.ts ./accountbook/plugin/src/server.test.ts ./accountbook/plugin/scripts/build.test.ts ./accountbook/scripts/accountbook-screenshot-import/resolve_private_root.test.ts ./accountbook/scripts/accountbook-screenshot-import/submit_import.test.ts ./accountbook/scripts/accountbook-weekly-import/weekly_pipeline.test.ts ./accountbook/scripts/accountbook-discord-import/discord_pipeline.test.ts
bun run --cwd accountbook/plugin typecheck
claude plugin validate accountbook/plugin
```

타입 검사와 네 스킬 검증, 한국어 검사는 accountbook/README.md 검증 절과 저장소 지침을 따른다.
운영 API를 부르지 않고 fetch 대역으로 모든 HTTP 동작을 검증한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `accountbook/.claude/skills/accountbook-discord-import/SKILL.md` | 수정 |
| `accountbook/.claude/skills/accountbook-screenshot-import/SKILL.md` | 수정 |
| `accountbook/.claude/skills/accountbook-weekly-import/SKILL.md` | 수정 |
| `accountbook/.env.example` | 수정 |
| `accountbook/AGENTS.md` | 수정 |
| `accountbook/README.md` | 수정 |
| `accountbook/docs/adr/INDEX.md` | 수정 |
| `accountbook/docs/code-architecture.md` | 수정 |
| `accountbook/docs/data-schema.md` | 수정 |
| `accountbook/docs/flow.md` | 수정 |
| `accountbook/docs/prd.md` | 수정 |
| `accountbook/scripts/accountbook-discord-import/discord_pipeline.test.ts` | 수정 |
| `accountbook/scripts/accountbook-screenshot-import/submit_import.test.ts` | 수정 |
| `accountbook/scripts/accountbook-screenshot-import/submit_import.ts` | 수정 |
| `accountbook/scripts/accountbook-weekly-import/run_weekly_import.ts` | 수정 |
| `accountbook/scripts/accountbook-weekly-import/weekly_pipeline.test.ts` | 수정 |
| `accountbook/.claude/skills/accountbook-api` | 신규 |
| `accountbook/docs/adr/ADR-004-mcp-connector-plugin.md` | 신규 |
| `accountbook/plugin/.claude-plugin/plugin.json` | 신규 |
| `accountbook/plugin/.mcp.json` | 신규 |
| `accountbook/plugin/bun.lock` | 신규 |
| `accountbook/plugin/dist/accountbook-mcp.js` | 신규 |
| `accountbook/plugin/package.json` | 신규 |
| `accountbook/plugin/scripts/build.test.ts` | 신규 |
| `accountbook/plugin/scripts/build.ts` | 신규 |
| `accountbook/plugin/skills/accountbook-api/SKILL.md` | 신규 |
| `accountbook/plugin/src/client.ts` | 신규 |
| `accountbook/plugin/src/server.test.ts` | 신규 |
| `accountbook/plugin/src/server.ts` | 신규 |
| `accountbook/plugin/src/tools.test.ts` | 신규 |
| `accountbook/plugin/src/tools.ts` | 신규 |
| `accountbook/plugin/tsconfig.json` | 신규 |
| `accountbook/scripts/accountbook-screenshot-import/resolve_private_root.test.ts` | 신규 |
| `accountbook/scripts/accountbook-screenshot-import/resolve_private_root.ts` | 신규 |
