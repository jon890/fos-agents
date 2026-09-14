import { z } from "zod";

export const CompanyResearchTopic = z.string().trim().min(1);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const httpsUrl = z.string().url().startsWith("https://");

export const CompanyResearchFact = z
  .object({
    factId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
    topic: CompanyResearchTopic,
    scope: z.string().trim().min(1).optional(),
    statement: z.string().trim().min(1),
    source: z
      .object({
        url: httpsUrl,
        title: z.string().trim().min(1),
        publisher: z.string().trim().min(1),
        sourceType: z.enum([
          "official",
          "regulatory-filing",
          "investor-relations",
          "reputable-news",
          "public-compensation",
          "job-posting",
          "other",
        ]),
        publishedAt: isoDate.nullable().optional(),
        observedAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    validUntil: isoDate.optional(),
  })
  .strict();

export const CompanyResearchGap = z
  .object({
    topic: CompanyResearchTopic,
    question: z.string().trim().min(1),
    lastAttemptedAt: z.string().datetime({ offset: true }),
    retryAfter: isoDate.optional(),
  })
  .strict();

export const CompanyResearchInference = z
  .object({
    inferenceId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
    topic: CompanyResearchTopic,
    statement: z.string().trim().min(1),
    basisFactIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/)).min(1),
    assumptions: z.array(z.string().trim().min(1)).default([]),
    confidence: z.enum(["high", "medium", "low"]).optional(),
    inferredAt: z.string().datetime({ offset: true }),
    validUntil: isoDate.optional(),
  })
  .strict();

export const CompanyResearchProfile = z
  .object({
    companyKey: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
    company: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)).default([]),
    researchedAt: z.string().datetime({ offset: true }),
    facts: z.array(CompanyResearchFact).default([]),
    inferences: z.array(CompanyResearchInference).default([]),
    researchGaps: z.array(CompanyResearchGap).default([]),
  })
  .strict()
  .superRefine((profile, ctx) => {
    const factIds = new Set<string>();
    profile.facts.forEach((fact, index) => {
      if (factIds.has(fact.factId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["facts", index, "factId"],
          message: `회사 조사 factId가 중복됐다: ${fact.factId}`,
        });
      }
      factIds.add(fact.factId);
    });
    const inferenceIds = new Set<string>();
    profile.inferences.forEach((inference, index) => {
      if (inferenceIds.has(inference.inferenceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["inferences", index, "inferenceId"],
          message: `회사 조사 inferenceId가 중복됐다: ${inference.inferenceId}`,
        });
      }
      inferenceIds.add(inference.inferenceId);
      for (const basisFactId of inference.basisFactIds) {
        if (!factIds.has(basisFactId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["inferences", index, "basisFactIds"],
            message: `추론 근거 factId가 회사 사실에 없다: ${basisFactId}`,
          });
        }
      }
    });
  });

export const CompanyResearchStore = z
  .object({
    schemaVersion: z.literal(1),
    companies: z.array(CompanyResearchProfile),
  })
  .strict()
  .superRefine((store, ctx) => {
    const keys = new Set<string>();
    store.companies.forEach((profile, index) => {
      if (keys.has(profile.companyKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companies", index, "companyKey"],
          message: `회사 조사 companyKey가 중복됐다: ${profile.companyKey}`,
        });
      }
      keys.add(profile.companyKey);
    });
  });

export type CompanyResearchStoreType = z.infer<typeof CompanyResearchStore>;
export type CompanyResearchProfileType = z.infer<typeof CompanyResearchProfile>;
