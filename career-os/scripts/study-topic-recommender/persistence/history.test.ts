import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MorningReadingReport } from "../reading_contracts.js";
import { appendReportToHistory, loadMorningStudyHistory } from "./history.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture(): { directory: string; historyPath: string } {
  const directory = mkdtempSync(join(tmpdir(), "morning-study-history."));
  temporaryDirectories.push(directory);
  return { directory, historyPath: join(directory, "state", "morning-study-history.json") };
}

function report(generatedAt = "2026-09-02T22:00:00.000Z"): MorningReadingReport {
  return {
    generatedAt,
    sourceOfTruth: {
      config: "config/external-reading-sources.ts",
      collectedArticles: "state/reading-candidates.json",
    },
    counts: {
      activeSources: 1,
      sourcesWithCandidates: 1,
      collectedArticles: 1,
      techBlogSources: 0,
      geekSources: 0,
      aiSources: 0,
      videoSources: 1,
    },
    collectionLog: [],
    topics: [{
      topicKey: "ai-product-operations",
      title: "AI 제품의 운영 판단",
      careerQuestion: "기능을 실제 제품에 넣을 때 어떤 실패를 먼저 막아야 하는가?",
      items: [{
        contentKey: "youtube:abc123",
        canonicalUrl: "https://www.youtube.com/watch?v=abc123",
        sourceKey: "video",
        sourceName: "영상 채널",
        category: "video",
        title: "AI 제품 운영 사례",
        url: "https://www.youtube.com/watch?v=abc123",
        published: "2026-09-02",
        summary: "운영 사례를 다룬다.",
        reason: "제품 운영 판단과 연결된다.",
        careerValue: "product-business",
      }],
    }],
  };
}

describe("아침 공부 추천 이력", () => {
  test("파일이 없으면 빈 이력을 반환한다", () => {
    const { historyPath } = fixture();
    expect(loadMorningStudyHistory(historyPath)).toEqual({ schemaVersion: 1, reports: [], entries: [] });
  });

  test("검증된 리포트를 원자적으로 누적한다", () => {
    const { historyPath } = fixture();
    const history = appendReportToHistory(historyPath, report());
    expect(history.reports[0]?.reportId).toBe("morning-2026-09-03");
    expect(history.entries[0]?.contentKey).toBe("youtube:abc123");
    expect(history.entries[0]?.studyTopicKey).toBe("ai-product-operations");
    expect(existsSync(historyPath)).toBe(true);
    expect(readFileSync(historyPath, "utf8")).not.toContain(".tmp-");
  });

  test("손상된 기존 이력을 빈 값으로 대체하지 않는다", () => {
    const { historyPath } = fixture();
    mkdirSync(join(historyPath, ".."), { recursive: true });
    writeFileSync(historyPath, "{broken", "utf8");
    expect(() => loadMorningStudyHistory(historyPath)).toThrow("이력을 읽을 수 없다");
    expect(readFileSync(historyPath, "utf8")).toBe("{broken");
  });

  test("같은 reportId를 다시 반영하지 않는다", () => {
    const { historyPath } = fixture();
    appendReportToHistory(historyPath, report());
    expect(() => appendReportToHistory(historyPath, report())).toThrow("이미 이력에 반영한 reportId");
  });

  test("다른 report라도 같은 contentKey는 다시 반영하지 않는다", () => {
    const { historyPath } = fixture();
    appendReportToHistory(historyPath, report());
    const nextReport = report("2026-09-03T22:00:00.000Z");
    nextReport.topics[0].topicKey = "different-topic";
    expect(() => appendReportToHistory(historyPath, nextReport))
      .toThrow("이미 추천한 contentKey");
  });

  test("다음 report에 직전 공부 주제가 반복되면 반영하지 않는다", () => {
    const { historyPath } = fixture();
    appendReportToHistory(historyPath, report());
    const nextReport = structuredClone(report("2026-09-03T22:00:00.000Z"));
    nextReport.topics[0].items[0].contentKey = "youtube:different";
    nextReport.topics[0].items[0].canonicalUrl = "https://www.youtube.com/watch?v=different";
    nextReport.topics[0].items[0].url = "https://www.youtube.com/watch?v=different";
    expect(() => appendReportToHistory(historyPath, nextReport))
      .toThrow("직전 리포트에서 추천한 topicKey");
  });

  test("한 report 안에서 같은 공부 주제를 두 번 기록하지 않는다", () => {
    const { historyPath } = fixture();
    const duplicated = report();
    const secondTopic = structuredClone(duplicated.topics[0]);
    secondTopic.items[0].contentKey = "youtube:different";
    secondTopic.items[0].canonicalUrl = "https://www.youtube.com/watch?v=different";
    secondTopic.items[0].url = "https://www.youtube.com/watch?v=different";
    duplicated.topics.push(secondTopic);
    expect(() => appendReportToHistory(historyPath, duplicated)).toThrow("중복 topicKey");
  });
});
