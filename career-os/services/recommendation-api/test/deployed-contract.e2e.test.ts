import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { companyPreferenceSchema } from "../src/positions/schema.js";

/**
 * 배포한 서비스를 상대로 HTTP 계약을 확인한다.
 *
 * 로컬 container 가 아니라 실제로 떠 있는 주소에 요청한다.
 * 읽기만 하고 운영 데이터를 바꾸지 않는다.
 *
 * 기본 `npm test` 에 들어가지 않는다. `npm run test:deployed` 가
 * `vitest.deployed.config.ts` 로 이 file 하나만 돌린다.
 */

/**
 * 환경값이 없으면 건너뛰지 않고 실패한다.
 * 이 검사를 부른 것은 배포한 서비스를 확인하려는 것이므로,
 * 건너뛴 실행을 확인 근거로 쓸 수 없다.
 */
function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 이 없다. 배포한 서비스의 값을 주고 다시 돌린다.`);
  }
  return value;
}

const baseUrl = requireEnvironment("CAREER_RECOMMENDATION_API_URL").replace(/\/+$/, "");
const apiToken = requireEnvironment("CAREER_RECOMMENDATION_API_TOKEN");

const errorBodySchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        requestId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

type Probe = {
  status: number;
  cacheControl: string | null;
  requestId: string | null;
  text: string;
};

async function probe(path: string, token: string | null): Promise<Probe> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: token === null ? {} : { Authorization: `Bearer ${token}` },
  });
  return {
    status: response.status,
    cacheControl: response.headers.get("cache-control"),
    requestId: response.headers.get("x-request-id"),
    text: await response.text(),
  };
}

/** 확인한 모든 응답을 모아 공통 헤더를 한 번에 단언한다. */
const seen: { label: string; probe: Probe }[] = [];

async function record(label: string, path: string, token: string | null): Promise<Probe> {
  const result = await probe(path, token);
  seen.push({ label, probe: result });
  return result;
}

describe("배포한 추천 Backend 의 HTTP 계약", () => {
  let live: Probe;
  let ready: Probe;
  let authorized: Probe;
  let rejected: Probe;
  let missing: Probe;
  let preferences: Probe;

  beforeAll(async () => {
    live = await record("GET /health/live", "/health/live", null);
    ready = await record("GET /health/ready", "/health/ready", null);
    authorized = await record("GET /api/v1/auth/check", "/api/v1/auth/check", apiToken);
    rejected = await record(
      "GET /api/v1/auth/check (틀린 token)",
      "/api/v1/auth/check",
      `${apiToken}-틀린값`,
    );
    missing = await record(
      "GET /api/positions/v1/없는경로",
      "/api/positions/v1/없는경로",
      apiToken,
    );
    preferences = await record(
      "GET /api/positions/v1/company-preferences",
      "/api/positions/v1/company-preferences",
      apiToken,
    );
  });

  it("살아 있음 확인이 200 이다", () => {
    expect(live.status).toBe(200);
  });

  it("준비 확인이 200 이다", () => {
    expect(ready.status).toBe(200);
  });

  it("유효한 token 의 인증 확인이 204 이고 본문이 없다", () => {
    expect(authorized.status).toBe(204);
    expect(authorized.text).toBe("");
  });

  it("틀린 token 의 인증 확인이 401 이고 본문이 UNAUTHORIZED 형식이다", () => {
    expect(rejected.status).toBe(401);
    const body = errorBodySchema.parse(JSON.parse(rejected.text));
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.requestId).toBe(rejected.requestId);
  });

  it("없는 경로가 404 NOT_FOUND 이고 오류 형식이 같다", () => {
    expect(missing.status).toBe(404);
    const body = errorBodySchema.parse(JSON.parse(missing.text));
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBe(missing.requestId);
  });

  it("기업 선호 조회의 응답이 schema 를 통과한다", () => {
    expect(preferences.status).toBe(200);
    const parsed = z.array(companyPreferenceSchema).safeParse(JSON.parse(preferences.text));
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it("모든 응답에 Cache-Control 과 X-Request-Id 가 있다", () => {
    const missingHeaders = seen
      .filter(({ probe: result }) => result.cacheControl !== "no-store" || !result.requestId)
      .map(({ label, probe: result }) => ({
        label,
        cacheControl: result.cacheControl,
        requestId: result.requestId,
      }));
    expect(missingHeaders).toEqual([]);
  });
});
