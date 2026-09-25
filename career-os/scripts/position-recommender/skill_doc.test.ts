import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const skillDirectory = resolve(import.meta.dir, "../../.claude/skills/position-recommender");
const skillPath = resolve(skillDirectory, "SKILL.md");
const skill = readFileSync(skillPath, "utf8");
const lines = skill.trimEnd().split("\n");

test("position-recommender 문서는 판단 기준과 네 하위 명령만 안내한다", () => {
  expect(skill).toContain("## 목표");
  expect(skill).toContain("## 최종 답변");
  expect(lines.length).toBeLessThanOrEqual(110);
  expect(skill.match(/^```bash$/gm) ?? []).toHaveLength(1);

  for (const command of ["collect", "commit-company-tiers", "commit-analyses", "finalize"]) {
    expect(skill).toContain(`position_run.ts ${command}`);
  }

  for (const removed of [
    "skill begin",
    "skill finish",
    "company_research.ts",
    "collect_live_postings.ts",
    "prepare_position_analysis.ts",
  ]) {
    expect(skill).not.toContain(removed);
  }
});

test("판정 기준과 실패 처리를 필요할 때 읽는 참고 문서로 둔다", () => {
  expect(skill).toContain(
    "[판정 기준](career-os/.claude/skills/position-recommender/references/judgment.md)",
  );
  expect(skill).toContain(
    "[실패 처리](career-os/.claude/skills/position-recommender/references/failures.md)",
  );
});

test("저장소 루트에서 스킬 경로와 참고 문서를 찾도록 안내한다", () => {
  expect(skill).toContain("이 문서의 경로와 명령은 모두 저장소 루트 기준이다.");
  expect(skill).toContain('cd "$(git rev-parse --show-toplevel)"');
});
