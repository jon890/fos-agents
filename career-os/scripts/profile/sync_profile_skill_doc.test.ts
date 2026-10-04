import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const careerOs = resolve(import.meta.dir, "../..");
const skillDirectory = join(careerOs, "plugin/skills/sync-profile");

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

test("스킬 문서가 library/profiles 를 가리키지 않는다", () => {
  for (const file of docs) expect(readFileSync(file, "utf8"), file).not.toContain("library/profiles");
});

test("개요 표에 reference 칸이 있다", () => {
  const header = skill.split("\n").find((line) => line.startsWith("| 단계"));
  expect(header).toContain("reference");
});

test("원고를 MCP 도구로 읽고 쓴다", () => {
  for (const text of ["list_profile_documents", "get_profile_document", "save_profile_document", "expectedVersion"]) {
    expect(skill).toContain(text);
  }
});

test("작업본 받기가 첫 동작이 아니다", () => {
  const begin = skill.indexOf("workspace begin sync-profile");
  const list = skill.indexOf("list_profile_documents");
  expect(list).toBeGreaterThan(-1);
  expect(begin).toBeGreaterThan(list);
});

test("사용량은 기록을 읽고 수집기로 채운다", () => {
  expect(github).toContain("list_usage_snapshots");
  expect(github).toContain("<CAREER_LOCAL> usage");
});

test("차트는 update_github_profile 이 그리고 CLI 나 파이썬 스크립트를 가리키지 않는다", () => {
  expect(github).toContain("update_github_profile");
  expect(github).not.toContain("render_chart.ts");
  expect(github).not.toContain("agent_usage_chart");
  expect(existsSync(join(skillDirectory, "scripts/agent_usage_chart.py"))).toBe(false);
});

test("references 의 $S/<이름>.sh 로 부르는 스크립트가 스킬의 scripts/ 에 실제로 있다", () => {
  const names = new Set<string>();
  for (const file of docs) {
    for (const found of readFileSync(file, "utf8").matchAll(/\$S\/([A-Za-z0-9_]+\.sh)/g)) names.add(found[1]!);
  }
  expect(names.size).toBeGreaterThanOrEqual(1);
  for (const name of names) expect(existsSync(join(skillDirectory, "scripts", name)), name).toBe(true);
});

test("폼 스크립트가 개인 설치 경로를 박지 않고 BROWSER_DRIVER 를 따른다", () => {
  const scripts = readdirSync(join(skillDirectory, "scripts")).filter((name) => name.endsWith(".sh"));
  expect(scripts.length).toBe(5);
  for (const name of scripts) {
    const text = readFileSync(join(skillDirectory, "scripts", name), "utf8");
    expect(text, name).not.toContain("~/.claude/scripts");
    expect(text, name).toContain("BROWSER_DRIVER");
  }
});

test("AGENTS.md 가 library/profiles/ 를 자리로 적지 않는다", () => {
  expect(readFileSync(join(careerOs, "AGENTS.md"), "utf8")).not.toContain("library/profiles/");
});
