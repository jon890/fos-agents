import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { restoreCareerWorkspaceEnv, useCareerWorkspaceEnv } from "../lib/career-store/test-support.ts";
import { manageReadingSources } from "./manage_reading_sources.ts";
import { main } from "./morning_reading_cli.ts";
import { StudyLibraryClient } from "./study-library/client.ts";

/**
 * 공부 추천을 같은 작업 폴더에서 두 번 돌린다. 외부 피드만 대역이고
 * 커서, 후보, 추천 저장, 게시 기록은 실제 실행기 경로와 작업 폴더 저장소를 쓴다.
 */
const originalArgv = process.argv;
const originalFetch = globalThis.fetch;
const originalLog = console.log;

afterEach(() => {
  process.argv = originalArgv;
  globalThis.fetch = originalFetch;
  console.log = originalLog;
  restoreCareerWorkspaceEnv();
});

function feed(titles: string[]): void {
  const items = titles
    .map((title) => `<item><title>${title}</title><link>https://example.com/${title.toLowerCase()}</link><pubDate>Fri, 20 Nov 2026 00:00:00 GMT</pubDate></item>`)
    .join("");
  globalThis.fetch = (async () =>
    new Response(`<?xml version="1.0"?><rss><channel>${items}</channel></rss>`, {
      headers: { "Content-Type": "application/xml" },
    })) as unknown as typeof fetch;
}

async function cli(args: string[]): Promise<Record<string, unknown>> {
  const logs: string[] = [];
  process.argv = ["bun", "morning_reading_cli.ts", ...args];
  console.log = (message?: unknown) => logs.push(String(message));
  try {
    await main();
  } finally {
    console.log = originalLog;
  }
  return JSON.parse(logs.at(-1)!) as Record<string, unknown>;
}

type Pool = { recentStudyTopicKeys: string[]; candidates: Array<{ id: string; title: string }> };

test("두 번째 실행은 저장된 커서에서 이어 읽고, 고른 자료를 다시 후보로 내지 않으며, 게시 기록을 보여 준다", async () => {
  const root = useCareerWorkspaceEnv({ "learning-interests": "- 분산 시스템과 LLM 서비스 운영" });
  await manageReadingSources([
    "add", "--key", "example-feed", "--title", "예시 피드", "--category", "techBlog",
    "--feed-url", "https://example.com/feed.xml", "--adapter", "feed", "--note", "두 번 실행 검사",
  ]);
  mkdirSync(join(root, "runs"), { recursive: true });
  const runDirectory = () => mkdtempSync(join(root, "runs", "study-topic-recommender."));

  // 첫 실행: 수집, 후보 조회, 선택, 추천 저장, 게시 기록.
  const first = runDirectory();
  feed(["One", "Two"]);
  const collected = await cli(["--run-dir", first, "--collect-only"]);
  expect(collected).toMatchObject({ acceptedCount: 2, statuses: [{ sourceKey: "example-feed", status: "ingested", acceptedCount: 2 }] });
  const library = new StudyLibraryClient();
  expect((await library.getSourceCursor("example-feed", "recent")).version).toBe(1);
  await cli(["--run-dir", first, "--prepare-candidates"]);
  const firstPoolPath = join(first, "state", "reading-candidates.json");
  const firstPool = JSON.parse(readFileSync(firstPoolPath, "utf8")) as Pool;
  expect(firstPool.candidates.map((candidate) => candidate.title).sort()).toEqual(["One", "Two"]);
  const chosen = firstPool.candidates.find((candidate) => candidate.title === "One")!;
  const selectionPath = join(first, "selection.json");
  writeFileSync(selectionPath, JSON.stringify({
    topics: [{
      topicKey: "operable-llm-services",
      title: "운영 가능한 LLM 서비스",
      careerQuestion: "지금 서비스의 장애 복구에 어떤 판단을 적용할 수 있는가?",
      items: [{ candidateId: chosen.id, summary: "운영 사례를 설명한다.", reason: "관심사와 맞는다.", careerValue: "current-work" }],
    }],
  }));
  const selected = await cli(["--run-dir", first, "--candidate-pool", firstPoolPath, "--reading-selection", selectionPath]);
  const saved = await cli(["--run-dir", first, "--commit-recommendation", "--report", String(selected.report)]);
  expect(saved.historyVersion).toBe(1);
  expect(existsSync(String(saved.reportCopy))).toBe(true);
  expect(String(saved.reportCopy)).toMatch(/\/reports\/\d{4}-\d{2}-\d{2}-study\.html$/);
  await cli([
    "--run-dir", first, "--record-publication", "--report-id", String(saved.reportId), "--channel", "blog",
    "--external-id", "post-1", "--published-at", "2026-11-21T03:00:00.000Z", "--url", "https://example.com/published/1",
  ]);
  await cli(["--run-dir", first, "--cleanup"]).catch(() => undefined);
  expect(existsSync(first)).toBe(false);

  // 두 번째 실행: 새 글 하나가 더 올라왔다.
  const second = runDirectory();
  feed(["Three", "One", "Two"]);
  // 저장된 커서가 이미 본 두 글을 빼므로 새 글 하나만 받는다. 커서를 무시하면 3건이 된다.
  expect(await cli(["--run-dir", second, "--collect-only"])).toMatchObject({ acceptedCount: 1 });
  const cursor = await library.getSourceCursor("example-feed", "recent");
  expect(cursor.version).toBe(2);
  expect(cursor.cursor?.lastSeen as string[]).toHaveLength(3);
  await cli(["--run-dir", second, "--prepare-candidates"]);
  const secondPool = JSON.parse(readFileSync(join(second, "state", "reading-candidates.json"), "utf8")) as Pool;
  expect(secondPool.candidates.map((candidate) => candidate.title).sort()).toEqual(["Three", "Two"]);
  expect(secondPool.recentStudyTopicKeys).toEqual(["operable-llm-services"]);

  const listed = (await cli(["--list-recommendations"])) as { runs: Array<Record<string, unknown>> };
  expect(listed.runs).toHaveLength(1);
  expect(listed.runs[0]).toMatchObject({
    reportId: saved.reportId,
    topics: [{ topicKey: "operable-llm-services", items: [{ title: "One" }] }],
    publications: [{ channel: "blog", url: "https://example.com/published/1", externalId: "post-1" }],
  });
});
