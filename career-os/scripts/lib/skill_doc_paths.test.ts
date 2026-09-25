import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "../../..");
const skillDocuments = [
  "career-os/.claude/skills/position-recommender/SKILL.md",
  "career-os/.claude/skills/position-recommender/references/judgment.md",
  "career-os/.claude/skills/position-recommender/references/failures.md",
  "career-os/.claude/skills/study-topic-recommender/SKILL.md",
  "career-os/.claude/skills/study-topic-recommender/references/execution.md",
  "career-os/.claude/skills/study-topic-recommender/references/source-management.md",
] as const;
const existenceExceptions = new Set(["career-os/.env", "career-os/sources/fos-study/"]);
const existenceExceptionPrefixes = ["career-os/sources/fos-study/"];

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function collectPathReferences(document: string): string[] {
  const linkTargets = [...document.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)].map(
    ([, target]) => target.replace(/^<|>$/g, ""),
  );
  const rootPaths = [...document.matchAll(/(?:career-os|\.agents)\/[A-Za-z0-9_./-]+/g)].map(
    ([path]) => path,
  );
  const relativePaths = [...document.matchAll(/(?<![A-Za-z0-9_./-])(?:\.\.\/|references\/|docs\/|sources\/)[A-Za-z0-9_./-]+/g)].map(
    ([path]) => path,
  );

  return unique([...linkTargets, ...rootPaths, ...relativePaths]);
}

function validatePathReferences(document: string, documentPath: string): void {
  for (const path of collectPathReferences(document)) {
    expect(path, `${documentPath}에 상대 경로가 남아 있습니다.`).not.toMatch(
      /^(?:\.\.\/|references\/|docs\/|sources\/)/,
    );

    if (!/^(?:career-os|\.agents)\//.test(path) || path.includes("<RUN_DIR>")) {
      continue;
    }

    if (
      existenceExceptions.has(path) ||
      existenceExceptionPrefixes.some((exceptionPath) => path.startsWith(exceptionPath))
    ) {
      continue;
    }

    expect(existsSync(resolve(repositoryRoot, path)), `${documentPath}의 ${path} 경로가 없습니다.`).toBe(true);
  }
}

test("추천 스킬 문서의 저장소 루트 경로가 존재하고 상대 경로가 없다", () => {
  const documents = skillDocuments.map((path) => [path, readFileSync(resolve(repositoryRoot, path), "utf8")] as const);

  for (const [path, document] of documents) {
    validatePathReferences(document, path);
  }

  const combined = documents.map(([, document]) => document).join("\n");
  expect(combined).toContain("career-os/.env");
  expect(combined).toContain("career-os/sources/fos-study/");
});

test("존재하지 않는 정적 경로는 문서 경로 검사에서 실패한다", () => {
  expect(() => validatePathReferences("`career-os/not-a-real-static-file.md`", "fixture.md")).toThrow(
    "career-os/not-a-real-static-file.md 경로가 없습니다.",
  );
});
