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

function markdownLinkTargets(document: string): string[] {
  return [...document.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)].map(([, target]) => {
    if (target.startsWith("<") && target.endsWith(">")) {
      return target.slice(1, -1);
    }

    return target;
  });
}

function codePathReferences(document: string): string[] {
  const codeSections = [
    ...[...document.matchAll(/`([^`\n]+)`/g)].map(([, code]) => code),
    ...[...document.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(([, code]) => code),
  ];

  return codeSections.flatMap((section) =>
    [...section.matchAll(/(?:career-os|\.agents)\/[A-Za-z0-9_./<>-]+|(?:\.\.\/|\.\/|references\/|docs\/|sources\/)[A-Za-z0-9_./<>-]+/g)].map(
      ([path]) => path,
    ),
  );
}

function pathWithoutQueryOrFragment(path: string): string {
  return path.split(/[?#]/, 1)[0];
}

function isExternalUrl(path: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path);
}

function validatePathReference(reference: string, documentPath: string, requireRootPrefix: boolean): void {
  if (reference.startsWith("#") || isExternalUrl(reference)) {
    return;
  }

  const path = pathWithoutQueryOrFragment(reference);
  expect(path, `${documentPath}에 상대 경로가 남아 있습니다.`).not.toMatch(
    /^(?:\.\.\/|\.\/|references\/|docs\/|sources\/)/,
  );

  if (/<[^>]+>/.test(path)) {
    return;
  }

  if (requireRootPrefix) {
    expect(path, `${documentPath}의 로컬 Markdown 링크는 저장소 루트 경로여야 합니다.`).toMatch(
      /^(?:career-os|\.agents)\//,
    );
  }

  if (
    existenceExceptions.has(path) ||
    existenceExceptionPrefixes.some((exceptionPath) => path.startsWith(exceptionPath))
  ) {
    return;
  }

  expect(existsSync(resolve(repositoryRoot, path)), `${documentPath}의 ${path} 경로가 없습니다.`).toBe(true);
}

function validatePathReferences(document: string, documentPath: string): void {
  for (const reference of unique(markdownLinkTargets(document))) {
    validatePathReference(reference, documentPath, true);
  }

  for (const reference of unique(codePathReferences(document))) {
    validatePathReference(reference, documentPath, false);
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

test("존재하지 않는 로컬 Markdown 링크는 상대 표기와 관계없이 실패한다", () => {
  for (const path of ["missing.md", "./missing.md"]) {
    expect(() => validatePathReferences(`[누락](${path})`, "fixture.md")).toThrow();
  }
});

test("실제 파일을 가리키더라도 상대 Markdown 링크를 허용하지 않는다", () => {
  expect(() => validatePathReferences("[루트 README](README.md)", "fixture.md")).toThrow(
    "로컬 Markdown 링크는 저장소 루트 경로여야 합니다.",
  );
});

test("자리표시자가 있어도 상대 Markdown 링크를 허용하지 않는다", () => {
  expect(() => validatePathReferences("[실행 파일](references/<RUN_DIR>/output.json)", "fixture.md")).toThrow(
    "상대 경로가 남아 있습니다.",
  );
});

test("외부 URL과 문서 내부 anchor는 존재 검사에서 제외한다", () => {
  expect(() => validatePathReferences("[외부](https://example.com/missing.md) [절](#missing)", "fixture.md")).not.toThrow();
});

test("Markdown 링크의 query와 fragment를 제외한 파일 경로를 검사한다", () => {
  expect(() =>
    validatePathReferences("[공통 흐름](career-os/docs/flow.md?view=raw#common)", "fixture.md"),
  ).not.toThrow();
});

test("경로는 Markdown 링크와 코드 영역에서만 검사한다", () => {
  expect(() =>
    validatePathReferences(
      [
        "[검사 파일](career-os/scripts/lib/skill_doc_paths.test.ts)",
        "`career-os/scripts/lib/skill_doc_paths.test.ts`",
        "```bash\ncareer-os/scripts/lib/skill_doc_paths.test.ts\n```",
        "career-os/not-a-real-static-file.md",
      ].join("\n"),
      "fixture.md",
    ),
  ).not.toThrow();
});

test("코드 블록 안의 존재하지 않는 정적 경로는 실패한다", () => {
  expect(() =>
    validatePathReferences("```bash\ncareer-os/not-a-real-static-file.md\n```", "fixture.md"),
  ).toThrow("career-os/not-a-real-static-file.md 경로가 없습니다.");
});

test("코드 경로도 현재 디렉터리 상대 경로를 허용하지 않는다", () => {
  expect(() => validatePathReferences("`./README.md`", "fixture.md")).toThrow("상대 경로가 남아 있습니다.");
});

test("일반 자리표시자가 든 경로는 존재 검사에서 제외한다", () => {
  expect(() =>
    validatePathReferences(
      "[실행 파일](<RUN_DIR>/output.json) `career-os/<WORKSPACE>/result.json` ```bash\ncareer-os/<RUN_DIR>/result.json\n```",
      "fixture.md",
    ),
  ).not.toThrow();
});
