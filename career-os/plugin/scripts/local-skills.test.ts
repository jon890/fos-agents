import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLUGIN_LOCAL_EXECUTORS } from "../../scripts/plugin-local/executors.ts";

const skillsDirectory = join(import.meta.dir, "..", "skills");
const launcher = 'bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js"';

function markdownFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFilesUnder(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

function frontMatterOf(text: string): { name?: string; description?: string; body: string } {
  const end = text.indexOf("\n---\n", 4);
  if (!text.startsWith("---\n") || end < 0) throw new Error("앞머리가 없거나 닫히지 않는다");
  const front = text.slice(4, end);
  return {
    name: front.match(/^name: (.+)$/m)?.[1],
    description: front.match(/^description: (.+)$/m)?.[1],
    body: text.slice(end + 5),
  };
}

function executorNamesIn(text: string): string[] {
  return [...text.matchAll(/<CAREER_LOCAL> ([a-z][a-z-]*)/g)].map((match) => match[1]!);
}

const skills = readdirSync(skillsDirectory);

test("Claude Code 전용 스킬이 둘 있다", () => {
  expect(skills.sort()).toEqual(["interview-question-prep", "study-collection"]);
});

test("실행기 이름 추출은 지어낸 이름을 실행기 목록에서 찾지 못한다", () => {
  const names = executorNamesIn("<CAREER_LOCAL> nope");
  expect(names).toEqual(["nope"]);
  expect((PLUGIN_LOCAL_EXECUTORS as readonly string[]).includes(names[0]!)).toBe(false);
});

for (const skill of skills) {
  describe(skill, () => {
    const directory = join(skillsDirectory, skill);
    const files = markdownFilesUnder(directory);
    const skillText = readFileSync(join(directory, "SKILL.md"), "utf8");
    const { name, description, body } = frontMatterOf(skillText);

    test("앞머리 name 이 디렉터리 이름과 같고 description 이 1자 이상 1024자 이하다", () => {
      expect(name).toBe(skill);
      expect(description?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(description?.length ?? 0).toBeLessThanOrEqual(1024);
    });

    test("본문이 실행기 명령과 Claude Code 전용 안내를 담는다", () => {
      expect(body).toContain(launcher);
      expect(body).toContain("Claude Code 에서만");
    });

    test("career-local.js 를 부르는 줄은 모두 --no-env-file 을 쓴다", () => {
      for (const file of files)
        for (const line of readFileSync(file, "utf8").split("\n"))
          if (line.includes("career-local.js")) expect(line, `${file}`).toContain('bun --no-env-file "');
    });

    test("저장소 경로, git rev-parse, --env-file 이 없다", () => {
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        for (const banned of ["career-os/", "git rev-parse", "--env-file"])
          expect(text.includes(banned), `${file} 에 ${banned}`).toBe(false);
      }
    });

    test("<CAREER_LOCAL> 로 적은 실행기 이름이 모두 실제 실행기다", () => {
      const known = PLUGIN_LOCAL_EXECUTORS as readonly string[];
      for (const file of files)
        for (const executor of executorNamesIn(readFileSync(file, "utf8")))
          expect(known, `${file} 의 ${executor}`).toContain(executor);
    });

    test("본문이 가리키는 references 파일이 모두 있다", () => {
      const links = [...body.matchAll(/references\/([A-Za-z0-9._-]+\.md)/g)].map((match) => match[1]!);
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) expect(existsSync(join(directory, "references", link)), link).toBe(true);
    });
  });
}
