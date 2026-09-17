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
