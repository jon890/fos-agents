# 월 소비 리포트: 예산과 예산 제외 판정을 가계부와 같게 읽는다

## 목표

비서에게 「지난달 소비를 평가하고 무엇을 줄여야 목표를 지킬지」 물으면,
가계부 달력 홈의 예산 요약 카드와 같은 예산 대상 금액과 예산 한도를 도구로 읽어 답한다.
사용자가 예산 금액을 대화로 알려 주거나 예산 제외 항목을 골라 주지 않아도 된다.

2026-11-02 운영 테스트에서 비서는 총액과 카테고리 합계는 맞혔지만 두 가지를 틀렸다.

- 카테고리에 걸린 예산 제외를 보지 못해 「예산 제외 항목이 없다」 고 단정했다.
  `plugin/src/tools.ts` 의 `categories()` 가 응답을 `{ uuid, name, type }` 로만 검증해 카테고리의 `excludeFromBudget` 을 버린다.
- 예산을 읽을 도구가 없어 목표 금액을 사용자에게 다시 물었다.
  연동 토큰 허용 목록(fos-accountbook ADR-B18)에 예산 읽기 경로가 없다.

## 범위

이번 범위는 두 저장소에 걸친다.

- fos-accountbook backend: 연동 토큰 허용 목록에 예산 읽기 경로를 연다(R4). 새 API 는 만들지 않는다(D2).
  지출·수입 목록의 기간 끝을 반열린 구간으로 고친다(R11, D24).
- fos-agents `accountbook/`: 카테고리의 예산 제외 전달(R1), 목록 파일의 예산 판정 칸(R2),
  예산 조회 도구(R3), connector 선언과 문서(R5), 스킬의 월 리포트 절차(R6~R9).

범위 밖:

- fos-accountbook 분석 화면에서 이전 달을 볼 때 카테고리 상세가 이번 달 값으로 남는 문제.
- fos-assistant 실행 상세에 도구 이름과 플러그인 이름을 보이는 일, 연결된 서비스에 원본이 있는 값의 기억 저장 제안 억제.
- 예산 항목, 월 예산, 반복지출 설정을 대화로 바꾸는 일. 이번 기능은 예산을 읽기만 한다.
- 할부. 할부는 지출을 만들지 않아 예산과 집계에 들어가지 않는다(fos-accountbook ADR-B27).
- 예산 구성의 이력. 지난달도 지금의 월 예산과 항목 구성으로 계산한다(fos-accountbook ADR-B25). 이력 저장은 하지 않는다.
- `list_expenses` inline 응답과 `get_expense` 응답의 모양(D10).
- 같은 23:59:59 경계를 쓰는 다른 곳: 카테고리별 지출 요약(`ExpenseSummarySearchRequest`)과 예산 알림(`BudgetAlertService`). 월 리포트가 쓰지 않는 경로다.

## 요구사항과 인수 조건

| ID | 요구사항 | 관측할 인수 조건 |
| --- | --- | --- |
| R1 | `list_categories` 가 카테고리마다 `excludeFromBudget` 을 돌려준다 | 도구 응답 항목이 `{ uuid, name, type, excludeFromBudget }` 이고 값은 API 응답의 boolean 그대로다. API 응답에 이 칸이 없거나 boolean 이 아니면 `ACCOUNTBOOK_INVALID_RESPONSE` 다. `plugin/src/tools.test.ts` 의 fetch 대역 테스트로 확인한다 |
| R2 | 지출 목록 파일의 행마다 카테고리 예산 제외와 예산 대상 여부를 싣는다 | `list_expenses` 의 `output: "file"` JSONL 에 `categoryExcludeFromBudget` 과 `countsTowardBudget` 칸이 더해지고 `columns` 에도 나온다. 판정 규칙은 「설계」 의 예산 대상 판정을 따른다. 거래 제외, 카테고리 제외, 반복지출 생성, 목록에 없는 카테고리, 해당 없음의 다섯 경우를 테스트 fixture 로 확인한다. 기존 칸과 수입 파일은 바뀌지 않는다 |
| R3 | `get_budget_summary` 가 한 달의 예산 합계, 생활비, 예산 항목을 돌려준다 | 「설계」 의 입력과 출력 모양을 테스트로 확인한다. 항목마다 속한 카테고리의 UUID 와 이름이 있다. 토큰이 경로를 허용받기 전이면 `ACCOUNTBOOK_FORBIDDEN` 이다 |
| R4 | 연동 토큰이 예산 읽기 경로 두 개를 부를 수 있고 그 밖의 예산·대시보드 경로는 계속 막힌다 | `ApiTokenAccessPolicyTest` 에서 `GET /api/v1/families/{f}/dashboard/budget-summary`, `GET /api/v1/families/{f}/budget-items` 가 허용되고, `POST /budget-items`, `PUT`·`DELETE /budget-items/{budgetItemUuid}`, `GET /budget-items/{budgetItemUuid}`, 다른 `/dashboard/**` 경로는 거절된다. backend `docs/flow.md` 의 허용 목록과 ADR-B18 결정 문장이 같은 목록을 적는다 |
| R5 | 새 도구가 connector 정책과 문서에 선언된다 | `plugin/connector.json` 의 `tools.get_budget_summary` 가 `READ`/`none` 이고, `tool-metadata.test.ts`, `connector-config.test.ts`, 도구 수를 고정한 `server.test.ts` 가 새 도구 수로 통과한다. `docs/data-schema.md` 의 MCP 계약, `docs/code-architecture.md` 의 도구 수 서술이 새 도구와 칸을 반영한다 |
| R6 | 스킬에 월 리포트 절차가 있다 | `plugin/skills/accountbook-api/references/monthly-report.md` 가 있고, `SKILL.md` 의 설명에 월 리포트 요청 예시가 있다. 본문에는 예산 판정 원칙과 참조 링크만 두고 앞머리를 뺀 본문이 8,000자 이하다(`connector-config.test.ts`) |
| R7 | 월 리포트가 예산 대비 평가와 줄일 금액을 숫자로 낸다 | 리포트에 총지출, 총수입, 수지, 예산 대상 지출과 월 예산, 항목별 사용액과 한도, 생활비 사용액과 한도, 예산 대상 카테고리별 금액, 전월 대비(D4), 줄일 카테고리별 금액과 다음 달 목표치(D5)가 있다. 모든 숫자는 도구 응답이나 `execute_code` 결과에서 나온다. 참조 스크립트를 fixture(한도 안, 생활비 초과, 항목 초과, 월 예산 0)로 돌려 줄일 금액과 목표치가 D5 의 산식과 같은지 확인한다 |
| R8 | 예산 합계, 생활비, 항목별 사용액을 서버 값과 대조한다 | 참조 스크립트가 세 값을 계산해 `get_budget_summary` 와 비교한다. `countsTowardBudget` 이 `true` 인 행의 합은 `total.spent`, 그 가운데 어느 항목의 카테고리에도 속하지 않는 행의 합은 `living.spent`, 항목마다 그 카테고리이면서 `excludeFromBudget` 이 `false` 인 행의 합은 그 항목의 `spent` 와 같아야 한다. 하나라도 다르면 두 값을 함께 보이고 어느 쪽도 고르지 않는다. 일치, 합계 불일치, 생활비 불일치, 항목 불일치 fixture 로 확인한다 |
| R9 | 예산을 읽지 못하면 지어내지 않는다 | `get_budget_summary` 가 `ACCOUNTBOOK_FORBIDDEN` 이면 「연동 토큰이 아직 예산을 읽을 수 없다」 고 알리고 예산 없이 총액과 카테고리 분석만 한다. 「예산 제외가 없다」 는 `countsTowardBudget` 로만 판정하고 거래의 `excludeFromBudget` 만 보고 말하지 않는다. fetch 대역이 403 을 돌려주는 테스트로 도구가 `ACCOUNTBOOK_FORBIDDEN` 을 내는지 확인하고, 참조 절차와 `SKILL.md` 본문에 이 대응이 있는지 리뷰로 확인한다. 배포 순서와 관계없이 지켜야 한다(D6) |
| R10 | 운영에서 같은 질문에 예산을 묻지 않고 답한다 | 두 저장소 배포 뒤 코디네이터가 비서에게 2026-10 소비 리포트를 물으면, 사용자에게 예산 금액이나 제외 항목을 묻지 않고 답하며 예산 대상 지출과 한도가 가계부 달력 홈(`/calendar?month=2026-10`)의 예산 요약 카드 값과 같다. 예산 화면(`/budget`)은 이번 달만 보여 대조 대상이 아니다. 쓰기 승인 카드는 나오지 않는다 |
| R11 | 지출·수입 목록 API 의 기간이 종료일 하루 전체를 빠짐없이 담는다 | `GET /expenses`(`ExpenseService`), `GET /incomes`(`IncomeSearchRequest`)가 `endDate` 를 「다음 날 0시 미만」 으로 조회한다. 요청 형식(`YYYY-MM-DD`)은 그대로다. 종료일 23:59:59.500 에 기록된 지출과 수입이 목록에 나오고 다음 날 00:00:00 기록은 나오지 않는다. backend 서비스 테스트로 확인한다. 같은 달의 목록 파일 합과 `budget-summary` 의 `total.spent` 가 그 경계 지출을 포함해 같다 |

## 설계

### 예산 대상 판정 (D1)

가계부 서버의 예산 합계 규칙(fos-accountbook ADR-B26, `DashboardRepositoryImpl.getMonthlyExpenseAmount`)을 그대로 따른다.
그 달의 지출 한 건은 아래 셋이 모두 아닐 때만 예산 대상이다.

- 거래에 예산 제외 표시가 있다(`excludeFromBudget`).
- 카테고리에 예산 제외 표시가 있다. 목록에 없는 카테고리는 제외가 아닌 것으로 본다. 서버가 ACTIVE 카테고리만 붙이는 것과 같다.
- 반복지출이 만든 지출이다(`recurringExpenseUuid` 가 있다).

`countsTowardBudget = !excludeFromBudget && !categoryExcludeFromBudget && recurringExpenseUuid === null` 이다.
가계부 웹의 거래 행 「예산 제외」 표시는 앞의 둘만 본다(`DayTransactionList.tsx`). 반복지출이 만든 지출이 예산 제외 카테고리 밖에 있으면 행 표시와 예산 합계가 다르다.
리포트는 달력 홈 예산 요약 카드와 예산 알림의 합계와 맞추는 쪽을 고른다.

예산 항목의 사용액은 다른 규칙이다. 항목 카테고리의 지출에서 거래 예산 제외만 뺀다(ADR-B25).
그래서 `living.spent` 와 항목 `spent` 의 합이 `total.spent` 와 다를 수 있다. 도구는 서버 값을 그대로 넘기고 스킬이 이 차이를 설명한다.

### 서버 계산과 모델 계산의 경계 (D3)

| 값 | 계산하는 곳 |
| --- | --- |
| 예산 합계, 월 예산, 생활비 사용액과 한도, 항목별 사용액과 한도 | 가계부 서버(`get_budget_summary`) |
| 행마다 예산 대상 여부 | 플러그인(`list_expenses` 파일의 `countsTowardBudget`) |
| 총지출, 총수입, 카테고리별 합계, 예산 대상 카테고리별 합계, 전월 대비, 줄일 금액과 목표치 | 모델이 `execute_code` 로 파일을 읽어 계산(ADR-006 유지) |
| 줄일 카테고리 고르기, 일회성 지출 구분, 문장 | 모델. 일회성 여부는 사용자에게 확인 |

모델이 판정 규칙을 다시 만들지 않게 규칙은 파일 칸으로 준다. 모델은 칸으로 필터링해 더하기만 한다.
R8 의 대조가 플러그인 판정과 서버 규칙이 어긋나는 것을 잡는다. 서버 규칙이 바뀌어 플러그인 판정이 낡으면 리포트가 조용히 틀리지 않고 불일치를 알린다.

### fos-accountbook: 연동 토큰 허용 목록 (D2)

`ApiTokenAccessPolicy` 에 아래 두 규칙을 더한다. 기존 Controller 와 Service 를 그대로 쓰고 새 API 는 만들지 않는다.

| 경로 | 메서드 | 응답 |
| --- | --- | --- |
| `/api/v1/families/{familyUuid}/dashboard/budget-summary` | GET | `BudgetSummaryResponse`: `year`, `month`, `total { spent, limit }`, `living { spent, limit }`, `allocationExceeded`, `items[] { budgetItemUuid, name, limit, spent }` |
| `/api/v1/families/{familyUuid}/budget-items` | GET | `BudgetItemResponse[]`: `uuid`, `name`, `monthlyLimit`, `categoryUuids`, 생성·수정 시각 |

가족 권한은 로그인과 같은 `@ValidateFamilyAccess` 경로가 본다. 예산 항목의 생성, 수정, 삭제와 다른 대시보드 경로는 열지 않는다.
같은 PR 에서 backend `docs/flow.md` 「연동 토큰으로 부르기」 의 허용 목록과 ADR-B18 의 제목(「기록 경로만」)과 결정 문장을 고친다(D13).

### fos-agents: 도구 계약

**`list_categories`** (R1): 응답 검증 스키마에 `excludeFromBudget: boolean` 을 필수로 더한다(D9).
`categories()` 는 다른 도구도 쓰므로 응답 모양이 바뀌는 곳은 `list_categories` 결과와 파일 출력뿐이다.

**`list_expenses` 파일 출력** (R2): `columns` 를 아래 순서로 한다. 앞의 아홉 칸은 지금과 같다(D12).

`uuid`, `date`, `amount`, `categoryName`, `categoryUuid`, `userUuid`, `description`, `recurringExpenseUuid`, `excludeFromBudget`, `categoryExcludeFromBudget`, `countsTowardBudget`

`excludeFromBudget` 은 지금처럼 거래 자체의 값이다. `categoryExcludeFromBudget` 은 목록에 없는 카테고리면 `false` 다.
`list_incomes` 파일은 바꾸지 않는다. 수입은 예산 판정 대상이 아니다.

**`get_budget_summary`** (R3, D8): 이름이 `get_` 으로 시작하므로 `server.ts` 가 읽기 전용으로 표시한다.

입력:

| 필드 | 형식 | 제약 |
| --- | --- | --- |
| `familyUuid` | UUID | 선택. 없으면 다른 도구와 같은 가족 선택 규칙 |
| `month` | `YYYY-MM` | 필수. 「지난달」 은 스킬이 실행 환경의 한국 날짜로 정한다 |

호출: `GET .../dashboard/budget-summary?year&month`, `GET .../budget-items`, `GET .../categories` 를 차례로 부른다.

출력:

```json
{
  "month": "YYYY-MM",
  "total": { "spent": 0, "limit": 0 },
  "living": { "spent": 0, "limit": 0 },
  "allocationExceeded": false,
  "items": [
    {
      "uuid": "…",
      "name": "…",
      "limit": 0,
      "spent": 0,
      "categories": [{ "uuid": "…", "name": "…" }]
    }
  ]
}
```

- 금액은 숫자다. API 의 숫자나 숫자 문자열을 받아 유한한 0 이상의 수로 바꾸고, 아니면 `ACCOUNTBOOK_INVALID_RESPONSE` 다.
- 한도 판정은 달력 홈 예산 요약 카드(`BudgetSummaryCard.tsx`)와 같게 한다(D15).
  `total` 과 `living` 은 `total.limit > 0` 일 때 한도를 적용한다. 서버가 생활비 한도를 0 으로 자르면(`DashboardService.java` 의 `max(0)`) 「남은 한도 0」 이며 쓴 금액이 있으면 초과다.
  항목은 `limit > 0` 일 때만 한도를 적용하고, 0 이면 한도 없음이다. `allocationExceeded` 가 `true` 면 「항목 한도가 예산을 넘었다」 고 알린다.
- `items` 순서는 서버 순서(만든 순서)다. 항목의 카테고리는 `budget-items` 의 `categoryUuids` 를 카테고리 목록 이름과 짝지은 것이고, 목록에 없으면 `name: null` 이다.
- `budget-summary` 의 항목 가운데 `budget-items` 에 없는 것이 있으면 `ACCOUNTBOOK_INVALID_RESPONSE` 다. 두 요청 사이에 항목이 바뀐 경우다.
- 오류는 기존 어휘를 쓴다. 허용 전 토큰은 `ACCOUNTBOOK_FORBIDDEN` 이다. 새 오류 코드는 없다.

**connector** (R5): `connector.json` 의 `tools` 에 `get_budget_summary` 를 `risk: READ`, `approval: none` 으로 선언하고 설명에 위 입력과 출력을 적는다.
도구 목록이 바뀌므로 배포 뒤 실행 환경이 MCP 서버를 다시 띄워야 새 도구가 보인다.

### 스킬: 월 리포트 절차 (R6~R9)

`SKILL.md` 본문은 지금 7,955자로 8,000자 한도에 가깝다. 절차는 `references/monthly-report.md` 에 두고 본문에는 아래만 둔다(D11).

- 예산 대상 판정은 `countsTowardBudget` 과 `get_budget_summary` 로만 한다. 거래의 `excludeFromBudget` 만 보고 「예산 제외가 없다」 고 말하지 않는다.
- 월 리포트는 참조 절차를 따른다. 참조를 읽을 수 없으면 위 원칙과 기존 계산 원칙으로 답한다.

본문이 8,000자를 넘으면 같은 PR 에서 다른 절의 중복 문장을 줄인다.

`references/monthly-report.md` 의 절차:

1. 대상 달과 비교 달(D4)을 정한다. 「지난달」 은 실행 환경의 한국 날짜 기준이다.
   대상 달이 진행 중인 이번 달이면 현황과 남은 한도만 보이고 줄일 금액과 목표치는 내지 않는다(D23).
2. 달마다 `get_budget_summary`, `list_expenses`(`output: "file"`), `list_incomes`(`output: "file"`)를 부른다.
3. `execute_code` 로 총지출, 총수입, 수지, 카테고리별 합계, `countsTowardBudget` 기준 카테고리별 합계를 계산하고 R8 의 대조를 한다.
   예산에서 빠진 금액은 거래 제외, 카테고리 제외, 반복지출 생성으로 나눠 보인다(D22). 셋이 겹치는 행은 앞의 사유 하나로 센다.
4. 예산, 생활비, 항목별로 한도 대비를 판정한다. 한도 적용 여부는 「`get_budget_summary`」 의 한도 판정(D15)을 따른다.
5. 초과한 줄은 D5 의 비례 배분으로 줄일 카테고리별 금액과 다음 달 목표치를 낸다. 줄마다 나눌 카테고리 금액은 D16 이 정한다.
   줄일 금액은 천 원 단위로 올린다(D17). 목표치는 이번 달 카테고리 금액에서 줄일 금액을 뺀 값이고 0 보다 작으면 0 이다.
6. 큰 지출 가운데 일회성으로 보이는 것은 사용자에게 확인한다. 사용자가 일회성이라고 하면 그 금액을 사용액과 카테고리 금액에서 빼고 초과액부터 다시 계산한다(D18).
   확인 전에는 포함한 값으로 보이고 그 사실을 알린다.
7. 전월 대비는 총지출, 총수입, 수지, 예산 대상 지출, 생활비와 항목 사용액, 예산 대상 카테고리별 금액을 비교한다(D19). 앞 달 한도도 지금 설정 기준이다.
8. 한도는 지금 설정 기준이라는 것(ADR-B25)과, 수지가 그달 저축액이라는 것을 알린다.

D16 의 줄별 분배 기준:

| 초과한 줄 | 나눌 카테고리 금액 |
| --- | --- |
| 생활비 | 어느 항목에도 속하지 않은 카테고리의 `countsTowardBudget` 금액 |
| 항목 | 그 항목 카테고리에서 거래 예산 제외만 뺀 금액. 서버의 항목 사용액 규칙과 같다 |
| 예산만 초과하고 생활비와 항목은 한도 안 | 예산 대상 카테고리 전체의 `countsTowardBudget` 금액 |

생활비와 항목이 함께 초과하면 줄마다 따로 낸다. 예산 줄은 그 위에 따로 더하지 않는다.

`references/category-totals.md` 예시에 `countsTowardBudget` 필터를 쓰는 예산 대상 합계를 더한다.

### 실패와 빈 상태

| 상황 | 동작 |
| --- | --- |
| `get_budget_summary` 가 `ACCOUNTBOOK_FORBIDDEN` | R9. 한도 없이 분석한다. 파일로 계산한 예산 대상 지출과 예산 대상 카테고리별 금액은 보이고 한도는 「읽을 수 없음」 으로 둔다(D21). 예산 금액을 사용자에게 묻지 않는다 |
| `get_budget_summary` 가 다른 오류 | 오류 코드와 안내를 전하고 자동으로 다시 부르지 않는다. 그다음은 FORBIDDEN 과 같다(D21) |
| 월 예산이 0 | 「월 예산이 설정되지 않았다」 고 알리고 예산과 생활비의 초과 판정을 하지 않는다. 한도가 있는 항목은 판정한다 |
| 예산 항목이 없음 | `items` 가 빈 배열이고 예산 대상 전체가 생활비다 |
| 대상 달에 지출이 없음 | 파일 `count` 가 0 이다. 0원으로 보이고 목표치는 내지 않는다 |
| R8 대조가 다름 | 두 값을 함께 보이고 어느 쪽이 맞는지 단정하지 않는다. 한도 대비 판정은 서버 값으로, 카테고리 분배는 파일 값으로 계속하고 불일치를 함께 알린다(D20) |
| 말일 23:59:59 뒤 밀리초에 기록된 지출 | 지금은 목록 API 가 `endDate` 에 `T23:59:59` 를 붙여 그 이하만 돌려주므로 이 지출이 파일에서 빠지고, 연월로 세는 서버 월 합계에는 들어간다. R11 로 목록의 기간 끝을 다음 날 0시 미만으로 고친다(D24). 플러그인 쪽 입력과 파일 검증(`date` 앞 10자리가 기간 안)은 바뀌지 않는다. R11 배포 전에는 R8 불일치로 드러난다 |
| `execute_code` 가 없음 | 기존 규칙대로 합계와 통계를 계산할 수 없다고 말한다. 예산 도구의 서버 값은 보인다 |

### 데이터와 운영

- 새로 저장하는 데이터는 없다. 목록 파일의 칸 두 개가 늘 뿐이며 보관 규칙(ADR-006)은 같다.
- 비용이 드는 호출은 없다. 월 리포트 한 번에 가계부 조회가 달마다 세 도구, 파일마다 페이지 수만큼 는다.
- 문제가 나면 fos-agents 배포를 되돌리면 된다. 토큰 허용 경로는 읽기 전용이라 남겨도 기록이 바뀌지 않는다.

### PR 과 배포 순서 (D6)

두 저장소의 PR 을 동시에 진행하고, 각자 준비되는 대로 머지하고 배포한다. 서로를 기다리지 않는다.

- fos-accountbook PR: 허용 목록 두 규칙, `ApiTokenAccessPolicyTest`, flow.md, ADR-B18, 목록 기간 끝(R11)과 그 테스트.
- fos-agents PR: R1, R2, R3, R5, R6~R9, accountbook 문서와 ADR.

배포 순서가 어긋나도 아래처럼 안전하다.

| 상태 | 동작 |
| --- | --- |
| 플러그인만 배포됨 | `get_budget_summary` 가 `ACCOUNTBOOK_FORBIDDEN` 이다. 스킬은 「연동 토큰이 아직 예산을 읽을 수 없다」 고 알리고 「실패와 빈 상태」 의 FORBIDDEN 행(R9, D21)대로 한도 없이 답한다. 예산 금액을 사용자에게 묻거나 지어내지 않는다. R1, R2 는 백엔드 변경 없이 동작한다 |
| 백엔드만 배포됨 | 새 경로를 부르는 도구가 아직 없다. 기존 도구는 그대로다 |
| 둘 다 배포됨 | 실행 환경이 MCP 서버를 다시 띄우고 연결 확인으로 스킬을 갱신한다. 그 뒤 R10 을 확인한다 |

R9 의 FORBIDDEN 동작은 fos-agents PR 의 테스트(fetch 대역이 403 을 돌려주는 경우)와 참조 절차로 확인한다.

### 테스트

| 요구사항 | 검증 |
| --- | --- |
| R1, R2, R3 | `plugin/src/tools.test.ts`, `output-file.test.ts` 의 fetch 대역 테스트. `cd accountbook/plugin && bun run typecheck && bun test && bun run build` 와 번들 일치 검사 |
| R4 | fos-accountbook backend 의 `ApiTokenAccessPolicyTest` 와 연동 토큰 필터 테스트 |
| R11 | fos-accountbook backend 의 지출·수입 목록 서비스 테스트(종료일 23:59:59.500 포함, 다음 날 00:00:00 제외) |
| R5, R6 | `plugin/scripts/connector-config.test.ts`, `tool-metadata.test.ts` |
| R7, R8, R9 | 참조 스크립트를 fixture JSONL 로 돌려 대조 결과를 확인하고, verify 단계에서 절차 문서를 리뷰한다 |
| R10 | 배포 뒤 코디네이터가 운영 비서에 2026-10 리포트를 묻고 가계부 달력 홈의 2026-10 예산 요약 카드와 대조한다. 가계부는 읽기만 한다 |

### 문서

- `accountbook/docs/data-schema.md`: MCP 계약의 도구 이름 목록, 카테고리 응답, 파일 칸, `get_budget_summary`.
- `accountbook/docs/code-architecture.md`: 도구 수 서술.
- `accountbook/docs/adr/ADR-007`: 플러그인이 서버 예산 규칙을 행 판정으로 옮기고 서버 합계로 대조한다는 결정(D14). ADR-006 은 유지한다.
- fos-accountbook `backend/docs/flow.md`, ADR-B18(D13).

## 결정

| ID | 결정 | 답 | 누가 | 근거 |
| --- | --- | --- | --- | --- |
| D0 | 이번 범위 | 예산 도구까지 함께 한다. 분석 화면 버그와 fos-assistant 개선은 범위 밖 | 사용자 2026-11-02 | 코디네이터 지시서의 사용자 결정 |
| D1 | 예산 대상 판정 규칙 | 서버 예산 합계 규칙(거래 제외 OR 카테고리 제외 OR 반복지출 생성이면 제외) | 사용자 2026-11-02 | 예산 화면, 홈, 예산 알림이 같은 규칙을 쓴다(ADR-B26). 거래 행 표시는 반복지출을 보지 않는다 |
| D2 | 예산 읽기 경로 | 기존 `GET budget-summary` 와 `GET budget-items` 를 연동 토큰에 연다. 새 API 없음 | 사용자 2026-11-02 | 필요한 값을 기존 응답이 모두 준다. ADR-B18 의 「기록 경로만」 을 넓히는 결정이다 |
| D3 | 서버 계산과 모델 계산의 경계 | 요약 도구를 두지 않는다(ADR-006 유지). 플러그인이 행 판정 칸을 주고 모델이 코드로 더한 뒤 서버 합계와 대조한다(R8) | 사용자 2026-11-02 | 운영 테스트의 합계 계산은 맞았고 틀린 것은 판정 규칙뿐이었다 |
| D4 | 전월 대비 범위 | 바로 앞 달 하나 | 사용자 2026-11-02 | 조회가 두 배로 그친다. 이사 같은 일회성 달과 비교될 수 있다 |
| D5 | 줄일 금액과 다음 달 목표치 산정 | 비례 배분: 초과액을 예산 대상 카테고리 금액에 비례해 나누고, 이번 달 금액에서 뺀 값을 목표치로 한다. 일회성으로 보이는 지출은 사용자 확인 뒤 계산에서 뺀다 | 사용자 2026-11-02 | 같은 입력에 같은 답이 나온다. 일회성 지출은 사용자 확인 뒤 뺀다 |
| D6 | PR 과 배포 순서 | 두 저장소 PR 을 동시에 진행한다. 어느 쪽이 먼저 배포돼도 R9 로 안전하다 | 사용자 2026-11-02 | 권장안(fos-accountbook 먼저) 대신 골랐다. 플러그인이 먼저 나가면 허용 전 기간에 예산 없는 리포트가 나온다 |
| D7 | 스펙 위치 | `accountbook/docs/features/monthly-report/spec.md` | 작성자 | 저장소에 기능 스펙 관례가 없어 spec 스킬 기본 위치를 따른다 |
| D8 | 예산 도구 이름과 입력 | `get_budget_summary`, `month` 필수 | 작성자 | `get_` 접두사가 읽기 전용 표시 규칙(`server.ts`)에 맞는다. 서버 API 가 연월을 필수로 받는다 |
| D9 | 카테고리 응답에 `excludeFromBudget` 이 없을 때 | `ACCOUNTBOOK_INVALID_RESPONSE` | 작성자 | backend `CategoryResponse` 는 primitive boolean 이라 항상 싣는다. 기본값 `false` 로 채우면 이번 오답이 되살아난다 |
| D10 | inline 목록과 `get_expense` 응답 | 바꾸지 않는다 | 작성자 | REST `data` 를 그대로 넘기는 계약이다. 판정은 파일 칸과 예산 도구로 한다 |
| D11 | 월 리포트 절차의 위치 | `references/monthly-report.md`, 본문에는 판정 원칙만 | 작성자 | 본문 7,955자로 8,000자 한도에 가깝다. 옛 설치용 원칙만 본문에 둔다 |
| D12 | 기존 파일 칸 `excludeFromBudget` | 거래 값 그대로 두고 칸을 더한다 | 작성자 | 이미 쓰는 스크립트와 호환된다 |
| D13 | fos-accountbook 문서 | ADR-B18 의 제목과 결정 문장, flow.md 허용 목록을 같은 PR 에서 고친다 | 작성자 | `ApiTokenAccessPolicy` javadoc 이 flow.md 와 목록을 같게 두라고 정했다. ADR-B18 제목의 「기록 경로만」 이 더는 맞지 않는다 |
| D14 | accountbook ADR | ADR-007 로 행 판정과 서버 합계 대조를 남긴다 | 작성자 | 같은 규칙이 backend 두 곳과 플러그인에 생겨 이후 변경에 영향을 준다 |
| D15 | 한도 적용 여부 | 예산과 생활비는 `total.limit > 0` 이면 한도를 적용하고 생활비 한도 0 은 「남은 한도 0」, 항목은 `limit > 0` 일 때만 적용 | 작성자 | 달력 홈 `BudgetSummaryCard.tsx` 의 `hasLimit` 규칙과 같아야 R10 대조가 맞는다 |
| D16 | 줄일 금액을 나눌 대상 | 「스킬: 월 리포트 절차」 의 줄별 분배 기준 표 | 사용자 2026-11-02 | 항목 사용액은 반복지출과 카테고리 제외를 포함해 `countsTowardBudget` 으로 나누면 분배 대상이 비는 경우가 있다 |
| D17 | 줄일 금액의 단위 | 천 원 단위로 올린다 | 사용자 2026-11-02 | 원 단위 비례 배분은 읽기 어렵다. 올림이라 합이 초과액보다 조금 크다 |
| D18 | 일회성 지출을 뺄 때 | 사용액과 카테고리 금액에서 빼고 초과액부터 다시 계산한다. 리포트에 뺀 금액과 이유를 보인다 | 사용자 2026-11-02 | 일회성 지출이 초과의 원인이면 초과 자체가 사라져야 한다 |
| D19 | 전월 대비 항목 | 총지출, 총수입, 수지, 예산 대상 지출, 생활비와 항목 사용액, 예산 대상 카테고리별 금액 | 사용자 2026-11-02 | 어느 카테고리가 튀었는지 보여야 줄일 곳을 고른다 |
| D20 | R8 대조가 다를 때 | 한도 판정은 서버 값, 카테고리 분배는 파일 값으로 계속하고 리포트 맨 위에 불일치를 알린다 | 사용자 2026-11-02 | 멈추면 리포트가 비고, 한 값을 고르면 오류를 숨긴다 |
| D21 | 예산 도구가 실패할 때 | 오류를 전하고 다시 부르지 않는다. 파일 기준 예산 대상 금액은 보이고 한도만 「읽을 수 없음」 | 사용자 2026-11-02 | `countsTowardBudget` 은 백엔드 허용과 관계없이 나온다(D6 동시 배포) |
| D22 | 예산에서 빠진 금액 표시 | 거래 제외, 카테고리 제외, 반복지출 생성으로 나눠 보인다 | 사용자 2026-11-02 | 운영 테스트의 오답이 「예산 제외가 없다」 단정이었다. 사유를 보이면 사용자가 바로 확인한다 |
| D23 | 진행 중인 달을 물을 때 | 현황과 남은 한도만 보이고 줄일 금액과 목표치는 내지 않는다 | 사용자 2026-11-02 | 달이 끝나지 않아 초과액이 확정되지 않았다 |
| D24 | 말일 밀리초 경계 | 목록 API 의 기간 끝을 다음 날 0시 미만(반열린 구간)으로 고친다(R11) | 작성자 | 코디네이터 지시(2026-11-02)로 드러내기만 하지 않고 고친다. 웹 등록이 밀리초까지 보내므로(`expense-service.ts` 의 `toISOString`) 말일 마지막 1초의 기록이 빠질 수 있다. 목록 API 는 날짜만 받고 `T23:59:59` 를 붙이므로 플러그인 입력으로는 고칠 수 없다. 응답에 그 1초의 기록이 더해질 뿐 요청 형식은 같다 |
