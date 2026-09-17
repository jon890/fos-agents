import { describe, expect, test } from "bun:test";
import { ApiError } from "./errors.ts";
import { idempotent, MemoryReceiptStore } from "./idempotency.ts";

describe("멱등 요청", () => {
  test("같은 key와 같은 canonical body는 저장한 응답을 반환한다", async () => {
    const store = new MemoryReceiptStore();
    let calls = 0;
    const first = await idempotent(store, "key-1", { b: 2, a: 1 }, async () => {
      calls += 1;
      return { status: 201, body: { ok: true } };
    });
    const second = await idempotent(store, "key-1", { a: 1, b: 2 }, async () => {
      calls += 1;
      return { status: 201, body: { ok: false } };
    });
    expect(first).toEqual(second);
    expect(calls).toBe(1);
  });

  test("같은 key에 다른 body가 오면 409로 거부한다", async () => {
    const store = new MemoryReceiptStore();
    await idempotent(store, "key-1", { value: 1 }, async () => ({ status: 200, body: {} }));
    try {
      await idempotent(store, "key-1", { value: 2 }, async () => ({ status: 200, body: {} }));
      throw new Error("충돌이 발생해야 한다.");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(409);
      expect((error as ApiError).code).toBe("IDEMPOTENCY_CONFLICT");
    }
  });
});
