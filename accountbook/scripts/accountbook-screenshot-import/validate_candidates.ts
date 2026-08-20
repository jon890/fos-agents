import { createHash } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  extractedImportSchema,
  type ExtractedDay,
  type ExtractedImport,
  type ExtractedTransaction,
  type ValidatedDay,
  type ValidatedImport,
  type ValidatedTransaction,
} from "./contracts.ts";

type ValidateOptions = {
  now?: () => Date;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isValidIsoDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function candidateId(imageHash: string, date: string, transaction: ExtractedTransaction): string {
  const identity = [
    imageHash,
    date,
    transaction.rowIndex,
    transaction.type,
    transaction.amount,
    normalizeText(transaction.description),
    normalizeText(transaction.paymentMethod ?? ""),
  ].join("|");
  return sha256(identity).slice(0, 24);
}

function validateTransaction(
  imageHash: string,
  date: string,
  transaction: ExtractedTransaction,
): ValidatedTransaction {
  const reviewReasons: string[] = [];
  for (const [field, confidence] of Object.entries(transaction.confidence)) {
    if (confidence !== "high") reviewReasons.push(`${field}_confidence_${confidence}`);
  }

  return {
    ...transaction,
    description: normalizeText(transaction.description),
    paymentMethod: transaction.paymentMethod ? normalizeText(transaction.paymentMethod) : null,
    categoryName: transaction.categoryName ? normalizeText(transaction.categoryName) : null,
    candidateId: candidateId(imageHash, date, transaction),
    reviewReasons,
  };
}

function validateDay(imageHash: string, day: ExtractedDay): ValidatedDay {
  if (!isValidIsoDate(day.date)) throw new Error(`INVALID_DATE:${day.date}`);

  const rowIndexes = new Set<number>();
  for (const transaction of day.transactions) {
    if (rowIndexes.has(transaction.rowIndex)) {
      throw new Error(`DUPLICATE_ROW_INDEX:${day.date}:${transaction.rowIndex}`);
    }
    rowIndexes.add(transaction.rowIndex);
  }

  const transactions = day.transactions.map((transaction) => (
    validateTransaction(imageHash, day.date, transaction)
  ));
  const calculatedTotals = transactions.reduce(
    (totals, transaction) => {
      totals[transaction.type] += transaction.amount;
      return totals;
    },
    { expense: 0, income: 0 },
  );
  const selectedForImport = day.completeness === "complete"
    ? (day.selectedForImport ?? true)
    : false;
  const errors: string[] = [];
  const warnings: string[] = [];

  let status: ValidatedDay["validation"]["status"];
  if (day.completeness === "partial") {
    status = "incomplete";
    warnings.push("partial_day_excluded");
  } else if (!day.expectedTotals) {
    status = "unavailable";
    errors.push("expected_totals_unavailable");
  } else if (
    calculatedTotals.expense !== day.expectedTotals.expense
    || calculatedTotals.income !== day.expectedTotals.income
  ) {
    status = "mismatch";
    errors.push("daily_totals_mismatch");
  } else {
    status = "exact";
  }

  if (day.dateSource === "file-metadata") warnings.push("year_inferred_from_file_metadata");
  if (transactions.some((transaction) => transaction.reviewReasons.length > 0)) {
    warnings.push("field_confidence_requires_review");
  }

  return {
    ...day,
    selectedForImport,
    transactions,
    validation: { status, calculatedTotals, errors, warnings },
  };
}

export function validateImport(raw: unknown, options: ValidateOptions = {}): ValidatedImport {
  const input: ExtractedImport = extractedImportSchema.parse(raw);
  const days = input.days.map((day) => validateDay(input.sourceImage.sha256, day));
  const selectedDays = days.filter((day) => day.selectedForImport);
  const selectedTransactions = selectedDays.flatMap((day) => day.transactions);
  const errors: string[] = [];
  const warnings = days.flatMap((day) => day.validation.warnings.map((warning) => `${day.date}:${warning}`));

  if (selectedDays.length === 0) errors.push("no_complete_day_selected");
  for (const day of selectedDays) {
    if (day.validation.status !== "exact") {
      errors.push(`${day.date}:validation_${day.validation.status}`);
    }
  }
  if (selectedTransactions.some((transaction) => (
    Object.values(transaction.confidence).includes("low")
  ))) {
    errors.push("low_confidence_required_field");
  }

  return {
    ...input,
    batchId: `toss-${input.sourceImage.sha256.slice(0, 16)}`,
    reviewedAt: input.reviewedAt ?? null,
    days,
    validation: {
      submissionReady: errors.length === 0 && selectedTransactions.length > 0,
      selectedDayCount: selectedDays.length,
      selectedTransactionCount: selectedTransactions.length,
      errors,
      warnings,
      validatedAt: (options.now?.() ?? new Date()).toISOString(),
    },
  };
}

function parseArgs(args: string[]): { input: string; output?: string; requireSubmittable: boolean } {
  let input = "";
  let output: string | undefined;
  let requireSubmittable = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input") input = args[++index] ?? "";
    else if (arg === "--output") output = args[++index];
    else if (arg === "--require-submittable") requireSubmittable = true;
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (!input) throw new Error("MISSING_ARGUMENT:--input");
  return { input, output, requireSubmittable };
}

export function main(args = process.argv.slice(2)): void {
  const options = parseArgs(args);
  const raw = JSON.parse(readFileSync(options.input, "utf8"));
  const validated = validateImport(raw);
  const serialized = `${JSON.stringify(validated, null, 2)}\n`;

  if (options.output) {
    writeFileSync(options.output, serialized, { mode: 0o600 });
    chmodSync(options.output, 0o600);
  } else {
    process.stdout.write(serialized);
  }

  if (options.requireSubmittable && !validated.validation.submissionReady) process.exitCode = 3;
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`VALIDATION_FAILED:${message}\n`);
    process.exitCode = 2;
  }
}
