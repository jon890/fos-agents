import { describe, expect, test } from "bun:test";
import { CareerError, type FetchLike } from "./backend.ts";
import { GithubProfileRepo } from "./github.ts";

const repo = "octo-example/octo-example";
const token = "g".repeat(40);
const base = `https://api.github.com/repos/${repo}`;

type Call = { method: string; url: string; init: RequestInit | undefined; body: any };
type Route = (call: Call) => Response | undefined;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function harness(routes: Record<string, Route | Response>) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const call = {
      method: init?.method ?? "GET",
      url: String(input),
      init,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    };
    calls.push(call);
    const key = `${call.method} ${call.url}`;
    const route = routes[key];
    const response = typeof route === "function" ? route(call) : route;
    if (!response) throw new Error(`unexpected request ${key}`);
    return response;
  };
  return { calls, github: new GithubProfileRepo({ token, repo }, fetchImpl) };
}

const step = {
  repo: `GET ${base}`,
  ref: `GET ${base}/git/ref/heads/main`,
  commit: `GET ${base}/git/commits/head-sha`,
  blob: `POST ${base}/git/blobs`,
  tree: `POST ${base}/git/trees`,
  newCommit: `POST ${base}/git/commits`,
  move: `PATCH ${base}/git/refs/heads/main`,
};

function commitRoutes(treeSha = "new-tree-sha"): Record<string, Route | Response> {
  return {
    [step.repo]: () => json({ default_branch: "main" }),
    [step.ref]: () => json({ object: { sha: "head-sha" } }),
    [step.commit]: () => json({ tree: { sha: "base-tree-sha" } }),
    [step.blob]: (call) => json({ sha: call.body.content.startsWith("<svg") ? "chart-blob" : "readme-blob" }, 201),
    [step.tree]: () => json({ sha: treeSha }, 201),
    [step.newCommit]: () => json({ sha: "new-commit-sha" }, 201),
    [step.move]: () => json({ object: { sha: "new-commit-sha" } }),
  };
}

const files = { readme: "# 프로필\n![Tokens](https://img.shields.io/badge/Tokens-1.2B-blue)\n", chart: "<svg>chart</svg>\n" };
const message = "docs: 프로필과 에이전트 사용량 차트를 갱신한다 (2031-01)";

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CareerError);
    return (error as CareerError).code;
  }
  throw new Error("expected a CareerError");
}

function expectGithubOnly(calls: Call[]) {
  for (const call of calls) {
    expect({ url: call.url, host: new URL(call.url).host }).toEqual({ url: call.url, host: "api.github.com" });
    expect({ url: call.url, redirect: call.init?.redirect }).toEqual({ url: call.url, redirect: "error" });
    const headers = call.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${token}`);
    expect(headers.Accept).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(headers["User-Agent"]).toBe("fos-career-connector");
  }
}

describe("read", () => {
  const readme = "# 안녕하세요\n한글 README 입니다. ✓\n";
  // GitHub wraps base64 content every 60 characters.
  const encoded = Buffer.from(readme, "utf8").toString("base64").replace(/(.{20})/g, "$1\n");

  test("README 의 base64 를 줄바꿈과 함께 받아 UTF-8 글로 풀고, 차트가 404 면 chartExists 가 false 다", async () => {
    const { calls, github } = harness({
      [step.repo]: json({ default_branch: "main" }),
      [`GET ${base}/contents/README.md?ref=main`]: json({ content: encoded, encoding: "base64" }),
      [`GET ${base}/contents/agent-usage.svg?ref=main`]: json({ message: "Not Found" }, 404),
    });
    expect(encoded).toContain("\n");
    expect(await github.read()).toEqual({ repo, branch: "main", readme, chartExists: false });
    expectGithubOnly(calls);
  });

  test("README 가 404 면 readme 가 null 이고 차트가 있으면 chartExists 가 true 다", async () => {
    const { github } = harness({
      [step.repo]: json({ default_branch: "main" }),
      [`GET ${base}/contents/README.md?ref=main`]: json({ message: "Not Found" }, 404),
      [`GET ${base}/contents/agent-usage.svg?ref=main`]: json({ content: "", encoding: "base64" }),
    });
    expect(await github.read()).toEqual({ repo, branch: "main", readme: null, chartExists: true });
  });

  test("저장소 조회의 404 는 오류이고 CAREER_GITHUB_FORBIDDEN 이다", async () => {
    const { github } = harness({ [step.repo]: json({ message: "Not Found" }, 404) });
    expect(await codeOf(github.read())).toBe("CAREER_GITHUB_FORBIDDEN");
  });
});

describe("commitProfile", () => {
  test("Git Data API 여덟 요청을 차례로 보내 두 파일을 커밋 하나로 올린다", async () => {
    const { calls, github } = harness(commitRoutes());
    const result = await github.commitProfile(files, message);
    expect(result).toEqual({ changed: true, commitSha: "new-commit-sha", branch: "main" });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      step.repo,
      step.ref,
      step.commit,
      step.blob,
      step.blob,
      step.tree,
      step.newCommit,
      step.move,
    ]);
    expect(calls[3]!.body).toEqual({ content: files.readme, encoding: "utf-8" });
    expect(calls[4]!.body).toEqual({ content: files.chart, encoding: "utf-8" });
    expect(calls[5]!.body).toEqual({
      base_tree: "base-tree-sha",
      tree: [
        { path: "README.md", mode: "100644", type: "blob", sha: "readme-blob" },
        { path: "agent-usage.svg", mode: "100644", type: "blob", sha: "chart-blob" },
      ],
    });
    expect(calls[6]!.body).toEqual({ message, tree: "new-tree-sha", parents: ["head-sha"] });
    expect(calls[7]!.body).toEqual({ sha: "new-commit-sha", force: false });
    expectGithubOnly(calls);
  });

  test("새 tree 가 지금 tree 와 같으면 커밋과 branch 이동 없이 changed 가 false 다", async () => {
    const { calls, github } = harness(commitRoutes("base-tree-sha"));
    const result = await github.commitProfile(files, message);
    expect(result).toEqual({ changed: false, commitSha: "head-sha", branch: "main" });
    expect(calls).toHaveLength(6);
    expect(calls.some((call) => call.method === "PATCH")).toBe(false);
  });

  const failWith = (key: string, status: number) => {
    const routes = commitRoutes();
    routes[key] = () => json({ message: `github-said ${token}` }, status);
    return routes;
  };
  const failures = [
    ["branch 이동이 422", step.move, 422, "CAREER_GITHUB_CONFLICT"],
    ["branch 이동이 409", step.move, 409, "CAREER_GITHUB_CONFLICT"],
    ["tree 생성이 422", step.tree, 422, "CAREER_GITHUB_UNAVAILABLE"],
    ["blob 생성이 409", step.blob, 409, "CAREER_GITHUB_UNAVAILABLE"],
    ["저장소 조회가 429", step.repo, 429, "CAREER_GITHUB_UNAVAILABLE"],
    ["커밋 생성이 429", step.newCommit, 429, "CAREER_GITHUB_UNAVAILABLE"],
    ["branch 이동이 429", step.move, 429, "CAREER_GITHUB_UNAVAILABLE"],
    ["저장소 조회가 401", step.repo, 401, "CAREER_GITHUB_UNAUTHORIZED"],
    ["저장소 조회가 403", step.repo, 403, "CAREER_GITHUB_FORBIDDEN"],
    ["저장소 조회가 404", step.repo, 404, "CAREER_GITHUB_FORBIDDEN"],
    ["저장소 조회가 502", step.repo, 502, "CAREER_GITHUB_UNAVAILABLE"],
    ["ref 조회가 400", step.ref, 400, "CAREER_GITHUB_FORBIDDEN"],
  ] as const;
  for (const [label, key, status, code] of failures) {
    test(`${label} 면 ${code} 이고 다시 보내지 않는다`, async () => {
      const { calls, github } = harness(failWith(key, status));
      const error = await github.commitProfile(files, message).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CareerError);
      expect((error as CareerError).code).toBe(code);
      expect((error as CareerError).message).not.toContain(token);
      const failed = calls.filter((call) => `${call.method} ${call.url}` === key);
      expect(failed).toHaveLength(1);
      // Nothing after the failed step is sent.
      expect(`${calls.at(-1)!.method} ${calls.at(-1)!.url}`).toBe(key);
    });
  }

  test("fetch 가 던지면 CAREER_GITHUB_UNAVAILABLE 이다", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error(`timeout ${token}`);
    };
    const github = new GithubProfileRepo({ token, repo }, fetchImpl);
    expect(await codeOf(github.commitProfile(files, message))).toBe("CAREER_GITHUB_UNAVAILABLE");
  });

  test("성공 상태인데 필요한 칸이 없으면 CAREER_INVALID_RESPONSE 다", async () => {
    const routes = commitRoutes();
    routes[step.ref] = () => json({ object: {} });
    const { github } = harness(routes);
    expect(await codeOf(github.commitProfile(files, message))).toBe("CAREER_INVALID_RESPONSE");
  });
});

test("check 는 저장소 조회 하나만 보낸다", async () => {
  const { calls, github } = harness({ [step.repo]: json({ default_branch: "main" }) });
  await github.check();
  expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([step.repo]);
  expectGithubOnly(calls);
});
