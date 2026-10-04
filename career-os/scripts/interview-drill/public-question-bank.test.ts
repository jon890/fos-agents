import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publicBehavioralQuestions, publicTechQuestions } from "./public-question-bank.ts";

describe("public-question-bank", () => {
  test("기술 질문은 정해진 카테고리 순서로 이어 붙는다", () => {
    const categories: string[] = [];
    for (const question of publicTechQuestions) {
      if (!categories.includes(question.category)) categories.push(question.category);
    }
    expect(categories).toEqual([
      "java-spring",
      "database",
      "cs",
      "operations",
      "system-design",
      "ai-platform",
    ]);
  });

  test("인성 질문은 비어 있지 않고 모두 behavioral 카테고리다", () => {
    expect(publicBehavioralQuestions.length).toBeGreaterThan(0);
    for (const question of publicBehavioralQuestions) {
      expect(question.category).toBe("behavioral");
    }
  });

  test("모듈 소스가 파일 시스템, zod, import.meta 에 기대지 않는다", () => {
    const source = readFileSync(join(import.meta.dir, "public-question-bank.ts"), "utf8");
    for (const forbidden of ["node:fs", "readFileSync", '"zod"', "import.meta"]) {
      expect(source.includes(forbidden), `소스에 ${forbidden} 가 있다`).toBe(false);
    }
  });

  test("번들해 다른 디렉터리에서 실행해도 같은 개수를 읽는다", async () => {
    const directory = mkdtempSync(join(tmpdir(), "public-bank-"));
    try {
      const entry = join(directory, "entry.ts");
      const modulePath = join(import.meta.dir, "public-question-bank.ts");
      await Bun.write(
        entry,
        `import { publicTechQuestions, publicBehavioralQuestions } from ${JSON.stringify(modulePath)};\nconsole.log(publicTechQuestions.length, publicBehavioralQuestions.length);\n`,
      );
      const built = await Bun.build({
        entrypoints: [entry],
        target: "bun",
        outdir: join(directory, "out"),
      });
      expect(built.success).toBe(true);
      const run = Bun.spawnSync(["bun", join(directory, "out", "entry.js")], { cwd: tmpdir() });
      expect(run.exitCode).toBe(0);
      expect(run.stdout.toString().trim()).toBe(
        `${publicTechQuestions.length} ${publicBehavioralQuestions.length}`,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
