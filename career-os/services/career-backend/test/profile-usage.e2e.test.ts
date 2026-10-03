import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ProfileClock } from "../src/profile/profile.service.js";
import { startE2eHarness, type E2eHarness } from "./support/e2e-harness.js";

let harness: E2eHarness;

beforeAll(async () => {
  harness = await startE2eHarness();
  // Seoul 기준 2026년 10월 1일 12:00 이다. 9월까지가 끝난 달이다.
  harness.app.get(ProfileClock).now = () => new Date("2026-10-01T03:00:00Z");
});

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.clearAll();
});

const basePath = "/api/profile/v1/usage-snapshots";
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** 지어낸 값이다. 실제 측정값이 아니다. */
function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    claudeTokens: 1200,
    codexTokens: 300,
    claudeCostUsd: 12.34,
    codexCostUsd: 5.6,
    sessions: 7,
    unpricedTokens: 10,
    measuredOn: "2026-10-01",
    source: "MEASURED",
    ...overrides,
  };
}

function put(month: string, body: unknown, idempotencyKey: string) {
  return harness.send("PUT", `${basePath}/${month}`, { body, idempotencyKey });
}

type SnapshotReply = { snapshot: Record<string, unknown>; created: boolean };

type StoredRow = { claude_tokens: number; note: string | null; created_at: Date; updated_at: Date };

async function storedRows(month?: string): Promise<StoredRow[]> {
  const rows = month
    ? await harness.prisma.$queryRawUnsafe<StoredRow[]>(
        "SELECT claude_tokens, note, created_at, updated_at FROM agent_usage_snapshots WHERE month = ?",
        month,
      )
    : await harness.prisma.$queryRawUnsafe<StoredRow[]>(
        "SELECT claude_tokens, note, created_at, updated_at FROM agent_usage_snapshots",
      );
  return rows.map((row) => ({ ...row, claude_tokens: Number(row.claude_tokens) }));
}

describe("에이전트 사용량 기록", () => {
  it("기록이 없으면 빈 목록이다", async () => {
    const listed = await harness.send("GET", basePath);

    expect(listed.status).toBe(200);
    expect(listed.json).toEqual({ snapshots: [] });
  });

  it("끝난 달에 처음 저장하면 created 가 참이고 요청 값이 한 행으로 저장된다", async () => {
    const saved = await put("2026-09", payload(), "usage-create");

    expect(saved.status).toBe(200);
    expect(saved.json).toEqual({
      created: true,
      snapshot: {
        month: "2026-09",
        claudeTokens: 1200,
        codexTokens: 300,
        claudeCostUsd: 12.34,
        codexCostUsd: 5.6,
        sessions: 7,
        unpricedTokens: 10,
        measuredOn: "2026-10-01",
        source: "MEASURED",
        note: null,
        createdAt: expect.stringMatching(isoPattern),
        updatedAt: expect.stringMatching(isoPattern),
      },
    });
    expect(await storedRows()).toHaveLength(1);

    const listed = await harness.send("GET", basePath);
    expect(listed.json).toEqual({ snapshots: [(saved.json as SnapshotReply).snapshot] });
  });

  it("소수 둘째 자리 비용 0.07 과 0.29 를 저장하고 같은 값으로 읽는다", async () => {
    const saved = await put("2026-09", payload({ claudeCostUsd: 0.07, codexCostUsd: 0.29 }), "usage-small-cost");

    expect(saved.status, JSON.stringify(saved.json)).toBe(200);
    expect(saved.json).toMatchObject({ snapshot: { claudeCostUsd: 0.07, codexCostUsd: 0.29 } });
    const listed = await harness.send("GET", basePath);
    expect(listed.json).toMatchObject({ snapshots: [{ claudeCostUsd: 0.07, codexCostUsd: 0.29 }] });
  });

  it("소수 셋째 자리 비용 12.345 는 400 이고 행이 생기지 않는다", async () => {
    const reply = await put("2026-09", payload({ claudeCostUsd: 12.345 }), "usage-third-decimal");

    expect(reply.status).toBe(400);
    expect(reply.json).toMatchObject({ error: { code: "BAD_REQUEST" } });
    expect(await storedRows()).toEqual([]);
  });

  it("이미 기록된 달에 다른 값을 올리면 200 과 created 거짓이고 저장된 값과 updated_at 이 그대로다", async () => {
    await put("2026-09", payload(), "usage-first");
    const [before] = await storedRows("2026-09");

    const again = await put("2026-09", payload({ claudeTokens: 9 }), "usage-again");

    expect(again.status).toBe(200);
    expect(again.json).toMatchObject({ created: false, snapshot: { claudeTokens: 1200 } });
    const [after] = await storedRows("2026-09");
    expect(after?.claude_tokens).toBe(1200);
    expect(after?.updated_at.toISOString()).toBe(before?.updated_at.toISOString());
  });

  it("replace 와 note 를 함께 보내면 값이 바뀌고 created 거짓이며 created_at 은 그대로다", async () => {
    await put("2026-09", payload(), "usage-before-replace");
    const [before] = await storedRows("2026-09");

    const replaced = await put(
      "2026-09",
      payload({ claudeTokens: 1500, replace: true, note: "예시 사유로 다시 측정한 값으로 바꾼다." }),
      "usage-replace",
    );

    expect(replaced.status).toBe(200);
    expect(replaced.json).toMatchObject({
      created: false,
      snapshot: { claudeTokens: 1500, note: "예시 사유로 다시 측정한 값으로 바꾼다." },
    });
    const [after] = await storedRows("2026-09");
    if (!after) throw new Error("교체한 뒤 2026-09 행이 없다");
    expect(after.claude_tokens).toBe(1500);
    expect(after.note).toBe("예시 사유로 다시 측정한 값으로 바꾼다.");
    expect(after.created_at.toISOString()).toBe(before?.created_at.toISOString());
    expect(after.updated_at.getTime()).toBeGreaterThanOrEqual(after.created_at.getTime());
  });

  it("replace 인데 note 가 없으면 400 이고 행이 바뀌지 않는다", async () => {
    await put("2026-09", payload(), "usage-before-bad-replace");

    const reply = await put("2026-09", payload({ claudeTokens: 1500, replace: true }), "usage-replace-no-note");

    expect(reply.status).toBe(400);
    expect(reply.json).toMatchObject({ error: { code: "BAD_REQUEST" } });
    const [after] = await storedRows("2026-09");
    expect(after?.claude_tokens).toBe(1200);
    expect(after?.note).toBeNull();
  });

  it("기록이 없는 달에 replace 와 note 를 보내면 만들어지고 created 가 참이다", async () => {
    const reply = await put(
      "2026-08",
      payload({ replace: true, note: "예시 사유로 처음 적는다." }),
      "usage-replace-new",
    );

    expect(reply.status).toBe(200);
    expect(reply.json).toMatchObject({ created: true, snapshot: { month: "2026-08", note: "예시 사유로 처음 적는다." } });
    expect(await storedRows("2026-08")).toHaveLength(1);
  });

  it("끝나지 않은 달과 미래의 달은 400 이고 행이 생기지 않는다", async () => {
    for (const month of ["2026-10", "2026-11"]) {
      const reply = await put(month, payload(), `usage-not-ended-${month}`);
      expect(reply.status, month).toBe(400);
      expect(reply.json, month).toMatchObject({ error: { code: "BAD_REQUEST" } });
    }
    expect(await storedRows()).toEqual([]);
  });

  it("형식이 맞지 않는 달은 400 이다", async () => {
    for (const month of ["2026-13", "2026-9", "latest"]) {
      const reply = await put(month, payload(), `usage-bad-month-${month}`);
      expect(reply.status, month).toBe(400);
      expect(reply.json, month).toMatchObject({ error: { code: "BAD_REQUEST" } });
    }
    expect(await storedRows()).toEqual([]);
  });

  it("계약에 맞지 않는 본문은 각각 400 이다", async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["음수 토큰", payload({ claudeTokens: -1 })],
      ["소수 토큰", payload({ codexTokens: 1.5 })],
      ["소수 셋째 자리 비용", payload({ codexCostUsd: 0.001 })],
      ["정하지 않은 source", payload({ source: "GUESSED" })],
      ["달력에 없는 날짜", payload({ measuredOn: "2026-02-30" })],
      ["모르는 칸 month", payload({ month: "2026-09" })],
    ];
    for (const [index, [label, body]] of cases.entries()) {
      const reply = await put("2026-09", body, `usage-invalid-${index}`);
      expect(reply.status, label).toBe(400);
      expect(reply.json, label).toMatchObject({ error: { code: "BAD_REQUEST" } });
    }
    expect(await storedRows()).toEqual([]);
  });

  it("비용과 세션 수를 빼고 BACKFILLED 로 보내면 셋이 null 로 저장된다", async () => {
    const body = payload({ source: "BACKFILLED" });
    delete body.claudeCostUsd;
    delete body.codexCostUsd;
    delete body.sessions;

    const saved = await put("2026-07", body, "usage-backfilled");

    expect(saved.status).toBe(200);
    const expected = { claudeCostUsd: null, codexCostUsd: null, sessions: null, source: "BACKFILLED" };
    expect(saved.json).toMatchObject({ created: true, snapshot: expected });
    const listed = await harness.send("GET", basePath);
    expect(listed.json).toMatchObject({ snapshots: [expected] });
  });

  it("INT 범위를 넘는 토큰 수를 저장하고 같은 숫자로 읽는다", async () => {
    const saved = await put("2026-09", payload({ claudeTokens: 24_600_000_000 }), "usage-big-tokens");

    expect(saved.status).toBe(200);
    const listed = await harness.send("GET", basePath);
    expect(listed.json).toMatchObject({ snapshots: [{ claudeTokens: 24_600_000_000 }] });
  });

  it("목록은 달 순서다", async () => {
    for (const month of ["2026-08", "2026-06", "2026-07"]) {
      const reply = await put(month, payload(), `usage-order-${month}`);
      expect(reply.status, month).toBe(200);
    }

    const listed = await harness.send("GET", basePath);

    const months = (listed.json as { snapshots: Array<{ month: string }> }).snapshots.map((item) => item.month);
    expect(months).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("같은 달의 첫 기록을 두 요청이 동시에 보내면 하나만 created 이고 두 응답의 값이 같다", async () => {
    const replies = await Promise.all([
      put("2026-09", payload({ claudeTokens: 1111 }), "usage-concurrent-first"),
      put("2026-09", payload({ claudeTokens: 2222 }), "usage-concurrent-second"),
    ]);

    expect(replies.map((reply) => reply.status)).toEqual([200, 200]);
    const bodies = replies.map((reply) => reply.json as SnapshotReply);
    expect(bodies.map((body) => body.created).sort()).toEqual([false, true]);
    expect(bodies[0]?.snapshot.claudeTokens).toBe(bodies[1]?.snapshot.claudeTokens);
    expect(await storedRows("2026-09")).toHaveLength(1);
  });

  it("같은 Idempotency-Key 와 같은 본문으로 다시 보내면 처음 응답이 그대로 오고 행이 하나다", async () => {
    const first = await put("2026-09", payload(), "usage-retry");
    const retried = await put("2026-09", payload(), "usage-retry");

    expect(first.status).toBe(200);
    expect(retried.status).toBe(200);
    expect(retried.json).toEqual(first.json);
    expect(retried.json).toMatchObject({ created: true });
    expect(await storedRows()).toHaveLength(1);
  });
});
