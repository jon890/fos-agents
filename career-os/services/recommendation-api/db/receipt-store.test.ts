import { expect, test } from "bun:test";
import { SqlReceiptStore } from "./receipt-store.ts";

function sqlReturning(responseBody: unknown): Bun.SQL {
  return (() =>
    Promise.resolve([
      {
        request_hash: "sha256:request",
        state: "completed",
        response_status: 201,
        response_body: responseBody,
      },
    ])) as unknown as Bun.SQL;
}

test("MySQL이 JSON 열을 객체로 반환해도 멱등 응답을 복원한다", async () => {
  const body = { analysisRunId: "analysis-1", nested: { count: 1 } };
  const receipt = await new SqlReceiptStore(sqlReturning(body)).getReceipt("request-1");
  expect(receipt?.response).toEqual({ status: 201, body });
});

test("문자열 JSON 반환도 호환한다", async () => {
  const body = { analysisRunId: "analysis-1" };
  const receipt = await new SqlReceiptStore(sqlReturning(JSON.stringify(body))).getReceipt(
    "request-1",
  );
  expect(receipt?.response).toEqual({ status: 201, body });
});

// Bun 1.3.5의 MySQL driver가 DML에 돌려주는 모양이다.
// 배열 자체는 비어 있고 `count`는 0으로 고정이며 바뀐 행 수는 `affectedRows`에만 들어온다.
function sqlAffecting(affectedRows: number): Bun.SQL {
  return (() => {
    const result = Object.assign([] as unknown[], {
      count: 0,
      command: "INSERT",
      lastInsertRowid: 0,
      affectedRows,
    });
    return Promise.resolve(result);
  }) as unknown as Bun.SQL;
}

test("새 멱등 키를 넣으면 실행 권한을 얻는다", async () => {
  const store = new SqlReceiptStore(sqlAffecting(1));
  expect(await store.startReceipt("request-1", "sha256:request")).toBe(true);
});

test("이미 있는 멱등 키는 실행 권한을 얻지 못한다", async () => {
  const store = new SqlReceiptStore(sqlAffecting(0));
  expect(await store.startReceipt("request-1", "sha256:request")).toBe(false);
});
