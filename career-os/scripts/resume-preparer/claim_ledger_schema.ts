import { z } from "zod";
import { EVIDENCE_LOCATOR_FORMAT_HINT, parseEvidenceLocator } from "./evidence_locator.ts";

export const EvidenceKindSchema = z.enum([
  "code",
  "test",
  "git",
  "document",
  "user",
  "artifact",
  "runtime",
]);

/** 원장 스키마의 현재 버전이다. 새로 만드는 원장은 이 값을 쓴다. */
export const CURRENT_CLAIM_LEDGER_SCHEMA_VERSION = 3;

/**
 * 인용한 자리를 기계가 확인할 수 있어야 하는 근거 종류다.
 * 문서와 사용자 확인은 파일 하나를 수십 번 인용하므로 경로만으로는 대조할 수 없다.
 */
export const LOCATOR_REQUIRED_EVIDENCE_KINDS = ["document", "user"] as const;

export const EvidenceSchema = z.object({
  kind: EvidenceKindSchema,
  path: z.string().min(1),
  locator: z.string().min(1).optional(),
  supports: z.string().min(1),
}).strict();

export function requiresEvidenceLocator(kind: z.infer<typeof EvidenceKindSchema>): boolean {
  return (LOCATOR_REQUIRED_EVIDENCE_KINDS as readonly string[]).includes(kind);
}

/** schemaVersion 3 부터 `document` 와 `user` 근거에 확인 가능한 locator 를 요구한다. */
const LocatedEvidenceSchema = EvidenceSchema.superRefine((evidence, context) => {
  if (!requiresEvidenceLocator(evidence.kind)) return;
  if (!evidence.locator) {
    context.addIssue({
      code: "custom",
      path: ["locator"],
      message: `${evidence.kind} 근거에는 locator 가 필요합니다. ${EVIDENCE_LOCATOR_FORMAT_HINT}`,
    });
    return;
  }
  if (!parseEvidenceLocator(evidence.locator)) {
    context.addIssue({
      code: "custom",
      path: ["locator"],
      message: EVIDENCE_LOCATOR_FORMAT_HINT,
    });
  }
});

const axisOf = (evidenceSchema: z.ZodType<z.infer<typeof EvidenceSchema>>) =>
  <T extends [string, ...string[]]>(statuses: T) => z.object({
    status: z.enum(statuses),
    evidence: z.array(evidenceSchema),
  }).strict();

const implementationAxis = (evidence: EvidenceSchemaType) => axisOf(evidence)([
  "code_verified",
  "test_verified",
  "artifact_verified",
  "document_only",
  "user_attested",
  "not_applicable",
  "unsupported",
  "contradicted",
]);

const ownershipAxis = (evidence: EvidenceSchemaType) => axisOf(evidence)([
  "git_verified",
  "document_only",
  "user_attested",
  "team_result",
  "not_claimed",
  "unsupported",
  "contradicted",
]);

const outcomeAxis = (evidence: EvidenceSchemaType) => axisOf(evidence)([
  "measured",
  "test_verified",
  "documented",
  "user_attested",
  "not_claimed",
  "unsupported",
  "contradicted",
]);

const experienceDepthAxis = (evidence: EvidenceSchemaType) => axisOf(evidence)([
  "usage_verified",
  "delivery_verified",
  "operations_verified",
  "user_attested",
  "not_claimed",
  "unsupported",
  "contradicted",
]);

type EvidenceSchemaType = z.ZodType<z.infer<typeof EvidenceSchema>>;

const claimSchemaOf = (evidence: EvidenceSchemaType) => z.object({
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
  implementation: implementationAxis(evidence),
  ownership: ownershipAxis(evidence),
  outcome: outcomeAxis(evidence),
  experienceDepth: experienceDepthAxis(evidence).optional(),
  verdict: z.enum(["safe", "soften", "ask_user", "remove"]),
  proposedText: z.string().min(1),
}).strict().superRefine((claim, context) => {
  const claimsOperationalDepth =
    /주력|숙련|전문|노하우|트러블슈팅|운영(?=\s*(?:·|$)|했|하|해|경험|문제|역량)/.test(claim.text);
  const requiresExperienceDepth =
    claim.type === "timeline" ||
    claim.type === "technology" ||
    claimsOperationalDepth;

  if (requiresExperienceDepth && !claim.experienceDepth) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["experienceDepth"],
      message: "기술 범위·기간·운영·숙련도 주장에는 경험 깊이 판정이 필요합니다.",
    });
  }
});

const ledgerSchemaOf = <Version extends number>(version: Version, evidence: EvidenceSchemaType) => z.object({
  schemaVersion: z.literal(version),
  artifact: z.string().min(1),
  artifactTextSha256: z.string().regex(/^[a-f0-9]{64}$/),
  generatedAt: z.string().min(1),
  claims: z.array(claimSchemaOf(evidence)).min(1),
}).strict();

/** 이미 제출한 원장은 locator 없이 남아 있으므로 버전 2 는 그대로 받고 검증기가 경고만 낸다. */
export const ClaimLedgerV2Schema = ledgerSchemaOf(2, EvidenceSchema);
export const ClaimLedgerV3Schema = ledgerSchemaOf(CURRENT_CLAIM_LEDGER_SCHEMA_VERSION, LocatedEvidenceSchema);

export const ClaimLedgerSchema = z.discriminatedUnion("schemaVersion", [
  ClaimLedgerV2Schema,
  ClaimLedgerV3Schema,
]);

export const ClaimSchema = claimSchemaOf(EvidenceSchema);
export const ImplementationAxisSchema = implementationAxis(EvidenceSchema);
export const OwnershipAxisSchema = ownershipAxis(EvidenceSchema);
export const OutcomeAxisSchema = outcomeAxis(EvidenceSchema);
export const ExperienceDepthAxisSchema = experienceDepthAxis(EvidenceSchema);

export type ClaimLedger = z.infer<typeof ClaimLedgerSchema>;
