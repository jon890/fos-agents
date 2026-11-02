# Phase 02. 예산 요약 도구 `get_budget_summary`

**Execution profile**: deep

## 목표

한 달의 예산 합계, 월 예산, 생활비 사용액과 한도, 예산 항목별 사용액과 한도, 항목의 카테고리를 가계부 서버에서 읽어 넘기는 읽기 전용 도구를 더한다.
운영 테스트에서 비서는 예산을 읽을 도구가 없어 목표 금액을 사용자에게 다시 물었다.

**범위 외**: 연동 토큰 허용 목록(fos-accountbook, 다른 저장소). 이 phase 는 허용 전 403 을 `ACCOUNTBOOK_FORBIDDEN` 으로 넘기는 것까지만 한다. 스킬 절차는 phase 03.

## 컨텍스트

- 스펙: `accountbook/docs/features/monthly-report/spec.md` 의 R3, R5, 「fos-agents: 도구 계약」 의 `get_budget_summary`, 결정 D8, D15.
- 계약 정본: `accountbook/docs/data-schema.md` 「MCP 계약」 의 `get_budget_summary` 항목(이미 갱신돼 있다).
- 가계부 API(경로는 `ACCOUNTBOOK_API_BASE_URL` 뒤, 응답은 `{ data: ... }`):
  - `GET /families/{familyUuid}/dashboard/budget-summary?year={YYYY}&month={M}`: `{ year, month, total: { spent, limit }, living: { spent, limit }, allocationExceeded, items: [{ budgetItemUuid, name, limit, spent }] }`. 금액은 `BigDecimal` 이라 JSON 숫자로 온다. 항목 순서는 만든 순서다.
  - `GET /families/{familyUuid}/budget-items`: `[{ uuid, name, monthlyLimit, categoryUuids: string[], createdAt, updatedAt }]`.
  - `GET /families/{familyUuid}/categories`: phase 01 의 `categories()` 를 쓴다.
- `accountbook/plugin/src/tools.ts` 의 `call()` 은 `list_families` 다음에 가족을 정하고(`this.family()`), 이름 접미사로 분기한다.
  `get_budget_summary` 는 `expense`/`income` 접미사가 없어 그대로 두면 수입 목록 경로로 떨어진다. 가족을 정한 직후, 반복지출 분기 앞에 명시 분기를 둔다.
- `server.ts` 는 `/^(list|get|preview)_/` 이름을 `readOnlyHint: true` 로 표시한다. `get_` 접두사라 따로 바꿀 것이 없다.
- 403 은 `AccountbookClient.request()` 가 이미 `ACCOUNTBOOK_FORBIDDEN` 으로 바꾼다.

**근거 문서**: `accountbook/docs/data-schema.md` 「MCP 계약」, `accountbook/docs/code-architecture.md` 「plugin 설치 계약」(새 도구는 같은 변경에서 `connector.json` `tools` 에 선언)

## 의도 메모

- 서버 값을 다시 계산하지 않고 그대로 넘긴다. 한도 판정(D15)은 스킬이 한다. 도구는 판정 칸을 더하지 않는다.
- `month` 는 필수다(D8). 서버 API 가 연월을 필수로 받는다.
- 새 오류 코드는 만들지 않는다.

## 작업 항목

### 1. `accountbook/plugin/src/tools.ts`

- `toolDefinitions` 에 `get_budget_summary` 를 더한다. 스키마는 `z.strictObject({ ...familyShape, month })`(기존 `month` 정규식 `^\d{4}-(0[1-9]|1[0-2])$` 재사용).
- 처리: `budget-summary`(`year` 는 앞 4자리, `month` 는 앞자리 0 을 뗀 숫자), `budget-items`, `categories()` 를 차례로 부른다.
- 금액 칸(`spent`, `limit`, 항목 `limit`, `spent`)은 숫자 또는 숫자 문자열을 받아 `Number` 로 바꾸고, 유한한 0 이상의 수가 아니면 `ACCOUNTBOOK_INVALID_RESPONSE` 다.
- 결과: `{ month, total: { spent, limit }, living: { spent, limit }, allocationExceeded, items: [{ uuid, name, limit, spent, categories: [{ uuid, name }] }] }`.
  `month` 는 입력값 그대로다. 항목 순서는 `budget-summary` 의 순서다. `uuid` 는 `budgetItemUuid` 다.
  항목 카테고리는 `budget-items` 의 같은 uuid 항목의 `categoryUuids` 순서대로, 카테고리 목록의 이름과 짝짓는다. 목록에 없으면 `name: null`.
- `budget-summary` 의 항목이 `budget-items` 에 없으면 `ACCOUNTBOOK_INVALID_RESPONSE` 다.
- 결과는 다른 도구처럼 `this.success(result)` 로 text JSON 을 돌려준다.

### 2. `accountbook/plugin/connector.json`

`tools.get_budget_summary` 를 `risk: "READ"`, `approval: "none"`, `title: "예산 요약 조회"` 로 선언한다.
설명에는 입력(`familyUuid` 선택, `month` 필수), 반환 칸, 한도 0 의 뜻(월 예산 0 은 예산 없음, 월 예산이 있으면 생활비 한도 0 은 남은 한도 0, 항목 한도 0 은 한도 없음), 지난달도 지금 예산 구성으로 계산된다는 것, 허용 전 토큰은 `ACCOUNTBOOK_FORBIDDEN` 이라는 것, 기록을 바꾸지 않는다는 것을 적는다.

### 3. 도구 수를 숫자로 단언하는 테스트

`accountbook/plugin/src/tool-metadata.test.ts` 의 `toHaveLength(16)` 과 테스트 제목의 「16개」, `accountbook/plugin/src/server.test.ts` 의 `toHaveLength(16)` 두 곳을 `Object.keys(connector.tools).length` 기준으로 바꾼다(제목은 숫자 없이).
도구를 더할 때마다 숫자를 고치지 않게 한다. `server.test.ts` 에 `connector` import 가 없으면 더한다.

`accountbook/plugin/scripts/verify-connector-policy.py` 의 마지막 출력 문구 「16개 설명·…」 에서 숫자를 뺀다(출력만 하는 문구다).

### 4. 정책 값 테스트 `accountbook/plugin/scripts/connector-config.test.ts`

이 파일의 `readTools` 배열에 `get_budget_summary` 를 더해 `READ/none` 정책을 단언하게 한다. 정책을 `WRITE` 로 잘못 적으면 실패해야 한다.

### 5. 이 phase 를 검증하는 `accountbook/plugin/src/tools.test.ts`

fetch 대역으로 확인한다.

- 정상: 항목 둘(하나는 카테고리 둘, 하나는 목록에 없는 카테고리 하나), 금액 하나는 숫자 문자열. 결과 모양, 순서, `name: null`, 문자열 금액의 숫자 변환, 요청 URL(`year=2026&month=10` 처럼 0 없는 달)을 확인한다.
- 403: `budget-summary` 가 403 이면 `ACCOUNTBOOK_FORBIDDEN` 이다(R9 의 도구 쪽).
- `budget-summary` 의 항목 uuid 가 `budget-items` 에 없으면 `ACCOUNTBOOK_INVALID_RESPONSE`.
- 금액이 음수이거나 숫자가 아니면 `ACCOUNTBOOK_INVALID_RESPONSE`.
- `month` 가 없거나 `2026-13` 이면 요청 없이 `ACCOUNTBOOK_INVALID_INPUT`.

### 6. 번들 다시 만들기

`accountbook/plugin/dist/accountbook-mcp.js` 를 `bun run build` 로 다시 만든다.

## 검증

```bash
cd accountbook/plugin && bun install --frozen-lockfile
cd accountbook/plugin && bun run build
cd accountbook/plugin && bun run typecheck
bun test ./accountbook/plugin
cd accountbook/plugin && bun test src/tools.test.ts src/tool-metadata.test.ts src/server.test.ts scripts/connector-config.test.ts
```

기대값: 모두 종료 코드 0. `scripts/connector-config.test.ts` 가 manifest 와 `toolDefinitions` 의 도구 이름이 같다고 판정한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `accountbook/plugin/src/tools.ts` | 수정 |
| `accountbook/plugin/src/tools.test.ts` | 수정 |
| `accountbook/plugin/src/tool-metadata.test.ts` | 수정 |
| `accountbook/plugin/src/server.test.ts` | 수정 |
| `accountbook/plugin/connector.json` | 수정 |
| `accountbook/plugin/scripts/connector-config.test.ts` | 수정 |
| `accountbook/plugin/scripts/verify-connector-policy.py` | 수정 |
| `accountbook/plugin/dist/accountbook-mcp.js` | 수정 |
