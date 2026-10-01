import { z } from "zod";
import {
  AccountbookClient,
  responseData,
  transactionSchema,
  transactionPageSchema,
  safeError,
} from "./client.ts";

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
  list_categories: { description: "가족 카테고리 목록", schema: z.strictObject(familyShape) },
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
  create_expense: { description: "확인한 지출 등록", schema: createSchema(true) },
  create_income: { description: "확인한 수입 등록", schema: createSchema(false) },
  update_expense: {
    description: "사용자가 현재 기록과 변경 내용을 확인한 뒤 지출 수정",
    schema: updateSchema(true),
  },
  update_income: {
    description: "사용자가 현재 기록과 변경 내용을 확인한 뒤 수입 수정",
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
};

function listSchema() {
  return z
    .strictObject({
      ...familyShape,
      startDate: day.optional(),
      endDate: day.optional(),
      limit: z.number().int().min(1).max(100).default(20),
      page: z.number().int().min(0).default(0),
    })
    .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate);
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
    .refine((v) => Boolean(v.categoryUuid) !== Boolean(v.categoryName));
}

function updateSchema(expense: boolean) {
  return z
    .strictObject({
      ...recordShape,
      ...fields,
      confirmed: z.literal(true),
      ...(expense ? { excludeFromBudget: z.boolean().optional() } : {}),
    })
    .refine((v) => !(v.categoryUuid && v.categoryName))
    .refine((v) =>
      Object.keys(v).some((key) => !["familyUuid", "transactionUuid", "confirmed"].includes(key)),
    );
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
        return this.success({
          families,
          defaultFamilyUuid:
            this.defaultFamilyUuid ?? (families.length === 1 ? families[0].uuid : null),
        });
      }
      const familyUuid = await this.family(args.familyUuid as string | undefined);
      const root = `/families/${familyUuid}`;
      if (name === "list_categories") return this.success(await this.categories(root));
      const expense = name.endsWith("expense") || name.endsWith("expenses");
      const collection = `${root}/${expense ? "expenses" : "incomes"}`;
      if (name.startsWith("list_")) {
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
        if (response !== undefined) responseData(response, z.null().optional());
        return this.success({ deleted: true, familyUuid, transactionUuid: args.transactionUuid });
      }
      const body = { ...args };
      for (const key of ["familyUuid", "transactionUuid", "confirmed", "categoryName"])
        delete body[key];
      if (args.categoryName || args.categoryUuid) {
        const categories = await this.categories(root);
        const matched = categories.filter((item) =>
          args.categoryUuid ? item.uuid === args.categoryUuid : item.name === args.categoryName,
        );
        if (matched.length !== 1)
          throw new SelectionError(
            "ACCOUNTBOOK_CATEGORY_SELECTION",
            "카테고리 목록에서 하나를 골라 주세요.",
          );
        body.categoryUuid = matched[0].uuid;
      }
      return this.success(
        responseData(
          await this.client.request(target, name.startsWith("create_") ? "POST" : "PUT", body),
          transactionSchema,
        ),
      );
    } catch (error) {
      const details =
        error instanceof SelectionError
          ? { code: error.code, message: error.message }
          : safeError(error);
      return {
        isError: true,
        content: [{ type: "text" as const, text: JSON.stringify({ error: details }) }],
      };
    }
  }

  private success(value: unknown) {
    return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
  }
  private async families(): Promise<NamedItem[]> {
    const schema = z.array(z.object({ uuid, name: z.string() }));
    return responseData(await this.client.request("/families"), schema);
  }
  private async categories(root: string): Promise<NamedItem[]> {
    const schema = z.array(z.object({ uuid, name: z.string() }));
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
