import { afterEach, describe, expect, test } from "bun:test";
import {
  cleanupCareerWorkspaces,
  createCareerWorkspace,
  writeContextDocument,
} from "../test-support.ts";
import { ANALYSIS_POLICY_PATH, legacyCase, materializeBody, PREFIX } from "./legacy-fixture.ts";
import type { AnalysisQueueResponse } from "./schema.ts";
import { PositionStore } from "./store.ts";

afterEach(cleanupCareerWorkspaces);

type CollectionBody = {
  pool: { collectionRunId: string; collectedAt: string; candidates: Array<Record<string, unknown>> };
};

const policyBody = materializeBody(ANALYSIS_POLICY_PATH, legacyCase("ok-04-put-analysis-policy").request.body);
const tierResultsBody = materializeBody(
  `${PREFIX}/company-tier-runs/x/results`,
  legacyCase("ok-08-post-company-tier-results").request.body,
) as { collectionRunId: string; results: Array<Record<string, unknown>>; failures: unknown[] };
const analysisTemplate = (
  legacyCase("ok-10-post-analysis-results").request.body as { results: Array<Record<string, unknown>> }
).results[0]!;

function collection(
  runId: string,
  collectedAt: string,
  change: (candidates: Array<Record<string, unknown>>) => void = () => {},
): CollectionBody {
  const body = structuredClone(legacyCase("ok-07-post-collection-run").request.body) as CollectionBody;
  body.pool.collectionRunId = runId;
  body.pool.collectedAt = collectedAt;
  change(body.pool.candidates);
  return body;
}

function setup() {
  const workspace = createCareerWorkspace({ "position-preferences": "- 백엔드 플랫폼" });
  return { ...workspace, store: new PositionStore(workspace.db) };
}

/** 수집 하나를 회사 판정과 공고 분석까지 끝내고 분석 큐를 돌려준다. */
async function runCollection(store: PositionStore, body: CollectionBody): Promise<AnalysisQueueResponse> {
  const runId = body.pool.collectionRunId;
  const prepared = await store.saveCollection(body, `collect:${runId}`);
  const companies = prepared.companyTierQueue.companies;
  if (companies.length > 0) {
    await store.saveCompanyTierResults(
      prepared.companyTierQueue.companyTierRunId,
      {
        ...tierResultsBody,
        collectionRunId: runId,
        results: companies.map((company) => ({ ...tierResultsBody.results[0], companyKey: company.companyKey })),
        failures: [],
      },
      `tiers:${runId}`,
    );
  }
  const queue = await store.createPositionAnalysisRun(runId, `analysis:${runId}`);
  if (queue.candidates.length > 0) {
    await store.saveAnalysisResults(
      queue.analysisRunId,
      {
        schemaVersion: 2,
        collectionRunId: runId,
        results: queue.candidates.map((candidate) => ({ ...analysisTemplate, positionId: candidate.positionId })),
        failures: [],
      },
      `results:${runId}`,
    );
  }
  return queue;
}

describe("공고 추천 저장 모듈", () => {
  test("정책이 없으면 수집을 받지 않는다", async () => {
    const { store } = setup();
    await expect(store.saveCollection(collection("run-a", "2026-09-17T00:00:00.000Z"), "k")).rejects.toMatchObject({
      code: "POLICY_NOT_CONFIGURED",
    });
  });

  test("맥락 문서가 없으면 수집을 받지 않는다", async () => {
    const { db } = createCareerWorkspace();
    const store = new PositionStore(db);
    await store.configureAnalysisPolicy(policyBody, "policy");
    await expect(store.saveCollection(collection("run-a", "2026-09-17T00:00:00.000Z"), "k")).rejects.toMatchObject({
      code: "CANDIDATE_CONTEXT_MISSING",
    });
  });

  test("두 번째 수집은 바뀌지 않은 공고와 평가한 회사를 다시 큐에 넣지 않는다", async () => {
    const { store } = setup();
    await store.configureAnalysisPolicy(policyBody, "policy");
    const first = await runCollection(store, collection("run-a", "2026-09-17T00:00:00.000Z"));
    expect(first.candidates.map((candidate) => candidate.analysisStatus)).toEqual(["new", "new"]);

    const prepared = await store.saveCollection(collection("run-b", "2026-09-18T00:00:00.000Z"), "collect:run-b");
    expect(prepared.companyTierQueue.companies).toEqual([]);
    expect(prepared.summary).toMatchObject({ activeCount: 2, reusedCount: 2, pendingCount: 0 });
    const second = await store.createPositionAnalysisRun("run-b", "analysis:run-b");
    expect(second.candidates).toEqual([]);

    const recommendation = await store.createRecommendation(second.analysisRunId, "recommend:run-b");
    expect(recommendation.ranking).toHaveLength(2);
    expect(recommendation.analysisSummary).toMatchObject({ analyzedNowCount: 0, reusedCount: 2, pendingCount: 0 });
  });

  test("본문이 바뀐 공고만 다시 분석 큐에 든다", async () => {
    const { store } = setup();
    await store.configureAnalysisPolicy(policyBody, "policy");
    await runCollection(store, collection("run-a", "2026-09-17T00:00:00.000Z"));
    const changed = collection("run-b", "2026-09-18T00:00:00.000Z", (candidates) => {
      candidates[0]!.summary = "주요 업무가 바뀌었다";
    });
    await store.saveCollection(changed, "collect:run-b");
    const queue = await store.createPositionAnalysisRun("run-b", "analysis:run-b");
    expect(queue.candidates.map((candidate) => [candidate.candidateId, candidate.analysisStatus])).toEqual([
      [changed.pool.candidates[0]!.id as string, "changed"],
    ]);
  });

  test("맥락 문서 본문이 바뀌면 다시 분석하고, 공백만 바뀌면 재사용한다", async () => {
    const { store, root } = setup();
    await store.configureAnalysisPolicy(policyBody, "policy");
    await runCollection(store, collection("run-a", "2026-09-17T00:00:00.000Z"));

    writeContextDocument(root, "position-preferences", "\n- 백엔드 플랫폼  \r\n\n");
    await store.saveCollection(collection("run-b", "2026-09-18T00:00:00.000Z"), "collect:run-b");
    expect((await store.createPositionAnalysisRun("run-b", "analysis:run-b")).candidates).toEqual([]);

    writeContextDocument(root, "position-preferences", "- 백엔드 플랫폼\n- AI 서비스");
    const prepared = await store.saveCollection(collection("run-c", "2026-09-19T00:00:00.000Z"), "collect:run-c");
    expect(prepared.companyTierQueue.companies).toHaveLength(2);
    const queue = await runCollection(store, collection("run-c", "2026-09-19T00:00:00.000Z"));
    expect(queue.candidates.map((candidate) => candidate.analysisStatus)).toEqual(["stale", "stale"]);
  });

  test("제외로 등록한 회사의 공고는 저장하지 않는다", async () => {
    const { store } = setup();
    await store.configureAnalysisPolicy(policyBody, "policy");
    const body = collection("run-a", "2026-09-17T00:00:00.000Z");
    const company = body.pool.candidates[0]!.company as string;
    await store.updateCompanyPreference(
      company.toLocaleLowerCase("ko-KR"),
      { companyKey: company.toLocaleLowerCase("ko-KR"), companyName: company, tier: 3, disposition: "exclude" },
      "preference",
    );
    const prepared = await store.saveCollection(body, "collect:run-a");
    expect(prepared.summary.activeCount).toBe(1);
  });

  test("제외 규칙은 만료일까지 적용하고 다음 날부터 뺀다", async () => {
    const { store } = setup();
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
    const yesterday = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );
    const rule = (company: string, expiresAt?: string) => ({
      scope: "company",
      company,
      decisionKind: "manual",
      reason: "재지원 간격",
      evidenceUrls: ["https://example.com/reason"],
      decidedAt: "2026-09-01",
      ...(expiresAt ? { expiresAt } : {}),
    });
    const saved = await store.replaceExclusions(
      { schemaVersion: 2, exclusions: [rule("오늘까지", today), rule("어제까지", yesterday), rule("기한 없음")] },
      "exclusions-1",
    );
    expect(saved.map((entry) => (entry.scope === "company" ? entry.company : "")).sort()).toEqual(["기한 없음", "오늘까지"]);
    expect(await store.getExclusions()).toEqual(saved);

    // 목록 전체를 바꾼다. 앞의 규칙은 남지 않는다.
    await store.replaceExclusions({ schemaVersion: 2, exclusions: [rule("새 규칙")] }, "exclusions-2");
    expect((await store.getExclusions()).map((entry) => (entry.scope === "company" ? entry.company : ""))).toEqual(["새 규칙"]);
  });

  test("같은 분석 실행의 추천은 멱등 키가 달라도 하나만 만든다", async () => {
    const { store, db } = setup();
    await store.configureAnalysisPolicy(policyBody, "policy");
    const queue = await runCollection(store, collection("run-a", "2026-09-17T00:00:00.000Z"));
    const first = await store.createRecommendation(queue.analysisRunId, "recommend-1");
    const second = await store.createRecommendation(queue.analysisRunId, "recommend-2");
    expect(second.recommendationRunId).toBe(first.recommendationRunId);
    expect(second.ranking).toEqual(first.ranking);
    expect(db.all("SELECT recommendation_run_id FROM position_recommendation_runs")).toHaveLength(1);
    expect(await store.getRun(first.recommendationRunId)).toMatchObject({
      recommendationRunId: first.recommendationRunId,
    });
  });

  test("회사 근거는 같은 출처면 갱신하되 더 오래된 관측으로 덮지 않고, 유효한 것만 돌려준다", async () => {
    const { store } = setup();
    await store.configureAnalysisPolicy(policyBody, "policy");
    const prepared = await store.saveCollection(collection("run-a", "2026-09-17T00:00:00.000Z"), "collect:run-a");
    const runId = prepared.companyTierQueue.companyTierRunId;
    const companyKey = prepared.companyTierQueue.companies[0]!.companyKey;
    const far = "2099-12-31";
    const evidence = (summary: string, observedAt: string, validUntil = far, url = "https://example.com/blog") => ({
      sourceType: "tech-blog",
      url,
      summary,
      payloadJson: { posts: 3 },
      observedAt,
      validUntil,
    });
    const put = (key: string, items: unknown[]) =>
      store.putCompanyEvidence(runId, { schemaVersion: 1, companies: [{ companyKey, evidence: items }] }, key);

    expect((await put("e-1", [evidence("처음", "2026-09-10T00:00:00.000Z")])).companies).toEqual([{ companyKey, savedCount: 1 }]);
    await put("e-2", [evidence("더 오래된 관측", "2026-09-01T00:00:00.000Z")]);
    expect((await store.getCompanyEvidence(companyKey)).map((item) => item.summary)).toEqual(["처음"]);
    await put("e-3", [evidence("같은 시각의 재전송", "2026-09-10T00:00:00.000Z")]);
    expect((await store.getCompanyEvidence(companyKey)).map((item) => item.summary)).toEqual(["같은 시각의 재전송"]);
    // 한 요청 안의 같은 출처는 하나로 세고, 만료된 근거는 조회에서 빠진다.
    const saved = await put("e-4", [
      evidence("새 관측", "2026-09-12T00:00:00.000Z"),
      evidence("같은 요청의 더 새 관측", "2026-09-13T00:00:00.000Z"),
      evidence("만료된 근거", "2020-01-01T00:00:00.000Z", "2020-01-02", "https://example.com/old"),
    ]);
    expect(saved.companies).toEqual([{ companyKey, savedCount: 2 }]);
    const valid = await store.getCompanyEvidence(companyKey);
    expect(valid.map((item) => item.summary)).toEqual(["같은 요청의 더 새 관측"]);
    expect(valid[0]).toMatchObject({ payloadJson: { posts: 3 }, validUntil: far, observedAt: "2026-09-13T00:00:00.000Z" });
    expect((await store.getActiveCompanyPostings(companyKey)).length).toBeGreaterThan(0);
    await expect(store.putCompanyEvidence("missing-run", { schemaVersion: 1, companies: [{ companyKey, evidence: [evidence("x", "2026-09-10T00:00:00.000Z")] }] }, "e-5")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("끝난 회사 판정 실행에는 근거를 더 저장하지 않는다", async () => {
    const { store } = setup();
    await store.configureAnalysisPolicy(policyBody, "policy");
    const body = collection("run-a", "2026-09-17T00:00:00.000Z");
    await runCollection(store, body);
    const run = await store.saveCollection(body, "collect:run-a");
    await expect(
      store.putCompanyEvidence(
        run.companyTierQueue.companyTierRunId,
        { schemaVersion: 1, companies: [{ companyKey: "회사 1", evidence: [{ sourceType: "official", url: "https://example.com/x", summary: "늦은 근거", payloadJson: {}, observedAt: "2026-09-17T00:00:00.000Z", validUntil: "2099-01-01" }] }] },
        "late",
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  test("정책을 바꾸면 조회가 바뀐 값을 돌려주고, 없을 때 조회는 POLICY_NOT_CONFIGURED 다", async () => {
    const { store } = setup();
    await expect(store.getAnalysisPolicy()).rejects.toMatchObject({ code: "POLICY_NOT_CONFIGURED", status: 409 });
    await store.configureAnalysisPolicy(policyBody, "policy-1");
    const changed = { ...(policyBody as Record<string, unknown>), dailyCompanyTierLimit: 1 };
    await store.configureAnalysisPolicy(changed, "policy-2");
    expect(await store.getAnalysisPolicy()).toEqual(changed as never);
    // 하루 회사 평가 상한이 큐 길이를 정한다.
    const prepared = await store.saveCollection(collection("run-a", "2026-09-17T00:00:00.000Z"), "collect:run-a");
    expect(prepared.companyTierQueue.companies).toHaveLength(1);
  });

  test("본문이 계약과 다르면 BAD_REQUEST 이고 아무것도 저장하지 않는다", async () => {
    const { store, db } = setup();
    await expect(store.configureAnalysisPolicy({ schemaVersion: 2 }, "policy")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
    });
    expect(db.all("SELECT singleton_id FROM position_analysis_policy")).toEqual([]);
    expect(db.all("SELECT idempotency_key FROM request_receipts")).toEqual([]);
  });
});
