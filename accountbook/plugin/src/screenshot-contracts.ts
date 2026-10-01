import { z } from "zod";

export const confidenceSchema = z.enum(["high", "medium", "low"]);

const isoDateSchema = z.iso.date();
const dateSourceSchema = z.enum(["screen", "received-date", "user-confirmed"]);

export const dateEvidenceSchema = z.object({
  screenMonth: z.number().int().min(1).max(12),
  screenDay: z.number().int().min(1).max(31),
  yearSource: dateSourceSchema,
});

export const transactionSchema = z.object({
  rowIndex: z.number().int().positive(),
  type: z.enum(["expense", "income"]),
  amount: z.number().int().positive().max(9_999_999_999),
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
  dateSource: dateSourceSchema,
  dateEvidence: dateEvidenceSchema,
  completeness: z.enum(["complete", "partial"]),
  selectedForImport: z.boolean().optional(),
  expectedTotals: z
    .object({
      expense: z.number().int().nonnegative(),
      income: z.number().int().nonnegative(),
    })
    .nullable(),
  transactions: z.array(transactionSchema).max(200),
});

export type ExtractedDay = z.infer<typeof extractedDaySchema>;
export type ExtractedTransaction = z.infer<typeof transactionSchema>;
export type ValidatedTransaction = ExtractedTransaction & {
  candidateId: string;
  reviewReasons: string[];
};
export type ValidatedDay = Omit<ExtractedDay, "selectedForImport" | "transactions"> & {
  selectedForImport: boolean;
  transactions: ValidatedTransaction[];
  validation: {
    status: "exact" | "mismatch" | "incomplete" | "unavailable";
    calculatedTotals: { expense: number; income: number };
    errors: string[];
    warnings: string[];
  };
};
