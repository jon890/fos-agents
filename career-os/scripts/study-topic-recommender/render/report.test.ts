import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MorningReadingReport } from "../reading_contracts.js";
import { writeReportArtifacts } from "./report.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const report: MorningReadingReport = {
  generatedAt: "2026-08-11T15:30:00.000Z",
  sourceOfTruth: {
    config: "config/external-reading-sources.ts",
    collectedArticles: "state/reading-candidates.json",
  },
  counts: {
    activeSources: 1,
    sourcesWithCandidates: 1,
    collectedArticles: 1,
    techBlogSources: 1,
    geekSources: 0,
    aiSources: 0,
    videoSources: 0,
  },
  collectionLog: [],
  recommendations: {
    techBlog: [{
      sourceKey: "official",
      sourceName: "공식 블로그",
      category: "techBlog",
      title: "운영 사례",
      url: "https://example.com/article",
      published: "2026-08-11",
      summary: "운영 사례를 설명한다.",
      reason: "현재 관심사와 연결된다.",
    }],
    geek: [],
    ai: [],
    video: [],
  },
};

describe("아침 읽을거리 산출물", () => {
  test("실행 경로 바로 아래에 Markdown과 HTML을 만든다", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
    temporaryDirectories.push(outputDir);

    const artifacts = writeReportArtifacts({ report, outputDir });

    expect(artifacts.markdownPath).toBe(join(outputDir, "morning-reading.md"));
    expect(artifacts.htmlPath).toBe(join(outputDir, "morning-reading-2026-08-12.html"));
    expect(readFileSync(artifacts.markdownPath, "utf8")).toContain("운영 사례");
    expect(readFileSync(artifacts.htmlPath, "utf8")).toContain("운영 사례");
    expect(existsSync(join(outputDir, "reports"))).toBe(false);
  });
});
