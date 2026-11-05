import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const agentSkillsDirectory = join(import.meta.dir, "..", "agent-skills");

test("일반 에이전트용 스킬이 없다", () => {
  // 폴더는 외부 마운트 경로라 README.md 와 함께 남긴다. 스킬을 다시 두려면 ADR-141 을 먼저 고친다.
  expect(readdirSync(agentSkillsDirectory).filter((name) => !name.startsWith("."))).toEqual([
    "README.md",
  ]);
});

test("plugin.json 의 skills 가 agent-skills 를 가리키지 않는다", () => {
  // Pointing here would merge the skill into the connector agent's instructions and its 8,000-char budget.
  const plugin = JSON.parse(
    readFileSync(join(import.meta.dir, "..", ".claude-plugin", "plugin.json"), "utf8"),
  );
  expect(plugin.skills).toBe("./connector-skills");
});
