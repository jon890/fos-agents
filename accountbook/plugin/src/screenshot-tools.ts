import { z } from "zod";
import {
  AccountbookClient,
  AccountbookError,
  recordIdentitySchema,
  responseData,
  safeError,
  transactionPageSchema,
} from "./client.ts";
import { extractedDaySchema, type ExtractedDay } from "./screenshot-contracts.ts";
import { normalizeText, sha256, validateDays } from "./screenshot-validation.ts";

const MAX_SELECTED_TRANSACTIONS = 100;
const MAX_EXISTING_PAGES = 100;

const importShape = {
  familyUuid: z.string().uuid().optional(),
  days: z.array(extractedDaySchema).min(1).max(31),
  defaultCategoryName: z.string().trim().min(1).max(50).optional(),
};

export const screenshotToolDefinitions = {
  preview_screenshot_import: {
    description:
      "토스 소비 화면에서 추출한 날짜별 거래를 검증하고 등록 전 미리보기와 묶음 ID를 반환. 등록하지 않음",
    schema: z.strictObject(importShape),
  },
  submit_screenshot_import: {
    description:
      "사용자가 미리보기를 확인한 뒤 같은 추출 결과와 묶음 ID로 수입·지출을 한 번에 등록",
    schema: z.strictObject({
      ...importShape,
      confirmBatchId: z.string().regex(/^toss-[a-f0-9]{16}$/),
      confirmed: z.literal(true),
    }),
  },
};

type ImportArgs = z.infer<typeof screenshotToolDefinitions.preview_screenshot_import.schema> & {
  confirmBatchId?: string;
};
type NamedItem = { uuid: string; name: string };
type Candidate = {
  candidateId: string;
  date: string;
  type: "expense" | "income";
  amount: number;
  description: string;
  categoryName: string | null;
  categoryUuid: string | null;
  reviewReasons: string[];
  existingMatch: boolean;
  existingUuid: string | null;
  existingMatchKind: "exact" | "description-only" | null;
};
type Created = Pick<Candidate, "candidateId" | "date" | "type" | "amount"> & { uuid: string };

const messages = {
  ACCOUNTBOOK_IMPORT_CONFIRMATION_MISMATCH:
    "확인한 묶음과 등록하려는 내용이 다릅니다. 미리보기를 다시 만들어 확인해 주세요.",
  ACCOUNTBOOK_IMPORT_NOT_SUBMITTABLE:
    "검증을 통과하지 못해 등록하지 않았습니다. 차단 사유를 확인해 주세요.",
  ACCOUNTBOOK_IMPORT_PARTIAL:
    "일부만 등록됐습니다. 미리보기를 다시 만들어 남은 거래를 확인한 뒤 등록해 주세요.",
  ACCOUNTBOOK_IMPORT_IN_PROGRESS: "같은 묶음을 등록하는 중입니다. 끝난 뒤 내역을 조회해 주세요.",
} as const;

// One process serves one profile, so an in-memory set is enough to stop overlapping submits.
const inProgress = new Set<string>();

export class ScreenshotImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function visible({ categoryUuid: _categoryUuid, ...candidate }: Candidate) {
  return candidate;
}

function koreaToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

function normalize(value: string | null | undefined): string | null {
  return value ? normalizeText(value) : null;
}

// The batch ID covers everything that decides what is written, so a submit that
// differs from the previewed content cannot reuse the confirmed ID.
function contentHash(args: ImportArgs, familyUuid: string): string {
  return sha256(
    JSON.stringify([
      familyUuid,
      normalize(args.defaultCategoryName),
      args.days.map((day) => [
        day.date,
        day.dateSource,
        [day.dateEvidence.screenMonth, day.dateEvidence.screenDay, day.dateEvidence.yearSource],
        day.completeness,
        day.selectedForImport ?? null,
        day.expectedTotals ? [day.expectedTotals.expense, day.expectedTotals.income] : null,
        day.transactions.map((item) => [
          item.rowIndex,
          item.type,
          item.amount,
          normalize(item.description),
          normalize(item.paymentMethod),
          normalize(item.categoryName),
          item.confidence.amount,
          item.confidence.description,
          item.confidence.date,
        ]),
      ]),
    ]),
  );
}

function dateBlockers(days: ExtractedDay[], today: string): string[] {
  const blockers: string[] = [];
  const seen = new Set<string>();
  for (const day of days) {
    if (seen.has(day.date)) blockers.push(`${day.date}:duplicate_date`);
    seen.add(day.date);
    if (day.completeness !== "complete" || day.selectedForImport === false) continue;
    if (day.date > today) blockers.push(`${day.date}:date_in_future`);
    if (day.dateSource !== day.dateEvidence.yearSource)
      blockers.push(`${day.date}:date_source_mismatch`);
    // An inferred year is the closest one that is not in the future, so it is within a year.
    const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
    if (day.dateSource === "received-date" && day.date <= yearAgo)
      blockers.push(`${day.date}:inferred_year_too_old`);
    const [, month, dayOfMonth] = day.date.split("-").map(Number);
    if (day.dateEvidence.screenMonth !== month || day.dateEvidence.screenDay !== dayOfMonth)
      blockers.push(`${day.date}:date_evidence_mismatch`);
  }
  return blockers;
}

async function existingTransactions(
  client: AccountbookClient,
  root: string,
  type: "expense" | "income",
  date: string,
) {
  const items: z.infer<typeof transactionPageSchema>["items"] = [];
  for (let page = 0; page < MAX_EXISTING_PAGES; page++) {
    const params = new URLSearchParams({
      size: "100",
      page: String(page),
      startDate: date,
      endDate: date,
    });
    const data = responseData(
      await client.request(`${root}/${type}s?${params}`),
      transactionPageSchema,
    );
    items.push(...data.items);
    if (page + 1 >= data.totalPages) return items;
  }
  throw new ScreenshotImportError(
    "ACCOUNTBOOK_SUMMARY_LIMIT",
    "해당 날짜의 기존 내역이 너무 많아 중복을 확인할 수 없습니다.",
  );
}

export async function screenshotImport(
  client: AccountbookClient,
  familyUuid: string,
  categories: NamedItem[],
  args: ImportArgs,
  now: Date,
) {
  if (args.confirmBatchId === undefined)
    return runImport(client, familyUuid, categories, args, now);
  // Taken before the ledger is read: a second submit that read the ledger while the first
  // was still writing would compute the same pending rows and write them again.
  const key = contentHash(args, familyUuid);
  if (inProgress.has(key))
    throw new ScreenshotImportError(
      "ACCOUNTBOOK_IMPORT_IN_PROGRESS",
      messages.ACCOUNTBOOK_IMPORT_IN_PROGRESS,
    );
  inProgress.add(key);
  try {
    return await runImport(client, familyUuid, categories, args, now);
  } finally {
    inProgress.delete(key);
  }
}

async function runImport(
  client: AccountbookClient,
  familyUuid: string,
  categories: NamedItem[],
  args: ImportArgs,
  now: Date,
) {
  const root = `/families/${familyUuid}`;
  const hash = contentHash(args, familyUuid);
  const validation = validateDays(hash, args.days);
  const blockers = [...validation.errors, ...dateBlockers(args.days, koreaToday(now))];
  const defaultCategory = normalize(args.defaultCategoryName);

  const candidates: Candidate[] = [];
  const bareDescriptions = new Map<string, string>();
  const categoryIssues = new Map<string, string>();
  for (const day of validation.days.filter((item) => item.selectedForImport)) {
    for (const item of day.transactions) {
      const categoryName = item.categoryName ?? defaultCategory;
      const matched = categories.filter((category) => category.name === categoryName);
      if (!categoryName) categoryIssues.set(item.candidateId, "category_required");
      else if (matched.length !== 1) categoryIssues.set(item.candidateId, "category_not_found");
      const description = item.paymentMethod
        ? `${item.description} | ${item.paymentMethod}`
        : item.description;
      bareDescriptions.set(item.candidateId, item.description);
      if (description.length > 1000) blockers.push(`${item.candidateId}:description_too_long`);
      candidates.push({
        candidateId: item.candidateId,
        date: day.date,
        type: item.type,
        amount: item.amount,
        description,
        categoryName,
        categoryUuid: matched.length === 1 ? matched[0]!.uuid : null,
        reviewReasons: item.reviewReasons,
        existingMatch: false,
        existingUuid: null,
        existingMatchKind: null,
      });
    }
  }
  if (candidates.length > MAX_SELECTED_TRANSACTIONS) blockers.push("too_many_transactions");

  // The daily totals fix how many identical rows a day holds, so each existing record
  // accounts for one row and only the rows left over are written. Records entered by hand
  // carry no payment method, so the bare description counts as well.
  const existing = new Map<string, Awaited<ReturnType<typeof existingTransactions>>>();
  for (const candidate of candidates) {
    const key = `${candidate.type}:${candidate.date}`;
    if (!existing.has(key))
      existing.set(key, await existingTransactions(client, root, candidate.type, candidate.date));
  }
  // Exact descriptions are paired first. Otherwise a row with a payment method could take
  // the record that only a row without one can match, and that row would be written again.
  const claimed = new Set<string>();
  for (const kind of ["exact", "description-only"] as const) {
    for (const candidate of candidates) {
      if (candidate.existingMatch) continue;
      const wanted =
        kind === "exact" ? candidate.description : bareDescriptions.get(candidate.candidateId);
      const match = existing
        .get(`${candidate.type}:${candidate.date}`)!
        .find(
          (remote) =>
            !claimed.has(remote.uuid) &&
            Number(remote.amount) === candidate.amount &&
            normalizeText(remote.description ?? "") === wanted &&
            remote.date.startsWith(candidate.date),
        );
      if (!match) continue;
      claimed.add(match.uuid);
      candidate.existingMatch = true;
      candidate.existingUuid = match.uuid;
      candidate.existingMatchKind = kind;
    }
  }
  const pending = candidates.filter((candidate) => !candidate.existingMatch);
  for (const candidate of pending) {
    const issue = categoryIssues.get(candidate.candidateId);
    if (issue) blockers.push(`${candidate.candidateId}:${issue}`);
  }

  // The ID also covers which rows will be written, so a ledger that changed after the
  // preview cannot be written to under the confirmed ID.
  const batchId = `toss-${sha256(
    [hash, ...pending.map((candidate) => candidate.candidateId)].join("|"),
  ).slice(0, 16)}`;
  const submissionReady = blockers.length === 0 && pending.length > 0;
  const preview = {
    batchId,
    familyUuid,
    submissionReady,
    pendingCount: pending.length,
    alreadyRegisteredCount: candidates.length - pending.length,
    blockers,
    warnings: validation.warnings,
    days: validation.days.map((day) => ({
      date: day.date,
      dateSource: day.dateSource,
      selected: day.selectedForImport,
      status: day.validation.status,
      expectedTotals: day.expectedTotals,
      calculatedTotals: day.validation.calculatedTotals,
      expenseCount: day.transactions.filter((item) => item.type === "expense").length,
      incomeCount: day.transactions.filter((item) => item.type === "income").length,
    })),
    candidates: candidates.map(visible),
  };
  if (args.confirmBatchId === undefined) return preview;

  // The new ID is withheld: returning it would let a caller submit without a preview.
  if (args.confirmBatchId !== batchId)
    throw new ScreenshotImportError(
      "ACCOUNTBOOK_IMPORT_CONFIRMATION_MISMATCH",
      messages.ACCOUNTBOOK_IMPORT_CONFIRMATION_MISMATCH,
    );
  if (blockers.length === 0 && pending.length === 0)
    return { batchId, status: "completed", submitted: 0, created: [] };
  if (!submissionReady)
    throw new ScreenshotImportError(
      "ACCOUNTBOOK_IMPORT_NOT_SUBMITTABLE",
      messages.ACCOUNTBOOK_IMPORT_NOT_SUBMITTABLE,
      { batchId, blockers },
    );

  const created: Created[] = [];
  for (const [index, candidate] of pending.entries()) {
    try {
      // The screen has no transaction time; noon keeps the calendar date stable.
      const response = responseData(
        await client.request(`${root}/${candidate.type}s`, "POST", {
          categoryUuid: candidate.categoryUuid,
          amount: candidate.amount,
          description: candidate.description,
          date: `${candidate.date}T12:00:00`,
        }),
        recordIdentitySchema,
      );
      created.push({
        candidateId: candidate.candidateId,
        date: candidate.date,
        type: candidate.type,
        amount: candidate.amount,
        uuid: response.uuid,
      });
    } catch (error) {
      // A 4xx answer was rejected for certain; anything else may still have been stored.
      const rejected =
        error instanceof AccountbookError &&
        error.status !== undefined &&
        error.status >= 400 &&
        error.status < 500;
      if (rejected && created.length === 0) throw error;
      throw new ScreenshotImportError(
        "ACCOUNTBOOK_IMPORT_PARTIAL",
        messages.ACCOUNTBOOK_IMPORT_PARTIAL,
        {
          batchId,
          cause: safeError(error).code,
          created,
          uncertain: rejected ? null : visible(candidate),
          notSubmitted: pending.slice(rejected ? index : index + 1).map(visible),
        },
      );
    }
  }
  return { batchId, status: "completed", submitted: created.length, created };
}
