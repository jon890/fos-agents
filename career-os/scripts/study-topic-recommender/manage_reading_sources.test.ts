import { afterEach, describe, expect, test } from "bun:test";
import { manageReadingSources } from "./manage_reading_sources.ts";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.CAREER_RECOMMENDATION_API_URL;
const originalToken = process.env.CAREER_RECOMMENDATION_API_TOKEN;
const originalTokenFile = process.env.CAREER_RECOMMENDATION_API_TOKEN_FILE;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.CAREER_RECOMMENDATION_API_URL;
  else process.env.CAREER_RECOMMENDATION_API_URL = originalUrl;
  if (originalToken === undefined) delete process.env.CAREER_RECOMMENDATION_API_TOKEN;
  else process.env.CAREER_RECOMMENDATION_API_TOKEN = originalToken;
  if (originalTokenFile === undefined) delete process.env.CAREER_RECOMMENDATION_API_TOKEN_FILE;
  else process.env.CAREER_RECOMMENDATION_API_TOKEN_FILE = originalTokenFile;
});

function clearApiEnvironment(): void {
  delete process.env.CAREER_RECOMMENDATION_API_URL;
  delete process.env.CAREER_RECOMMENDATION_API_TOKEN;
  delete process.env.CAREER_RECOMMENDATION_API_TOKEN_FILE;
}

describe("manage_reading_sources", () => {
  test("help와 template는 API 환경값 없이 성공한다", async () => {
    clearApiEnvironment();
    globalThis.fetch = (() => { throw new Error("API를 호출하면 안 된다."); }) as unknown as typeof fetch;

    for (const args of [[], ["help"], ["--help"], ["-h"]]) {
      await expect(manageReadingSources(args)).resolves.toContain("사용법:");
    }
    await expect(manageReadingSources([
      "template",
      "--key", "example-test-feed",
      "--title", "예시",
      "--category", "techBlog",
      "--feed-url", "https://example.com/feed.xml",
      "--adapter", "feed",
      "--note", "새 기술 블로그를 수집한다",
    ])).resolves.toEqual({
      sourceKey: "example-test-feed",
      payload: {
        title: "예시",
        category: "techBlog",
        adapter: "feed",
        url: null,
        feedUrl: "https://example.com/feed.xml",
        enabled: true,
        note: "새 기술 블로그를 수집한다",
        expectedVersion: 0,
      },
    });
  });

  test("잘못된 template는 API 환경값과 무관하게 거부한다", async () => {
    clearApiEnvironment();
    globalThis.fetch = (() => { throw new Error("API를 호출하면 안 된다."); }) as unknown as typeof fetch;

    await expect(manageReadingSources([
      "template",
      "--key", "example-test-feed",
      "--title", "예시",
      "--category", "invalid-category",
      "--url", "https://example.com/engineering",
      "--adapter", "page",
      "--note", "잘못된 category다",
    ])).rejects.toThrow("Invalid option");
    await expect(manageReadingSources([
      "template",
      "--key", "example-test-feed",
      "--title", "예시",
      "--category", "techBlog",
      "--url", "http://example.com/engineering",
      "--adapter", "page",
      "--note", "HTTPS URL이 아니다",
    ])).rejects.toThrow("HTTPS URL이어야 한다.");
  });

  test("API 명령은 연결 환경값이 없으면 실패한다", async () => {
    clearApiEnvironment();

    for (const args of [
      ["list"],
      ["add", "--key", "source-1", "--title", "예시", "--category", "techBlog", "--url", "https://example.com", "--adapter", "page", "--note", "추가"],
      ["update", "--key", "source-1", "--title", "예시", "--note", "수정"],
      ["disable", "--key", "source-1", "--note", "중지"],
      ["enable", "--key", "source-1", "--note", "복구"],
    ]) {
      await expect(manageReadingSources(args)).rejects.toThrow("CAREER_RECOMMENDATION_API_URL 환경값이 필요하다.");
    }
  });

  test("disable에 --note가 없으면 API를 부르기 전에 거부한다", async () => {
    process.env.CAREER_RECOMMENDATION_API_URL = "http://study.local";
    process.env.CAREER_RECOMMENDATION_API_TOKEN = "t".repeat(32);
    globalThis.fetch = (() => { throw new Error("API를 호출하면 안 된다."); }) as unknown as typeof fetch;

    await expect(manageReadingSources(["disable", "--key", "source-1"]))
      .rejects.toThrow("--note 값이 필요하다.");
  });
});
