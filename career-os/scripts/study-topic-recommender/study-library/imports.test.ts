import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { main } from "../morning_reading_cli.js";
import type { StudyLibraryFetch } from "./client.js";
import {
  buildImportPayload,
  canonicalJson,
  importKeyForReports,
  reportsFromPagesManifest,
} from "./imports.js";
import type { StudyLibraryImportPayload, StudyLibraryImportReport } from "./contracts.js";

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

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function history(entries: unknown[]) {
  return {
    schemaVersion: 1,
    reports: [
      { reportId: "morning-2026-09-01", recommendedAt: "2026-08-31T22:00:00.000Z" },
      { reportId: "morning-2026-09-02", recommendedAt: "2026-09-01T22:00:00.000Z" },
    ],
    entries,
  };
}

function legacyEntry(overrides: Record<string, unknown> = {}) {
  return {
    contentKey: "url:legacy-a",
    canonicalUrl: "https://example.com/legacy-a",
    sourceKey: "blog-a",
    category: "techBlog",
    title: "Legacy A",
    studyTopic: "운영 가능한 배치 처리",
    studyTopicKey: "operable-batch-processing",
    recommendedAt: "2026-08-31T22:00:00.000Z",
    reportId: "morning-2026-09-01",
    ...overrides,
  };
}

function pageReport(overrides: Partial<StudyLibraryImportReport> = {}): StudyLibraryImportReport {
  return {
    reportId: "pages-2026-09-03",
    generatedAt: "2026-09-02T22:00:00.000Z",
    topics: [{
      topicKey: "database-index-review",
      title: "인덱스 변경 전 비용을 검토하기",
      careerQuestion: null,
      items: [{
        contentKey: "url:pages-a",
        canonicalUrl: "https://example.com/pages-a",
        sourceKey: "blog-b",
        title: "Pages A",
        category: "techBlog",
        summary: null,
        reason: null,
        careerValue: null,
      }],
    }],
    ...overrides,
  };
}

function manifest(reports: unknown[]) {
  return {
    schemaVersion: 1,
    reports: reports.map((report) => ({
      ...(report as Record<string, unknown>),
      provenance: {
        sourcePageUrl: "https://pages.example.com/morning-2026-09-03",
        localHtmlPath: "/tmp/morning-2026-09-03.html",
      },
    })),
  };
}

async function runCli(args: string[], fetchImpl: StudyLibraryFetch): Promise<string[]> {
  const logs: string[] = [];
  process.argv = ["bun", "morning_reading_cli.ts", ...args];
  console.log = (message?: unknown) => logs.push(String(message));
  globalThis.fetch = fetchImpl as unknown as typeof fetch;
  process.env.STUDY_LIBRARY_URL = "https://study.example.com";
  process.env.STUDY_SERVICE_TOKEN = "test-token-123456789012345678901234567890";
  await main();
  return logs;
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

describe("study-library import payload", () => {
  test("파일 이력은 없는 summary, reason, careerValue를 null로 둔다", () => {
    const root = runDir();
    const historyPath = join(root, "state", "morning-study-history.json");
    const pagesPath = join(root, "pages.json");
    writeJson(historyPath, history([legacyEntry()]));
    writeJson(pagesPath, { schemaVersion: 1, reports: [] });

    const result = buildImportPayload({ historyFile: historyPath, pagesManifest: pagesPath });

    expect(result.errors).toEqual([]);
    expect(result.payload?.reports[0]).toEqual({
      reportId: "morning-2026-09-01",
      generatedAt: "2026-08-31T22:00:00.000Z",
      topics: [{
        topicKey: "operable-batch-processing",
        title: "운영 가능한 배치 처리",
        careerQuestion: null,
        items: [{
          contentKey: "url:legacy-a",
          canonicalUrl: "https://example.com/legacy-a",
          sourceKey: "blog-a",
          title: "Legacy A",
          category: "techBlog",
          summary: null,
          reason: null,
          careerValue: null,
        }],
      }],
    });
  });

  test("과거 report 사이에 반복된 contentKey를 이관 payload에 보존한다", () => {
    const root = runDir();
    const historyPath = join(root, "state", "morning-study-history.json");
    const pagesPath = join(root, "pages.json");
    writeJson(historyPath, history([
      legacyEntry(),
      legacyEntry({
        studyTopic: "다시 읽은 장애 복구",
        studyTopicKey: "incident-recovery-review",
        reportId: "morning-2026-09-02",
        recommendedAt: "2026-09-01T22:00:00.000Z",
      }),
    ]));
    writeJson(pagesPath, { schemaVersion: 1, reports: [] });

    const result = buildImportPayload({ historyFile: historyPath, pagesManifest: pagesPath });

    expect(result.errors).toEqual([]);
    expect(result.payload?.reports.flatMap((report) => report.topics.flatMap((topic) => topic.items)))
      .toHaveLength(2);
    expect(result.payload?.reports.map((report) => report.reportId))
      .toEqual(["morning-2026-09-01", "morning-2026-09-02"]);
  });

  test("sourceKey 또는 canonicalUrl이 없으면 추정하지 않고 변환 오류로 처리한다", () => {
    const root = runDir();
    const historyPath = join(root, "state", "morning-study-history.json");
    const pagesPath = join(root, "pages.json");
    writeJson(historyPath, history([
      legacyEntry({ sourceKey: undefined, canonicalUrl: undefined }),
    ]));
    writeJson(pagesPath, { schemaVersion: 1, reports: [] });

    const result = buildImportPayload({ historyFile: historyPath, pagesManifest: pagesPath });

    expect(result.payload).toBeUndefined();
    expect(result.errors.map((error) => error.path)).toContain("history.entries[0].canonicalUrl");
    expect(result.errors.map((error) => error.path)).toContain("history.entries[0].sourceKey");
  });

  test("Pages manifest schemaVersion 1과 provenance를 검증하고 API payload에서 제거한다", () => {
    const root = runDir();
    const pagesPath = join(root, "pages.json");
    writeJson(pagesPath, manifest([pageReport()]));

    const result = reportsFromPagesManifest(pagesPath);

    expect(result.errors).toEqual([]);
    expect(result.reports[0]).not.toHaveProperty("provenance");
    expect(result.reports[0]?.reportId).toBe("pages-2026-09-03");

    writeJson(pagesPath, {
      schemaVersion: 1,
      reports: [{ ...pageReport(), provenance: { sourcePageUrl: "http://pages.example.com/report" } }],
    });
    expect(reportsFromPagesManifest(pagesPath).errors[0]?.path).toContain("provenance.sourcePageUrl");
  });

  test("importKey는 canonical JSON reports SHA-256으로 만들고 null 보존값 변경을 반영한다", () => {
    const reports = [pageReport()];
    const expected = `import:${createHash("sha256").update(canonicalJson(reports), "utf8").digest("hex")}`;

    expect(importKeyForReports(reports)).toBe(expected);
    expect(importKeyForReports(reports)).toBe(expected);

    const changed = structuredClone(reports);
    changed[0].topics[0].items[0].summary = "이전 리포트에 있던 요약";
    expect(importKeyForReports(changed)).not.toBe(expected);
  });
});

describe("study-library import preview CLI", () => {
  test("dry-run preview와 raw 관리자 UI payload를 분리 저장한다", async () => {
    const root = runDir();
    const historyPath = join(root, "state", "morning-study-history.json");
    const pagesPath = join(root, "pages.json");
    const outputPath = join(root, "study-library-import-preview.json");
    const bodies: StudyLibraryImportPayload[] = [];
    writeJson(historyPath, history([legacyEntry()]));
    writeJson(pagesPath, manifest([pageReport()]));

    const logs = await runCli([
      "--run-dir", root,
      "--library",
      "--import-preview",
      "--history-file", historyPath,
      "--pages-manifest", pagesPath,
      "--output", outputPath,
    ], async (url, init) => {
      expect(url.pathname).toBe("/api/study/v1/imports/dry-run");
      bodies.push(JSON.parse(String(init.body)) as StudyLibraryImportPayload);
      return jsonResponse({
        previewHash: "preview-hash-1",
        historyVersion: 7,
        counts: { reports: 3, topics: 2, items: 2 },
        warnings: [{ code: "DUPLICATED_CONTENT", message: "중복 자료가 과거 report에 있다." }],
      });
    });

    const raw = JSON.parse(readFileSync(outputPath, "utf8")) as StudyLibraryImportPayload;
    const preview = JSON.parse(readFileSync(`${outputPath}.preview.json`, "utf8")) as Record<string, unknown>;
    expect(raw).toEqual(bodies[0]);
    expect(raw).toHaveProperty("importKey");
    expect(raw).toHaveProperty("reports");
    expect(raw).not.toHaveProperty("previewHash");
    expect(preview.previewHash).toBe("preview-hash-1");
    expect(preview.counts).toEqual({ reports: 3, topics: 2, items: 2 });
    expect(preview.warnings).toEqual([
      { code: "DUPLICATED_CONTENT", message: "중복 자료가 과거 report에 있다." },
    ]);
    expect(JSON.parse(logs[0])).toMatchObject({
      mode: "import-preview",
      library: true,
      reportCount: 3,
      historyVersion: 7,
    });
  });

  test("변환 오류가 있으면 errors만 만들고 payload 생성과 API 요청을 중단한다", async () => {
    const root = runDir();
    const historyPath = join(root, "state", "morning-study-history.json");
    const pagesPath = join(root, "pages.json");
    const outputPath = join(root, "study-library-import-preview.json");
    let apiCalled = false;
    writeJson(historyPath, history([legacyEntry({ sourceKey: undefined })]));
    writeJson(pagesPath, manifest([pageReport()]));

    await expect(runCli([
      "--run-dir", root,
      "--library",
      "--import-preview",
      "--history-file", historyPath,
      "--pages-manifest", pagesPath,
      "--output", outputPath,
    ], async () => {
      apiCalled = true;
      return jsonResponse({});
    })).rejects.toThrow("이관 입력 변환 오류");

    expect(apiCalled).toBe(false);
    expect(existsSync(outputPath)).toBe(false);
    expect(existsSync(`${outputPath}.preview.json`)).toBe(false);
    const errors = JSON.parse(readFileSync(`${outputPath}.errors.json`, "utf8")) as { errors: Array<{ path: string }> };
    expect(errors.errors[0]?.path).toBe("history.entries[0].sourceKey");
  });

  test("import commit 요청 함수나 CLI 플래그를 만들지 않는다", () => {
    const cli = readFileSync(join(import.meta.dir, "../morning_reading_cli.ts"), "utf8");
    const client = readFileSync(join(import.meta.dir, "client.ts"), "utf8");

    expect(cli).not.toContain("--import-commit");
    expect(client).not.toContain("createImportCommit");
    expect(client).not.toContain("/imports/commit");
  });
});
