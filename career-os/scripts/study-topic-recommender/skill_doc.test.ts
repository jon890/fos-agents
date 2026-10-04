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
  test("정리 명령과 도움말, cron에서 읽을 결과를 안내한다", () => {
    const skill = readFileSync(join(skillRoot, "SKILL.md"), "utf8");
    const execution = readFileSync(join(skillRoot, "references/execution.md"), "utf8");
    expect(skill).toContain("morning_reading_cli.ts --cleanup --run-dir <RUN_DIR>");
    expect(skill).toContain("사용자가 결과를 확인하기 전에 유일한 HTML 파일을 삭제하지 않는다.");
    expect(skill).toContain("`bun -e`, `python -c`, heredoc 같은 즉석 스크립트를 쓰지 않고 CLI stdout과 큐 파일을 읽는다.");
    expect(skill).toContain("게시 확인은 `report-publisher`가 반환한 결과로 판단한다.");
    expect(execution).toContain("morning_reading_cli.ts --cleanup --run-dir <RUN_DIR>");
    expect(execution).toContain("morning_reading_cli.ts --help");
  });

  test("제거한 파일 기반 실행 용어를 적지 않는다", () => {
    const documents = readSkillDocuments();

    for (const forbidden of ["파일모드", "--library", "morning-study-history", "--commit-history"]) {
      expect(documents).not.toContain(forbidden);
    }
  });

  test("관심사 변경과 제외 판정 저장을 안내한다", () => {
    const documents = readSkillDocuments();

    expect(documents).toContain("manage_candidate_context.ts");
    expect(documents).toContain("rejections");
  });

  test("관심사를 Backend 문서에서 읽고 분야를 직접 적지 않는다", () => {
    const documents = readSkillDocuments();

    expect(documents).toContain("learningInterests");
    for (const forbidden of ["brain-search", "configure_study_recommendation", "백엔드를 잘 만드는 데"]) {
      expect(documents).not.toContain(forbidden);
    }
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
    const sectionEnd = flow.indexOf("### 커리어 Backend");
    const section = flow.slice(sectionStart, sectionEnd);
    const firstSentence = section.split("\n").find((line) => line.startsWith("plugin 의 `application-package-writer`"));

    expect(firstSentence).toBeDefined();
    expect(firstSentence).not.toContain("study-topic-recommender");
  });
});
