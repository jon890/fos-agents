import { createHash } from "node:crypto";
import type {
  ExtractedDay,
  ExtractedTransaction,
  ValidatedDay,
  ValidatedTransaction,
} from "./screenshot-contracts.ts";

export type DaysValidation = {
  days: ValidatedDay[];
  errors: string[];
  warnings: string[];
};

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function validateTransaction(
  sourceHash: string,
  date: string,
  transaction: ExtractedTransaction,
): ValidatedTransaction {
  const description = normalizeText(transaction.description);
  const paymentMethod = transaction.paymentMethod ? normalizeText(transaction.paymentMethod) : null;
  const identity = [
    sourceHash,
    date,
    transaction.rowIndex,
    transaction.type,
    transaction.amount,
    description,
    paymentMethod ?? "",
  ].join("|");
  return {
    ...transaction,
    description,
    paymentMethod,
    categoryName: transaction.categoryName ? normalizeText(transaction.categoryName) : null,
    candidateId: sha256(identity).slice(0, 24),
    reviewReasons: Object.entries(transaction.confidence)
      .filter(([, confidence]) => confidence !== "high")
      .map(([field, confidence]) => `${field}_confidence_${confidence}`),
  };
}

function validateDay(sourceHash: string, day: ExtractedDay): ValidatedDay {
  const transactions = day.transactions.map((transaction) =>
    validateTransaction(sourceHash, day.date, transaction),
  );
  // Sum integers of won only; a mismatch is reported, never adjusted.
  const calculatedTotals = { expense: 0, income: 0 };
  for (const transaction of transactions) calculatedTotals[transaction.type] += transaction.amount;
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
    calculatedTotals.expense !== day.expectedTotals.expense ||
    calculatedTotals.income !== day.expectedTotals.income
  ) {
    status = "mismatch";
    errors.push("daily_totals_mismatch");
  } else {
    status = "exact";
  }
  if (new Set(transactions.map((item) => item.rowIndex)).size !== transactions.length)
    errors.push("duplicate_row_index");
  if (day.dateEvidence.yearSource === "received-date")
    warnings.push("year_inferred_from_received_date");
  if (transactions.some((transaction) => transaction.reviewReasons.length > 0))
    warnings.push("field_confidence_requires_review");

  return {
    ...day,
    // A day cut off by the screen is never imported, whatever the caller selected.
    selectedForImport: day.completeness === "complete" && (day.selectedForImport ?? true),
    transactions,
    validation: { status, calculatedTotals, errors, warnings },
  };
}

// `sourceHash` only seeds candidate identifiers.
export function validateDays(sourceHash: string, rawDays: ExtractedDay[]): DaysValidation {
  const days = rawDays.map((day) => validateDay(sourceHash, day));
  const selectedDays = days.filter((day) => day.selectedForImport);
  const errors: string[] = [];
  if (selectedDays.length === 0) errors.push("no_complete_day_selected");
  for (const day of selectedDays) {
    for (const error of day.validation.errors) errors.push(`${day.date}:${error}`);
    if (day.transactions.length === 0) errors.push(`${day.date}:no_transactions`);
    if (day.transactions.some((item) => Object.values(item.confidence).includes("low")))
      errors.push(`${day.date}:low_confidence_required_field`);
  }
  return {
    days,
    errors,
    warnings: days.flatMap((day) =>
      day.validation.warnings.map((warning) => `${day.date}:${warning}`),
    ),
  };
}
