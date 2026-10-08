# 카테고리별 합계 계산 예시

`output: "file"`로 받은 `file`과 `count`를 아래 값에 넣어 `execute_code`에서 실행한다.
가계부 도구를 코드 안에서 다시 호출하지 않고, 이미 받은 JSONL 파일만 읽는다.
계산 결과는 총 건수, 전체 합계와 카테고리별 합계다. 예산 제외 지출도 포함한다.

```python
import json
from collections import defaultdict

result_file = "/connector-output/list_expenses-example.jsonl"  # 목록 응답의 file
expected_count = 0  # 목록 응답의 count
totals = defaultdict(int)
count = 0
with open(result_file, encoding="utf-8") as records:
    for line in records:
        record = json.loads(line)
        amount = record["amount"]
        if type(amount) is not int or amount <= 0:
            raise ValueError("정수 금액이 아닙니다")
        key = (record["categoryUuid"], record["categoryName"])
        totals[key] += amount
        count += 1
if count != expected_count:
    raise ValueError("파일의 행 수가 목록 응답과 다릅니다")
print(json.dumps({
    "count": count,
    "totalAmount": sum(totals.values()),
    "categories": [
        {"categoryUuid": key[0], "categoryName": key[1], "totalAmount": total}
        for key, total in sorted(totals.items(), key=lambda entry: entry[1], reverse=True)
    ],
}, ensure_ascii=False))
```

정수 덧셈이므로 소수 오차가 없다. 파일이 없거나 행 수가 다르면 합계를 답하지 않는다.
