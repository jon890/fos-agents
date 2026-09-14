#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { firstOptionValue } from "../lib/cli.ts";
import { CompanyResearchStore } from "./company-research/schema.ts";
import {
  defaultCompanyResearchDirectory,
  loadCompanyResearch,
  mergeCompanyResearch,
  writeCompanyResearch,
} from "./company-research/store.ts";

export function applyCompanyResearchUpdates(
  input: string,
  storeDirectory = defaultCompanyResearchDirectory,
) {
  const updates = CompanyResearchStore.parse(JSON.parse(readFileSync(input, "utf8")));
  const next = mergeCompanyResearch(updates, loadCompanyResearch(storeDirectory));
  writeCompanyResearch(next, storeDirectory);
  return { updated: updates.companies.length, total: next.companies.length };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const input = firstOptionValue(args, "--input");
  const store =
    firstOptionValue(args, "--store-dir") ??
    firstOptionValue(args, "--store") ??
    defaultCompanyResearchDirectory;
  if (!input) {
    console.error(
      "사용법: company_research.ts --input <company-research-updates.json> [--store-dir <company-research-directory>]",
    );
    process.exit(2);
  }
  try {
    const result = applyCompanyResearchUpdates(input, store);
    console.log(`회사 조사 데이터: ${result.updated}개 갱신, 전체 ${result.total}개`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
