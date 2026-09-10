import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectLivePostings, parseArgs } from "../collect_live_postings.ts";
import { filterExcludedPostings, loadPositionExclusions, type PositionExclusions } from "./exclusions.ts";
import type { Posting } from "./types.ts";

// 실제 개인 규칙과 지원 이력은 공개 테스트 fixture에 복제하지 않는다.
const posting: Posting = {
  source: "toss-careers", company: "테스트 회사", title: "Server Developer (AI Platform)",
  url: "https://toss.im/career/job-detail?job_id=fixture-old", identityHash: "toss-careers:fixture-old",
  linkType: "direct_posting", postingStatus: "active", activeEvidence: "공식 API active",
  openedAt: "", closesAt: "no_deadline", daysUntilClose: "no_deadline", closeUrgency: "no_deadline",
  category: "개발", summary: "", tags: [], skills: [], dueTime: "", mainTasks: "서비스 개발",
  requirements: "백엔드 경험", preferred: "",
};
const config: PositionExclusions = {
  schemaVersion: 1,
  exclusions: [{ source: posting.source, identityHash: posting.identityHash, url: posting.url }],
};

describe("개인 공고 제외", () => {
  test("같은 소스의 ID 또는 정규화 URL만 제외한다", () => {
    const posts = [
      posting,
      { ...posting, url: "https://example.com/changed" },
      { ...posting, identityHash: undefined, url: `${posting.url}&utm_source=mail#apply` },
      { ...posting, identityHash: undefined, url: "https://toss.im/career/job-detail/?utm_medium=email&job_id=fixture-old" },
      { ...posting, title: "Server Developer (Payments)", identityHash: "toss-careers:other", url: "https://toss.im/career/job-detail?job_id=other" },
      { ...posting, identityHash: "toss-careers:new", url: "https://toss.im/career/job-detail?job_id=new" },
      { ...posting, source: "wanted" as const },
    ];
    const result = filterExcludedPostings(posts, config);
    expect(result.eligible).toEqual(posts.slice(4));
    expect(result.rejectedBySource.get("toss-careers")).toBe(4);
  });

  test("최종 후보풀과 진단에 제외 공고 본문이나 식별자가 남지 않는다", async () => {
    const dir = mkdtempSync(join(tmpdir(), "position-exclusions-"));
    try {
      const path = join(dir, "rules.json");
      const out = join(dir, "pool.json");
      writeFileSync(path, JSON.stringify(config));
      const kept = { ...posting, identityHash: "toss-careers:new", url: "https://toss.im/career/job-detail?job_id=new" };
      const code = await collectLivePostings(parseArgs(["--source", "toss", "--exclusions-config", path, "--output", out]), [{
        id: "toss-careers", name: "fixture", collect: async () => [posting, kept],
      }]);
      const raw = readFileSync(out, "utf8");
      const pool = JSON.parse(raw);
      expect(code).toBe(0);
      expect(pool.candidates.map((p: Posting) => p.url)).toEqual([kept.url]);
      expect(pool.sourceDiagnostics[0].importedCount).toBe(1);
      expect(pool.sourceDiagnostics[0].skippedCount).toBe(1);
      expect(raw).not.toContain("fixture-old");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("누락, JSON 오류, 스키마 오류는 수집과 출력 전에 중단한다", async () => {
    const dir = mkdtempSync(join(tmpdir(), "position-exclusions-"));
    try {
      const path = join(dir, "rules.json");
      const out = join(dir, "pool.json");
      let calls = 0;
      for (const raw of [undefined, "{", "null", '{"schemaVersion":2,"exclusions":[]}',
        '{"schemaVersion":1,"exclusions":[{"source":"toss-careers"}]}',
        '{"schemaVersion":1,"exclusions":[{"source":"toss-careers","url":"http://invalid"}]}',
        '{"schemaVersion":1,"exclusions":[{"source":"toss-careers","identityHash":"x","company":"all"}]}']) {
        if (raw !== undefined) writeFileSync(path, raw);
        await expect(collectLivePostings(parseArgs(["--output", out, "--exclusions-config", path]), [{
          id: "toss-careers", name: "fixture", collect: async () => { calls++; return [posting]; },
        }])).rejects.toThrow("FAIL position exclusions");
        expect(existsSync(out)).toBe(false);
      }
      expect(calls).toBe(0);
      writeFileSync(path, '{"schemaVersion":1,"exclusions":[]}');
      expect(loadPositionExclusions(path).exclusions).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
