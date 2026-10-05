import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("비공개 작업본 동기화 절의 첫 문장에서 공부 추천을 제외한다", () => {
  const repositoryRoot = resolve(import.meta.dir, "../../..");
  const flow = readFileSync(resolve(repositoryRoot, "career-os/docs/flow.md"), "utf8");
  const sectionStart = flow.indexOf("### 비공개 작업본 동기화");
  const sectionEnd = flow.indexOf("### 커리어 Backend");
  const section = flow.slice(sectionStart, sectionEnd);
  const firstSentence = section.split("\n").find((line) => line.startsWith("plugin 의 `application-package-writer`"));

  expect(firstSentence).toBeDefined();
  expect(firstSentence).not.toContain("study-topic-recommender");
});
