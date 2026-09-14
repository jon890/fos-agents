import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyCompanyResearchUpdates } from "../company_research.ts";
import { CompanyResearchStore } from "./schema.ts";
import { loadCompanyResearch } from "./store.ts";

function profile(companyKey: string, company: string, statement: string) {
  return {
    companyKey,
    company,
    aliases: [],
    researchedAt: "2026-09-14T12:00:00+09:00",
    facts: [
      {
        factId: `${companyKey}-growth-2026`,
        topic: "growth" as const,
        scope: "company" as const,
        statement,
        source: {
          url: `https://example.com/${companyKey}`,
          title: "공식 발표",
          publisher: company,
          sourceType: "official" as const,
          publishedAt: "2026-09-01",
          observedAt: "2026-09-14T12:00:00+09:00",
        },
        validUntil: "2026-12-13",
      },
    ],
    inferences: [],
    researchGaps: [],
  };
}

test("회사 조사 갱신은 같은 companyKey를 교체하고 다른 회사는 보존한다", () => {
  const directory = mkdtempSync("/tmp/company-research.");
  const storePath = join(directory, "company-research.json");
  const inputPath = join(directory, "updates.json");
  try {
    writeFileSync(
      storePath,
      JSON.stringify({
        schemaVersion: 1,
        companies: [
          {
            ...profile("toss", "토스", "이전 값"),
            facts: [
              ...profile("toss", "토스", "이전 값").facts,
              {
                ...profile("toss", "토스", "보존할 보상 자료").facts[0],
                factId: "toss-compensation-2026",
                topic: "compensation",
              },
            ],
          },
          profile("line", "라인", "보존할 값"),
        ],
      }),
    );
    writeFileSync(
      inputPath,
      JSON.stringify({ schemaVersion: 1, companies: [profile("toss", "토스", "새 값")] }),
    );

    expect(applyCompanyResearchUpdates(inputPath, storePath)).toEqual({ updated: 1, total: 2 });
    const stored = loadCompanyResearch(storePath);
    expect(stored.companies.map((company) => company.companyKey)).toEqual(["line", "toss"]);
    expect(stored.companies[1].facts[0].statement).toBe("새 값");
    expect(stored.companies[1].facts[1].statement).toBe("보존할 보상 자료");
    expect(CompanyResearchStore.parse(JSON.parse(readFileSync(storePath, "utf8")))).toEqual(stored);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("회사 조사 파일이 없으면 빈 저장소로 시작한다", () => {
  expect(loadCompanyResearch("/tmp/company-research-file-that-does-not-exist.json")).toEqual({
    schemaVersion: 1,
    companies: [],
  });
});
