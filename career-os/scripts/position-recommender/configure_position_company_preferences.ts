#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { runCli, type CliSpec } from "../lib/cli.ts";
import { companyKey, stableUuid } from "../../services/recommendation-api/src/positions/hash.ts";
import type { RecommendationApiClient } from "./recommendation-api/client.ts";
import { createRecommendationApiClient } from "./recommendation-api/client.ts";

const inputPreferenceSchema = z
  .object({
    companyName: z.string().trim().min(1),
    tier: z.number().int().min(1).max(3),
    disposition: z.enum(["analyze", "exclude"]),
  })
  .strict();

export const companyPreferencesInputSchema = z
  .object({
    schemaVersion: z.literal(1),
    preferences: z.array(inputPreferenceSchema).min(1),
  })
  .strict()
  .superRefine((input, context) => {
    const seen = new Set<string>();
    for (const [index, preference] of input.preferences.entries()) {
      const key = companyKey(preference.companyName);
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["preferences", index, "companyName"],
          message: "같은 회사 정책이 두 번 들어 있습니다.",
        });
      }
      seen.add(key);
    }
  });

type CompanyPreferenceClient = Pick<RecommendationApiClient, "updateCompanyPreference">;
type ClientFactory = () => CompanyPreferenceClient;

export async function configurePositionCompanyPreferences(
  inputPath: string,
  createClient: ClientFactory = createRecommendationApiClient,
) {
  const input = companyPreferencesInputSchema.parse(
    JSON.parse(readFileSync(resolve(inputPath), "utf8")) as unknown,
  );
  const client = createClient();
  const tierCounts = { "1": 0, "2": 0, "3": 0 };
  let excludedCount = 0;

  for (const preference of input.preferences) {
    const key = companyKey(preference.companyName);
    const body = { companyKey: key, ...preference };
    const idempotencyKey = `company-preference:${stableUuid(JSON.stringify(body))}`;
    await client.updateCompanyPreference(key, body, idempotencyKey);
    tierCounts[String(preference.tier) as keyof typeof tierCounts] += 1;
    if (preference.disposition === "exclude") excludedCount += 1;
  }

  return {
    passed: true,
    appliedCount: input.preferences.length,
    analyzedCount: input.preferences.length - excludedCount,
    excludedCount,
    tierCounts,
  };
}

const spec: CliSpec = {
  name: "configure_position_company_preferences.ts",
  summary: "명시한 회사별 분석 tier와 제외 정책을 recommendation-api에 설정한다.",
  options: {
    "--input": { value: true, description: "회사 정책 JSON" },
  },
};

if (import.meta.main) {
  await runCli(spec, async ({ options }) => {
    const input = options["--input"];
    if (typeof input !== "string") throw new Error("--input이 필요합니다.");
    return configurePositionCompanyPreferences(input);
  });
}
