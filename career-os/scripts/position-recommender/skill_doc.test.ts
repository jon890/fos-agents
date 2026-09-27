import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const skillDirectory = resolve(import.meta.dir, "../../.claude/skills/position-recommender");
const skillPath = resolve(skillDirectory, "SKILL.md");
const skill = readFileSync(skillPath, "utf8");
const lines = skill.trimEnd().split("\n");

test("position-recommender 문서는 판단 기준과 다섯 하위 명령을 안내한다", () => {
  expect(skill).toContain("## 목표");
  expect(skill).toContain("## 최종 답변");
  expect(lines.length).toBeLessThanOrEqual(110);
  expect(skill.match(/^```bash$/gm) ?? []).toHaveLength(1);

  for (const command of ["collect", "commit-company-tiers", "commit-analyses", "finalize", "cleanup"]) {
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

test("정리 명령과 cron에서 읽을 결과를 안내한다", () => {
  expect(skill).toContain("position_run.ts cleanup --run <RUN_DIR>");
  expect(skill).toContain("`bun -e`, `python -c`, heredoc 같은 즉석 스크립트를 쓰지 않고 CLI stdout과 큐 파일을 읽는다.");
  expect(skill).toContain("게시 확인은 `report-publisher`가 반환한 결과로 판단한다.");
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
