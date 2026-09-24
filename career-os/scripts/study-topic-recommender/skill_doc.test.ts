import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const skillRoot = join(import.meta.dir, "../../.claude/skills/study-topic-recommender");
const files = [
  "SKILL.md",
  "references/execution.md",
  "references/source-management.md",
] as const;

function readSkillDocuments(): string {
  return files.map((file) => readFileSync(join(skillRoot, file), "utf8")).join("\n");
}

describe("study-topic-recommender skill 문서", () => {
  test("제거한 파일 기반 실행 용어를 적지 않는다", () => {
    const documents = readSkillDocuments();

    for (const forbidden of ["파일모드", "--library", "morning-study-history", "--commit-history"]) {
      expect(documents).not.toContain(forbidden);
    }
  });

  test("관심사 변경과 제외 판정 저장을 안내한다", () => {
    const documents = readSkillDocuments();

    expect(documents).toContain("configure_study_recommendation.ts");
    expect(documents).toContain("rejections");
  });
});
