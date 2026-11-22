import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { MorningReadingReport, ReadingCandidatePool } from "../reading_contracts.js";
import { main } from "../morning_reading_cli.js";
import { writeReportArtifacts } from "../render/report.js";
import { contextVersion } from "../../lib/career-store/context.ts";
import { openCareerStore } from "../../lib/career-store/database.ts";
import { restoreCareerWorkspaceEnv, useCareerWorkspaceEnv } from "../../lib/career-store/test-support.ts";
import { StudyLibraryClient } from "./client.js";
import {
  publicationIdempotencyKey,
  toRecommendationRunPayload,
} from "./recommendations.js";
import type { StudyLibraryCandidateMeta } from "./candidates.js";
import { SUBPROCESS_TEST_TIMEOUT_MS } from "../../lib/test-timeouts.ts";

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

const INTERESTS = "예시 관심사 문장";
const CONTEXT_VERSION = contextVersion("learning-interests", INTERESTS);

/** 임시 작업 폴더에 learning-interests 문서와 소스 하나, 자료 둘(content-a, content-b)을 넣는다. */
async function seededWorkspace(): Promise<StudyLibraryClient> {
  useCareerWorkspaceEnv({ "learning-interests": INTERESTS });
  const client = new StudyLibraryClient();
  await client.putSource("blog-a", { title: "Blog A", category: "techBlog", adapter: "page", url: "https://example.com", feedUrl: null, enabled: true, note: null, expectedVersion: 0 });
  await client.createIngestion({
    sourceKey: "blog-a",
    mode: "recent",
    items: ["content-a", "content-b"].map((key) => ({
      contentKey: key,
      canonicalUrl: `https://example.com/${key}`,
      url: `https://example.com/${key}`,
      title: `Title ${key}`,
      published: "2026-09-07",
      publishedAt: "2026-09-07T00:00:00.000Z",
      excerpt: null,
      kind: "page-link",
      tags: [],
      collectedAt: "2026-09-07T00:00:00.000Z",
    })),
    cursor: null,
    expectedCursorVersion: 0,
    idempotencyKey: "seed-ingestion",
  });
  return client;
}

async function runCli(args: string[]): Promise<string[]> {
  const logs: string[] = [];
  process.argv = ["bun", "morning_reading_cli.ts", ...args];
  console.log = (message?: unknown) => {
    logs.push(String(message));
  };
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
    candidateContextVersion: CONTEXT_VERSION,
    learningInterests: { version: CONTEXT_VERSION, body: INTERESTS },
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
      sources: "store:study_sources",
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
  delete process.env.CAREER_OS_ROOT;
  restoreCareerWorkspaceEnv();
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("study-library recommendations CLI", () => {
  test("prepare-candidates 성공 출력은 최근 수집 성공으로 보이지 않는다", async () => {
    await seededWorkspace();
    const root = runDir();
    const logs = await runCli(["--run-dir", root, "--prepare-candidates"]);

    const output = JSON.parse(logs[0]) as Record<string, unknown>;
    expect(output.mode).toBe("prepare-candidates");
    expect(output).not.toHaveProperty("acceptedCount");
    expect(output).not.toHaveProperty("statuses");
    const stored = JSON.parse(readFileSync(join(root, "state", "study-library-meta.json"), "utf8")) as StudyLibraryCandidateMeta;
    expect(stored.candidateContextVersion).toBe(CONTEXT_VERSION);
    expect(stored.learningInterests).toEqual({ version: CONTEXT_VERSION, body: INTERESTS });
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
      "--candidate-pool", poolPath,
      "--reading-selection", selectionPath,
    ]);

    const output = JSON.parse(logs[0]) as { report: string; htmlPath: string; topicCount: number; mode: string };
    const report = JSON.parse(readFileSync(output.report, "utf8")) as MorningReadingReport;
    expect(output.mode).toBe("reading-selection");
    expect(existsSync(output.htmlPath)).toBe(true);
    expect(report.counts).toMatchObject({
      activeSources: 2,
      sourcesWithCandidates: 1,
      collectedArticles: 1,
      techBlogSources: 1,
      videoSources: 1,
    });
    expect(report.topics).toHaveLength(1);
    expect(report.collectionLog).toEqual([]);
    expect(existsSync(join(root, "state", "morning-study-history.json"))).toBe(false);
  });

  test("선택의 제외 판정은 sidecar를 거쳐 저장소의 판정으로 남는다", async () => {
    const client = await seededWorkspace();
    const root = runDir();
    const poolPath = join(root, "state", "reading-candidates.json");
    const selectionPath = join(root, "selection.json");
    const pool = candidatePool();
    pool.candidates.push({
      ...pool.candidates[0],
      id: "content-b",
      contentKey: "content-b",
      canonicalUrl: "https://example.com/content-b",
      url: "https://example.com/content-b",
      title: "Title B",
    });
    writeJson(poolPath, pool);
    writeJson(join(root, "state", "study-library-meta.json"), meta());
    writeJson(selectionPath, {
      ...selection(),
      rejections: [{ candidateId: "content-b", reason: "이번 주제와 겹친다." }],
    });

    await runCli([
      "--run-dir", root,
      "--candidate-pool", poolPath,
      "--reading-selection", selectionPath,
    ]);

    const reportPath = join(root, "state", "morning-reading.json");
    const sidecar = JSON.parse(readFileSync(join(root, "state", "recommendation-request.json"), "utf8"));
    expect(sidecar).toMatchObject({
      candidateContextVersion: CONTEXT_VERSION,
      rejections: [{ candidateId: "content-b", reason: "이번 주제와 겹친다." }],
    });

    const logs = await runCli(["--run-dir", root, "--commit-recommendation", "--report", reportPath]);
    // 선택 단계가 지금 시각으로 리포트를 만든다. reportId 는 그 서울 날짜다.
    const reportId = (JSON.parse(readFileSync(join(root, "state", "recommendation-request.json"), "utf8")) as { reportId: string }).reportId;
    expect(JSON.parse(logs.at(-1)!)).toMatchObject({ reportId, historyVersion: 1 });

    const db = openCareerStore();
    expect(db.all("SELECT content_key, candidate_context_version, verdict, reason FROM study_material_verdicts")).toEqual([
      { content_key: "content-b", candidate_context_version: CONTEXT_VERSION, verdict: "rejected", reason: "이번 주제와 겹친다." },
    ]);
    // 고른 자료와 제외한 자료는 다음 후보에서 빠진다.
    expect((await client.getCandidates()).candidates).toEqual([]);
    // 리포트 사본이 작업 폴더 reports/ 에 날짜가 든 이름으로 남는다.
    const copy = (JSON.parse(logs.at(-1)!) as { reportCopy: string }).reportCopy;
    expect(copy).toEndWith(`/reports/${reportId.slice("morning-".length)}-study.html`);
    expect(existsSync(copy)).toBe(true);
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
      "--candidate-pool", poolPath,
      "--reading-selection", selectionPath,
    ])).rejects.toThrow("이미 추천한 candidateId: content-a");
  });

  test("validate_outputs 뒤 commit 명령은 같은 report JSON의 generatedAt으로 빈 topics 추천을 저장한다", async () => {
    const client = await seededWorkspace();
    const root = runDir();
    const reportPath = join(root, "state", "morning-reading.json");
    writeJson(reportPath, emptyReport());
    writeJson(join(root, "state", "recommendation-request.json"), {
      reportId: "morning-2026-09-08",
      generatedAt: "2026-09-07T15:30:00.000Z",
      candidateContextVersion: CONTEXT_VERSION,
      rejections: [],
    });
    writeReportArtifacts({ report: emptyReport(), outputDir: root });
    // 경로를 이 파일 기준으로 푼다. 저장소 루트에서만 맞는 상대 경로였다.
    const validation = spawnSync(process.execPath, [
      resolve(import.meta.dir, "../validate_outputs.ts"),
      "--run-dir",
      root,
    ], { encoding: "utf8" });
    expect(validation.status).toBe(0);

    const logs = await runCli(["--run-dir", root, "--commit-recommendation", "--report", reportPath]);

    expect(JSON.parse(logs[0])).toMatchObject({ reportId: "morning-2026-09-08", historyVersion: 1 });
    expect((await client.listRecommendationRuns()).runs).toEqual([
      { reportId: "morning-2026-09-08", generatedAt: "2026-09-07T15:30:00.000Z", publications: [], topics: [] },
    ]);
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("publication idempotencyKey는 접두사와 고정 순서 JSON SHA-256으로 만들고 CLI 재시도는 한 번만 기록한다", async () => {
    const expected = publicationIdempotencyKey({
      reportId: "morning-2026-09-08",
      channel: "cloudflare-pages",
      publishedAt: "2026-09-08T00:00:00.000Z",
      externalId: "deploy-1",
      url: "https://pages.example.com/report",
    });
    expect(expected).toMatch(/^publication:[a-f0-9]{64}$/);

    const client = await seededWorkspace();
    await client.createRecommendationRun({ reportId: "morning-2026-09-08", generatedAt: "2026-09-07T15:30:00.000Z", candidateContextVersion: CONTEXT_VERSION, rejections: [], topics: [] });
    const root = runDir();
    const args = [
      "--run-dir", root,
      "--record-publication",
      "--report-id", "morning-2026-09-08",
      "--channel", "cloudflare-pages",
      "--external-id", "deploy-1",
      "--published-at", "2026-09-08T00:00:00.000Z",
      "--url", "https://pages.example.com/report",
    ];

    const first = await runCli(args);
    const second = await runCli(args);

    expect(second).toEqual(first);
    const db = openCareerStore();
    expect(db.all("SELECT idempotency_key FROM request_receipts WHERE idempotency_key LIKE 'publication:%'")).toEqual([{ idempotency_key: expected }]);
    // 다음 실행에서 게시 기록이 보인다.
    const listed = await runCli(["--list-recommendations"]);
    expect((JSON.parse(listed[0]) as { runs: Array<{ publications: unknown[] }> }).runs[0]!.publications).toEqual([
      { channel: "cloudflare-pages", url: "https://pages.example.com/report", externalId: "deploy-1", publishedAt: "2026-09-08T00:00:00.000Z" },
    ]);
  });

  test("같은 날의 두 번째 추천 저장은 충돌로 끝나고 완료 JSON을 출력하지 않는다", async () => {
    await seededWorkspace();
    const root = runDir();
    const reportPath = join(root, "state", "morning-reading.json");
    writeJson(reportPath, emptyReport());
    const sidecar = { reportId: "morning-2026-09-08", generatedAt: "2026-09-07T15:30:00.000Z", candidateContextVersion: CONTEXT_VERSION, rejections: [] };
    writeJson(join(root, "state", "recommendation-request.json"), sidecar);
    const args = ["--run-dir", root, "--commit-recommendation", "--report", reportPath];
    await runCli(args);

    // 같은 서울 날짜에 다시 만든 리포트다. reportId 가 같아 저장되지 않는다.
    const later = { ...emptyReport(), generatedAt: "2026-09-07T16:00:00.000Z" };
    writeJson(reportPath, later);
    writeJson(join(root, "state", "recommendation-request.json"), { ...sidecar, generatedAt: later.generatedAt });
    const logs: string[] = [];
    process.argv = ["bun", "morning_reading_cli.ts", ...args];
    console.log = (message?: unknown) => logs.push(String(message));
    await expect(main()).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
    expect(logs).toEqual([]);

    // 기준 버전이 바뀐 뒤의 저장도 충돌이다.
    writeJson(join(root, "state", "recommendation-request.json"), { ...sidecar, generatedAt: later.generatedAt, candidateContextVersion: "learning-interests:sha256:old" });
    await expect(main()).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
  });

  test("sidecar가 없거나 리포트와 다르면 저장하기 전에 중단한다", async () => {
    const client = await seededWorkspace();
    const root = runDir();
    const reportPath = join(root, "state", "morning-reading.json");
    writeJson(reportPath, emptyReport());
    const args = ["--run-dir", root, "--commit-recommendation", "--report", reportPath];

    await expect(runCli(args)).rejects.toThrow("추천 저장 요청 파일을 찾을 수 없다");

    writeJson(join(root, "state", "recommendation-request.json"), {
      reportId: "morning-2026-09-08",
      generatedAt: "2026-09-07T15:31:00.000Z",
      candidateContextVersion: CONTEXT_VERSION,
      rejections: [],
    });
    await expect(runCli(args)).rejects.toThrow("추천 저장 요청 파일이 리포트와 다르다");
    expect((await client.listRecommendationRuns()).runs).toEqual([]);
  });
});

describe("study-library recommendation payload", () => {
  test("유효한 candidateContextVersion과 함께 MorningReadingReport를 recommendation-runs payload로 변환한다", () => {
    const report = emptyReport();
    const payload = toRecommendationRunPayload(report, {
      reportId: "morning-2026-09-08",
      generatedAt: report.generatedAt,
      candidateContextVersion: "context-0",
      rejections: [],
    });

    expect(payload).toEqual({
      reportId: "morning-2026-09-08",
      generatedAt: report.generatedAt,
      candidateContextVersion: "context-0",
      rejections: [],
      topics: [],
    });
  });

  test("빈 candidateContextVersion은 payload로 변환하지 않는다", () => {
    expect(() => toRecommendationRunPayload(emptyReport(), {
      reportId: "morning-2026-09-08",
      generatedAt: "2026-09-07T15:30:00.000Z",
      candidateContextVersion: " ",
      rejections: [],
    })).toThrow("candidateContextVersion이 필요하다");
  });
});
