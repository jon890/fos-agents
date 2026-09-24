import { afterEach, describe, expect, test } from "bun:test";
import { manageReadingSources } from "./manage_reading_sources.ts";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.CAREER_RECOMMENDATION_API_URL;
const originalToken = process.env.CAREER_RECOMMENDATION_API_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.CAREER_RECOMMENDATION_API_URL;
  else process.env.CAREER_RECOMMENDATION_API_URL = originalUrl;
  if (originalToken === undefined) delete process.env.CAREER_RECOMMENDATION_API_TOKEN;
  else process.env.CAREER_RECOMMENDATION_API_TOKEN = originalToken;
});

describe("manage_reading_sources", () => {
  test("disable에 --note가 없으면 API를 부르기 전에 거부한다", async () => {
    process.env.CAREER_RECOMMENDATION_API_URL = "http://study.local";
    process.env.CAREER_RECOMMENDATION_API_TOKEN = "t".repeat(32);
    globalThis.fetch = (() => { throw new Error("API를 호출하면 안 된다."); }) as unknown as typeof fetch;

    await expect(manageReadingSources(["disable", "--key", "source-1"]))
      .rejects.toThrow("--note 값이 필요하다.");
  });
});
