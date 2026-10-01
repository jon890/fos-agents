import { describe, expect, test } from "bun:test";
import { AccountbookClient } from "./client.ts";
import { AccountbookTools } from "./tools.ts";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";
const TOKEN = `fab_${"x".repeat(43)}`;
const BASE = "https://accountbook.example.com/api/v1";
const NOW = new Date("2026-08-20T03:00:00Z");
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const result = (r: Awaited<ReturnType<AccountbookTools["call"]>>) => JSON.parse(r.content[0].text);

type Row = Record<string, unknown>;
const row = (rowIndex: number, patch: Row = {}) => ({
  rowIndex,
  type: "expense",
  amount: 12000,
  description: "예시 상점",
  paymentMethod: "예시 카드",
  categoryName: "예시 분류",
  confidence: { amount: "high", description: "high", date: "medium" },
  evidence: { amountText: "-12,000원", detailText: "예시 상점 | 예시 카드" },
  ...patch,
});
const day = (patch: Row = {}) => ({
  date: "2026-08-19",
  dateSource: "received-date",
  dateEvidence: { screenMonth: 8, screenDay: 19, yearSource: "received-date" },
  completeness: "complete",
  expectedTotals: { expense: 12000, income: 500 },
  transactions: [
    row(1),
    row(2, { type: "income", amount: 500, description: "예시 입금", paymentMethod: null }),
  ],
  ...patch,
});

function setup(
  options: {
    existing?: Row[];
    existingIncomes?: Row[];
    failPostAt?: number;
    failStatus?: number;
    throwOnPost?: boolean;
  } = {},
) {
  const requests: Array<{ url: string; method: string; body?: Row }> = [];
  let posts = 0;
  const tools = new AccountbookTools(
    new AccountbookClient({ apiBaseUrl: BASE, apiToken: TOKEN }, async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, method, body });
      if (url.endsWith("/categories")) return json([{ uuid: CATEGORY, name: "예시 분류" }]);
      if (method === "POST") {
        posts++;
        if (posts === options.failPostAt) {
          if (options.throwOnPost) throw new Error(TOKEN);
          return new Response("{}", { status: options.failStatus ?? 503 });
        }
        return json({ uuid: `33333333-3333-4333-8333-33333333333${posts}` });
      }
      const all = url.includes("/expenses?")
        ? (options.existing ?? [])
        : (options.existingIncomes ?? []);
      // Serve one record per page so the lookup has to follow pagination.
      const page = Number(new URL(url).searchParams.get("page"));
      return json({
        items: all.slice(page, page + 1),
        totalPages: all.length,
        currentPage: page,
        totalElements: all.length,
      });
    }),
    FAMILY,
    () => NOW,
  );
  const posted = () => requests.filter((request) => request.method === "POST");
  return { tools, requests, posted };
}

async function blockers(patch: Row, options?: Parameters<typeof setup>[0]) {
  const { tools, posted } = setup(options);
  const preview = result(await tools.call("preview_screenshot_import", { days: [day(patch)] }));
  expect(preview.submissionReady).toBe(false);
  const submitted = result(
    await tools.call("submit_screenshot_import", {
      days: [day(patch)],
      confirmBatchId: preview.batchId,
      confirmed: true,
    }),
  );
  expect(submitted.error.code).toBe("ACCOUNTBOOK_IMPORT_NOT_SUBMITTABLE");
  expect(posted()).toHaveLength(0);
  return preview.blockers as string[];
}

describe("토스 화면 가져오기 도구", () => {
  test("미리보기는 합계를 검증하고 등록 요청을 보내지 않는다", async () => {
    const { tools, posted } = setup();
    const preview = result(await tools.call("preview_screenshot_import", { days: [day()] }));
    expect(preview.submissionReady).toBe(true);
    expect(preview.batchId).toMatch(/^toss-[a-f0-9]{16}$/);
    expect(preview.blockers).toEqual([]);
    expect(preview.warnings).toContain("2026-08-19:year_inferred_from_received_date");
    expect(preview.days[0]).toMatchObject({
      status: "exact",
      selected: true,
      expenseCount: 1,
      incomeCount: 1,
      calculatedTotals: { expense: 12000, income: 500 },
    });
    expect(preview.candidates[0].description).toBe("예시 상점 | 예시 카드");
    expect(preview.candidates[0]).not.toHaveProperty("categoryUuid");
    expect(posted()).toHaveLength(0);
  });

  test("확인한 묶음과 같은 내용만 날짜 정오로 등록한다", async () => {
    const { tools, posted } = setup();
    const { batchId } = result(await tools.call("preview_screenshot_import", { days: [day()] }));
    const done = result(
      await tools.call("submit_screenshot_import", {
        days: [day()],
        confirmBatchId: batchId,
        confirmed: true,
      }),
    );
    expect(done).toMatchObject({ batchId, status: "completed", submitted: 2 });
    expect(posted().map((request) => request.url.split("/").at(-1))).toEqual([
      "expenses",
      "incomes",
    ]);
    expect(posted()[0]!.body).toEqual({
      categoryUuid: CATEGORY,
      amount: 12000,
      description: "예시 상점 | 예시 카드",
      date: "2026-08-19T12:00:00",
    });
  });

  test("미리보기와 다른 내용이나 확인 없는 요청은 등록하지 않는다", async () => {
    const { tools, posted } = setup();
    const { batchId } = result(await tools.call("preview_screenshot_import", { days: [day()] }));
    const changed = day({
      expectedTotals: { expense: 13000, income: 500 },
      transactions: [row(1, { amount: 13000 }), day().transactions[1]],
    });
    const mismatch = result(
      await tools.call("submit_screenshot_import", {
        days: [changed],
        confirmBatchId: batchId,
        confirmed: true,
      }),
    );
    expect(mismatch.error.code).toBe("ACCOUNTBOOK_IMPORT_CONFIRMATION_MISMATCH");
    // The recomputed ID must not leak, or a caller could submit without a preview.
    expect(JSON.stringify(mismatch)).not.toMatch(/toss-[a-f0-9]{16}/);
    for (const patch of [
      { defaultCategoryName: "예시 분류" },
      { familyUuid: "55555555-5555-4555-8555-555555555555" },
    ]) {
      const other = result(
        await tools.call("submit_screenshot_import", {
          days: [day()],
          confirmBatchId: batchId,
          confirmed: true,
          ...patch,
        }),
      );
      expect(other.error.code).toBe("ACCOUNTBOOK_IMPORT_CONFIRMATION_MISMATCH");
    }
    const unconfirmed = result(
      await tools.call("submit_screenshot_import", { days: [day()], confirmBatchId: batchId }),
    );
    expect(unconfirmed.error.code).toBe("ACCOUNTBOOK_INVALID_INPUT");
    expect(posted()).toHaveLength(0);
  });

  test("합계 불일치와 낮은 신뢰도, 읽지 못한 요약은 등록을 막는다", async () => {
    expect(await blockers({ expectedTotals: { expense: 11000, income: 500 } })).toContain(
      "2026-08-19:daily_totals_mismatch",
    );
    expect(await blockers({ expectedTotals: null })).toContain(
      "2026-08-19:expected_totals_unavailable",
    );
    expect(
      await blockers({
        expectedTotals: { expense: 12000, income: 0 },
        transactions: [
          row(1, { confidence: { amount: "low", description: "high", date: "high" } }),
        ],
      }),
    ).toContain("2026-08-19:low_confidence_required_field");
    expect(
      await blockers({
        expectedTotals: { expense: 24000, income: 0 },
        transactions: [row(1), row(1)],
      }),
    ).toContain("2026-08-19:duplicate_row_index");
    expect(
      await blockers({ expectedTotals: { expense: 0, income: 0 }, transactions: [] }),
    ).toContain("2026-08-19:no_transactions");
    expect(await blockers({ selectedForImport: false })).toEqual(["no_complete_day_selected"]);
    const { tools, requests } = setup();
    const tooLarge = result(
      await tools.call("preview_screenshot_import", {
        days: [
          day({
            expectedTotals: { expense: 10_000_000_000, income: 0 },
            transactions: [row(1, { amount: 10_000_000_000 })],
          }),
        ],
      }),
    );
    expect(tooLarge.error.code).toBe("ACCOUNTBOOK_INVALID_INPUT");
    expect(requests).toHaveLength(0);
  });

  test("잘린 날짜와 미래 날짜, 화면 월일과 다른 날짜는 등록을 막는다", async () => {
    expect(await blockers({ completeness: "partial", selectedForImport: true })).toEqual([
      "no_complete_day_selected",
    ]);
    expect(
      await blockers({
        date: "2026-08-21",
        dateEvidence: { screenMonth: 8, screenDay: 21, yearSource: "received-date" },
      }),
    ).toContain("2026-08-21:date_in_future");
    expect(
      await blockers({
        dateEvidence: { screenMonth: 8, screenDay: 18, yearSource: "received-date" },
      }),
    ).toContain("2026-08-19:date_evidence_mismatch");
    expect(await blockers({ dateSource: "screen" })).toContain("2026-08-19:date_source_mismatch");
    expect(
      await blockers({
        date: "2025-08-20",
        dateEvidence: { screenMonth: 8, screenDay: 20, yearSource: "received-date" },
      }),
    ).toContain("2025-08-20:inferred_year_too_old");
    const { tools } = setup();
    const twice = result(await tools.call("preview_screenshot_import", { days: [day(), day()] }));
    expect(twice.blockers).toContain("2026-08-19:duplicate_date");
  });

  test("카테고리가 없거나 목록에 없으면 등록을 막고 기본 카테고리는 허용한다", async () => {
    const uncategorized = {
      expectedTotals: { expense: 12000, income: 0 },
      transactions: [row(1, { categoryName: null })],
    };
    expect((await blockers(uncategorized))[0]).toEndWith(":category_required");
    expect(
      (
        await blockers({
          ...uncategorized,
          transactions: [row(1, { categoryName: "없는 분류" })],
        })
      )[0],
    ).toEndWith(":category_not_found");
    const { tools } = setup();
    const preview = result(
      await tools.call("preview_screenshot_import", {
        days: [day(uncategorized)],
        defaultCategoryName: "예시 분류",
      }),
    );
    expect(preview.submissionReady).toBe(true);
    expect(preview.candidates[0].categoryName).toBe("예시 분류");
  });

  test("같은 날짜와 금액, 설명의 기존 기록이 있으면 중복으로 단정하지 않고 멈춘다", async () => {
    const existing = [
      {
        uuid: "44444444-4444-4444-8444-444444444444",
        amount: "12000.00",
        description: "예시 상점 | 예시 카드",
        date: "2026-08-19T12:00:00",
      },
    ];
    const found = await blockers({}, { existing });
    expect(found).toHaveLength(1);
    expect(found[0]).toEndWith(":existing_transaction");
    // A record typed by hand has no payment method and a real time; it still stops the import.
    const byHand = [
      { ...existing[0], amount: 1, description: "다른 기록" },
      { ...existing[0], description: "예시 상점", date: "2026-08-19T09:30:00" },
    ];
    expect(await blockers({}, { existing: byHand })).toHaveLength(1);
    const income = [{ ...existing[0], amount: 500, description: "예시 입금" }];
    expect(await blockers({}, { existingIncomes: income })).toHaveLength(1);
  });

  test("등록을 마친 묶음을 다시 보내면 기존 기록 대조에서 멈춘다", async () => {
    const stored: Row[] = [];
    const { tools, posted } = setup({ existing: stored });
    const { batchId } = result(await tools.call("preview_screenshot_import", { days: [day()] }));
    const args = { days: [day()], confirmBatchId: batchId, confirmed: true };
    expect(result(await tools.call("submit_screenshot_import", args)).status).toBe("completed");
    stored.push({ uuid: "44444444-4444-4444-8444-444444444444", ...posted()[0]!.body });
    const again = result(await tools.call("submit_screenshot_import", args));
    expect(again.error.code).toBe("ACCOUNTBOOK_IMPORT_NOT_SUBMITTABLE");
    expect(posted()).toHaveLength(2);
  });

  test("같은 묶음의 등록이 겹치면 하나만 진행한다", async () => {
    const { tools, posted } = setup();
    const { batchId } = result(await tools.call("preview_screenshot_import", { days: [day()] }));
    const args = { days: [day()], confirmBatchId: batchId, confirmed: true };
    const both = await Promise.all([
      tools.call("submit_screenshot_import", args),
      tools.call("submit_screenshot_import", args),
    ]);
    expect(both.map((r) => result(r).status ?? result(r).error.code).sort()).toEqual([
      "ACCOUNTBOOK_IMPORT_IN_PROGRESS",
      "completed",
    ]);
    expect(posted()).toHaveLength(2);
  });

  test("등록 도중 실패하면 다시 보내지 않고 등록된 것과 남은 것을 알린다", async () => {
    const three = day({
      expectedTotals: { expense: 24000, income: 500 },
      transactions: [
        row(1),
        row(2, { description: "다른 상점" }),
        { ...day().transactions[1], rowIndex: 3 },
      ],
    });
    for (const [options, uncertain, remaining] of [
      [{ failPostAt: 2 }, true, 1],
      [{ failPostAt: 2, throwOnPost: true }, true, 1],
      [{ failPostAt: 2, failStatus: 400 }, false, 2],
    ] as const) {
      const { tools, posted } = setup(options);
      const { batchId } = result(await tools.call("preview_screenshot_import", { days: [three] }));
      const response = await tools.call("submit_screenshot_import", {
        days: [three],
        confirmBatchId: batchId,
        confirmed: true,
      });
      const partial = result(response);
      expect(response).toHaveProperty("isError", true);
      expect(partial.error.code).toBe("ACCOUNTBOOK_IMPORT_PARTIAL");
      expect(partial.created).toHaveLength(1);
      expect(partial.uncertain?.description ?? null).toBe(
        uncertain ? "다른 상점 | 예시 카드" : null,
      );
      expect(partial.notSubmitted).toHaveLength(remaining);
      expect(posted()).toHaveLength(2);
      expect(response.content[0].text).not.toContain(TOKEN);
    }
  });

  test("첫 요청이 거절되면 부분 등록이 아니라 원래 오류를 알린다", async () => {
    const { tools, posted } = setup({ failPostAt: 1, failStatus: 401 });
    const { batchId } = result(await tools.call("preview_screenshot_import", { days: [day()] }));
    const rejected = result(
      await tools.call("submit_screenshot_import", {
        days: [day()],
        confirmBatchId: batchId,
        confirmed: true,
      }),
    );
    expect(rejected.error.code).toBe("ACCOUNTBOOK_UNAUTHORIZED");
    expect(posted()).toHaveLength(1);
  });
});
