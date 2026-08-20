import { z } from "zod";

export const confidenceSchema = z.enum(["high", "medium", "low"]);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTimeSchema = z.string().datetime({ offset: true });

export const transactionSchema = z.object({
  rowIndex: z.number().int().positive(),
  type: z.enum(["expense", "income"]),
  amount: z.number().int().positive(),
  description: z.string().trim().min(1).max(1000),
  paymentMethod: z.string().trim().min(1).max(200).nullable().default(null),
  categoryName: z.string().trim().min(1).max(50).nullable().default(null),
  confidence: z.object({
    amount: confidenceSchema,
    description: confidenceSchema,
    date: confidenceSchema,
  }),
  evidence: z.object({
    amountText: z.string().trim().min(1),
    detailText: z.string().trim().min(1),
  }),
});

export const extractedDaySchema = z.object({
  date: isoDateSchema,
  dateSource: z.enum(["screen", "file-metadata", "user-confirmed"]),
  completeness: z.enum(["complete", "partial"]),
  selectedForImport: z.boolean().optional(),
  expectedTotals: z.object({
    expense: z.number().int().nonnegative(),
    income: z.number().int().nonnegative(),
  }).nullable(),
  transactions: z.array(transactionSchema),
});

export const extractedImportSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("toss-consumption-screenshot"),
  sourceImage: z.object({
    fileName: z.string().trim().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    capturedAt: isoDateTimeSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  extraction: z.object({
    engine: z.string().trim().min(1),
    runtime: z.string().trim().min(1),
    extractedAt: isoDateTimeSchema,
  }),
  reviewStatus: z.enum(["pending", "approved"]).default("pending"),
  reviewedAt: isoDateTimeSchema.nullable().optional(),
  days: z.array(extractedDaySchema).min(1),
});

export const validationStatusSchema = z.enum([
  "exact",
  "mismatch",
  "incomplete",
  "unavailable",
]);

export const validatedTransactionSchema = transactionSchema.extend({
  candidateId: z.string().regex(/^[a-f0-9]{24}$/),
  reviewReasons: z.array(z.string()),
});

export const validatedDaySchema = extractedDaySchema.extend({
  selectedForImport: z.boolean(),
  transactions: z.array(validatedTransactionSchema),
  validation: z.object({
    status: validationStatusSchema,
    calculatedTotals: z.object({
      expense: z.number().int().nonnegative(),
      income: z.number().int().nonnegative(),
    }),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
});

export const validatedImportSchema = extractedImportSchema.omit({ days: true }).extend({
  batchId: z.string().regex(/^toss-[a-f0-9]{16}$/),
  reviewedAt: isoDateTimeSchema.nullable(),
  days: z.array(validatedDaySchema),
  validation: z.object({
    submissionReady: z.boolean(),
    selectedDayCount: z.number().int().nonnegative(),
    selectedTransactionCount: z.number().int().nonnegative(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    validatedAt: isoDateTimeSchema,
  }),
});

export type ExtractedImport = z.infer<typeof extractedImportSchema>;
export type ExtractedDay = z.infer<typeof extractedDaySchema>;
export type ExtractedTransaction = z.infer<typeof transactionSchema>;
export type ValidatedImport = z.infer<typeof validatedImportSchema>;
export type ValidatedDay = z.infer<typeof validatedDaySchema>;
export type ValidatedTransaction = z.infer<typeof validatedTransactionSchema>;
