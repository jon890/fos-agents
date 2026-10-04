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

test("Claude Code 전용 스킬이 여섯 있다", () => {
  expect(skills.sort()).toEqual([
    "application-package-writer",
    "interview-question-prep",
    "position-recommender",
    "resume-preparer",
    "study-collection",
    "sync-profile",
  ]);
});

describe("application-package-writer", () => {
  const directory = join(skillsDirectory, "application-package-writer");
  const references = [
    "application-quality-rubric.md",
    "candidate-interview-questions.md",
    "evidence-source-freshness.md",
    "fit-judgment.md",
    "full-document-review.md",
    "growth-judgment.md",
  ];

  test("본문이 실행기의 package, application-profile, workspace 명령을 모두 적는다", () => {
    const body = readFileSync(join(directory, "SKILL.md"), "utf8");
    for (const command of [
      "<CAREER_LOCAL> package check-sources",
      "<CAREER_LOCAL> package validate",
      "<CAREER_LOCAL> package render",
      "<CAREER_LOCAL> package question-schema",
      "<CAREER_LOCAL> application-profile get --out",
      "workspace begin application-package-writer",
      "workspace finish application-package-writer",
    ])
      expect(body, command).toContain(command);
  });

  test("저장소 스크립트와 저장소 경로, 개인 brain 안내가 없다", () => {
    for (const file of markdownFilesUnder(directory)) {
      const text = readFileSync(file, "utf8");
      for (const banned of [
        "brain-search",
        "brain-add",
        "private brain",
        "manage_candidate_context.ts",
        "read_application_profile.ts",
        "sources/fos-study",
        "PERSONAL_ROOT",
      ])
        expect(text.includes(banned), `${file} 에 ${banned}`).toBe(false);
    }
  });

  test("plugin 밖을 가리키는 ](../ 링크가 없다", () => {
    for (const file of markdownFilesUnder(directory))
      expect(readFileSync(file, "utf8").includes("](../"), file).toBe(false);
  });

  test("근거 원본 최신화 문서가 실행기 명령, 위치 환경 변수, 공통 프로필 절을 담는다", () => {
    const text = readFileSync(join(directory, "references", "evidence-source-freshness.md"), "utf8");
    for (const expected of ["package check-sources", "CAREER_EVIDENCE_DIR", "## 지원서 공통 프로필을 경로로 확인하지 않는 이유"])
      expect(text, expected).toContain(expected);
  });

  test("references 여섯이 모두 있고 각각 본문이나 다른 reference 가 한 번 이상 가리킨다", () => {
    const texts = Object.fromEntries(
      ["SKILL.md", ...references.map((file) => join("references", file))].map((file) => [file, readFileSync(join(directory, file), "utf8")]),
    );
    for (const reference of references) {
      expect(existsSync(join(directory, "references", reference)), `${reference} 가 없다`).toBe(true);
      const referrers = Object.entries(texts).filter(
        ([file, text]) => file !== join("references", reference) && (text.includes(`references/${reference}`) || text.includes(`](${reference})`)),
      );
      expect(referrers.length, `${reference} 를 가리키는 문서가 없다`).toBeGreaterThan(0);
    }
  });

  test("evals.json 이 올바른 JSON 이고 /Users/ 경로가 없다", () => {
    const text = readFileSync(join(directory, "evals", "evals.json"), "utf8");
    const strings: string[] = [];
    const collect = (value: unknown): void => {
      if (typeof value === "string") strings.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") Object.values(value).forEach(collect);
    };
    collect(JSON.parse(text));
    expect(strings.length).toBeGreaterThan(0);
    for (const value of strings) expect(value.includes("/Users/"), value).toBe(false);
  });
});

describe("position-recommender", () => {
  const directory = join(skillsDirectory, "position-recommender");

  test("본문이 실행기의 position 하위 명령을 모두 적는다", () => {
    const body = readFileSync(join(directory, "SKILL.md"), "utf8");
    for (const command of ["<CAREER_LOCAL> position collect", "commit-company-tiers", "commit-analyses", "finalize", "cleanup"])
      expect(body, command).toContain(command);
  });

  test("brain-search, brain-add, private brain 이 없다", () => {
    // skill_boundary.test.ts 는 저장소 사본을 먼저 찾으므로 plugin 사본은 여기서 검사한다.
    for (const file of markdownFilesUnder(directory)) {
      const text = readFileSync(file, "utf8");
      for (const banned of ["brain-search", "brain-add", "private brain"])
        expect(text.includes(banned), `${file} 에 ${banned}`).toBe(false);
    }
  });

  // 저장소 사본(.claude/skills/position-recommender)을 지울 때 이 단언도 함께 지운다.
  test("references 의 판정 기준과 실패 처리가 저장소 사본과 바이트 단위로 같다", () => {
    const repoReferences = join(import.meta.dir, "..", "..", ".claude", "skills", "position-recommender", "references");
    for (const file of ["judgment.md", "failures.md"]) {
      const original = join(repoReferences, file);
      expect(existsSync(original), `${original} 가 없다`).toBe(true);
      expect(readFileSync(join(directory, "references", file)).equals(readFileSync(original)), file).toBe(true);
    }
  });
});

describe("resume-preparer", () => {
  const directory = join(skillsDirectory, "resume-preparer");

  test("plugin 밖을 가리키는 ](../ 링크가 없다", () => {
    for (const file of markdownFilesUnder(directory))
      expect(readFileSync(file, "utf8").includes("](../"), file).toBe(false);
  });

  test("본문이 실행기의 resume 하위 명령과 작업본 시작 명령을 적는다", () => {
    const body = readFileSync(join(directory, "SKILL.md"), "utf8");
    for (const command of [
      "<CAREER_LOCAL> resume export",
      "validate-ledger",
      "assess-reuse",
      "promote-claims",
      "build-bundle",
      "validate-bundle",
      "workspace begin resume-preparer",
    ])
      expect(body, command).toContain(command);
  });

  test("brain-search, brain-add, private brain, manage_candidate_context.ts 가 없다", () => {
    for (const file of markdownFilesUnder(directory)) {
      const text = readFileSync(file, "utf8");
      for (const banned of ["brain-search", "brain-add", "private brain", "manage_candidate_context.ts"])
        expect(text.includes(banned), `${file} 에 ${banned}`).toBe(false);
    }
  });

  // 저장소 사본(.claude/skills/resume-preparer)을 지울 때 이 단언도 함께 지운다.
  test("기준 문서 다섯이 저장소 사본과 바이트 단위로 같다", () => {
    const repoReferences = join(import.meta.dir, "..", "..", ".claude", "skills", "resume-preparer", "references");
    for (const file of ["claim-model.md", "hard-review.md", "resume-taste.md", "resume-writing-style.md", "scoring-rubric.md"]) {
      const original = join(repoReferences, file);
      expect(existsSync(original), `${original} 가 없다`).toBe(true);
      expect(readFileSync(join(directory, "references", file)).equals(readFileSync(original)), file).toBe(true);
    }
  });
});

describe("sync-profile", () => {
  const directory = join(skillsDirectory, "sync-profile");
  const allFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? allFiles(join(dir, entry.name)) : [join(dir, entry.name)],
    );

  test("brain-search, brain-add, private brain, manage_profile.ts, ~/.claude/scripts 가 없다", () => {
    for (const file of allFiles(directory)) {
      const text = readFileSync(file, "utf8");
      for (const banned of ["brain-search", "brain-add", "private brain", "manage_profile.ts", "~/.claude/scripts"])
        expect(text.includes(banned), `${file} 에 ${banned}`).toBe(false);
    }
  });

  test("resume-preparer 의 판정 모델 링크 말고는 ](../ 링크가 없다", () => {
    for (const file of markdownFilesUnder(directory)) {
      const text = readFileSync(file, "utf8").replaceAll("](../resume-preparer/references/claim-model.md)", "");
      expect(text.includes("](../"), file).toBe(false);
    }
  });
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
      const links = [...body.matchAll(/(?:\]\(|`)references\/([A-Za-z0-9._-]+\.md)/g)].map((match) => match[1]!);
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) expect(existsSync(join(directory, "references", link)), link).toBe(true);
    });
  });
}
