import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 월 리포트 참조 문서의 계산 스크립트를 그대로 꺼내 입력 줄만 fixture 로 바꿔 실행한다.
// 금액과 이름은 모두 예시 값이다. 기대값은 스펙의 산식으로 계산해 적었다.

const START = "# --- 입력 시작 ---";
const END = "# --- 입력 끝 ---";
const reference = readFileSync(
  join(import.meta.dir, "../skills/accountbook-api/references/monthly-report.md"),
  "utf8",
);
const blocks = [...reference.matchAll(/```python\n([\s\S]*?)\n```/g)].map((match) => match[1]);
const source = blocks[0] ?? "";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Category = { uuid: string; name: string; excluded: boolean };
const FOOD: Category = { uuid: uuid(1), name: "식비", excluded: false };
const CAFE: Category = { uuid: uuid(2), name: "카페", excluded: false };
const HOUSE: Category = { uuid: uuid(3), name: "주거", excluded: false };
const PHONE: Category = { uuid: uuid(4), name: "통신", excluded: false };
const GIFT: Category = { uuid: uuid(5), name: "경조사", excluded: true };
const HOBBY: Category = { uuid: uuid(6), name: "취미", excluded: false };
const FIXED_ITEM = uuid(101);
const HOBBY_ITEM = uuid(102);

let rowSeq = 1000;
type Row = Record<string, unknown>;
function expense(
  amount: number,
  category: Category,
  options: { id?: string; transactionExcluded?: boolean; recurring?: boolean } = {},
): Row {
  const id = options.id ?? uuid(++rowSeq);
  const excludeFromBudget = options.transactionExcluded ?? false;
  const recurringExpenseUuid = options.recurring ? uuid(900) : null;
  return {
    uuid: id,
    date: "2026-09-15T12:00:00",
    amount,
    categoryName: category.name,
    categoryUuid: category.uuid,
    userUuid: uuid(500),
    description: "예시 지출",
    recurringExpenseUuid,
    excludeFromBudget,
    categoryExcludeFromBudget: category.excluded,
    countsTowardBudget: !excludeFromBudget && !category.excluded && recurringExpenseUuid === null,
  };
}
const income = (amount: number): Row => ({
  uuid: uuid(++rowSeq),
  date: "2026-09-25T12:00:00",
  amount,
  categoryName: "급여",
  categoryUuid: uuid(7),
  userUuid: uuid(500),
  description: "예시 수입",
  excludeFromBudget: false,
});

type Line = { spent: number; limit: number };
type Item = { uuid: string; name: string; limit: number; spent: number; categories: Category[] };
function budget(total: Line, living: Line, items: Item[], allocationExceeded = false) {
  return {
    month: "2026-09",
    total,
    living,
    allocationExceeded,
    items: items.map((item) => ({
      uuid: item.uuid,
      name: item.name,
      limit: item.limit,
      spent: item.spent,
      categories: item.categories.map((category) => ({ uuid: category.uuid, name: category.name })),
    })),
  };
}
const fixedItem = (limit: number, spent: number): Item => ({
  uuid: FIXED_ITEM,
  name: "고정비",
  limit,
  spent,
  categories: [HOUSE, PHONE],
});
const hobbyItem = (limit: number, spent: number): Item => ({
  uuid: HOBBY_ITEM,
  name: "취미생활",
  limit,
  spent,
  categories: [HOBBY],
});

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

type Month = { expenses: Row[]; incomes?: Row[]; budget?: unknown; count?: number };
type Input = Month & {
  previous?: Month;
  oneOffUuids?: string[];
  inProgress?: boolean;
  budgetText?: string;
};

function run(input: Input) {
  const directory = mkdtempSync(join(tmpdir(), "accountbook-monthly-report-"));
  directories.push(directory);
  let fileSeq = 0;
  const file = (rows: Row[], count?: number) => {
    const path = join(directory, `rows-${fileSeq++}.jsonl`);
    writeFileSync(path, rows.map((row) => JSON.stringify(row) + "\n").join(""));
    return { file: path, count: count ?? rows.length };
  };
  const month = (value: Month) => ({
    expenses: file(value.expenses, value.count),
    incomes: file(value.incomes ?? []),
  });
  const params = {
    ...month(input),
    previous: input.previous
      ? { ...month(input.previous), budget: input.previous.budget ?? null }
      : null,
    budget: "__BUDGET__",
    oneOffUuids: input.oneOffUuids ?? [],
    inProgress: input.inProgress ?? false,
  };
  // 도구 결과 JSON 을 글자 그대로 붙이는 경우를 재현하려고 budget 자리는 문자열로 끼운다.
  const budgetText = input.budgetText ?? JSON.stringify(input.budget ?? null);
  const paramsText = JSON.stringify(params).replace('"__BUDGET__"', budgetText);
  const [head, rest] = source.split(START);
  const [, tail] = rest.split(END);
  const script = `${head}${START}\nPARAMS = json.loads(r'''${paramsText}''')\n${END}${tail}`;
  const scriptPath = join(directory, "report.py");
  writeFileSync(scriptPath, script);
  const result = Bun.spawnSync(["python3", "-I", scriptPath], { cwd: directory });
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  return { exitCode: result.exitCode, stdout, stderr };
}

function report(input: Input) {
  const result = run(input);
  if (result.exitCode !== 0) throw new Error(`스크립트 실패(${result.exitCode}): ${result.stderr}`);
  return JSON.parse(result.stdout);
}

const line = (output: any, name: string) => {
  const found = output.lines.find((entry: any) => entry.name === name);
  if (!found) throw new Error(`${name} 줄이 없습니다: ${JSON.stringify(output.lines)}`);
  return found;
};
const reduction = (output: any, name: string) =>
  output.reductions.find((entry: any) => entry.name === name);
const shares = (entry: any) =>
  entry.categories.map((category: any) => [
    category.categoryName,
    category.amount,
    category.reduction,
    category.target,
  ]);

test("참조 문서에 python 블록이 하나 있고 입력 표지가 한 번씩 있다", () => {
  expect(blocks).toHaveLength(1);
  expect(source.split(START)).toHaveLength(2);
  expect(source.split(END)).toHaveLength(2);
  const input = source.split(START)[1].split(END)[0].trim();
  expect(input.startsWith("PARAMS = json.loads(r'''")).toBe(true);
  expect(input.split("\n")).toHaveLength(1);
});

test("한도 안이면 모든 줄의 초과가 0 이고 배분이 없다", () => {
  const output = report({
    expenses: [
      expense(300000, FOOD),
      expense(50000, CAFE),
      expense(500000, HOUSE),
      expense(100000, HOBBY),
    ],
    incomes: [income(3000000)],
    budget: budget({ spent: 950000, limit: 2000000 }, { spent: 350000, limit: 1200000 }, [
      fixedItem(600000, 500000),
      hobbyItem(200000, 100000),
    ]),
  });
  expect(output.totalExpense).toBe(950000);
  expect(output.totalIncome).toBe(3000000);
  expect(output.balance).toBe(2050000);
  expect(output.lines.map((entry: any) => [entry.name, entry.over, entry.remaining])).toEqual([
    ["예산", 0, 1050000],
    ["생활비", 0, 850000],
    ["고정비", 0, 100000],
    ["취미생활", 0, 100000],
  ]);
  expect(output.reductions).toEqual([]);
  expect(output.checks.every((check: any) => check.match)).toBe(true);
});

test("생활비와 항목이 함께 초과하면 줄마다 배분하고 예산 줄은 배분하지 않는다", () => {
  const output = report({
    expenses: [
      expense(600000, FOOD),
      expense(200000, CAFE),
      expense(700000, HOUSE),
      expense(50000, HOBBY),
    ],
    budget: budget({ spent: 1550000, limit: 1200000 }, { spent: 800000, limit: 500000 }, [
      fixedItem(600000, 700000),
      hobbyItem(100000, 50000),
    ]),
  });
  expect(line(output, "예산").over).toBe(350000);
  expect(output.reductions.map((entry: any) => [entry.name, entry.over, entry.base])).toEqual([
    ["생활비", 300000, 800000],
    ["고정비", 100000, 700000],
  ]);
  // 300000 × 600000 ÷ 800000 = 225000, 300000 × 200000 ÷ 800000 = 75000
  expect(shares(reduction(output, "생활비"))).toEqual([
    ["식비", 600000, 225000, 375000],
    ["카페", 200000, 75000, 125000],
  ]);
  expect(shares(reduction(output, "고정비"))).toEqual([["주거", 700000, 100000, 600000]]);
});

test("월 예산이 있고 생활비 한도가 0 이면 생활비 사용액 전부가 초과다", () => {
  const output = report({
    expenses: [expense(30000, FOOD), expense(500000, HOUSE)],
    budget: budget({ spent: 530000, limit: 600000 }, { spent: 30000, limit: 0 }, [
      fixedItem(600000, 500000),
    ]),
  });
  expect(line(output, "생활비")).toMatchObject({
    limit: 0,
    limitApplies: true,
    over: 30000,
    remaining: 0,
  });
  expect(shares(reduction(output, "생활비"))).toEqual([["식비", 30000, 30000, 0]]);
});

test("생활비 초과는 생활비 행 카테고리에만 천 원 단위로 올려 배분한다", () => {
  const output = report({
    expenses: [
      expense(123456, FOOD),
      expense(76544, CAFE),
      expense(400000, HOUSE),
      expense(50000, GIFT),
      expense(10000, FOOD, { transactionExcluded: true }),
    ],
    budget: budget({ spent: 600000, limit: 1000000 }, { spent: 200000, limit: 150000 }, [
      fixedItem(500000, 400000),
    ]),
  });
  expect(output.reductions).toHaveLength(1);
  const living = reduction(output, "생활비");
  expect(living.over).toBe(50000);
  expect(living.base).toBe(200000);
  // 50000 × 123456 ÷ 200000 = 30864 → 31000, 50000 × 76544 ÷ 200000 = 19136 → 20000
  expect(shares(living)).toEqual([
    ["식비", 123456, 31000, 92456],
    ["카페", 76544, 20000, 56544],
  ]);
});

test("항목 초과는 반복지출 생성분을 넣고 거래 제외분을 빼서 그 항목 카테고리로 배분한다", () => {
  const output = report({
    expenses: [
      expense(300000, HOUSE, { recurring: true }),
      expense(100000, PHONE),
      expense(20000, PHONE, { transactionExcluded: true }),
      expense(100000, FOOD),
    ],
    budget: budget({ spent: 200000, limit: 1000000 }, { spent: 100000, limit: 400000 }, [
      fixedItem(300000, 400000),
    ]),
  });
  expect(output.checks.every((check: any) => check.match)).toBe(true);
  expect(output.reductions).toHaveLength(1);
  const fixed = reduction(output, "고정비");
  expect([fixed.over, fixed.base]).toEqual([100000, 400000]);
  // 100000 × 300000 ÷ 400000 = 75000, 100000 × 100000 ÷ 400000 = 25000
  expect(shares(fixed)).toEqual([
    ["주거", 300000, 75000, 225000],
    ["통신", 100000, 25000, 75000],
  ]);
});

test("예산 줄만 초과하면 예산 합계 행 전체로 배분한다", () => {
  const output = report({
    expenses: [
      expense(400000, FOOD),
      expense(200000, CAFE),
      expense(500000, HOBBY),
      expense(30000, GIFT),
      expense(300000, HOUSE, { recurring: true }),
    ],
    budget: budget({ spent: 1100000, limit: 1000000 }, { spent: 600000, limit: 1000000 }, [
      hobbyItem(0, 500000),
    ]),
  });
  expect(line(output, "생활비").over).toBe(0);
  expect(line(output, "취미생활")).toMatchObject({ limitApplies: false, over: 0, remaining: null });
  expect(output.reductions).toHaveLength(1);
  const total = reduction(output, "예산");
  expect([total.over, total.base]).toEqual([100000, 1100000]);
  // 100000 × 500000 ÷ 1100000 = 45454.5… → 46000
  // 100000 × 400000 ÷ 1100000 = 36363.6… → 37000
  // 100000 × 200000 ÷ 1100000 = 18181.8… → 19000
  expect(shares(total)).toEqual([
    ["취미", 500000, 46000, 454000],
    ["식비", 400000, 37000, 363000],
    ["카페", 200000, 19000, 181000],
  ]);
});

test("월 예산이 0 이면 예산과 생활비는 판정하지 않고 한도 있는 항목만 판정한다", () => {
  const output = report({
    expenses: [expense(200000, FOOD), expense(150000, HOBBY)],
    budget: budget({ spent: 350000, limit: 0 }, { spent: 200000, limit: 0 }, [
      hobbyItem(100000, 150000),
    ]),
  });
  expect(line(output, "예산")).toMatchObject({ limitApplies: false, over: 0, remaining: null });
  expect(line(output, "생활비")).toMatchObject({ limitApplies: false, over: 0, remaining: null });
  expect(line(output, "취미생활")).toMatchObject({ limitApplies: true, over: 50000, remaining: 0 });
  expect(output.reductions.map((entry: any) => entry.name)).toEqual(["취미생활"]);
  expect(shares(reduction(output, "취미생활"))).toEqual([["취미", 150000, 50000, 100000]]);
});

test.each([
  ["일치", { total: 300000, living: 100000, fixed: 200000 }, []],
  ["합계 불일치", { total: 310000, living: 100000, fixed: 200000 }, ["예산"]],
  ["생활비 불일치", { total: 300000, living: 90000, fixed: 200000 }, ["생활비"]],
  ["항목 불일치", { total: 300000, living: 100000, fixed: 210000 }, ["고정비"]],
] as const)("대조 %s", (_, server, mismatched) => {
  const output = report({
    expenses: [expense(100000, FOOD), expense(200000, HOUSE)],
    budget: budget(
      { spent: server.total, limit: 1000000 },
      { spent: server.living, limit: 500000 },
      [fixedItem(500000, server.fixed)],
    ),
  });
  expect(
    output.checks.map((check: any) => [check.name, check.file, check.server, check.match]),
  ).toEqual([
    ["예산", 300000, server.total, !(mismatched as readonly string[]).includes("예산")],
    ["생활비", 100000, server.living, !(mismatched as readonly string[]).includes("생활비")],
    ["고정비", 200000, server.fixed, !(mismatched as readonly string[]).includes("고정비")],
  ]);
  // 한도 판정은 서버 값으로 한다.
  expect(line(output, "예산").spent).toBe(server.total);
  expect(line(output, "생활비").spent).toBe(server.living);
  expect(line(output, "고정비").spent).toBe(server.fixed);
});

test("예산에서 빠진 금액은 겹친 사유 가운데 앞 사유 하나로만 센다", () => {
  const output = report({
    expenses: [
      expense(10000, FOOD, { transactionExcluded: true, recurring: true }),
      expense(20000, GIFT, { transactionExcluded: true }),
      expense(30000, GIFT, { recurring: true }),
      expense(40000, HOUSE, { recurring: true }),
      expense(50000, FOOD),
    ],
    budget: null,
  });
  expect(output.budgetExcluded).toEqual({ transaction: 30000, category: 30000, recurring: 40000 });
  expect(output.totalExpense).toBe(150000);
  expect(line(output, "예산").spent).toBe(50000);
});

test("일회성으로 확인한 지출을 빼면 초과가 사라진다", () => {
  const oneOff = uuid(700);
  const input = {
    expenses: [
      expense(100000, FOOD, { id: oneOff }),
      expense(50000, FOOD),
      expense(30000, CAFE),
      expense(200000, HOUSE),
    ],
    budget: budget({ spent: 380000, limit: 1000000 }, { spent: 180000, limit: 120000 }, [
      fixedItem(300000, 200000),
    ]),
  };
  const before = report(input);
  expect(line(before, "생활비").over).toBe(60000);
  expect(before.reductions).toHaveLength(1);

  const after = report({ ...input, oneOffUuids: [oneOff] });
  expect(line(after, "예산")).toMatchObject({ spent: 280000, over: 0, remaining: 720000 });
  expect(line(after, "생활비")).toMatchObject({ spent: 80000, over: 0, remaining: 40000 });
  expect(line(after, "고정비").spent).toBe(200000);
  expect(after.reductions).toEqual([]);
  expect(after.oneOffRemoved).toEqual([
    { uuid: oneOff, amount: 100000, categoryName: "식비", lines: ["예산", "생활비"] },
  ]);
  // 대조와 총액은 일회성 제외 전 값이다.
  expect(after.checks.map((check: any) => [check.name, check.file, check.match])).toEqual([
    ["예산", 380000, true],
    ["생활비", 180000, true],
    ["고정비", 200000, true],
  ]);
  expect(after.totalExpense).toBe(380000);
  expect(after.budgetCategories).toEqual([
    { categoryUuid: HOUSE.uuid, categoryName: "주거", amount: 200000 },
    { categoryUuid: FOOD.uuid, categoryName: "식비", amount: 50000 },
    { categoryUuid: CAFE.uuid, categoryName: "카페", amount: 30000 },
  ]);
});

test("진행 중인 달은 배분 없이 남은 한도를 보인다", () => {
  const output = report({
    expenses: [
      expense(600000, FOOD),
      expense(200000, CAFE),
      expense(700000, HOUSE),
      expense(50000, HOBBY),
    ],
    budget: budget({ spent: 1550000, limit: 1200000 }, { spent: 800000, limit: 500000 }, [
      fixedItem(600000, 700000),
      hobbyItem(100000, 50000),
    ]),
    inProgress: true,
  });
  expect(output.inProgress).toBe(true);
  expect(output.reductions).toEqual([]);
  expect(line(output, "생활비")).toMatchObject({ over: 300000, remaining: 0 });
  expect(line(output, "취미생활")).toMatchObject({ over: 0, remaining: 50000 });
});

test("예산을 읽지 못하면 파일 기준 예산 대상 금액만 내고 한도를 판정하지 않는다", () => {
  const output = report({
    expenses: [
      expense(100000, FOOD),
      expense(20000, GIFT),
      expense(50000, HOUSE, { recurring: true }),
    ],
    budget: null,
  });
  expect(output.lines).toEqual([
    {
      line: "budget",
      uuid: null,
      name: "예산",
      spent: 100000,
      limit: null,
      limitApplies: false,
      over: 0,
      remaining: null,
    },
  ]);
  expect(output.checks).toEqual([]);
  expect(output.reductions).toEqual([]);
  expect(output.allocationExceeded).toBeNull();
  expect(output.budgetCategories).toEqual([
    { categoryUuid: FOOD.uuid, categoryName: "식비", amount: 100000 },
  ]);
});

test("서버 금액에 원 미만이 있으면 실패한다", () => {
  const result = run({
    expenses: [expense(1000, FOOD)],
    budget: budget({ spent: 1000.5, limit: 100000 }, { spent: 1000, limit: 100000 }, []),
  });
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("원 단위 정수가 아닙니다");
  expect(result.stdout).toBe("");
});

test("false 와 null 이 든 도구 결과 JSON 을 그대로 붙여도 실행된다", () => {
  const unknownCategory = uuid(99);
  const budgetText = `{"month":"2026-09","total":{"spent":350000.0,"limit":1800000.0},"living":{"spent":150000,"limit":1200000},"allocationExceeded":false,"items":[{"uuid":"${FIXED_ITEM}","name":"고정비","limit":600000,"spent":200000,"categories":[{"uuid":"${HOUSE.uuid}","name":"주거"},{"uuid":"${unknownCategory}","name":null}]}]}`;
  const output = report({
    expenses: [expense(150000, FOOD), expense(200000, HOUSE)],
    budgetText,
  });
  expect(output.allocationExceeded).toBe(false);
  expect(line(output, "예산")).toMatchObject({ spent: 350000, limit: 1800000, remaining: 1450000 });
  expect(output.checks.every((check: any) => check.match)).toBe(true);
});

test("전월 대비는 양쪽 서버 값을 비교하고 한쪽이 없으면 양쪽 파일 분류 값을 비교한다", () => {
  const current = {
    expenses: [
      expense(300000, FOOD),
      expense(50000, CAFE),
      expense(500000, HOUSE),
      expense(100000, HOBBY),
    ],
    incomes: [income(3000000)],
  };
  const previousMonth = {
    expenses: [expense(200000, FOOD), expense(500000, HOUSE), expense(50000, HOBBY)],
    incomes: [income(2800000)],
  };
  const items = (fixed: number, hobby: number) => [
    fixedItem(600000, fixed),
    hobbyItem(200000, hobby),
  ];

  // 앞 달 서버 합계는 파일(750000)과 일부러 다르게 둬서 서버 값을 썼는지 본다.
  const server = report({
    ...current,
    budget: budget(
      { spent: 950000, limit: 2000000 },
      { spent: 350000, limit: 1200000 },
      items(500000, 100000),
    ),
    previous: {
      ...previousMonth,
      budget: budget(
        { spent: 760000, limit: 2000000 },
        { spent: 210000, limit: 1200000 },
        items(500000, 50000),
      ),
    },
  }).comparison;
  expect(server.totalExpense).toEqual({ current: 950000, previous: 750000, diff: 200000 });
  expect(server.totalIncome).toEqual({ current: 3000000, previous: 2800000, diff: 200000 });
  expect(server.balance).toEqual({ current: 2050000, previous: 2050000, diff: 0 });
  expect(server.budgetSource).toBe("server");
  expect(
    server.lines.map((entry: any) => [entry.name, entry.current, entry.previous, entry.diff]),
  ).toEqual([
    ["예산", 950000, 760000, 190000],
    ["생활비", 350000, 210000, 140000],
    ["고정비", 500000, 500000, 0],
    ["취미생활", 100000, 50000, 50000],
  ]);
  expect(
    server.budgetCategories.map((entry: any) => [
      entry.categoryName,
      entry.current,
      entry.previous,
      entry.diff,
    ]),
  ).toEqual([
    ["주거", 500000, 500000, 0],
    ["식비", 300000, 200000, 100000],
    ["취미", 100000, 50000, 50000],
    ["카페", 50000, 0, 50000],
  ]);

  // 대상 달 서버 합계(960000)는 파일(950000)과 다르지만 앞 달 예산이 없으니 양쪽 모두 파일 값이다.
  const file = report({
    ...current,
    budget: budget(
      { spent: 960000, limit: 2000000 },
      { spent: 350000, limit: 1200000 },
      items(500000, 100000),
    ),
    previous: { ...previousMonth, budget: null },
  }).comparison;
  expect(file.budgetSource).toBe("file");
  expect(
    file.lines.map((entry: any) => [entry.name, entry.current, entry.previous, entry.diff]),
  ).toEqual([
    ["예산", 950000, 750000, 200000],
    ["생활비", 350000, 200000, 150000],
    ["고정비", 500000, 500000, 0],
    ["취미생활", 100000, 50000, 50000],
  ]);
});

test("파일의 행 수가 목록 응답과 다르면 실패한다", () => {
  const result = run({
    expenses: [expense(1000, FOOD), expense(2000, CAFE)],
    count: 3,
    budget: null,
  });
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("행 수가 목록 응답과 다릅니다");
  expect(result.stdout).toBe("");
});
