import { z } from "zod";
import { CareerBackend, CareerError, safeError } from "./backend.ts";

// Field names and enum values are the Backend's (services/career-backend/src/positions/schema.ts).
// The Backend validated these rules when they were saved, so only the shape is checked here.
const exclusionEvidence = {
  decisionKind: z.enum(["career-downside", "manual"]),
  reason: z.string(),
  evidenceUrls: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  decidedAt: z.string(),
  expiresAt: z.string().optional(),
};
const exclusionSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("posting"),
    source: z.string(),
    identityHash: z.string().optional(),
    url: z.string().optional(),
    ...exclusionEvidence,
  }),
  z.object({ scope: z.literal("company"), company: z.string(), ...exclusionEvidence }),
  z.object({
    scope: z.literal("company-role"),
    company: z.string(),
    titleKeywords: z.array(z.string()),
    ...exclusionEvidence,
  }),
]);
const companyPreferenceSchema = z.object({
  companyKey: z.string(),
  companyName: z.string(),
  tier: z.number().int().nullable(),
  disposition: z.enum(["analyze", "exclude", "benchmark"]),
  techBlogFeedUrl: z.string().nullable().optional(),
  githubOrg: z.string().nullable().optional(),
  dartCorpCode: z.string().nullable().optional(),
  blindCompanySlug: z.string().nullable().optional(),
  updatedAt: z.string(),
});

export const getPositionResearchConstraintsSchema = z.strictObject({});

const sources = {
  exclusions: { path: "/api/positions/v1/exclusions", schema: z.array(exclusionSchema) },
  companyPreferences: { path: "/api/positions/v1/company-preferences", schema: z.array(companyPreferenceSchema) },
} as const;

// Both lists are required to finalize a position recommendation: exclusions name postings, companies
// and roles to skip, and a preference with disposition "exclude" skips a whole company. Either one
// failing yields readiness "hold" instead of an error, so research can go on while the final pick waits.
// A rejected token is still an error, since only the connection screen can fix it.
// Expired exclusions are already dropped by the Backend (Asia/Seoul date); expiresAt is passed through.
export async function getPositionResearchConstraints(backend: CareerBackend) {
  const [exclusions, companyPreferences] = await Promise.allSettled([
    backend.request("GET", sources.exclusions.path, sources.exclusions.schema),
    backend.request("GET", sources.companyPreferences.path, sources.companyPreferences.schema),
  ]);
  const settled = { exclusions, companyPreferences };
  for (const result of Object.values(settled))
    if (
      result.status === "rejected" &&
      result.reason instanceof CareerError &&
      result.reason.code === "CAREER_UNAUTHORIZED"
    )
      throw result.reason;
  const missing = Object.entries(settled).flatMap(([source, result]) =>
    // Only the code: the fixed messages are written for saves and documents and would mislead here.
    result.status === "rejected" ? [{ source, code: safeError(result.reason).code }] : [],
  );
  return {
    readiness: missing.length === 0 ? ("ready" as const) : ("hold" as const),
    missing,
    exclusions: exclusions.status === "fulfilled" ? exclusions.value : null,
    companyPreferences: companyPreferences.status === "fulfilled" ? companyPreferences.value : null,
  };
}
