import { z } from "zod";
import {
  AccountbookClient,
  AccountbookError,
  responseData,
  transactionSchema,
  transactionPageSchema,
  safeError,
  configuredValue,
} from "./client.ts";
import {
  ScreenshotImportError,
  screenshotImport,
  screenshotToolDefinitions,
} from "./screenshot-tools.ts";

import { writeOutputFile } from "./output-file.ts";

const uuid = z.string().uuid();
const day = z.iso.date();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/)
  .refine((value) => {
    const parsedDay = day.safeParse(value.slice(0, 10));
    return (
      parsedDay.success &&
      Number(value.slice(11, 13)) < 24 &&
      Number(value.slice(14, 16)) < 60 &&
      Number(value.slice(17, 19)) < 60
    );
  });
const amount = z
  .number()
  .positive()
  .max(9_999_999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const familyShape = { familyUuid: uuid.optional() };
const recordShape = { ...familyShape, transactionUuid: uuid };
const fields = {
  categoryUuid: uuid.optional(),
  categoryName: z.string().trim().min(1).max(50).optional(),
  amount: amount.optional(),
  description: z.string().max(1000).optional(),
  date: date.optional(),
};

export const toolDefinitions = {
  list_families: {
    description: "접근할 수 있는 가족과 기본 가족 조회",
    schema: z.strictObject({}),
  },
  list_categories: {
    description: "가족 카테고리 목록과 종류(EXPENSE: 지출, INCOME: 수입)",
    schema: z.strictObject(familyShape),
  },
  list_expenses: { description: "기간별 최근 지출 목록", schema: listSchema() },
  list_incomes: { description: "기간별 최근 수입 목록", schema: listSchema() },
  get_expense: {
    description: "수정·삭제 전에 지출 기록 재조회",
    schema: z.strictObject(recordShape),
  },
  get_income: {
    description: "수정·삭제 전에 수입 기록 재조회",
    schema: z.strictObject(recordShape),
  },
  create_expense: {
    description: "EXPENSE 카테고리로 확인한 지출 등록",
    schema: createSchema(true),
  },
  create_income: { description: "INCOME 카테고리로 확인한 수입 등록", schema: createSchema(false) },
  update_expense: {
    description: "사용자가 현재 기록과 변경 내용을 확인한 뒤 EXPENSE 카테고리로 지출 수정",
    schema: updateSchema(true),
  },
  update_income: {
    description: "사용자가 현재 기록과 변경 내용을 확인한 뒤 INCOME 카테고리로 수입 수정",
    schema: updateSchema(false),
  },
  delete_expense: {
    description: "사용자가 대상 기록을 확인한 뒤 지출 삭제",
    schema: z.strictObject({ ...recordShape, confirmed: z.literal(true) }),
  },
  delete_income: {
    description: "사용자가 대상 기록을 확인한 뒤 수입 삭제",
    schema: z.strictObject({ ...recordShape, confirmed: z.literal(true) }),
  },
  list_recurring_expenses: {
    description:
      "반복지출(고정지출) 설정 목록과 해당 월 생성 여부. month 는 YYYY-MM 이며 생략하면 이번 달",
    schema: z.strictObject({ ...familyShape, month: month.optional() }),
  },
  update_recurring_expense: {
    description:
      "사용자가 현재 설정과 변경 내용을 확인한 뒤 반복지출 설정 수정. 다음 생성분부터 반영되고 이미 생성된 그 달 지출은 바뀌지 않는다",
    schema: z
      .strictObject({
        ...familyShape,
        recurringExpenseUuid: uuid,
        name: z.string().trim().min(1).max(100).optional(),
        amount: amount.optional(),
        dayOfMonth: z.number().int().min(1).max(28).optional(),
        categoryUuid: fields.categoryUuid,
        categoryName: fields.categoryName,
        confirmed: z.literal(true),
      })
      .refine((v) =>
        ["name", "amount", "dayOfMonth", "categoryUuid", "categoryName"].some(
          (key) => v[key as keyof typeof v] !== undefined,
        ),
      ),
  },
  ...screenshotToolDefinitions,
};

const recurringItemSchema = z
  .object({
    uuid,
    name: z.string(),
    amount: z
      .union([z.number().finite(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)])
      .refine((value) => Number(value) > 0),
    dayOfMonth: z.number().int().min(1).max(31),
    categoryUuid: z.string().min(1).nullable(),
    generatedThisMonth: z.boolean(),
  })
  .passthrough();

function listSchema() {
  return z
    .strictObject({
      ...familyShape,
      output: z.enum(["inline", "file"]).default("inline"),
      startDate: day.optional(),
      endDate: day.optional(),
      limit: z.number().int().min(1).max(100).default(20),
      page: z.number().int().min(0).default(0),
    })
    .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate)
    .refine((v) => v.output !== "file" || Boolean(v.startDate && v.endDate));
}

function createSchema(expense: boolean) {
  return z
    .strictObject({
      ...familyShape,
      ...fields,
      amount,
      date,
      ...(expense ? { excludeFromBudget: z.boolean().optional() } : {}),
    })
    .refine((v) => Boolean(v.categoryUuid || v.categoryName));
}

function updateSchema(expense: boolean) {
  return z
    .strictObject({
      ...recordShape,
      ...fields,
      confirmed: z.literal(true),
      ...(expense ? { excludeFromBudget: z.boolean().optional() } : {}),
    })
    .refine((v) =>
      Object.keys(v).some((key) => !["familyUuid", "transactionUuid", "confirmed"].includes(key)),
    );
}

// A 2xx answer to a change request means it was applied; an unreadable body only hides the result.
function written<T>(response: unknown, schema: z.ZodType<T>): T {
  try {
    return responseData(response, schema);
  } catch {
    throw new AccountbookError("ACCOUNTBOOK_OUTCOME_UNKNOWN");
  }
}

// UUID 와 이름이 각자 하나씩 찾아지는데 서로 다를 때만 불일치다. 종류가 다르거나 없는 값은 목록 안내로 충분하다.
function conflict(categories: NamedItem[], args: Record<string, unknown>) {
  if (!args.categoryUuid || !args.categoryName) return false;
  const byUuid = categories.filter((item) => item.uuid === args.categoryUuid);
  const byName = categories.filter((item) => item.name === args.categoryName);
  return byUuid.length === 1 && byName.length === 1 && byUuid[0].uuid !== byName[0].uuid;
}

type NamedItem = { uuid: string; name: string };
class SelectionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class AccountbookTools {
  constructor(
    private readonly client: AccountbookClient,
    private readonly defaultFamilyUuid?: string,
    private readonly now: () => Date = () => new Date(),
    private readonly outputDirectory?: string,
  ) {
    if (defaultFamilyUuid && !uuid.safeParse(defaultFamilyUuid).success)
      throw new SelectionError("ACCOUNTBOOK_CONFIG", "기본 가족 UUID 설정을 확인해 주세요.");
  }

  async call(name: string, raw: unknown) {
    try {
      if (!Object.hasOwn(toolDefinitions, name))
        throw new SelectionError("ACCOUNTBOOK_UNKNOWN_TOOL", "지원하지 않는 도구입니다.");
      const definition = toolDefinitions[name as keyof typeof toolDefinitions];
      const parsed = definition.schema.safeParse(raw);
      if (!parsed.success)
        throw new SelectionError(
          "ACCOUNTBOOK_INVALID_INPUT",
          "요청 필드와 날짜, 금액, 확인 여부를 확인해 주세요.",
        );
      const args = parsed.data as Record<string, unknown>;
      if (name === "list_families") {
        const families = await this.families();
        if (
          this.defaultFamilyUuid &&
          !families.some((item) => item.uuid === this.defaultFamilyUuid)
        )
          throw new SelectionError("ACCOUNTBOOK_FORBIDDEN", "설정된 가족에 접근할 수 없습니다.");
        const result = {
          families,
          defaultFamilyUuid:
            this.defaultFamilyUuid ?? (families.length === 1 ? families[0].uuid : null),
        };
        return { ...this.success(result), structuredContent: result };
      }
      if (args.output === "file" && !configuredValue(this.outputDirectory))
        throw new AccountbookError("ACCOUNTBOOK_OUTPUT_UNAVAILABLE");
      const familyUuid = await this.family(args.familyUuid as string | undefined);
      const root = `/families/${familyUuid}`;
      if (name === "list_categories") return this.success(await this.categories(root));
      if (name.endsWith("_screenshot_import"))
        return this.success(
          await screenshotImport(
            this.client,
            familyUuid,
            await this.categories(root),
            args as Parameters<typeof screenshotImport>[3],
            this.now(),
          ),
        );
      if (name.endsWith("_recurring_expenses") || name.endsWith("_recurring_expense"))
        return this.success(await this.recurring(root, name, args));
      const expense = name.endsWith("expense") || name.endsWith("expenses");
      const collection = `${root}/${expense ? "expenses" : "incomes"}`;
      if (name.startsWith("list_")) {
        if (args.output === "file")
          return this.success(await this.exportList(root, collection, args, expense));
        const params = new URLSearchParams({ size: String(args.limit), page: String(args.page) });
        for (const key of ["startDate", "endDate"])
          if (args[key]) params.set(key, String(args[key]));
        return this.success(
          responseData(await this.client.request(`${collection}?${params}`), transactionPageSchema),
        );
      }
      const target = args.transactionUuid ? `${collection}/${args.transactionUuid}` : collection;
      if (name.startsWith("get_"))
        return this.success(responseData(await this.client.request(target), transactionSchema));
      if (name.startsWith("delete_")) {
        const response = await this.client.request(target, "DELETE");
        if (response !== undefined) written(response, z.null().optional());
        return this.success({ deleted: true, familyUuid, transactionUuid: args.transactionUuid });
      }
      const body = { ...args };
      for (const key of ["familyUuid", "transactionUuid", "confirmed", "categoryName"])
        delete body[key];
      if (args.categoryName || args.categoryUuid)
        body.categoryUuid = await this.category(root, expense ? "EXPENSE" : "INCOME", args);
      return this.success(
        written(
          await this.client.request(target, name.startsWith("create_") ? "POST" : "PUT", body),
          transactionSchema,
        ),
      );
    } catch (error) {
      const details =
        error instanceof SelectionError || error instanceof ScreenshotImportError
          ? { code: error.code, message: error.message }
          : safeError(error);
      const extra = error instanceof ScreenshotImportError ? error.details : {};
      return {
        isError: true,
        content: [{ type: "text" as const, text: JSON.stringify({ error: details, ...extra }) }],
      };
    }
  }

  private async category(
    root: string,
    categoryType: "EXPENSE" | "INCOME",
    args: Record<string, unknown>,
    loaded?: Awaited<ReturnType<AccountbookTools["categories"]>>,
  ) {
    const categories = (loaded ?? (await this.categories(root))).filter(
      (item) => item.type === categoryType,
    );
    // 모델은 조회한 카테고리의 UUID 와 이름을 함께 보내곤 한다. 둘이 같은 카테고리를 가리킬 때만 받는다.
    const matched = categories.filter(
      (item) =>
        (!args.categoryUuid || item.uuid === args.categoryUuid) &&
        (!args.categoryName || item.name === args.categoryName),
    );
    if (matched.length !== 1)
      throw new SelectionError(
        "ACCOUNTBOOK_CATEGORY_SELECTION",
        `${conflict(categories, args) ? "categoryUuid 와 categoryName 이 서로 다른 카테고리를 가리킵니다. 하나만 보내 주세요. " : ""}${categoryType} 카테고리 목록에서 하나를 골라 주세요. 선택 가능한 이름: ${categories.map((item) => item.name).join(", ") || "없음"}`,
      );
    return matched[0].uuid;
  }

  // 반복지출 설정은 지출 기록과 다른 자원이다. 사용자 식별자는 이름과 이어지지 않아 내보내지 않는다.
  private async recurring(root: string, name: string, args: Record<string, unknown>) {
    const collection = `${root}/recurring-expenses`;
    const view = (item: z.infer<typeof recurringItemSchema>, names: Map<string, string>) => ({
      uuid: item.uuid,
      name: item.name,
      amount: item.amount,
      dayOfMonth: item.dayOfMonth,
      categoryUuid: item.categoryUuid,
      categoryName: item.categoryUuid ? (names.get(item.categoryUuid) ?? null) : null,
      generatedThisMonth: item.generatedThisMonth,
    });
    const categories = await this.categories(root);
    const names = new Map(categories.map((item) => [item.uuid, item.name]));
    if (name === "list_recurring_expenses") {
      const query = args.month ? `?${new URLSearchParams({ month: String(args.month) })}` : "";
      const data = responseData(
        await this.client.request(`${collection}${query}`),
        z.object({ items: z.array(recurringItemSchema) }).passthrough(),
      );
      return { month: args.month ?? null, items: data.items.map((item) => view(item, names)) };
    }
    const body: Record<string, unknown> = {};
    for (const key of ["name", "amount", "dayOfMonth"])
      if (args[key] !== undefined) body[key] = args[key];
    if (args.categoryName || args.categoryUuid)
      body.categoryUuid = await this.category(root, "EXPENSE", args, categories);
    const updated = responseData(
      await this.client.request(`${collection}/${args.recurringExpenseUuid}`, "PUT", body),
      recurringItemSchema,
    );
    return view(updated, names);
  }

  private success(value: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
  }
  private async exportList(
    root: string,
    collection: string,
    args: Record<string, unknown>,
    expense: boolean,
  ) {
    const categories = await this.categories(root);
    const names = new Map(categories.map((item) => [item.uuid, item.name]));
    const columns = [
      "uuid",
      "date",
      "amount",
      "categoryName",
      "categoryUuid",
      "userUuid",
      "description",
      ...(expense ? ["recurringExpenseUuid"] : []),
      "excludeFromBudget",
    ];
    const rows: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let expectedCount: number | undefined;
    let expectedPages: number | undefined;
    const itemSchema = transactionSchema.extend({
      amount: z
        .union([z.number(), z.string().regex(/^\d+(?:\.0{1,2})?$/)])
        .transform(Number)
        .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
      categoryUuid: z.string().min(1).nullable(),
      userUuid: z.string().min(1),
      ...(expense
        ? {
            excludeFromBudget: z.boolean(),
            recurringExpenseUuid: z.string().min(1).nullable(),
          }
        : { excludeFromBudget: z.boolean().default(false) }),
    });
    for (let page = 0; page < 100; page++) {
      const params = new URLSearchParams({
        size: "100",
        page: String(page),
        startDate: String(args.startDate),
        endDate: String(args.endDate),
      });
      const data = responseData(
        await this.client.request(`${collection}?${params}`),
        transactionPageSchema,
      );
      if (data.totalPages > 100 || data.totalElements > 10_000)
        throw new SelectionError(
          "ACCOUNTBOOK_OUTPUT_LIMIT",
          "조회 범위가 10,000건 또는 100페이지를 넘습니다. 기간을 줄여 다시 요청해 주세요.",
        );
      expectedCount ??= data.totalElements;
      expectedPages ??= data.totalPages;
      if (
        data.currentPage !== page ||
        data.totalElements !== expectedCount ||
        data.totalPages !== expectedPages ||
        data.items.length > 100 ||
        (data.totalPages === 0 && data.items.length > 0)
      )
        throw new AccountbookError("ACCOUNTBOOK_INVALID_RESPONSE");
      for (const raw of data.items) {
        const parsed = itemSchema.safeParse(raw);
        if (!parsed.success) throw new AccountbookError("ACCOUNTBOOK_INVALID_RESPONSE");
        const item = parsed.data;
        if (
          seen.has(item.uuid) ||
          item.date.slice(0, 10) < String(args.startDate) ||
          item.date.slice(0, 10) > String(args.endDate)
        )
          throw new AccountbookError("ACCOUNTBOOK_INVALID_RESPONSE");
        seen.add(item.uuid);
        if (seen.size > 10_000)
          throw new SelectionError("ACCOUNTBOOK_OUTPUT_LIMIT", "기간을 줄여 다시 요청해 주세요.");
        rows.push({
          uuid: item.uuid,
          date: item.date,
          amount: item.amount,
          categoryName: item.categoryUuid ? (names.get(item.categoryUuid) ?? null) : null,
          categoryUuid: item.categoryUuid,
          userUuid: item.userUuid,
          description: item.description,
          ...(expense ? { recurringExpenseUuid: item.recurringExpenseUuid } : {}),
          excludeFromBudget: item.excludeFromBudget,
        });
      }
      if (page + 1 >= data.totalPages) {
        if (seen.size !== expectedCount) throw new AccountbookError("ACCOUNTBOOK_INVALID_RESPONSE");
        const file = await writeOutputFile(
          configuredValue(this.outputDirectory)!,
          expense ? "list_expenses" : "list_incomes",
          rows,
          this.now(),
        );
        return { file, count: rows.length, from: args.startDate, to: args.endDate, columns };
      }
      if (data.items.length === 0) throw new AccountbookError("ACCOUNTBOOK_INVALID_RESPONSE");
    }
    throw new SelectionError("ACCOUNTBOOK_OUTPUT_LIMIT", "기간을 줄여 다시 요청해 주세요.");
  }
  private async families(): Promise<NamedItem[]> {
    const schema = z.array(z.object({ uuid, name: z.string() }));
    return responseData(await this.client.request("/families"), schema);
  }
  private async categories(root: string) {
    const schema = z.array(
      z.object({ uuid, name: z.string(), type: z.enum(["EXPENSE", "INCOME"]) }),
    );
    return responseData(await this.client.request(`${root}/categories`), schema);
  }
  private async family(explicit?: string): Promise<string> {
    const selected = explicit ?? this.defaultFamilyUuid;
    if (selected) return selected;
    const families = await this.families();
    if (families.length === 1) return families[0].uuid;
    throw new SelectionError(
      families.length ? "ACCOUNTBOOK_FAMILY_SELECTION" : "ACCOUNTBOOK_NO_FAMILY",
      families.length
        ? "가족이 여러 개입니다. 가족 목록에서 하나를 골라 주세요."
        : "접근할 가족이 없습니다. 가계부에서 가족을 만들어 주세요.",
    );
  }
}
