import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 스킬 평가 사례는 비서에 복사되지 않게 스킬 디렉터리 밖에 둔다. 공개 저장소라 개인 경로가 들어가면 안 된다.
const files = [
  join(import.meta.dir, "evals", "evals.json"),
  join(import.meta.dir, "evals", "latest-results.json"),
  join(import.meta.dir, "..", "application-package", "evals", "evals.json"),
];

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}

test("스킬 평가 사례는 올바른 JSON 이고 개인 경로를 담지 않는다", () => {
  for (const file of files) {
    const strings = stringsIn(JSON.parse(readFileSync(file, "utf8")));
    expect(strings.length, file).toBeGreaterThan(0);
    for (const value of strings) expect({ file, hit: value.includes("/Users/") }).toEqual({ file, hit: false });
  }
});
