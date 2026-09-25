import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

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

  test("저장소 루트에서 스킬 경로와 참고 문서를 찾도록 안내한다", () => {
    const skill = readFileSync(join(skillRoot, "SKILL.md"), "utf8");

    expect(skill).toContain("이 문서의 경로와 명령은 모두 저장소 루트 기준이다.");
    expect(skill).toContain('cd "$(git rev-parse --show-toplevel)"');

    for (const link of [
      "[실행 계약](career-os/.claude/skills/study-topic-recommender/references/execution.md)",
      "[소스 관리](career-os/.claude/skills/study-topic-recommender/references/source-management.md)",
    ]) {
      expect(skill).toContain(link);
    }
  });

  test("파일 동기화 명령을 실행하지 않고 Backend 추천 상태를 사용하도록 안내한다", () => {
    const skill = readFileSync(join(skillRoot, "SKILL.md"), "utf8");

    expect(skill).toContain("`career-workspace` 파일 동기화 명령을 실행하지 않는다.");
  });

  test("비공개 작업본 동기화 절의 첫 문장에서 공부 추천을 제외한다", () => {
    const repositoryRoot = resolve(import.meta.dir, "../../..");
    const flow = readFileSync(resolve(repositoryRoot, "career-os/docs/flow.md"), "utf8");
    const sectionStart = flow.indexOf("### 비공개 작업본 동기화");
    const sectionEnd = flow.indexOf("### 추천 상태 Backend");
    const section = flow.slice(sectionStart, sectionEnd);
    const firstSentence = section.split("\n").find((line) => line.startsWith("`application-package-writer`"));

    expect(firstSentence).toBeDefined();
    expect(firstSentence).not.toContain("study-topic-recommender");
  });
});
