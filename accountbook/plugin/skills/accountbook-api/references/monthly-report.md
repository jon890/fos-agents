# 월 소비 리포트 절차

사용자가 한 달 소비를 평가해 달라거나 예산 대비 무엇을 줄여야 하는지 물을 때 이 절차를 따른다.
예산 금액과 예산 제외 항목은 도구로 읽는다. 사용자에게 묻지 않는다.
리포트의 모든 숫자는 도구 응답이나 아래 계산 스크립트의 출력에서 가져온다. 직접 더하거나 어림하지 않는다.

## 절차

1. 대상 달과 바로 앞 달을 정한다. 「지난달」 은 실행 환경의 한국 날짜 기준이다.
   대상 달이 진행 중인 이번 달이면 `inProgress` 를 `true` 로 둔다. 현황과 남은 한도만 보이고 줄일 금액과 목표치는 내지 않는다.
2. 대상 달과 앞 달 각각 `get_budget_summary`(`month`), `list_expenses`(`output: "file"`), `list_incomes`(`output: "file"`)를 부른다.
   목록의 기간은 그 달 1일부터 말일까지다.
   `get_budget_summary` 가 실패하면 오류 코드와 안내를 전하고 다시 부르지 않는다. 그 달의 예산 입력을 `null` 로 두고 계속한다.
   `ACCOUNTBOOK_FORBIDDEN` 이면 「연동 토큰이 아직 예산을 읽을 수 없다」 고 알린다. 예산 금액을 사용자에게 묻지 않는다.
3. 아래 계산 스크립트를 `execute_code` 로 실행한다.
   총지출, 총수입, 수지, 카테고리별 합계, `countsTowardBudget` 기준 카테고리별 합계를 계산하고 서버 값과 대조한다(`checks`).
   대조가 하나라도 다르면 리포트 맨 위에 파일 값과 서버 값을 함께 보이고 어느 쪽이 맞는지 단정하지 않는다.
   한도 대비 판정은 서버 값으로, 카테고리 분배는 파일 값으로 계속한다. 스크립트가 이 기준으로 계산한다.
   예산에서 빠진 금액은 거래 제외, 카테고리 제외, 반복지출 생성으로 나눠 보인다(`budgetExcluded`). 셋이 겹치는 행은 앞의 사유 하나로 센다.
   「예산 제외가 없다」 는 `budgetExcluded` 가 모두 0 일 때만 말한다. 거래의 `excludeFromBudget` 만 보고 말하지 않는다.
4. 예산, 생활비, 항목별로 한도 대비를 판정한다(`lines`).
   예산과 생활비는 월 예산(`total.limit`)이 0 보다 클 때 한도를 적용한다. 이때 생활비 한도 0 은 「남은 한도 0」 이고 쓴 금액이 있으면 초과다.
   항목은 한도가 0 보다 클 때만 적용하고, 0 이면 한도 없음이다.
   `allocationExceeded` 가 `true` 면 「항목 한도 합이 월 예산을 넘었다」 고 알린다.
   항목 사용액은 항목 카테고리의 지출에서 거래 예산 제외만 뺀 금액이라, 반복지출 생성분과 카테고리 제외분도 들어간다.
   그래서 생활비와 항목 사용액의 합이 예산 합계와 다를 수 있다. 다르면 이 이유를 알린다.
5. 초과한 줄은 비례 배분으로 줄일 카테고리별 금액과 다음 달 목표치를 낸다(`reductions`). 줄마다 나눌 카테고리 금액은 아래 분배 기준 표를 따른다.
   카테고리 몫은 초과액 × 카테고리 금액 ÷ 나눌 금액 합이고, 줄일 금액은 몫을 천 원 단위로 올린 값이다. 올림이라 줄일 금액의 합은 초과액보다 조금 크다.
   목표치는 이번 달 카테고리 금액에서 줄일 금액을 뺀 값이고 0 보다 작으면 0 이다.
6. 큰 지출 가운데 일회성으로 보이는 것은 리포트를 먼저 다 보인 뒤 사용자에게 확인한다. 확인 전에는 포함한 값으로 보이고 그 사실을 알린다.
   사용자가 일회성이라고 하면 그 거래의 `uuid` 를 `oneOffUuids` 에 넣어 스크립트를 다시 실행한다.
   스크립트가 그 금액을 사용액과 카테고리 금액에서 빼고 초과액부터 다시 계산한다. 뺀 금액과 이유를 리포트에 보인다(`oneOffRemoved`).
7. 전월 대비는 총지출, 총수입, 수지, 예산 대상 지출, 생활비와 항목 사용액, 예산 대상 카테고리별 금액을 비교한다(`comparison`). 앞 달 한도도 지금 설정 기준이다.
8. 한도는 지금 설정 기준이라는 것(fos-accountbook ADR-B25)과, 수지가 그달 저축액이라는 것을 알린다.

분배 기준:

| 초과한 줄 | 나눌 카테고리 금액 |
| --- | --- |
| 생활비 | 어느 항목에도 속하지 않은 카테고리의 `countsTowardBudget` 금액 |
| 항목 | 그 항목 카테고리에서 거래 예산 제외만 뺀 금액. 서버의 항목 사용액 규칙과 같다 |
| 예산만 초과하고 생활비와 항목은 한도 안 | 예산 대상 카테고리 전체의 `countsTowardBudget` 금액 |

생활비와 항목이 함께 초과하면 줄마다 따로 낸다. 예산 줄은 그 위에 따로 더하지 않는다.

## 리포트 항목

- 총지출, 총수입, 수지
- 예산 대상 지출과 월 예산
- 생활비 사용액과 한도, 항목별 사용액과 한도
- 예산 대상 카테고리별 금액
- 예산에서 빠진 금액과 사유
- 전월 대비
- 줄일 카테고리별 금액과 다음 달 목표치. 진행 중인 달이면 대신 남은 한도를 보인다

## 실패와 빈 상태

| 상황 | 동작 |
| --- | --- |
| `get_budget_summary` 가 `ACCOUNTBOOK_FORBIDDEN` | 「연동 토큰이 아직 예산을 읽을 수 없다」 고 알리고 예산 입력을 `null` 로 둔다. 파일로 계산한 예산 대상 지출과 예산 대상 카테고리별 금액은 보이고 한도는 「읽을 수 없음」 으로 둔다. 예산 금액을 사용자에게 묻지 않는다 |
| `get_budget_summary` 가 다른 오류 | 오류 코드와 안내를 전하고 다시 부르지 않는다. 그다음은 `ACCOUNTBOOK_FORBIDDEN` 과 같다 |
| 월 예산이 0 | 「월 예산이 설정되지 않았다」 고 알리고 예산과 생활비의 초과 판정을 하지 않는다. 한도가 있는 항목은 판정한다 |
| 예산 항목이 없음 | `items` 가 빈 배열이고 예산 대상 전체가 생활비다 |
| 대상 달에 지출이 없음 | 파일 `count` 가 0 이다. 0원으로 보이고 목표치는 내지 않는다 |
| 대조가 다름 | 두 값을 함께 보이고 어느 쪽이 맞는지 단정하지 않는다. 한도 대비 판정은 서버 값, 카테고리 분배는 파일 값으로 계속한다 |
| `execute_code` 가 없음 | 합계와 통계를 계산할 수 없다고 말한다. `get_budget_summary` 의 서버 값은 보인다 |

## 계산 스크립트

가계부 도구를 코드 안에서 부르지 않고, 이미 받은 JSONL 파일과 도구 결과만 읽는다.
`# --- 입력 시작 ---` 과 `# --- 입력 끝 ---` 사이의 `PARAMS` 한 줄만 바꾼다.
`r'''` 와 `'''` 사이에는 JSON 을 쓴다. `get_budget_summary` 결과는 받은 JSON 을 그대로 붙인다.
`true`, `false`, `null` 을 python 의 `True`, `False`, `None` 으로 옮겨 적지 않는다.

| 키 | 내용 |
| --- | --- |
| `expenses`, `incomes` | 대상 달 `list_expenses`, `list_incomes` 응답의 `{ "file": 경로, "count": 정수 }` |
| `previous` | `null` 또는 앞 달의 `{ "expenses", "incomes", "budget" }`. 형식은 대상 달과 같다 |
| `budget` | 대상 달 `get_budget_summary` 결과 객체. 실패했으면 `null` |
| `oneOffUuids` | 사용자가 일회성이라고 확인한 지출 `uuid` 목록. 확인 전에는 빈 목록 |
| `inProgress` | 대상 달이 진행 중인 이번 달이면 `true` |

출력은 JSON 한 줄이다.

| 키 | 내용 |
| --- | --- |
| `totalExpense`, `totalIncome`, `balance` | 총지출, 총수입, 수지(수입 − 지출). 일회성 제외를 반영하지 않는다 |
| `categories` | 전체 지출의 카테고리별 금액. 일회성 제외를 반영하지 않는다 |
| `budgetCategories` | 예산 대상(`countsTowardBudget`) 카테고리별 금액. 일회성 제외를 반영한다 |
| `budgetExcluded` | 예산에서 빠진 금액. `transaction`(거래 제외), `category`(카테고리 제외), `recurring`(반복지출 생성) |
| `allocationExceeded` | 서버 값. `budget` 이 `null` 이면 `null` |
| `checks` | 줄마다 `{ line, uuid, name, file, server, match }`. 일회성 제외 전 값으로 대조한다. `budget` 이 `null` 이면 빈 목록 |
| `lines` | 줄마다 `{ line, uuid, name, spent, limit, limitApplies, over, remaining }`. `line` 은 `budget`, `living`, `item` 이고 `uuid` 는 항목에만 있다. `budget` 이 `null` 이면 파일로 계산한 예산 줄 하나이고 `limit` 은 `null` 이다 |
| `reductions` | 줄일 금액을 낸 줄마다 `{ line, uuid, name, over, base, categories, reason }`. `categories` 의 항목은 `{ categoryUuid, categoryName, amount, reduction, target }` 이다. `base` 가 0 이면 배분 없이 `reason` 을 둔다 |
| `oneOffRemoved` | 뺀 거래마다 `{ uuid, amount, categoryName, lines }` |
| `comparison` | 전월 대비. `previous` 가 `null` 이면 `null`. `budgetSource` 는 예산 대상 지출, 생활비, 항목 사용액을 서버 값으로 비교했으면 `server`, 파일 분류 값으로 비교했으면 `file` 이다 |

```python
import json
from collections import defaultdict

# --- 입력 시작 ---
PARAMS = json.loads(r'''{"expenses": {"file": "/connector-output/list_expenses-example.jsonl", "count": 0}, "incomes": {"file": "/connector-output/list_incomes-example.jsonl", "count": 0}, "previous": null, "budget": null, "oneOffUuids": [], "inProgress": false}''')
# --- 입력 끝 ---


def read_rows(source, expense):
    rows = []
    with open(source["file"], encoding="utf-8") as records:
        for line in records:
            row = json.loads(line)
            amount = row["amount"]
            if type(amount) is not int or amount <= 0:
                raise ValueError("양의 정수 금액이 아닌 행이 있습니다")
            if expense and type(row["countsTowardBudget"]) is not bool:
                raise ValueError("지출 파일에 countsTowardBudget 칸이 없습니다")
            rows.append(row)
    if len(rows) != source["count"]:
        raise ValueError("파일의 행 수가 목록 응답과 다릅니다")
    return rows


def won(value):
    # 서버 금액은 원 단위 정수만 받는다. 1800000.0 처럼 소수부가 0 이면 정수로 바꾼다.
    if type(value) is float and value.is_integer():
        value = int(value)
    if type(value) is not int or value < 0:
        raise ValueError("서버 금액이 원 단위 정수가 아닙니다: " + repr(value))
    return value


def read_budget(raw):
    if raw is None:
        return None
    return {
        "total": {"spent": won(raw["total"]["spent"]), "limit": won(raw["total"]["limit"])},
        "living": {"spent": won(raw["living"]["spent"]), "limit": won(raw["living"]["limit"])},
        "allocationExceeded": raw["allocationExceeded"],
        "items": [
            {
                "uuid": item["uuid"],
                "name": item["name"],
                "spent": won(item["spent"]),
                "limit": won(item["limit"]),
                "categories": {category["uuid"] for category in item["categories"]},
            }
            for item in raw["items"]
        ],
    }


def budget_lines(budget):
    # 예산이 없으면 파일로 계산한 예산 줄 하나만 둔다.
    lines = [{"line": "budget", "uuid": None, "name": "예산", "categories": None}]
    if budget is not None:
        lines.append({"line": "living", "uuid": None, "name": "생활비", "categories": None})
        for item in budget["items"]:
            lines.append({"line": "item", "uuid": item["uuid"], "name": item["name"], "categories": item["categories"]})
    return lines


def in_line(row, line, item_categories):
    # 예산 합계: countsTowardBudget. 생활비: 그 가운데 어느 항목 카테고리도 아닌 행.
    # 항목: 그 항목 카테고리이면서 거래 예산 제외가 아닌 행. 반복지출 생성분과 카테고리 제외분도 들어간다.
    if line["line"] == "budget":
        return row["countsTowardBudget"]
    if line["line"] == "living":
        return row["countsTowardBudget"] and row["categoryUuid"] not in item_categories
    return row["categoryUuid"] in line["categories"] and not row["excludeFromBudget"]


def server_line(budget, line):
    if line["line"] == "budget":
        return budget["total"]
    if line["line"] == "living":
        return budget["living"]
    for item in budget["items"]:
        if item["uuid"] == line["uuid"]:
            return item
    return None


def amount_of(rows):
    return sum(row["amount"] for row in rows)


def by_category(rows):
    totals = defaultdict(int)
    for row in rows:
        totals[(row["categoryUuid"], row["categoryName"])] += row["amount"]
    return totals


def ordered(totals):
    return sorted(totals.items(), key=lambda entry: (-entry[1], str(entry[0][1]), str(entry[0][0])))


def category_list(totals):
    return [
        {"categoryUuid": key[0], "categoryName": key[1], "amount": amount}
        for key, amount in ordered(totals)
    ]


def compared(current, previous):
    diff = None if current is None or previous is None else current - previous
    return {"current": current, "previous": previous, "diff": diff}


budget = read_budget(PARAMS["budget"])
expenses = read_rows(PARAMS["expenses"], True)
incomes = read_rows(PARAMS["incomes"], False)
one_off = set(PARAMS.get("oneOffUuids") or [])
in_progress = PARAMS.get("inProgress") is True
missing = one_off - {row["uuid"] for row in expenses}
if missing:
    raise ValueError("일회성으로 확인한 거래가 대상 달 지출 파일에 없습니다: " + ", ".join(sorted(missing)))

lines = budget_lines(budget)
item_categories = set()
for line in lines:
    if line["line"] == "item":
        item_categories |= line["categories"]

budget_excluded = {"transaction": 0, "category": 0, "recurring": 0}
for row in expenses:
    if row["excludeFromBudget"]:
        budget_excluded["transaction"] += row["amount"]
    elif row["categoryExcludeFromBudget"]:
        budget_excluded["category"] += row["amount"]
    elif row["recurringExpenseUuid"] is not None:
        budget_excluded["recurring"] += row["amount"]

checks = []
results = []
line_categories = []
removed_from = defaultdict(list)
for line in lines:
    members = [row for row in expenses if in_line(row, line, item_categories)]
    kept = [row for row in members if row["uuid"] not in one_off]
    for row in members:
        if row["uuid"] in one_off:
            removed_from[row["uuid"]].append(line["name"])
    file_spent = amount_of(members)
    removed = file_spent - amount_of(kept)
    line_categories.append(by_category(kept))
    if budget is None:
        spent, limit, applies = file_spent - removed, None, False
    else:
        server = server_line(budget, line)
        checks.append({
            "line": line["line"], "uuid": line["uuid"], "name": line["name"],
            "file": file_spent, "server": server["spent"], "match": file_spent == server["spent"],
        })
        spent, limit = server["spent"] - removed, server["limit"]
        applies = limit > 0 if line["line"] == "item" else budget["total"]["limit"] > 0
    results.append({
        "line": line["line"], "uuid": line["uuid"], "name": line["name"],
        "spent": spent, "limit": limit, "limitApplies": applies,
        "over": max(spent - limit, 0) if applies else 0,
        "remaining": max(limit - spent, 0) if applies else None,
    })

reductions = []
if not in_progress:
    # 생활비나 항목이 초과하면 그 줄마다, 둘 다 한도 안이면 예산 줄 하나만 계산한다.
    targets = [index for index, result in enumerate(results) if result["line"] != "budget" and result["over"] > 0]
    if not targets and results[0]["over"] > 0:
        targets = [0]
    for index in targets:
        result = results[index]
        amounts = {key: amount for key, amount in line_categories[index].items() if amount > 0}
        base = sum(amounts.values())
        entry = {
            "line": result["line"], "uuid": result["uuid"], "name": result["name"],
            "over": result["over"], "base": base, "categories": [], "reason": None,
        }
        if base == 0:
            entry["reason"] = "나눌 카테고리 금액이 없습니다"
        for key, amount in ordered(amounts):
            share = (result["over"] * amount + base - 1) // base
            reduction = (share + 999) // 1000 * 1000
            entry["categories"].append({
                "categoryUuid": key[0], "categoryName": key[1], "amount": amount,
                "reduction": reduction, "target": max(amount - reduction, 0),
            })
        reductions.append(entry)

total_expense = amount_of(expenses)
total_income = amount_of(incomes)
comparison = None
previous = PARAMS.get("previous")
if previous is not None:
    previous_expenses = read_rows(previous["expenses"], True)
    previous_incomes = read_rows(previous["incomes"], False)
    previous_budget = read_budget(previous.get("budget"))
    previous_expense = amount_of(previous_expenses)
    previous_income = amount_of(previous_incomes)
    # 양쪽 달 모두 서버 값이 있을 때만 서버 값을 쓴다. 한쪽이라도 없으면 대상 달 항목 구성으로 양쪽 파일을 분류한다.
    source = "server" if budget is not None and previous_budget is not None else "file"
    compared_lines = []
    for line in lines:
        if source == "server":
            previous_line = server_line(previous_budget, line)
            values = compared(
                server_line(budget, line)["spent"],
                None if previous_line is None else previous_line["spent"],
            )
        else:
            values = compared(
                amount_of([row for row in expenses if in_line(row, line, item_categories)]),
                amount_of([row for row in previous_expenses if in_line(row, line, item_categories)]),
            )
        compared_lines.append({"line": line["line"], "uuid": line["uuid"], "name": line["name"], **values})
    current_categories = by_category([row for row in expenses if row["countsTowardBudget"]])
    previous_categories = by_category([row for row in previous_expenses if row["countsTowardBudget"]])
    keys = set(current_categories) | set(previous_categories)
    comparison = {
        "totalExpense": compared(total_expense, previous_expense),
        "totalIncome": compared(total_income, previous_income),
        "balance": compared(total_income - total_expense, previous_income - previous_expense),
        "budgetSource": source,
        "lines": compared_lines,
        "budgetCategories": [
            {"categoryUuid": key[0], "categoryName": key[1], **compared(current_categories[key], previous_categories[key])}
            for key, _ in ordered({key: current_categories[key] for key in keys})
        ],
    }

print(json.dumps({
    "inProgress": in_progress,
    "totalExpense": total_expense,
    "totalIncome": total_income,
    "balance": total_income - total_expense,
    "categories": category_list(by_category(expenses)),
    "budgetCategories": category_list(line_categories[0]),
    "budgetExcluded": budget_excluded,
    "allocationExceeded": None if budget is None else budget["allocationExceeded"],
    "checks": checks,
    "lines": results,
    "reductions": reductions,
    "oneOffRemoved": [
        {"uuid": row["uuid"], "amount": row["amount"], "categoryName": row["categoryName"], "lines": removed_from[row["uuid"]]}
        for row in expenses if row["uuid"] in one_off
    ],
    "comparison": comparison,
}, ensure_ascii=False))
```

파일이 없거나 행 수가 다르거나 금액이 원 단위 정수가 아니면 스크립트가 멈춘다. 그때는 리포트를 내지 않고 원인을 알린다.
