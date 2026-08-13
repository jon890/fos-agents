import { z } from "zod";

export const EvidenceKindSchema = z.enum([
  "code",
  "test",
  "git",
  "document",
  "user",
  "artifact",
  "runtime",
]);

export const EvidenceSchema = z.object({
  kind: EvidenceKindSchema,
  path: z.string().min(1),
  locator: z.string().min(1).optional(),
  supports: z.string().min(1),
}).strict();

const axis = <T extends [string, ...string[]]>(statuses: T) => z.object({
  status: z.enum(statuses),
  evidence: z.array(EvidenceSchema),
}).strict();

export const ImplementationAxisSchema = axis([
  "code_verified",
  "test_verified",
  "artifact_verified",
  "document_only",
  "user_attested",
  "not_applicable",
  "unsupported",
  "contradicted",
]);

export const OwnershipAxisSchema = axis([
  "git_verified",
  "document_only",
  "user_attested",
  "team_result",
  "not_claimed",
  "unsupported",
  "contradicted",
]);

export const OutcomeAxisSchema = axis([
  "measured",
  "test_verified",
  "documented",
  "user_attested",
  "not_claimed",
  "unsupported",
  "contradicted",
]);

export const ClaimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  location: z.string().min(1),
  type: z.enum([
    "timeline",
    "technology",
    "implementation",
    "ownership",
    "metric",
    "outcome",
    "causal",
  ]),
  implementation: ImplementationAxisSchema,
  ownership: OwnershipAxisSchema,
  outcome: OutcomeAxisSchema,
  verdict: z.enum(["safe", "soften", "ask_user", "remove"]),
  proposedText: z.string().min(1),
}).strict();

export const ClaimLedgerSchema = z.object({
  schemaVersion: z.literal(1),
  artifact: z.string().min(1),
  artifactTextSha256: z.string().regex(/^[a-f0-9]{64}$/),
  generatedAt: z.string().min(1),
  claims: z.array(ClaimSchema).min(1),
}).strict();

export type ClaimLedger = z.infer<typeof ClaimLedgerSchema>;
