import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { stableUuid } from "../../services/recommendation-api/src/positions/hash.ts";
import type {
  CompanyEvidence,
  StoredCompanyEvidence,
} from "../../services/recommendation-api/src/positions/schema.ts";
import { collectEvidenceForRun, type EvidenceClient } from "./collect_company_evidence.ts";
import { runDirectoryPaths } from "./run-dir.ts";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

test("수집한 공고 근거를 저장하고 모델 파일에 저장 ID를 남긴다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "company-evidence-test-"));
  dirs.push(directory);
  const paths = runDirectoryPaths(directory);
  writeFileSync(
    paths.companyTierQueue,
    JSON.stringify({
      schemaVersion: 1,
      collectionRunId: "run-1",
      companyTierRunId: "tier-run-1",
      generatedAt: "2026-09-24T00:00:00.000Z",
      status: "pending",
      companies: [
        {
          companyKey: "example",
          companyName: "예시",
          assessmentStatus: "new",
          activePositionCount: 1,
          representativePostingUrls: ["https://example.com/job"],
          priorTier: null,
          priorReason: null,
          priorValidUntil: null,
        },
      ],
      summary: {
        activeCompanyCount: 1,
        manualCount: 0,
        modelCount: 0,
        defaultCount: 1,
        queuedCount: 1,
        newCount: 1,
        staleCount: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 1,
      },
    }),
  );
  let saved: StoredCompanyEvidence[] = [];
  const client = {
    listCompanyPreferences: async () => [],
    getCompanyEvidence: async () => saved,
    getActiveCompanyPostings: async () => [
      {
        title: "백엔드 개발자",
        url: "https://example.com/job",
        firstSeenAt: "2026-09-18T00:00:00.000Z",
      },
    ],
    putCompanyEvidence: async (_runId: string, body: unknown) => {
      saved = (
        body as { companies: Array<{ evidence: CompanyEvidence[] }> }
      ).companies[0]!.evidence.map((entry) => ({
        ...entry,
        id: stableUuid(`company-evidence:example:${entry.sourceType}:${entry.url}`),
      }));
      return {
        companyTierRunId: "tier-run-1",
        companies: [{ companyKey: "example", savedCount: 1 }],
      };
    },
    updateCompanyPreference: async () => {
      throw new Error("호출하면 안 됩니다.");
    },
  } as EvidenceClient;
  const result = await collectEvidenceForRun(
    paths,
    client,
    new Date("2026-09-24T00:00:00.000Z"),
    async () => {
      throw new Error("외부 요청을 호출하면 안 됩니다.");
    },
    () => null,
  );
  expect(result).toEqual({ companyCount: 1, evidenceCount: 1, failedCollectorCount: 1 });
  const file = JSON.parse(readFileSync(paths.companyEvidence, "utf8")) as {
    companies: Array<{ evidence: Array<{ id: string; sourceType: string }> }>;
  };
  expect(file.companies[0]!.evidence[0]).toMatchObject({
    id: stableUuid("company-evidence:example:job-posting:https://example.com/job"),
    sourceType: "job-posting",
  });
});
