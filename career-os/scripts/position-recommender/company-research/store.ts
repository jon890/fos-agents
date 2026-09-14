import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  CompanyResearchFile,
  CompanyResearchStore,
  type CompanyResearchProfileType,
  type CompanyResearchStoreType,
} from "./schema.ts";

export const defaultCompanyResearchDirectory = resolve(
  import.meta.dir,
  "../../../state/company-research",
);

export function loadCompanyResearch(
  directory = defaultCompanyResearchDirectory,
): CompanyResearchStoreType {
  try {
    const profiles = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .toSorted((left, right) => left.name.localeCompare(right.name, "en"))
      .map((entry) => {
        const parsed = CompanyResearchFile.parse(
          JSON.parse(readFileSync(join(directory, entry.name), "utf8")),
        );
        if (entry.name !== `${parsed.profile.companyKey}.json`) {
          throw new Error(`회사 조사 파일명과 companyKey가 다릅니다: ${entry.name}`);
        }
        return parsed.profile;
      });
    return CompanyResearchStore.parse({ schemaVersion: 1, companies: profiles });
  } catch (error) {
    if (!isNotFound(error)) throw new Error("회사 조사 데이터를 읽거나 검증할 수 없습니다.");
  }

  try {
    return CompanyResearchStore.parse(JSON.parse(readFileSync(legacyPath(directory), "utf8")));
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
  directory = defaultCompanyResearchDirectory,
): void {
  const outputDirectory = resolve(directory);
  const parsed = CompanyResearchStore.parse(store);
  if (!existsSync(outputDirectory)) {
    mkdirSync(dirname(outputDirectory), { recursive: true });
    const temporaryDirectory = mkdtempSync(`${outputDirectory}.tmp-`);
    try {
      writeProfiles(parsed, temporaryDirectory);
      renameSync(temporaryDirectory, outputDirectory);
    } catch (error) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
  } else {
    if (!statSync(outputDirectory).isDirectory()) {
      throw new Error("회사 조사 저장 경로가 디렉터리가 아닙니다.");
    }
    writeProfiles(parsed, outputDirectory);
  }

  try {
    unlinkSync(legacyPath(outputDirectory));
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

function writeProfiles(store: CompanyResearchStoreType, outputDirectory: string): void {
  for (const profile of store.companies) {
    const output = join(outputDirectory, `${profile.companyKey}.json`);
    const temporary = `${output}.tmp-${process.pid}`;
    try {
      writeFileSync(temporary, `${JSON.stringify({ schemaVersion: 1, profile }, null, 2)}\n`, {
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
}

function legacyPath(directory: string): string {
  const output = resolve(directory);
  return join(dirname(output), `${basename(output)}.json`);
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
