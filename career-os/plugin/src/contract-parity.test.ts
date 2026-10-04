// The plugin keeps its own thin Backend client so the bundle never carries the CLI's
// token-file reader. This test is not bundled; it imports the CLI contracts to keep both sides aligned.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCandidateContextClient } from "../../scripts/candidate-context/client.ts";
import { candidateContextDocumentKeys } from "../../scripts/candidate-context/contracts.ts";
import { createProfileClient } from "../../scripts/profile/client.ts";
import {
  profileDocumentKeys as cliProfileDocumentKeys,
  usageSnapshotSchema,
} from "../../scripts/profile/contracts.ts";
import { createStudyLibraryClient } from "../../scripts/study-topic-recommender/study-library/client.ts";
import { InterviewBackendClient } from "../../scripts/interview-drill/career-backend/client.ts";
import { loadQuestionBank } from "../../scripts/interview-drill/drill-engine.ts";
import {
  attemptBodySchema,
  interviewQuestionSchema as backendQuestionSchema,
  personalQuestionBodySchema,
} from "../../services/career-backend/src/interview/schema.ts";
import { studyCandidatesQuerySchema, studyRecommendationRunSchema } from "../../services/career-backend/src/study/schema.ts";
import {
  companyPreferenceSchema as backendCompanyPreferenceSchema,
  positionExclusionSchema as backendExclusionSchema,
} from "../../services/career-backend/src/positions/schema.ts";
import { CareerBackendClient } from "../../scripts/position-recommender/career-backend/client.ts";
import { studyLibraryCandidatePageSchema } from "../../scripts/study-topic-recommender/study-library/contracts.ts";
import { CareerBackend, type FetchLike } from "./backend.ts";
import {
  attemptInputSchema,
  interviewQuestionSchema,
  personalQuestionInputSchema,
  publicBehavioralQuestions,
  publicTechQuestions,
} from "./interview.ts";
import { urlKey, worstCaseRecommendation } from "./study-fixtures.ts";
import { listStudyCandidatesSchema } from "./study.ts";
import { CareerTools, contextDocumentKeys, profileDocumentKeys } from "./tools.ts";

test("후보자 맥락 문서 키가 CLI 계약과 같다", () => {
  expect([...contextDocumentKeys]).toEqual([...candidateContextDocumentKeys]);
});

test("프로필 원고 키가 CLI 계약과 같다", () => {
  expect([...profileDocumentKeys]).toEqual([...cliProfileDocumentKeys]);
});

test("사용량 기록 한 줄은 CLI 계약의 칸을 모두 요구하고 그 밖의 칸을 요구하지 않는다", async () => {
  const row = usageSnapshotSchema.parse({
    month: "2026-08",
    claudeTokens: 1,
    codexTokens: 2,
    claudeCostUsd: null,
    codexCostUsd: null,
    sessions: null,
    unpricedTokens: 0,
    measuredOn: "2026-09-01",
    source: "MEASURED",
    note: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
  const keys = Object.keys(usageSnapshotSchema.shape);
  expect(Object.keys(row).sort()).toEqual([...keys].sort());

  const listWith = async (snapshot: Record<string, unknown>) =>
    new CareerTools(
      new CareerBackend({ baseUrl: "https://career.example.com/", token: "x".repeat(40) }, async () =>
        new Response(JSON.stringify({ snapshots: [snapshot] })),
      ),
    ).call("list_usage_snapshots", {});

  const accepted = await listWith(row);
  expect(accepted.isError).toBeUndefined();
  expect(JSON.parse(accepted.content[0].text)).toEqual({ snapshots: [row] });

  for (const key of keys) {
    const { [key]: _omitted, ...missing } = row as Record<string, unknown>;
    const rejected = await listWith(missing);
    expect({ key, code: JSON.parse(rejected.content[0].text).error?.code }).toEqual({
      key,
      code: "CAREER_INVALID_RESPONSE",
    });
  }
});

test("번들에 파일을 읽는 코드가 없다", () => {
  const bundle = readFileSync(join(import.meta.dir, "../dist/career-mcp.js"), "utf8");
  expect(bundle).not.toContain("readFileSync");
  expect(bundle).not.toContain("statSync");
});

describe("저장 요청이 CLI 와 같은 경로, 본문, Idempotency-Key 로 간다", () => {
  const origin = "https://career.example.com/";
  const token = "x".repeat(40);
  type Sent = { url: string; body: unknown; key: string | null };

  function recorder(documentKey: string) {
    const sent: Sent[] = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      sent.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
        key: new Headers(init?.headers).get("Idempotency-Key"),
      });
      return new Response(
        JSON.stringify({ document: { documentKey, version: 4, updatedAt: "2026-09-01T00:00:00.000Z" } }),
        { status: 200 },
      );
    };
    return { sent, fetchImpl };
  }

  const payload = { body: "# 저장할 본문\n", note: "  경력 갱신  ", expectedVersion: 3 };

  const cases = [
    {
      tool: "save_context_document",
      documentKey: "career-status",
      viaCli: (fetchImpl: FetchLike) =>
        createCandidateContextClient({ origin, token, fetchImpl }).putDocument("career-status", payload),
    },
    {
      tool: "save_profile_document",
      documentKey: "github",
      viaCli: (fetchImpl: FetchLike) =>
        createProfileClient({ origin, token, fetchImpl }).putDocument("github", payload),
    },
  ] as const;

  for (const c of cases) {
    test(c.tool, async () => {
      const cli = recorder(c.documentKey);
      await c.viaCli(cli.fetchImpl);
      const plugin = recorder(c.documentKey);
      const result = await new CareerTools(new CareerBackend({ baseUrl: origin, token }, plugin.fetchImpl)).call(
        c.tool,
        { documentKey: c.documentKey, ...payload },
      );
      expect(result.isError).toBeUndefined();
      expect(cli.sent).toHaveLength(1);
      expect(plugin.sent).toHaveLength(1);
      expect(cli.sent[0]!.key).not.toBeNull();
      expect(plugin.sent[0]).toEqual(cli.sent[0]!);
    });
  }
});

describe("면접 연습 입력 스키마가 Backend 요청 스키마와 같은 칸을 갖는다", () => {
  const keysOf = (schema: { shape: Record<string, unknown> }) => Object.keys(schema.shape).sort();
  const optionalKeysOf = (schema: { shape: Record<string, { safeParse: (value: unknown) => { success: boolean } }> }) =>
    Object.entries(schema.shape)
      .filter(([, field]) => field.safeParse(undefined).success)
      .map(([key]) => key)
      .sort();

  test("연습 기록은 칸이 같고 attemptId 의 선택 여부만 다르다", () => {
    expect(keysOf(attemptInputSchema)).toEqual(keysOf(attemptBodySchema));
    expect(optionalKeysOf(attemptInputSchema)).toEqual([...optionalKeysOf(attemptBodySchema), "attemptId"].sort());
  });

  test("개인 질문 저장과 질문 한 개는 칸과 선택 여부가 같다", () => {
    expect(keysOf(personalQuestionInputSchema)).toEqual(keysOf(personalQuestionBodySchema));
    expect(keysOf(interviewQuestionSchema)).toEqual(keysOf(backendQuestionSchema));
    expect(optionalKeysOf(interviewQuestionSchema)).toEqual(optionalKeysOf(backendQuestionSchema));
  });
});

test("번들한 공개 질문 은행이 CLI 가 읽는 은행과 id 순서까지 같다", () => {
  const ids = (questions: Array<{ id: string }>) => questions.map((question) => question.id);
  expect(ids(publicTechQuestions)).toEqual(ids(loadQuestionBank("tech")));
  expect(ids(publicBehavioralQuestions)).toEqual(ids(loadQuestionBank("behavioral")));
  expect(publicTechQuestions.length).toBeGreaterThan(0);
  expect(publicBehavioralQuestions.length).toBeGreaterThan(0);
});

test("save_interview_attempt 는 attemptId 를 넘기면 CLI 의 recordAttempt 와 같은 경로, 본문, Idempotency-Key 로 간다", async () => {
  const origin = "https://career.example.com/";
  const token = "x".repeat(40);
  const body = {
    attemptId: "3f2b8c1e-4d5a-4b6c-9e7f-1a2b3c4d5e6f",
    drillType: "behavioral",
    questionId: "behavioral-ownership",
    topic: "ownership",
    question: "맡은 일을 끝까지 책임진 경험을 말해 주세요.",
    score: "pass",
    rootQuestionId: "behavioral-ownership",
    followUpDepth: 1,
    followUpAxis: "decision",
  } as const;
  type Sent = { url: string; method: string; body: unknown; key: string | null };
  function recorder() {
    const sent: Sent[] = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      sent.push({
        url: String(input),
        method: String(init?.method),
        body: JSON.parse(String(init?.body)),
        key: new Headers(init?.headers).get("Idempotency-Key"),
      });
      return new Response(
        JSON.stringify({
          attemptId: body.attemptId,
          evaluatedOn: "2026-10-01",
          progress: {
            drillType: "behavioral",
            topic: "ownership",
            passCount: 1,
            failCount: 0,
            nextReviewDate: "2026-10-02",
            lastPassedDate: "2026-10-01",
          },
        }),
        { status: 200 },
      );
    };
    return { sent, fetchImpl };
  }

  const cli = recorder();
  await new InterviewBackendClient({ baseUrl: origin, token, fetcher: cli.fetchImpl, maxRetries: 0 }).recordAttempt(body);
  const plugin = recorder();
  const result = await new CareerTools(new CareerBackend({ baseUrl: origin, token }, plugin.fetchImpl)).call(
    "save_interview_attempt",
    body,
  );
  expect(result.isError).toBeUndefined();
  expect(cli.sent).toHaveLength(1);
  expect(plugin.sent).toHaveLength(1);
  expect(cli.sent[0]!.key).toBe(body.attemptId);
  expect(plugin.sent[0]).toEqual(cli.sent[0]!);
});

describe("save_study_recommendation 이 CLI 의 createRecommendationRun 과 Backend 계약에 맞는다", () => {
  const origin = "https://career.example.com/";
  const token = "x".repeat(40);
  const reportId = "morning-2026-10-04";

  test("같은 리포트를 CLI 와 같은 URL, 본문, Idempotency-Key 로 보낸다", async () => {
    type Sent = { url: string; method: string; body: unknown; key: string | null };
    function recorder() {
      const sent: Sent[] = [];
      const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
        sent.push({
          url: String(input),
          method: String(init?.method),
          body: JSON.parse(String(init?.body)),
          key: new Headers(init?.headers).get("Idempotency-Key"),
        });
        return new Response(JSON.stringify({ reportId, historyVersion: 4 }), { status: 201 });
      };
      return { sent, fetchImpl };
    }

    const input = worstCaseRecommendation();
    const cli = recorder();
    await createStudyLibraryClient({ origin, token, fetchImpl: cli.fetchImpl, maxRetries: 0 }).createRecommendationRun({
      ...input,
      reportId,
    });
    const plugin = recorder();
    const result = await new CareerTools(
      new CareerBackend({ baseUrl: origin, token }, plugin.fetchImpl),
      undefined,
      () => new Date("2026-10-04T00:00:00.000Z"),
    ).call("save_study_recommendation", input);
    expect(result.isError).toBeUndefined();
    expect(cli.sent).toHaveLength(1);
    expect(plugin.sent).toHaveLength(1);
    expect(cli.sent[0]!.key).toMatch(/^recommendation:/);
    expect(plugin.sent[0]).toEqual(cli.sent[0]!);
  });

  // The plugin's limits must never be wider than the Backend's: a value the connector accepts
  // and the Backend rejects would cost an approval for nothing.
  test("모든 칸을 상한까지 채운 plugin 입력에 reportId 를 붙이면 Backend 스키마도 받는다", () => {
    const parsed = studyRecommendationRunSchema.safeParse({ ...worstCaseRecommendation(), reportId });
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
  });
});

describe("조사용 읽기 도구가 CLI 와 같은 GET 을 보내고 Backend 계약의 칸을 보존한다", () => {
  const origin = "https://career.example.com/";
  const token = "x".repeat(40);
  type Sent = { method: string; url: string; body: unknown };
  function recorder(body: unknown) {
    const sent: Sent[] = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      sent.push({ method: String(init?.method), url: String(input), body: init?.body });
      return new Response(JSON.stringify(body), { status: 200 });
    };
    return { sent, fetchImpl };
  }
  const tools = (fetchImpl: FetchLike) => new CareerTools(new CareerBackend({ baseUrl: origin, token }, fetchImpl));

  test("list_study_candidates 의 입력 칸은 Backend 후보 query 의 칸과 같다", () => {
    expect(Object.keys(listStudyCandidatesSchema.shape).sort()).toEqual(
      Object.keys(studyCandidatesQuerySchema.shape).sort(),
    );
  });

  test("list_study_candidates 는 CLI 의 getCandidates 와 같은 URL 로 GET 하고 CLI 계약을 통과하는 쪽을 받는다", async () => {
    const page = {
      candidates: [
        {
          id: urlKey(7),
          contentKey: urlKey(7),
          canonicalUrl: "https://blog.example.com/posts/idempotency",
          sourceKey: "example-blog",
          sourceName: "예시 기술 블로그",
          category: "techBlog",
          title: "멱등 키 설계",
          url: "https://blog.example.com/posts/idempotency",
          published: "2026-09-30",
          kind: "feed-article",
          previouslyRecommended: false,
        },
      ],
      recentStudyTopicKeys: ["idempotency-key"],
      nextCursor: "eyJ4IjoxfQ",
      historyVersion: 1,
      candidateContextVersion: "learning-interests:v1",
      learningInterests: { version: 1, body: "# 관심사\n" },
    };
    expect(studyLibraryCandidatePageSchema.safeParse(page).success).toBe(true);
    const filters = {
      limit: 10,
      category: "ai",
      sourceKey: "example-blog",
      publishedFrom: "2026-09-01T00:00:00Z",
      publishedTo: "2026-10-01T00:00:00Z",
      cursor: "eyJ4IjowfQ",
    } as const;

    const cli = recorder(page);
    await createStudyLibraryClient({ origin, token, fetchImpl: cli.fetchImpl, maxRetries: 0 }).getCandidates(
      Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, String(value)])),
    );
    const plugin = recorder(page);
    const result = await tools(plugin.fetchImpl).call("list_study_candidates", filters);
    expect(result.isError).toBeUndefined();
    expect(plugin.sent).toEqual([{ method: "GET", url: expect.any(String), body: undefined }]);
    const params = (sent: Sent[]) => Object.fromEntries(new URL(sent[0]!.url).searchParams);
    expect(new URL(plugin.sent[0]!.url).pathname).toBe(new URL(cli.sent[0]!.url).pathname);
    expect(params(plugin.sent)).toEqual(params(cli.sent));
    const row = JSON.parse(result.content[0].text).candidates[0];
    for (const key of ["contentKey", "canonicalUrl", "url", "sourceKey", "sourceName", "title", "published"] as const)
      expect({ key, value: row[key] }).toEqual({ key, value: page.candidates[0]![key] });
  });

  test("get_position_research_constraints 는 CLI 의 getExclusions, listCompanyPreferences 와 같은 URL 로 GET 하고 Backend 계약의 칸을 그대로 낸다", async () => {
    const exclusions = [
      {
        scope: "posting",
        source: "example-jobs",
        url: "https://jobs.example.com/postings/7",
        decisionKind: "manual",
        reason: "이미 지원했다",
        evidenceUrls: ["https://jobs.example.com/postings/7"],
        decidedAt: "2026-09-01",
        expiresAt: "2026-12-01",
      },
      {
        scope: "company-role",
        company: "example-corp",
        titleKeywords: ["데이터 엔지니어"],
        decisionKind: "career-downside",
        reason: "역할 범위가 맞지 않는다",
        evidenceUrls: ["https://jobs.example.com/companies/example-corp"],
        confidence: "medium",
        decidedAt: "2026-08-01",
      },
    ];
    const preferences = [
      {
        companyKey: "example-corp",
        companyName: "예시 주식회사",
        tier: 2,
        disposition: "benchmark",
        techBlogFeedUrl: "https://tech.example.com/feed.xml",
        githubOrg: "example-corp",
        dartCorpCode: "00000001",
        blindCompanySlug: "example-corp",
        updatedAt: "2026-09-20T01:00:00.000Z",
      },
    ];
    for (const rule of exclusions) expect(backendExclusionSchema.safeParse(rule).success).toBe(true);
    for (const preference of preferences) expect(backendCompanyPreferenceSchema.safeParse(preference).success).toBe(true);

    const respond = (sent: Sent[]) => async (input: string | URL | Request, init?: RequestInit) => {
      sent.push({ method: String(init?.method), url: String(input), body: init?.body });
      const body = String(input).endsWith("/exclusions") ? exclusions : preferences;
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const cliSent: Sent[] = [];
    const cli = new CareerBackendClient({ baseUrl: origin, token, fetcher: respond(cliSent), maxRetries: 0 });
    await cli.getExclusions();
    await cli.listCompanyPreferences();
    const pluginSent: Sent[] = [];
    const result = await tools(respond(pluginSent)).call("get_position_research_constraints", {});
    expect(result.isError).toBeUndefined();
    const lines = (sent: Sent[]) => sent.map((call) => `${call.method} ${call.url}`).sort();
    expect(lines(pluginSent)).toEqual(lines(cliSent));
    expect(pluginSent.every((call) => call.body === undefined)).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({
      readiness: "ready",
      missing: [],
      exclusions,
      companyPreferences: preferences,
    });
  });
});
