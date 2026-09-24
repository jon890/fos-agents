import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importStudyState } from "./import_study_state.ts";
import type { StudyLibraryClient } from "./study-library/client.ts";

const createdDirectories: string[] = [];

function fixtureDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "study-state-import-"));
  createdDirectories.push(directory);
  return directory;
}

function writeFixture(directory: string): { historyFile: string; sourcesFile: string } {
  const sourcesFile = join(directory, "sources.ts");
  const historyFile = join(directory, "history.json");
  const sources = [
    { key: "feed-source", title: "Feed", category: "techBlog", url: "https://example.com/feed", feedUrl: "https://example.com/feed.xml", adapter: "feed", enabled: true },
    { key: "page-source", title: "Page", category: "geek", url: "https://example.com/page", adapter: "page", enabled: true },
    { key: "youtube-source", title: "YouTube", category: "video", url: "https://youtube.com/@example", adapter: "youtube", enabled: true },
  ];
  const reports = [0, 1, 2].map((index) => ({
    reportId: `report-${index + 1}`,
    recommendedAt: `2026-09-0${index + 1}T09:00:00.000Z`,
  }));
  const entries = reports.flatMap((report, reportIndex) => Array.from({ length: 5 }, (_, entryIndex) => {
    const sourceKey = sources[(reportIndex + entryIndex) % sources.length].key;
    return {
      contentKey: `content-${reportIndex}-${entryIndex}`,
      canonicalUrl: `https://example.com/${reportIndex}/${entryIndex}`,
      sourceKey,
      category: sources.find((source) => source.key === sourceKey)!.category,
      title: `Title ${reportIndex}-${entryIndex}`,
      studyTopic: "Backend",
      studyTopicKey: "backend",
      careerValue: "current-work",
      recommendedAt: report.recommendedAt,
      reportId: report.reportId,
    };
  }));
  writeFileSync(sourcesFile, `export const externalReadingSources = ${JSON.stringify({ _meta: { purpose: "fixture", schemaVersion: 6 }, sources })};\n`);
  writeFileSync(historyFile, JSON.stringify({ schemaVersion: 1, reports, entries }));
  return { historyFile, sourcesFile };
}

class StubClient {
  ingestions: Array<Record<string, unknown>> = [];
  recommendations: Array<Record<string, unknown>> = [];
  readonly statuses = new Map<string, boolean>();
  statusCalls = 0;
  candidateCalls = 0;
  cursorCalls = 0;
  rejectCursorLookup = false;

  async getSources() { return { sources: [] }; }
  async putSource(sourceKey: string, body: Parameters<StudyLibraryClient["putSource"]>[1]) { return { source: { sourceKey, ...body, version: 1 }, version: 1 }; }
  async getRecommendationRunStatus(reportId: string) { this.statusCalls += 1; return { reportId, exists: this.statuses.get(reportId) ?? false }; }
  async getCandidates() { this.candidateCalls += 1; return { candidates: [], recentStudyTopicKeys: [], nextCursor: null, historyVersion: 0, candidateContextVersion: "context-17" }; }
  async getSourceCursor(sourceKey: string) { this.cursorCalls += 1; if (this.rejectCursorLookup) throw new Error("dry-run에서는 cursor를 읽으면 안 된다."); return { sourceKey, mode: "recent" as const, cursor: { lastSeen: [] }, version: 4 }; }
  async createIngestion(body: unknown) { this.ingestions.push(body as Record<string, unknown>); return { idempotencyKey: "ingestion", acceptedCount: 1, cursorVersion: 5 }; }
  async createRecommendationRun(body: unknown) { this.recommendations.push(body as Record<string, unknown>); return { reportId: (body as { reportId: string }).reportId, historyVersion: 1 }; }
}

afterEach(() => {
  while (createdDirectories.length > 0) rmSync(createdDirectories.pop()!, { recursive: true, force: true });
});

describe("공부 이력 이관", () => {
  test("dry-run은 지정한 소스 파일로 3개 리포트와 15개 자료를 집계하고 쓰지 않는다", async () => {
    const fixture = writeFixture(fixtureDirectory());
    const client = new StubClient();
    client.rejectCursorLookup = true;

    const result = await importStudyState(["--dry-run", "--history-file", fixture.historyFile, "--sources-file", fixture.sourcesFile], { client });

    expect(result).toEqual({ sources: 3, reports: 3, materials: 15, skipped: 0 });
    expect(client.ingestions).toEqual([]);
    expect(client.recommendations).toEqual([]);
    expect(client.cursorCalls).toBe(0);
    expect(client.statusCalls).toBe(3);
    expect(client.candidateCalls).toBe(3);
  });

  test("YouTube 자료는 feed-video로 넣고 기존 리포트는 ingestion 전에 건너뛴다", async () => {
    const fixture = writeFixture(fixtureDirectory());
    const client = new StubClient();
    client.statuses.set("report-1", true);

    const result = await importStudyState(["--commit", "--history-file", fixture.historyFile, "--sources-file", fixture.sourcesFile], { client });

    expect(result).toMatchObject({ reports: 3, materials: 10, skipped: 1 });
    expect(client.ingestions).toHaveLength(6);
    expect(client.ingestions.flatMap((payload) => payload.items as Array<{ kind: string }>).some((item) => item.kind === "feed-video")).toBe(true);
  });

  test("추천은 이력 recommendedAt과 ingestion 전에 조회한 기준 버전을 사용한다", async () => {
    const fixture = writeFixture(fixtureDirectory());
    const client = new StubClient();

    await importStudyState(["--commit", "--history-file", fixture.historyFile, "--sources-file", fixture.sourcesFile], { client });

    expect(client.recommendations.map((body) => ({ reportId: body.reportId, generatedAt: body.generatedAt, candidateContextVersion: body.candidateContextVersion }))).toEqual([
      { reportId: "report-1", generatedAt: "2026-09-01T09:00:00.000Z", candidateContextVersion: "context-17" },
      { reportId: "report-2", generatedAt: "2026-09-02T09:00:00.000Z", candidateContextVersion: "context-17" },
      { reportId: "report-3", generatedAt: "2026-09-03T09:00:00.000Z", candidateContextVersion: "context-17" },
    ]);
  });

  test("CLI dry-run은 fixture에서 리포트 3건과 자료 15건을 출력한다", async () => {
    const fixture = writeFixture(fixtureDirectory());
    const requestedPaths: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname;
        requestedPaths.push(path);
        if (path === "/api/study/v1/sources") return Response.json({ sources: [] });
        if (path.endsWith("/status")) return Response.json({ reportId: path.split("/").at(-2), exists: false });
        if (path === "/api/study/v1/candidates") return Response.json({ candidates: [], recentStudyTopicKeys: [], nextCursor: null, historyVersion: 0, candidateContextVersion: "context-17" });
        return new Response("not found", { status: 404 });
      },
    });
    try {
      const child = Bun.spawn(["bun", `${import.meta.dir}/import_study_state.ts`, "--dry-run", "--history-file", fixture.historyFile, "--sources-file", fixture.sourcesFile], {
        env: { ...process.env, CAREER_RECOMMENDATION_API_URL: `http://127.0.0.1:${server.port}`, CAREER_RECOMMENDATION_API_TOKEN: "a".repeat(32) },
        stdout: "pipe", stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);

      expect(exitCode, `${stderr}: ${requestedPaths.join(", ")}`).toBe(0);
      expect(JSON.parse(stdout)).toEqual({ sources: 3, reports: 3, materials: 15, skipped: 0 });
      expect(requestedPaths.some((path) => path.endsWith("/cursor"))).toBe(false);
    } finally {
      server.stop(true);
    }
  });
});
