# Phase 03. 스킬의 월 리포트 절차와 계산 스크립트

**Execution profile**: deep

## 목표

`accountbook-api` 스킬이 월 소비 리포트를 예산 화면과 같은 숫자로 내게 한다.
절차와 `execute_code` 로 돌릴 계산 스크립트를 `references/monthly-report.md` 에 두고, 스크립트를 fixture 로 돌리는 테스트를 더한다.

**범위 외**: 도구 코드(phase 01, 02). 운영 확인(R10)은 배포 뒤 원격 검증 목록이 맡는다.

## 컨텍스트

- 스펙: `accountbook/docs/features/monthly-report/spec.md` 의 R6 부터 R9, 「스킬: 월 리포트 절차」(절차 1 부터 8 과 D16 분배 기준 표), 「실패와 빈 상태」, 결정 D15 부터 D23.
  절차와 산식은 스펙의 문장을 그대로 옮긴다. 스펙과 다른 산식을 만들지 않는다.
- `accountbook/plugin/skills/accountbook-api/SKILL.md` 앞머리를 뺀 본문은 지금 7,955자로 여유가 45자뿐이다. `accountbook/plugin/scripts/connector-config.test.ts` 가 8,000자 이하인지, `skills/` 아래 심볼릭 링크가 없는지 검사한다.
  fos-assistant 의 옛 설치는 본문만 전달하므로 판정 원칙은 본문에도 둔다(`accountbook/docs/code-architecture.md` 「plugin 설치 계약」).
- 기존 참조 `references/category-totals.md` 는 `execute_code` 에 붙여 넣는 python 예시 하나다. 같은 형식(가계부 도구를 코드 안에서 부르지 않고 받은 JSONL 파일만 읽음, 행 수를 `count` 와 대조)을 따른다.
- 도구 출력: `list_expenses` 파일의 칸(phase 01), `get_budget_summary` 결과(phase 02). 칸 이름은 `accountbook/docs/data-schema.md` 「MCP 계약」 을 따른다.
- 테스트 러너: `bun test ./accountbook/plugin` 이 `src/` 와 `scripts/` 의 `*.test.ts` 를 돈다. CI(`.github/workflows/connector-contracts.yml`)는 ubuntu-24.04 라 `python3` 이 있다.

**근거 문서**: `accountbook/docs/features/monthly-report/spec.md`, `accountbook/docs/adr/ADR-007-budget-scope-row-flag.md`, `accountbook/docs/adr/ADR-006-list-output-file.md`

## 의도 메모

- 계산은 스크립트 하나가 한다. 모델이 판정 규칙을 다시 만들지 않게, 스크립트는 `countsTowardBudget`, `excludeFromBudget`, `categoryExcludeFromBudget`, `recurringExpenseUuid` 값과 `get_budget_summary` 의 항목 카테고리만 쓴다.
- 금액은 정수 원 단위로 더한다. 서버 금액(`spent`, `limit`)은 값이 정수일 때만 `int` 로 바꾸고(예: `1800000.0` 은 받는다), 원 미만이 있으면 예외로 멈춘다. 목록 파일이 소수 금액을 거절하는 것과 같은 기준이다.
- 예시 금액과 이름은 실제 값이 아닌 것만 쓴다(`accountbook/AGENTS.md`).

## 작업 항목

### 1. `accountbook/plugin/skills/accountbook-api/references/monthly-report.md` 신규

두 부분으로 쓴다.

**절차**: 스펙 「스킬: 월 리포트 절차」 의 1~8 단계, 「실패와 빈 상태」 표의 대응, 리포트에 넣을 항목(R7)을 옮긴다. 추가로 아래를 적는다.

- 대상 달과 바로 앞 달 각각 `get_budget_summary`, `list_expenses`(`output: "file"`), `list_incomes`(`output: "file"`)를 부른다. 「지난달」 은 실행 환경의 한국 날짜 기준이다.
- `get_budget_summary` 가 실패하면 오류 코드와 안내를 전하고 다시 부르지 않는다. 스크립트의 예산 입력을 `None` 으로 두고 계속한다(D21). `ACCOUNTBOOK_FORBIDDEN` 이면 「연동 토큰이 아직 예산을 읽을 수 없다」 고 알린다. 예산 금액을 사용자에게 묻지 않는다.
- 일회성 지출 확인은 리포트를 먼저 다 보인 뒤에 묻는다. 확인을 받으면 그 거래 uuid 를 넣어 스크립트를 다시 돌린다(D18).
- 「예산 제외가 없다」 는 스크립트의 `budgetExcluded` 가 모두 0 일 때만 말한다. 거래의 `excludeFromBudget` 만 보고 말하지 않는다(R9).
- 대조가 다르면 리포트 맨 위에 두 값을 함께 보인다(D20).
- `allocationExceeded` 가 `true` 면 「항목 한도 합이 월 예산을 넘었다」 고 알린다.
- 도구 결과는 JSON 이다(`true`, `false`, `null`). 모델은 `PARAMS` 자리에 도구 결과 JSON 을 그대로 붙이고, 스크립트가 `json.loads` 로 읽는다. python 리터럴로 옮겨 적지 않는다.

**계산 스크립트**: `execute_code` 에 붙여 넣을 python 코드 블록 하나. 입력은 `# --- 입력 시작 ---` 과 `# --- 입력 끝 ---` 줄 사이에 `PARAMS = json.loads(r'''<JSON>''')` 한 줄로만 둔다. 키 이름과 값은 JSON 표기(`true`, `false`, `null`)다. 테스트도 같은 형식으로 이 사이를 바꿔 끼운다.

`PARAMS` 의 키:

| 키 | 내용 |
| --- | --- |
| `expenses`, `incomes` | `{ "file": 경로, "count": 정수 }`. 대상 달 파일 |
| `previous` | `null` 또는 `{ "expenses", "incomes", "budget" }`. 앞 달 |
| `budget` | `get_budget_summary` 결과 객체 또는 `null` |
| `oneOffUuids` | 사용자가 일회성이라고 확인한 지출 uuid 목록. 기본 빈 목록 |
| `inProgress` | 대상 달이 진행 중인 이번 달이면 `true` |

계산(스펙의 규칙을 그대로 따른다):

- 행 수가 `count` 와 다르거나 금액이 양의 정수가 아니면 예외로 멈춘다.
- 총지출, 총수입, 수지(수입 − 지출). 카테고리별 합계와 `countsTowardBudget` 기준 카테고리별 합계.
- `budgetExcluded`: 예산에서 빠진 금액을 `transaction`(거래 `excludeFromBudget`), `category`(카테고리 제외), `recurring`(반복지출 생성)으로 나눈다. 여러 사유가 겹치면 이 순서의 앞 사유 하나로 센다(D22).
- 행 분류: 항목 카테고리 집합은 `budget["items"][*]["categories"][*]["uuid"]`. 예산 합계 행 = `countsTowardBudget`, 생활비 행 = 예산 합계 행 가운데 어느 항목 카테고리도 아닌 것, 항목 행 = 그 항목 카테고리이면서 `excludeFromBudget` 이 `False` 인 것.
- 대조(R8, `budget` 이 있을 때): 위 세 분류의 파일 합을 `total.spent`, `living.spent`, 항목별 `spent` 와 비교해 `checks` 에 `{ line, file, server, match }` 로 담는다.
- 일회성 제외(D18): `oneOffUuids` 의 행을 위 세 분류 규칙으로 속하는 모든 줄(예산, 생활비, 항목 중 해당하는 것 전부)의 사용액과 그 줄의 카테고리 금액에서 뺀다. 사용액은 서버 값에서 빼고, `budget` 이 `null` 이면 파일로 계산한 예산 대상 금액에서 뺀다.
  R8 `checks` 는 일회성 제외 전의 값으로 대조한다. 총지출, 총수입, 수지, `budgetExcluded`, 전월 대비는 일회성 제외를 반영하지 않는다. 뺀 행은 `oneOffRemoved` 에 uuid, 금액, 카테고리 이름으로 담는다.
- 한도 판정(D15): `total.limit > 0` 이면 예산과 생활비 줄에 한도를 적용한다(생활비 한도 0 은 남은 한도 0). 항목은 `limit > 0` 일 때만 적용한다. `budget` 이 `None` 이면 어느 줄도 한도를 적용하지 않는다.
  한도 판정의 사용액은 서버 값(일회성 제외 반영)이다(D20).
- 줄마다 `{ line, name, spent, limit, limitApplies, over, remaining }`. `over` = max(사용액 − 한도, 0), `remaining` = max(한도 − 사용액, 0).
- 줄일 금액(D5, D16, D17, `inProgress` 가 아닐 때만): 생활비나 항목이 초과하면 그 줄마다, 둘 다 한도 안인데 예산 줄만 초과하면 예산 줄 하나만 계산한다.
  나눌 카테고리 금액은 생활비 = 생활비 행, 항목 = 그 항목 행, 예산 = 예산 합계 행의 카테고리별 합(일회성 제외 반영, 파일 값).
  카테고리 몫 = 초과액 × 카테고리 금액 ÷ 나눌 금액 합, 줄일 금액 = 몫을 1,000원 단위로 올린 값, 목표치 = max(카테고리 금액 − 줄일 금액, 0). 나눌 금액 합이 0 이면 그 줄은 배분 없이 이유를 남긴다.
  금액 비례 계산은 정수 연산(`(over * amount + total - 1) // total` 처럼)으로 해 부동소수점 오차를 피한다.
- 전월 대비(D19, `previous` 가 있을 때): 총지출, 총수입, 수지, 예산 대상 지출, 생활비와 항목 사용액, 예산 대상 카테고리별 금액의 앞 달 값과 차이.
  예산 대상 지출, 생활비, 항목 사용액은 양쪽 달 모두 서버 값(`budget`, `previous.budget`)을 쓴다. 어느 한쪽이 `null` 이면 양쪽 모두 파일 분류 값을 쓰고, 항목 카테고리는 대상 달 `budget` 의 것을 쓴다(지난달도 지금 구성으로 계산하는 ADR-B25 와 같다). 대상 달 `budget` 도 `null` 이면 생활비와 항목 비교는 빼고 예산 대상 지출만 비교한다. 총액과 카테고리 금액은 파일 값이다.
- 결과는 `json.dumps(..., ensure_ascii=False)` 로 한 번 출력한다.

### 2. `accountbook/plugin/skills/accountbook-api/references/category-totals.md`

기존 예시는 그대로 두고, 예산 대상 합계는 `countsTowardBudget` 이 `True` 인 행만 더한다는 짧은 예시나 문장을 더한다. 월 리포트는 `monthly-report.md` 를 쓴다고 링크한다.

### 3. `accountbook/plugin/skills/accountbook-api/SKILL.md`

- 앞머리 `description` 에 월 리포트 요청 예시(「지난달 소비 리포트」, 「예산 대비 평가」)를 더한다.
- 본문 「등록과 조회」 의 「전체 합계에는 예산 제외 지출도 포함하고, 제외할 때는 `excludeFromBudget` 조건을 코드에 넣어 기준을 알린다.」 문장은 새 원칙과 충돌하므로 아래 원칙으로 바꾼다(지우고 바꿔 넣는다).
- 바꿔 넣는 원칙은 두 줄이다: 예산 대상 판정은 `countsTowardBudget` 과 `get_budget_summary` 로만 하고 거래의 `excludeFromBudget` 만 보고 「예산 제외가 없다」 고 말하지 않는다. 월 리포트는 `references/monthly-report.md` 로 가는 상대 링크(「월 리포트 절차」)를 따르고, 읽을 수 없으면 이 원칙과 계산 원칙으로 답한다.
- 앞머리를 뺀 본문이 8,000자를 넘으면 같은 절의 겹치는 문장을 줄인다. 후보: 파일 모드 설명에서 도구 설명과 겹치는 `limit`/`page` 와 파일 이름 문장, 참조 파일을 읽을 수 없을 때의 문장. 의미를 바꾸는 삭제는 하지 않는다.

### 4. 이 phase 를 검증하는 `accountbook/plugin/scripts/monthly-report-script.test.ts` 신규

`references/monthly-report.md` 의 python 코드 블록을 읽어 입력 표지 사이를 fixture `PARAMS` 로 바꾸고, 임시 디렉터리의 fixture JSONL 로 `python3` 을 실행해 출력 JSON 을 단언한다. python3 이 없으면 실패한다(건너뛰지 않는다).
fixture 금액은 예시 값이다. 경우마다 기대값을 손 계산으로 적는다.

| 경우 | 확인 |
| --- | --- |
| 한도 안 | 모든 줄 `over` 0, 배분 없음 |
| 생활비와 항목이 함께 초과, 예산 줄도 초과 | 생활비와 항목 줄마다 배분하고 예산 줄 배분은 없다 |
| 월 예산은 있고 생활비 한도 0, 생활비 사용액 있음 | 생활비 `limitApplies` 가 `True`, 사용액 전부가 `over` |
| 생활비 초과 | 생활비 행 카테고리에만 배분, 1,000원 올림, 목표치 |
| 항목 초과 | 그 항목 카테고리(반복지출 생성분 포함, 거래 제외분 제외)로 배분 |
| 예산만 초과 | 예산 합계 행 전체로 배분 |
| 월 예산 0 | 예산과 생활비 `limitApplies` 가 `False`, 한도 있는 항목은 판정 |
| 대조 일치, 합계·생활비·항목 불일치 | `checks` 의 `match` 와 두 값 |
| 사유별 예산 제외 | 거래, 카테고리, 반복지출이 겹친 행이 앞 사유 하나로만 셈 |
| 일회성 제외 | 사용액에서 빠져 초과가 사라지는 경우 |
| 진행 중인 달 | 배분 없음, `remaining` 있음 |
| 예산 없음(`null`) | 파일 기준 예산 대상 금액은 있고 한도 판정 없음 |
| 서버 금액이 소수(원 미만) | 예외로 실패 |
| 도구 결과 JSON 그대로 입력 | `false`, `null` 이 든 `get_budget_summary` 결과를 그대로 붙인 입력이 실행된다 |
| 전월 대비 | 양쪽 서버 값 비교, 한쪽 `null` 이면 파일 분류 값 비교 |
| 행 수 불일치 | 예외로 실패 |

## 검증

```bash
cd accountbook/plugin && bun install --frozen-lockfile
cd accountbook/plugin && bun run typecheck
bun test ./accountbook/plugin
cd accountbook/plugin && bun test scripts/monthly-report-script.test.ts scripts/connector-config.test.ts
```

기대값: 모두 종료 코드 0. `connector-config.test.ts` 의 스킬 본문 길이 검사가 통과한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `accountbook/plugin/skills/accountbook-api/references/monthly-report.md` | 신규 |
| `accountbook/plugin/skills/accountbook-api/references/category-totals.md` | 수정 |
| `accountbook/plugin/skills/accountbook-api/SKILL.md` | 수정 |
| `accountbook/plugin/scripts/monthly-report-script.test.ts` | 신규 |
