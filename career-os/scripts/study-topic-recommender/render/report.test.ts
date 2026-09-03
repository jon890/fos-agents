import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeReportArtifacts } from "./report.js";
import { morningReadingReportFixture } from "./test_fixture.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("아침 읽을거리 산출물", () => {
  test("실행 경로 바로 아래에 주제 중심 Markdown과 HTML을 만든다", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    temporaryDirectories.push(outputDir);
    const artifacts = writeReportArtifacts({ report: morningReadingReportFixture, outputDir });
    expect(artifacts.markdownPath).toBe(join(outputDir, "morning-reading.md"));
    expect(artifacts.htmlPath).toBe(join(outputDir, "morning-reading-2026-08-12.html"));
    expect(readFileSync(artifacts.markdownPath, "utf8")).toContain("운영 가능한 AI 제품");
    expect(readFileSync(artifacts.htmlPath, "utf8")).toContain("운영 가능한 AI 제품");
    expect(existsSync(join(outputDir, "reports"))).toBe(false);
  });
});
