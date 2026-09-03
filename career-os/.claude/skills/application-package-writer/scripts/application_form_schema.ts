import { readFileSync } from "node:fs";
import { z } from "zod";

const ApplicationFormFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string(),
  source: z.enum(["profile", "application", "posting", "derived"]),
  required: z.boolean(),
});

const ApplicationFormSectionSchema = z.object({
  title: z.string().min(1),
  fields: z.array(ApplicationFormFieldSchema).min(1),
});

const ApplicationAttachmentSchema = z.object({
  label: z.string().min(1),
  file: z.string().min(1),
  required: z.boolean(),
});

const ApplicationQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  answer: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

export const ApplicationFormSchema = z.object({
  schemaVersion: z.literal(1),
  formUrl: z.string().url(),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["fields_verified", "needs_review"]),
  profileSource: z.literal("private-brain:career-application-profile"),
  sections: z.array(ApplicationFormSectionSchema).min(1),
  attachments: z.array(ApplicationAttachmentSchema),
  questions: z.array(ApplicationQuestionSchema),
  submission: z.object({
    autofill: z.enum(["ready_for_preview", "needs_review"]),
    finalSubmit: z.literal("requires_user_approval"),
  }),
  notes: z.array(z.string()).default([]),
});

export type ApplicationForm = z.infer<typeof ApplicationFormSchema>;

export function loadApplicationForm(path: string): ApplicationForm {
  return ApplicationFormSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
