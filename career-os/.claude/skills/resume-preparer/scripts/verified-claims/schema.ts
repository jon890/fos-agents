import { z } from "zod";
import { ClaimSchema } from "../claim_ledger_schema.ts";

export const VERIFIED_CLAIMS_SCHEMA_VERSION = 1;

export const EvidenceSnapshotSchema = z
  .object({
    path: z.string().min(1),
    kind: z.string().min(1),
    axis: z.enum(["implementation", "ownership", "outcome", "experienceDepth"]).optional(),
    locator: z.string().optional(),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    freshness: z.enum(["tracked", "refresh_required", "missing"]),
  })
  .strict();

export const VerifiedClaimSchema = z
  .object({
    claimKey: z.string().regex(/^[a-f0-9]{64}$/),
    claim: ClaimSchema,
    evidenceSnapshots: z.array(EvidenceSnapshotSchema),
    origins: z.array(
      z
        .object({
          application: z.string().min(1),
          ledger: z.string().min(1),
          artifactTextSha256: z.string().regex(/^[a-f0-9]{64}$/),
          generatedAt: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

export const VerifiedClaimsFileSchema = z
  .object({
    schemaVersion: z.literal(VERIFIED_CLAIMS_SCHEMA_VERSION),
    groupKey: z.string().min(1),
    claims: z.array(VerifiedClaimSchema),
  })
  .strict();

export type VerifiedClaim = z.infer<typeof VerifiedClaimSchema>;
export type VerifiedClaimsFile = z.infer<typeof VerifiedClaimsFileSchema>;
