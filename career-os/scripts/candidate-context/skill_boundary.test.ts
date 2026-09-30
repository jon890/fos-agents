import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const repositoryRoot = dirname(dirname(dirname(import.meta.dir)));
const skillsRoot = join(repositoryRoot, "career-os", ".claude", "skills");
const candidateContextSkills = ["position-recommender", "resume-preparer", "sync-profile", "interview-practice", "study-topic-recommender"];
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

  test("resume-preparer 는 candidate-context.md 를 두고 brain-context.md 를 두지 않는다", () => {
    const references = join(skillsRoot, "resume-preparer", "references");
    expect(existsSync(join(references, "candidate-context.md"))).toBe(true);
    expect(existsSync(join(references, "brain-context.md"))).toBe(false);
  });
});
