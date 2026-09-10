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
      reason: "상향 근거가 없고 문제의 난도가 현재보다 낮다.",
      axes: [
        { axis: "문제의 난도" as const, direction: "하향" as const, reason: "공고 근거" },
        { axis: "오너십과 파는 깊이" as const, direction: "동일" as const, reason: "공고 근거" },
        { axis: "도메인 확장 여지" as const, direction: "확인 필요" as const, reason: "정보 없음" },
        { axis: "보상" as const, direction: "확인 필요" as const, reason: "정보 없음" },
      ],
      evidenceUrls: [candidate.url],
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
