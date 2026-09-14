import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyExclusionSuggestions } from "../apply_exclusion_suggestions.ts";
import { pool, run } from "../render/fixture.ts";

test("검증된 자동 제외 제안을 기존 규칙과 중복 없이 합친다", () => {
  const directory = mkdtempSync(join(tmpdir(), "position-feedback-"));
  try {
    const input = join(directory, "recommendation.json");
    const candidates = join(directory, "candidates.json");
    const config = join(directory, "exclusions.json");
    const candidate = pool.candidates[0];
    const suggestion = {
      candidateId: candidate.id,
      scope: "posting" as const,
      reason: "공고의 역할 범위가 희망하는 소유권과 맞지 않는다.",
      evidenceUrls: [candidate.url],
      confidence: "medium" as const,
    };
    writeFileSync(input, JSON.stringify({ ...run, autoExclusionSuggestions: [suggestion] }));
    writeFileSync(candidates, JSON.stringify(pool));
    writeFileSync(
      config,
      JSON.stringify({
        schemaVersion: 1,
        exclusions: [{ source: candidate.source, url: "https://example.com/legacy" }],
      }),
    );

    expect(applyExclusionSuggestions(input, candidates, config)).toEqual({ added: 1, total: 2 });
    expect(applyExclusionSuggestions(input, candidates, config)).toEqual({ added: 0, total: 2 });
    const saved = JSON.parse(readFileSync(config, "utf8"));
    expect(saved.schemaVersion).toBe(2);
    expect(saved.exclusions[1]).toMatchObject({
      scope: "posting",
      source: candidate.source,
      reason: suggestion.reason,
      decidedAt: run.reportDate,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
