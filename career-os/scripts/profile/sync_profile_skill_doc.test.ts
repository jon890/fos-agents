import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const careerOs = resolve(import.meta.dir, "../..");
const workspaceRoot = resolve(careerOs, "..");
const skillDirectory = join(careerOs, ".claude/skills/sync-profile");

function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

const docs = markdownFiles(skillDirectory);
const skill = readFileSync(join(skillDirectory, "SKILL.md"), "utf8");
const github = readFileSync(join(skillDirectory, "references/github.md"), "utf8");
const chart = readFileSync(join(skillDirectory, "scripts/agent_usage_chart.py"), "utf8");

test("스킬 문서와 차트 스크립트가 library/profiles 를 가리키지 않는다", () => {
  for (const file of docs) expect(readFileSync(file, "utf8"), file).not.toContain("library/profiles");
  expect(chart).not.toContain("library/profiles");
});

test("개요 표에 reference 칸이 있다", () => {
  const header = skill.split("\n").find((line) => line.startsWith("| 단계"));
  expect(header).toContain("reference");
});

test("원고를 manage_profile.ts 로 읽고 쓴다", () => {
  for (const text of ["career-os/scripts/profile/manage_profile.ts", "documents get", "documents put", "--expected-version"]) {
    expect(skill).toContain(text);
  }
});

test("작업본 받기가 첫 동작이 아니다", () => {
  const begin = skill.indexOf("skill begin sync-profile");
  const list = skill.indexOf("documents list");
  expect(list).toBeGreaterThan(-1);
  expect(begin).toBeGreaterThan(list);
});

test("사용량은 기록을 읽고 수집기로 채운다", () => {
  expect(github).toContain("usage list");
  expect(github).toContain("career-os/scripts/agent-usage/collect_usage.ts");
});

test("코드 영역의 career-os 경로가 실제로 있다", () => {
  const paths = new Set<string>();
  for (const file of docs) {
    const text = readFileSync(file, "utf8");
    for (const block of text.match(/```[\s\S]*?```|`[^`\n]+`/g) ?? []) {
      for (const found of block.match(/career-os\/[^\s"'`<>$)]+/g) ?? []) paths.add(found);
    }
  }
  paths.delete("career-os/.env");
  expect(paths.size).toBeGreaterThan(0);
  for (const found of paths) expect(existsSync(join(workspaceRoot, found)), found).toBe(true);
});

test("AGENTS.md 가 library/profiles/ 를 자리로 적지 않는다", () => {
  expect(readFileSync(join(careerOs, "AGENTS.md"), "utf8")).not.toContain("library/profiles/");
});
