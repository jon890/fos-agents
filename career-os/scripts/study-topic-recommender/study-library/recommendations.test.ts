import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { MorningReadingReport, ReadingCandidatePool } from "../reading_contracts.js";
import { main } from "../morning_reading_cli.js";
import { writeReportArtifacts } from "../render/report.js";
import type { StudyLibraryFetch } from "./client.js";
import {
  publicationIdempotencyKey,
  toRecommendationRunPayload,
} from "./recommendations.js";
import type { StudyLibraryCandidateMeta } from "./candidates.js";

const originalArgv = process.argv;
const originalFetch = globalThis.fetch;
const originalLog = console.log;
const temporaryDirectories: string[] = [];

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function runDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "study-topic-recommender."));
  temporaryDirectories.push(directory);
  return directory;
}

async function runCli(args: string[], fetchImpl?: StudyLibraryFetch): Promise<string[]> {
  const logs: string[] = [];
  process.argv = ["bun", "morning_reading_cli.ts", ...args];
  console.log = (message?: unknown) => {
    logs.push(String(message));
  };
  if (fetchImpl) {
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    process.env.STUDY_LIBRARY_URL = "https://study.example.com";
    process.env.STUDY_SERVICE_TOKEN = "test-token-123456789012345678901234567890";
  }
  await main();
  return logs;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function candidatePool(previouslyRecommended = false): ReadingCandidatePool {
  return {
    generatedAt: "2026-09-07T00:00:00.000Z",
    recentStudyTopicKeys: [],
    policy: {
      selection: "llm",
      fixedKeywordsUsed: false,
      sourcePriorityUsed: false,
      maxCandidatesPerSource: 100,
    },
    candidates: [{
      id: "content-a",
      contentKey: "content-a",
      canonicalUrl: "https://example.com/content-a",
      sourceKey: "blog-a",
      sourceName: "Blog A",
      category: "techBlog",
      title: "Title A",
      url: "https://example.com/content-a",
      published: "2026-09-07",
      kind: "page-link",
      previouslyRecommended,
    }],
    collectionLog: [],
  };
}

function meta(): StudyLibraryCandidateMeta {
  return {
    historyVersion: 19,
    filters: { limit: 100 },
    nextCursor: null,
    enabledSources: [
      { sourceKey: "blog-a", title: "Blog A", category: "techBlog" },
      { sourceKey: "video-a", title: "Video A", category: "video" },
    ],
  };
}

function selection(candidateId = "content-a") {
  return {
    topics: [{
      topicKey: "operable-ai-products",
      title: "운영 가능한 AI 제품",
      careerQuestion: "현재 서비스의 장애 복구에 어떤 판단을 적용할 수 있는가?",
      items: [{
        candidateId,
        summary: "운영 장애를 설명한다.",
        reason: "현재 운영 관점과 연결된다.",
        careerValue: "current-work",
      }],
    }],
  };
}

function emptyReport(): MorningReadingReport {
  return {
    generatedAt: "2026-09-07T15:30:00.000Z",
    sourceOfTruth: {
      config: "config/external-reading-sources.ts",
      collectedArticles: "state/reading-candidates.json",
    },
    counts: {
      activeSources: 0,
      sourcesWithCandidates: 0,
      collectedArticles: 0,
      techBlogSources: 0,
      geekSources: 0,
      aiSources: 0,
      videoSources: 0,
    },
    collectionLog: [],
    topics: [],
  };
}

afterEach(() => {
  process.argv = originalArgv;
  globalThis.fetch = originalFetch;
  console.log = originalLog;
  delete process.env.STUDY_LIBRARY_URL;
  delete process.env.STUDY_SERVICE_TOKEN;
  delete process.env.CAREER_OS_ROOT;
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("study-library recommendations CLI", () => {
  test("prepare-candidates 성공 출력은 최근 수집 성공으로 보이지 않는다", async () => {
    const root = runDir();
    const logs = await runCli([
      "--run-dir", root,
      "--library",
      "--prepare-candidates",
    ], async (url) => {
      const pathname = url.pathname;
      if (pathname.endsWith("/sources")) {
        return jsonResponse({ sources: [] });
      }
      if (pathname.endsWith("/candidates")) {
        return jsonResponse({
          candidates: [],
          recentStudyTopicKeys: [],
          nextCursor: null,
          historyVersion: 0,
        });
      }
      throw new Error(`unexpected request: ${url.href}`);
    });

    const output = JSON.parse(logs[0]) as Record<string, unknown>;
    expect(output.mode).toBe("prepare-candidates");
    expect(output).not.toHaveProperty("acceptedCount");
    expect(output).not.toHaveProperty("statuses");
  });

  test("HTML과 report JSON 생성 단계는 recommendation-runs 요청을 보내지 않고 history를 쓰지 않는다", async () => {
    const root = runDir();
    const poolPath = join(root, "state", "reading-candidates.json");
    const selectionPath = join(root, "selection.json");
    writeJson(poolPath, candidatePool());
    writeJson(join(root, "state", "study-library-meta.json"), meta());
    writeJson(selectionPath, selection());
    globalThis.fetch = (async () => {
      throw new Error("selection 단계에서 API를 호출하면 안 된다.");
    }) as unknown as typeof fetch;

    const logs = await runCli([
      "--run-dir", root,
      "--library",
      "--candidate-pool", poolPath,
      "--reading-selection", selectionPath,
    ]);

    const output = JSON.parse(logs[0]) as { report: string; html: string; topicCount: number; library: boolean };
    const report = JSON.parse(readFileSync(output.report, "utf8")) as MorningReadingReport;
    expect(output.library).toBe(true);
    expect(output.topicCount).toBe(1);
    expect(existsSync(output.html)).toBe(true);
    expect(report.counts).toMatchObject({
      activeSources: 2,
      sourcesWithCandidates: 1,
      collectedArticles: 1,
      techBlogSources: 1,
      videoSources: 1,
    });
    expect(report.collectionLog).toEqual([]);
    expect(existsSync(join(root, "state", "morning-study-history.json"))).toBe(false);
  });

  test("previouslyRecommended true 후보를 선택하면 기존 선택 검증이 실패한다", async () => {
    const root = runDir();
    const poolPath = join(root, "state", "reading-candidates.json");
    const selectionPath = join(root, "selection.json");
    writeJson(poolPath, candidatePool(true));
    writeJson(join(root, "state", "study-library-meta.json"), meta());
    writeJson(selectionPath, selection());

    await expect(runCli([
      "--run-dir", root,
      "--library",
      "--candidate-pool", poolPath,
      "--reading-selection", selectionPath,
    ])).rejects.toThrow("이미 추천한 candidateId: content-a");
  });

  test("validate_outputs 뒤 commit 명령은 같은 report JSON의 generatedAt으로 빈 topics 저장 요청을 보낸다", async () => {
    const root = runDir();
    const reportPath = join(root, "state", "morning-reading.json");
    writeJson(reportPath, emptyReport());
    writeReportArtifacts({ report: emptyReport(), outputDir: root });
    // 경로를 이 파일 기준으로 푼다. 저장소 루트에서만 맞는 상대 경로였다.
    const validation = spawnSync("bun", [
      resolve(import.meta.dir, "../validate_outputs.ts"),
      "--run-dir",
      root,
    ], { encoding: "utf8" });
    expect(validation.status).toBe(0);

    const bodies: unknown[] = [];
    const logs = await runCli([
      "--run-dir", root,
      "--library",
      "--commit-recommendation",
      "--report", reportPath,
    ], async (url, init) => {
      expect(url.pathname).toBe("/api/study/v1/recommendation-runs");
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      bodies.push(body);
      return jsonResponse({ reportId: body.reportId, historyVersion: 20 });
    });

    expect(bodies[0]).toEqual({
      reportId: "morning-2026-09-08",
      generatedAt: "2026-09-07T15:30:00.000Z",
      topics: [],
    });
    expect(bodies[0]).not.toHaveProperty("historyVersion");
    expect(JSON.parse(logs[0])).toMatchObject({
      mode: "commit-recommendation",
      library: true,
      reportId: "morning-2026-09-08",
      historyVersion: 20,
    });
  });

  test("publication idempotencyKey는 접두사와 고정 순서 JSON SHA-256으로 만들고 CLI 재시도에서 같다", async () => {
    const expected = publicationIdempotencyKey({
      reportId: "morning-2026-09-08",
      channel: "cloudflare-pages",
      publishedAt: "2026-09-08T00:00:00.000Z",
      externalId: "deploy-1",
      url: "https://pages.example.com/report",
    });
    expect(expected).toMatch(/^publication:[a-f0-9]{64}$/);

    const root = runDir();
    const bodies: Array<{ idempotencyKey: string }> = [];
    const args = [
      "--run-dir", root,
      "--library",
      "--record-publication",
      "--report-id", "morning-2026-09-08",
      "--channel", "cloudflare-pages",
      "--external-id", "deploy-1",
      "--published-at", "2026-09-08T00:00:00.000Z",
      "--url", "https://pages.example.com/report",
    ];
    const fetchImpl: StudyLibraryFetch = async (_url, init) => {
      bodies.push(JSON.parse(String(init.body)) as { idempotencyKey: string });
      return jsonResponse({ publicationId: "pub-1" });
    };

    await runCli(args, fetchImpl);
    await runCli(args, fetchImpl);

    expect(bodies.map((body) => body.idempotencyKey)).toEqual([expected, expected]);
  });

  test("추천 저장 409 ALREADY_RECOMMENDED와 RECENT_TOPIC_CONFLICT는 완료 JSON을 출력하지 않는다", async () => {
    for (const code of ["ALREADY_RECOMMENDED", "RECENT_TOPIC_CONFLICT"]) {
      const root = runDir();
      const reportPath = join(root, "state", "morning-reading.json");
      writeJson(reportPath, emptyReport());
      const logs: string[] = [];
      process.argv = [
        "bun",
        "morning_reading_cli.ts",
        "--run-dir", root,
        "--library",
        "--commit-recommendation",
        "--report", reportPath,
      ];
      console.log = (message?: unknown) => logs.push(String(message));
      process.env.STUDY_LIBRARY_URL = "https://study.example.com";
      process.env.STUDY_SERVICE_TOKEN = "test-token-123456789012345678901234567890";
      globalThis.fetch = (async () => jsonResponse({
        error: { code, message: "conflict", requestId: `req-${code}` },
      }, { status: 409 })) as unknown as typeof fetch;

      await expect(main()).rejects.toMatchObject({ status: 409, code });
      expect(logs).toEqual([]);
    }
  });
});

describe("study-library recommendation payload", () => {
  test("기존 MorningReadingReport를 recommendation-runs payload로 변환한다", () => {
    const report = emptyReport();
    const payload = toRecommendationRunPayload(report);

    expect(payload).toEqual({
      reportId: "morning-2026-09-08",
      generatedAt: report.generatedAt,
      topics: [],
    });
  });
});
