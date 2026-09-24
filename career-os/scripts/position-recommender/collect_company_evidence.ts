import { readFileSync, writeFileSync } from "node:fs";

import {
  companyTierQueueResponseSchema,
  type CompanyEvidence,
  type CompanyPreference,
} from "../../services/recommendation-api/src/positions/schema.ts";
import { stableUuid } from "../../services/recommendation-api/src/positions/hash.ts";
import {
  companyEvidenceCollectors,
  collectCompanyEvidence,
} from "./company-evidence/collectors/index.ts";
import { loadDartApiKey } from "./company-evidence/collectors/dart.ts";
import type { EvidenceFetcher } from "./company-evidence/collectors/types.ts";
import {
  createRecommendationApiClient,
  type RecommendationApiClient,
} from "./recommendation-api/client.ts";
import type { RunDirectoryPaths } from "./run-dir.ts";

export type EvidenceClient = Pick<
  RecommendationApiClient,
  | "listCompanyPreferences"
  | "getCompanyEvidence"
  | "getActiveCompanyPostings"
  | "putCompanyEvidence"
  | "updateCompanyPreference"
>;

export async function collectEvidenceForRun(
  paths: RunDirectoryPaths,
  client: EvidenceClient = createRecommendationApiClient(),
  now = new Date(),
  fetcher: EvidenceFetcher = fetch,
  dartKeyResolver: () => string | null = loadDartApiKey,
): Promise<{ companyCount: number; evidenceCount: number; failedCollectorCount: number }> {
  const queue = companyTierQueueResponseSchema.parse(
    JSON.parse(readFileSync(paths.companyTierQueue, "utf8")),
  );
  const preferences = new Map(
    (await client.listCompanyPreferences()).map((item) => [item.companyKey, item]),
  );
  let dartApiKey: string | undefined;
  try {
    dartApiKey = dartKeyResolver() ?? undefined;
  } catch {
    /* 키 파일 오류는 DART 진단으로 남긴다. */
  }

  const newEvidence: Array<{ companyKey: string; evidence: CompanyEvidence[] }> = [];
  let failedCollectorCount = 0;
  for (const company of queue.companies) {
    const existingEvidence = await client.getCompanyEvidence(company.companyKey);
    const activePostings = await client.getActiveCompanyPostings(company.companyKey);
    const collected = await collectCompanyEvidence(
      {
        companyKey: company.companyKey,
        companyName: company.companyName,
        preference: preferences.get(company.companyKey),
        existingEvidence,
        activePostings,
        now,
        fetcher,
        dartApiKey,
        async persistDartCorpCode(companyKey, corpCode) {
          const current: CompanyPreference = preferences.get(companyKey) ?? {
            companyKey,
            companyName: company.companyName,
            tier: null,
            disposition: company.disposition ?? "analyze",
            updatedAt: now.toISOString(),
          };
          const { updatedAt: _updatedAt, ...body } = { ...current, dartCorpCode: corpCode };
          const saved = await client.updateCompanyPreference(
            companyKey,
            body,
            `dart-corp-code:${stableUuid(`${companyKey}:${corpCode}`)}`,
          );
          preferences.set(companyKey, saved);
        },
      },
      companyEvidenceCollectors,
    );
    if (collected.evidence.length > 0)
      newEvidence.push({ companyKey: company.companyKey, evidence: collected.evidence });
    failedCollectorCount += collected.diagnostics.length;
  }

  if (newEvidence.length > 0) {
    const body = { schemaVersion: 1, companies: newEvidence };
    await client.putCompanyEvidence(
      queue.companyTierRunId,
      body,
      `company-evidence:${stableUuid(`${queue.companyTierRunId}:${JSON.stringify(body)}`)}`,
    );
  }
  const companies = await Promise.all(
    queue.companies.map(async (company) => ({
      companyKey: company.companyKey,
      companyName: company.companyName,
      disposition: company.disposition ?? "analyze",
      evidence: await client.getCompanyEvidence(company.companyKey),
    })),
  );
  writeFileSync(
    paths.companyEvidence,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        companyTierRunId: queue.companyTierRunId,
        companies,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return {
    companyCount: companies.length,
    evidenceCount: companies.reduce((sum, company) => sum + company.evidence.length, 0),
    failedCollectorCount,
  };
}
