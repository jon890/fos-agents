import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoDateTimeSchema = z.string().datetime({ offset: true });

const basenameSchema = z.string()
  .trim()
  .min(1)
  .refine((value) => !value.includes("/") && !value.includes("\\"), "BASENAME_REQUIRED");

export const inboxSidecarManifestSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.literal("ios-shortcut"),
  imageFile: basenameSchema,
  capturedAt: isoDateTimeSchema,
  receivedAt: isoDateTimeSchema,
});

export const weeklyItemStatusSchema = z.enum([
  "queued",
  "processing",
  "submitted",
  "needs_review",
  "failed",
]);

export const weeklyTerminalStatusSchema = z.enum([
  "submitted",
  "needs_review",
  "failed",
]);

export const weeklyStateItemSchema = z.object({
  status: weeklyItemStatusSchema,
  batchId: z.string().regex(/^toss-[a-f0-9]{16}$/).nullable(),
  attempts: z.number().int().nonnegative(),
  lastErrorCode: z.string().trim().min(1).max(100).nullable(),
  selectedDates: z.array(isoDateSchema),
  updatedAt: isoDateTimeSchema,
});

export const weeklyStateSchema = z.object({
  schemaVersion: z.literal(1),
  policyVersion: z.literal("weekly-safe-v1"),
  items: z.record(z.string().regex(/^[a-f0-9]{64}$/), weeklyStateItemSchema),
});

export const weeklyWorkItemSchema = z.object({
  imageSha256: z.string().regex(/^[a-f0-9]{64}$/),
  imageFile: basenameSchema,
  manifestFile: basenameSchema,
  imagePath: z.string().min(1),
  manifestPath: z.string().min(1),
  manifest: inboxSidecarManifestSchema,
  state: weeklyStateItemSchema,
});

export type InboxSidecarManifest = z.infer<typeof inboxSidecarManifestSchema>;
export type WeeklyItemStatus = z.infer<typeof weeklyItemStatusSchema>;
export type WeeklyTerminalStatus = z.infer<typeof weeklyTerminalStatusSchema>;
export type WeeklyStateItem = z.infer<typeof weeklyStateItemSchema>;
export type WeeklyState = z.infer<typeof weeklyStateSchema>;
export type WeeklyWorkItem = z.infer<typeof weeklyWorkItemSchema>;
