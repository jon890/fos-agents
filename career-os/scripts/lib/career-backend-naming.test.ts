import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dir, "../../..");
const testFile = "career-os/scripts/lib/career-backend-naming.test.ts";
const excludedPrefixes = [
  "career-os/docs/adr/",
  "career-os/tasks/",
  "career-os/services/career-backend/test/fixtures/legacy-contract/",
] as const;

function trackedCareerFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z", "career-os"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(
      (file) =>
        file &&
        file !== testFile &&
        !excludedPrefixes.some((prefix) => file.startsWith(prefix)) &&
        statSync(resolve(repositoryRoot, file)).isFile(),
    );
}

describe("커리어 Backend 이름", () => {
  test("추적 파일에 옛 Backend 이름을 남기지 않는다", () => {
    const forbidden = ["recommendation-api", "RecommendationApi", "추천 Backend", "추천 상태 Backend", "추천 API"];

    for (const file of trackedCareerFiles()) {
      const content = readFileSync(resolve(repositoryRoot, file), "utf8");
      for (const value of forbidden) {
        expect(`${file}\n${content}`).not.toContain(value);
      }
    }
  });

  test("옛 환경값 호환은 다섯 파일에만 둔다", () => {
    const legacyEnvironmentFiles = trackedCareerFiles().filter((file) =>
      readFileSync(resolve(repositoryRoot, file), "utf8").includes("CAREER_RECOMMENDATION_"),
    );

    expect(legacyEnvironmentFiles).toEqual([
      "career-os/docs/code-architecture.md",
      "career-os/scripts/lib/career-backend-config.ts",
      "career-os/scripts/position-recommender/career-backend/client.test.ts",
      "career-os/services/career-backend/src/config/config.test.ts",
      "career-os/services/career-backend/src/config/config.ts",
    ]);
  });
});
