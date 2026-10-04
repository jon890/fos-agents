import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const repositoryRoot = dirname(dirname(dirname(import.meta.dir)));
const skillsRoot = join(repositoryRoot, "career-os", ".claude", "skills");
const candidateContextSkills = ["position-recommender", "resume-preparer", "sync-profile", "interview-practice", "study-topic-recommender", "application-package-writer"];
const removedTerms = ["brain-search", "brain-add", "private brain"];

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

describe("후보자 맥락 스킬 경계", () => {
  for (const skill of candidateContextSkills) {
    test(`${skill} 은 개인 brain 조회와 저장 안내를 담지 않는다`, () => {
      const files = filesUnder(join(skillsRoot, skill));
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

  test("application-package-writer 는 공통 프로필을 CLI 로 읽게 한다", () => {
    const text = readFileSync(join(skillsRoot, "application-package-writer", "SKILL.md"), "utf8");
    expect(text).toContain("bun --env-file=career-os/.env career-os/scripts/application-profile/read_application_profile.ts get --out");
  });

  test("resume-preparer 는 candidate-context.md 를 두고 brain-context.md 를 두지 않는다", () => {
    const references = join(skillsRoot, "resume-preparer", "references");
    expect(existsSync(join(references, "candidate-context.md"))).toBe(true);
    expect(existsSync(join(references, "brain-context.md"))).toBe(false);
  });
});
