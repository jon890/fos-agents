import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  CompanyResearchStore,
  type CompanyResearchProfileType,
  type CompanyResearchStoreType,
} from "./schema.ts";

export const defaultCompanyResearchPath = resolve(
  import.meta.dir,
  "../../../state/company-research.json",
);

export function loadCompanyResearch(path = defaultCompanyResearchPath): CompanyResearchStoreType {
  try {
    return CompanyResearchStore.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    if (isNotFound(error)) return { schemaVersion: 1, companies: [] };
    throw new Error("회사 조사 데이터를 읽거나 검증할 수 없습니다.");
  }
}

export function mergeCompanyResearch(
  updates: CompanyResearchStoreType,
  current: CompanyResearchStoreType,
): CompanyResearchStoreType {
  const companies = new Map<string, CompanyResearchProfileType>(
    current.companies.map((profile) => [profile.companyKey, profile]),
  );
  for (const profile of updates.companies) {
    const previous = companies.get(profile.companyKey);
    if (!previous) {
      companies.set(profile.companyKey, profile);
      continue;
    }
    const facts = new Map(previous.facts.map((fact) => [fact.factId, fact]));
    profile.facts.forEach((fact) => facts.set(fact.factId, fact));
    const inferences = new Map(
      previous.inferences.map((inference) => [inference.inferenceId, inference]),
    );
    profile.inferences.forEach((inference) => inferences.set(inference.inferenceId, inference));
    const gaps = new Map(previous.researchGaps.map((gap) => [gap.topic, gap]));
    profile.researchGaps.forEach((gap) => gaps.set(gap.topic, gap));
    companies.set(profile.companyKey, {
      ...profile,
      aliases: [...new Set([...previous.aliases, ...profile.aliases])],
      facts: [...facts.values()],
      inferences: [...inferences.values()],
      researchGaps: [...gaps.values()],
    });
  }
  return CompanyResearchStore.parse({
    schemaVersion: 1,
    companies: [...companies.values()].toSorted((left, right) =>
      left.companyKey.localeCompare(right.companyKey, "en"),
    ),
  });
}

export function writeCompanyResearch(
  store: CompanyResearchStoreType,
  path = defaultCompanyResearchPath,
): void {
  const output = resolve(path);
  const temporary = `${output}.tmp-${process.pid}`;
  mkdirSync(dirname(output), { recursive: true });
  try {
    writeFileSync(temporary, `${JSON.stringify(CompanyResearchStore.parse(store), null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporary, output);
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      // rename 뒤에는 임시 파일이 없다.
    }
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
