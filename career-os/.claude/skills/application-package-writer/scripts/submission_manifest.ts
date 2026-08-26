import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";

export const SubmissionArtifactSchema = z.object({
  kind: z.enum(["resume", "career_description", "combined"]),
  file: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  sourceHtml: z.string().min(1).optional(),
  sourceTextSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).strict();

export const SubmissionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  artifacts: z.array(SubmissionArtifactSchema).min(1),
}).strict();

export type SubmissionManifest = z.infer<typeof SubmissionManifestSchema>;

export function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
