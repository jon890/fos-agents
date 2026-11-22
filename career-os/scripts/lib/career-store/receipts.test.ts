import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeCareerStores, openCareerStore } from "./database.ts";
import { runWithReceipt } from "./receipts.ts";

const roots: string[] = [];
afterEach(() => {
  closeCareerStores();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function store() {
  const root = mkdtempSync(join(tmpdir(), "career-receipt-test-"));
  roots.push(root);
  return openCareerStore({ CAREER_WORKSPACE_ROOT: root });
}

describe("재전송 기록", () => {
  test("같은 키와 같은 본문은 처리하지 않고 처음 응답을 돌려준다", async () => {
    const db = store();
    let calls = 0;
    const handler = async () => ({ call: (calls += 1) });
    expect(await runWithReceipt(db, "k-1", { b: 1, a: 2 }, 201, handler)).toEqual({ call: 1 });
    // 키 순서만 다른 본문은 같은 요청이다.
    expect(await runWithReceipt(db, "k-1", { a: 2, b: 1 }, 201, handler)).toEqual({ call: 1 });
    expect(calls).toBe(1);
  });

  test("같은 키에 다른 본문이면 IDEMPOTENCY_CONFLICT 다", async () => {
    const db = store();
    await runWithReceipt(db, "k-1", { a: 1 }, 200, async () => "ok");
    await expect(runWithReceipt(db, "k-1", { a: 2 }, 200, async () => "ok")).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
      status: 409,
    });
  });

  test("처리가 실패하면 기록을 남기지 않아 다시 보낼 수 있다", async () => {
    const db = store();
    await expect(
      runWithReceipt(db, "k-1", {}, 200, async () => {
        throw new Error("실패");
      }),
    ).rejects.toThrow("실패");
    expect(await runWithReceipt(db, "k-1", {}, 200, async () => "다시")).toBe("다시");
  });

  test("응답을 기록하지 못하면 처리도 되돌린다", async () => {
    const db = store();
    db.raw.exec("DROP TABLE request_receipts; CREATE TABLE request_receipts (idempotency_key TEXT PRIMARY KEY)");
    await expect(
      runWithReceipt(db, "k-1", {}, 200, async () => {
        db.run("INSERT INTO position_sources (source_key, enabled) VALUES ('a', 1)");
        return "ok";
      }),
    ).rejects.toThrow();
    expect(db.all("SELECT source_key FROM position_sources")).toEqual([]);
  });

  test("키가 없으면 BAD_REQUEST 다", async () => {
    await expect(runWithReceipt(store(), " ", {}, 200, async () => 1)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
