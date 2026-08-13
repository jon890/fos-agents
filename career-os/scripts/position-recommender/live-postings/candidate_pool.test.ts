import { describe, expect, test } from "bun:test";
import { buildPostingCandidatePool } from "./candidate_pool.ts";
import type { CollectionDiagnostics, Posting } from "./types.ts";

const posting: Posting = {
  source: "wanted",
  company: "테스트 회사",
  title: "Backend Engineer",
  url: "https://example.com/jobs/1",
  linkType: "direct_posting",
  postingStatus: "active",
  activeEvidence: "공식 API active",
  openedAt: "",
  closesAt: "no_deadline",
  daysUntilClose: "no_deadline",
  closeUrgency: "no_deadline",
  category: "개발",
  summary: "",
  tags: [],
  skills: [],
  dueTime: "",
  mainTasks: "서비스 개발",
  requirements: "백엔드 경험",
  preferred: "",
};

const diagnostics: CollectionDiagnostics = {
  collectionRunId: "position-postings-2026-08-13T00:00:00.000Z",
  collectedAt: "2026-08-13T00:00:00.000Z",
  requestedSource: "all",
  configuredSources: ["wanted"],
  serverOnly: false,
  wantedLimit: 120,
  includeTossArticles: false,
  sourceDiagnostics: [{
    source: "wanted",
    status: "ok",
    collectedCount: 1,
    importedCount: 1,
    skippedCount: 0,
    failedCount: 0,
    discoveryModes: ["broad"],
    message: "ok",
  }],
  errors: [],
};

describe("buildPostingCandidatePool", () => {
  test("공고에 안정적인 ID를 부여하고 JSON 기준 데이터를 만든다", () => {
    const first = buildPostingCandidatePool([posting], diagnostics).pool;
    const second = buildPostingCandidatePool([posting], diagnostics).pool;
    expect(first.candidates).toHaveLength(1);
    expect(first.candidates[0].id).toBe(second.candidates[0].id);
    expect(first.policy.selection).toBe("llm");
  });

  test("잘못된 외부 공고는 후보풀에서 제외하고 진단에 남긴다", () => {
    const result = buildPostingCandidatePool([{ ...posting, url: "http://unsafe.example/jobs/1" }], diagnostics);
    expect(result.pool.candidates).toHaveLength(0);
    expect(result.validationErrors.join("\n")).toContain("HTTPS");
  });
});
