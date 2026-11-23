import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const repositoryRoot = dirname(dirname(dirname(import.meta.dir)));
const candidateContextSkills = ["position-recommender", "resume-preparer", "resume-review", "interview-practice", "interview-question-prep", "career-connector", "application-package-writer"];
const removedTerms = ["brain-search", "brain-add", "private brain"];

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function skillDirectory(skill: string): string {
  const directory = join(repositoryRoot, "career-os", "plugin", "agent-skills", skill);
  if (existsSync(directory)) return directory;
  throw new Error(`스킬 디렉터리를 찾을 수 없다: ${skill}`);
}

describe("후보자 맥락 스킬 경계", () => {
  for (const skill of candidateContextSkills) {
    test(`${skill} 은 개인 brain 조회와 저장 안내를 담지 않는다`, () => {
      const files = filesUnder(skillDirectory(skill));
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        for (const term of removedTerms) {
          expect(text.includes(term), `${file} 에 ${term} 이 남아 있다`).toBe(false);
        }
      }
    });
  }

  test("career-os/AGENTS.md 는 공통 프로필을 read_application_profile.ts 로 읽게 한다", () => {
    const text = readFileSync(join(repositoryRoot, "career-os", "AGENTS.md"), "utf8");
    for (const term of removedTerms) {
      expect(text.includes(term), `career-os/AGENTS.md 에 ${term} 이 남아 있다`).toBe(false);
    }
    const found = text.split("\n").filter((line) => line.includes("career-application-profile"));
    expect(found.length).toBeGreaterThanOrEqual(4);
    for (const line of found) {
      expect(line.startsWith("|") && line.includes("read_application_profile.ts"), `조회 표 밖이거나 CLI 가 없는 공통 프로필 줄: ${line}`).toBe(true);
    }
  });

  test("application-package-writer 는 공통 프로필을 기억에서 읽어 작업 폴더로 옮기게 한다", () => {
    const text = readFileSync(join(skillDirectory("application-package-writer"), "SKILL.md"), "utf8");
    expect(text).toContain("「커리어: 지원서 공통 프로필」");
    expect(text).toContain("context/application-profile.md");
    expect(text).not.toContain("<CAREER_LOCAL> application-profile");
  });

  test("career-os/AGENTS.md 는 프로필 원고의 자리를 적지 않는다", () => {
    // 자리는 `docs/data-schema.md` 의 「커리어 작업 폴더」 가 갖는다.
    expect(readFileSync(join(repositoryRoot, "career-os", "AGENTS.md"), "utf8")).not.toContain("library/profiles/");
  });

  test("resume-preparer 는 candidate-context.md 를 두고 brain-context.md 를 두지 않는다", () => {
    const references = join(skillDirectory("resume-preparer"), "references");
    expect(existsSync(join(references, "candidate-context.md"))).toBe(true);
    expect(existsSync(join(references, "brain-context.md"))).toBe(false);
  });
});
