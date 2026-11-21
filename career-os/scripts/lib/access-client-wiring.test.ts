import { afterEach, describe, expect, test } from "bun:test";
import { CandidateContextClient } from "../candidate-context/client.ts";
import { ProfileClient } from "../profile/client.ts";

// Backend 를 부르는 client 가 환경의 Access 값을 요청 머리말까지 전달하는지 확인한다. 응답 내용은 보지 않는다.
// 공고 추천과 공부 추천은 작업 폴더 저장소를 써서 이 검사의 대상이 아니다(ADR-146).
const keys = [
  "CAREER_BACKEND_URL",
  "CAREER_BACKEND_TOKEN",
  "CAREER_BACKEND_ACCESS_CLIENT_ID",
  "CAREER_BACKEND_ACCESS_CLIENT_SECRET",
] as const;
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const environment = {
  CAREER_BACKEND_URL: "https://backend.example",
  CAREER_BACKEND_TOKEN: "t".repeat(40),
  CAREER_BACKEND_ACCESS_CLIENT_ID: "fake-id.access",
  CAREER_BACKEND_ACCESS_CLIENT_SECRET: "fake-secret-0001",
};

afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function recorder() {
  const seen: Headers[] = [];
  const fetchImpl = async (_url: URL, init: RequestInit) => {
    seen.push(new Headers(init.headers));
    return Response.json({});
  };
  return { seen, fetchImpl };
}

function expectAccess(seen: Headers[]) {
  expect(seen.length).toBeGreaterThan(0);
  expect(seen[0].get("CF-Access-Client-Id")).toBe("fake-id.access");
  expect(seen[0].get("CF-Access-Client-Secret")).toBe("fake-secret-0001");
}

describe("client 의 Access 머리말 전달", () => {
  test("profile client", async () => {
    Object.assign(process.env, environment);
    const { seen, fetchImpl } = recorder();
    await new ProfileClient({ fetchImpl, maxRetries: 0 }).listDocuments().catch(() => undefined);
    expectAccess(seen);
  });

  test("candidate-context client", async () => {
    Object.assign(process.env, environment);
    const { seen, fetchImpl } = recorder();
    await new CandidateContextClient({ fetchImpl, maxRetries: 0 }).listDocuments().catch(() => undefined);
    expectAccess(seen);
  });
});
