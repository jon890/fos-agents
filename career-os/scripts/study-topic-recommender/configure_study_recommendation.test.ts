import { afterEach, describe, expect, test } from "bun:test";
import { configureStudyRecommendation } from "./configure_study_recommendation.ts";

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

describe("configure_study_recommendation", () => {
  test("A → B → A 요청은 마지막 A를 실제로 저장한다", async () => {
    process.env.CAREER_RECOMMENDATION_API_URL = "http://study.local";
    process.env.CAREER_RECOMMENDATION_API_TOKEN = "t".repeat(32);
    let stored = "";
    const keys: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { candidateContextVersion: string };
      stored = body.candidateContextVersion;
      keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
      return Response.json({ candidateContextVersion: stored });
    }) as typeof fetch;

    await configureStudyRecommendation(["--candidate-context-version", "A"]);
    await configureStudyRecommendation(["--candidate-context-version", "B"]);
    await configureStudyRecommendation(["--candidate-context-version", "A"]);

    expect(stored).toBe("A");
    expect(new Set(keys).size).toBe(3);
    expect(keys.every((key) => key.startsWith("control:"))).toBe(true);
  });
});
