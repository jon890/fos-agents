# Phase 01. 카테고리 예산 제외 전달과 목록 파일의 예산 판정 칸

**Execution profile**: deep

## 목표

`list_categories` 가 카테고리의 `excludeFromBudget` 을 돌려주고, `list_expenses` 파일 출력이 행마다 `categoryExcludeFromBudget` 과 `countsTowardBudget` 을 싣게 한다.
운영 테스트의 오답(「예산 제외 항목이 없다」)은 플러그인이 카테고리 단위 예산 제외를 버린 데서 나왔다.

**범위 외**: `get_budget_summary` 도구(phase 02), 스킬과 참조 문서(phase 03), fos-accountbook 변경(다른 저장소).

## 컨텍스트

- 스펙: `accountbook/docs/features/monthly-report/spec.md` 의 R1, R2, 「예산 대상 판정 (D1)」, 「fos-agents: 도구 계약」, 결정 D9, D10, D12.
- 계약 정본: `accountbook/docs/data-schema.md` 의 「MCP 계약」 절(이미 이 계약으로 갱신돼 있다). 코드를 문서에 맞춘다.
- `accountbook/plugin/src/tools.ts` 의 `categories(root)` 는 `z.array(z.object({ uuid, name: z.string(), type: z.enum(["EXPENSE","INCOME"]) }))` 로 응답을 검증한다. `z.object` 라 다른 칸은 버려진다.
  `accountbook/plugin/src/screenshot-tools.ts` 는 이 결과를 `NamedItem[]`(`uuid`, `name`, `type`)로 받으므로 칸이 늘어도 고칠 것이 없다.
  이 함수는 `list_categories`, 화면 가져오기(`screenshotImport` 에 넘김), 카테고리 해석(`category()`), 반복지출(`recurring()`), 삭제 확인(`confirmDeletion()`), 파일 출력(`exportList()`)이 함께 쓴다.
- 가계부 API 의 카테고리 응답(`CategoryResponse`)은 `excludeFromBudget` 을 primitive boolean 으로 항상 싣는다.
- `exportList()` 는 지출 행을 `transactionSchema.extend({... excludeFromBudget: z.boolean(), recurringExpenseUuid: z.string().min(1).nullable() })` 로 검증하고 `columns` 배열과 같은 순서로 행 객체를 만든다.
- 판정 규칙(서버 예산 합계 규칙과 같다):
  `categoryExcludeFromBudget` = 행의 `categoryUuid` 와 같은 uuid 의 카테고리가 목록에 있고 그 `excludeFromBudget` 이 `true`. 목록에 없거나 `categoryUuid` 가 `null` 이면 `false`.
  `countsTowardBudget` = `!excludeFromBudget && !categoryExcludeFromBudget && recurringExpenseUuid === null`.

**근거 문서**: `accountbook/docs/data-schema.md` 「MCP 계약」, `accountbook/docs/adr/ADR-007-budget-scope-row-flag.md`

## 의도 메모

- 카테고리 응답에 `excludeFromBudget` 이 없으면 기본값 `false` 로 채우지 않고 `ACCOUNTBOOK_INVALID_RESPONSE` 다(D9). 기본값으로 채우면 이번 오답이 되살아난다.
- 기존 칸 `excludeFromBudget` 은 거래 자체의 값 그대로 둔다(D12). 이미 쓰는 스크립트와 호환된다.
- inline 목록과 `get_expense` 응답은 바꾸지 않는다(D10).
- 수입 파일(`list_incomes`)은 칸을 더하지 않는다.

## 작업 항목

### 1. `accountbook/plugin/src/tools.ts`

- `categories()` 스키마에 `excludeFromBudget: z.boolean()` 을 필수로 더한다. 반환 객체도 이 칸을 가진다.
- `list_categories` 결과는 항목마다 `{ uuid, name, type, excludeFromBudget }` 만 담는다. API 응답의 다른 칸(색, 아이콘, 시각)은 넘기지 않는다. `z.object` 의 기본 동작(모르는 칸 제거)으로 충분하다.
- `exportList()` 의 지출 `columns` 를 `uuid`, `date`, `amount`, `categoryName`, `categoryUuid`, `userUuid`, `description`, `recurringExpenseUuid`, `excludeFromBudget`, `categoryExcludeFromBudget`, `countsTowardBudget` 순서로 하고 행 객체에 두 칸을 더한다. 수입 `columns` 와 행은 그대로다.
  카테고리 예산 제외는 이미 읽은 `categories` 로 uuid → boolean 맵을 만들어 찾는다.

### 2. 카테고리 응답 fixture 를 쓰는 기존 테스트

`categories` 응답을 흉내 내는 fixture 에 `excludeFromBudget: false`(필요한 곳은 `true`)를 더한다. 더하지 않으면 새 스키마에서 `ACCOUNTBOOK_INVALID_RESPONSE` 로 깨진다.
대상: `accountbook/plugin/src/tools.test.ts`, `deletion.test.ts`, `recurring.test.ts`, `output-file.test.ts`, `server.test.ts`, `screenshot.test.ts`. `git grep -n '"EXPENSE"' accountbook/plugin/src` 로 빠진 곳이 없는지 확인한다.
fixture 의 이름, 금액은 실제 값이 아닌 예시 값만 쓴다(`accountbook/AGENTS.md` 금융 데이터 경계).
`tools.test.ts` 의 「카테고리 목록은 종류를 보존한다」 테스트는 fixture 와 함께 `toEqual` 기대값에도 `excludeFromBudget` 을 더한다.
`categories()` 를 쓰는 쓰기 도구(등록·수정·삭제·화면 가져오기)도 카테고리 응답에 이 칸이 없으면 `ACCOUNTBOOK_INVALID_RESPONSE` 가 된다. 가계부 API 는 항상 싣으므로 의도한 동작이다.

### 3. 이 phase 를 검증하는 `accountbook/plugin/src/tools.test.ts`

- `list_categories` 가 `excludeFromBudget` 을 그대로 돌려주는지(`true` 하나, `false` 하나), 색이나 아이콘 같은 다른 칸을 넘기지 않는지 확인한다.
- 카테고리 응답에 `excludeFromBudget` 이 없거나 문자열이면 `ACCOUNTBOOK_INVALID_RESPONSE` 인지 확인한다.

### 4. 이 phase 를 검증하는 `accountbook/plugin/src/output-file.test.ts`

지출 파일 출력에서 다섯 경우의 행을 한 fixture 로 만들어 칸 값을 확인한다.

| 행 | 거래 `excludeFromBudget` | 카테고리 | `recurringExpenseUuid` | 기대 `categoryExcludeFromBudget` | 기대 `countsTowardBudget` |
| --- | --- | --- | --- | --- | --- |
| 거래 제외 | `true` | 제외 아님 | `null` | `false` | `false` |
| 카테고리 제외 | `false` | 제외 | `null` | `true` | `false` |
| 반복지출 생성 | `false` | 제외 아님 | uuid | `false` | `false` |
| 목록에 없는 카테고리 | `false` | 목록에 없는 uuid | `null` | `false` | `true` |
| 해당 없음 | `false` | 제외 아님 | `null` | `false` | `true` |

`columns` 가 위 순서인지, 수입 파일의 `columns` 와 행이 바뀌지 않았는지도 확인한다.

### 5. `accountbook/plugin/connector.json`

`tools.list_categories.description` 의 반환 칸 설명에 `excludeFromBudget`(카테고리 예산 제외)를 더한다.
`tools.list_expenses.description` 의 파일 칸 설명에 지출 파일의 `categoryExcludeFromBudget`, `countsTowardBudget` 과 판정 규칙 한 문장을 더한다. `list_incomes` 설명은 바꾸지 않는다.
설명은 `tool-metadata.test.ts` 가 SDK 도구 설명과 같은지 본다.

### 6. 번들 다시 만들기

`accountbook/plugin/dist/accountbook-mcp.js` 를 `bun run build` 로 다시 만든다. 번들 일치 검사(`scripts/build.test.ts`)가 원본과 다르면 실패한다.

## 검증

```bash
cd accountbook/plugin && bun install --frozen-lockfile
cd accountbook/plugin && bun run build
cd accountbook/plugin && bun run typecheck
bun test ./accountbook/plugin
cd accountbook/plugin && bun test src/tools.test.ts src/output-file.test.ts
```

기대값: 모두 종료 코드 0. `git grep -n '"EXPENSE"' accountbook/plugin/src` 의 fixture 가 모두 `excludeFromBudget` 을 가진다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `accountbook/plugin/src/tools.ts` | 수정 |
| `accountbook/plugin/src/tools.test.ts` | 수정 |
| `accountbook/plugin/src/output-file.test.ts` | 수정 |
| `accountbook/plugin/src/deletion.test.ts` | 수정 |
| `accountbook/plugin/src/recurring.test.ts` | 수정 |
| `accountbook/plugin/src/server.test.ts` | 수정 |
| `accountbook/plugin/src/screenshot.test.ts` | 수정 |
| `accountbook/plugin/connector.json` | 수정 |
| `accountbook/plugin/dist/accountbook-mcp.js` | 수정 |
