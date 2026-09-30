import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AnalysisPolicy } from "../../services/career-backend/src/positions/schema.ts";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import type { CandidateContextDocument } from "./contracts.ts";
import { positionContextVersion, prepareCandidateContext, syncPositionPolicy } from "./position-policy.ts";

const directories: string[] = [];
const repositoryRoot = dirname(dirname(dirname(import.meta.dir)));

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function tempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "position-policy."));
  directories.push(directory);
  return directory;
}

/** 성공하면 테스트를 실패시키고, 거절되면 그 오류를 돌려준다. */
async function rejection(promise: Promise<unknown>): Promise<Error> {
  const outcome = await promise.then((value) => ({ value }), (error: unknown) => ({ error }));
  if (!("error" in outcome)) throw new Error(`거절되어야 하는데 성공했다: ${JSON.stringify(outcome.value)}`);
  expect(outcome.error).toBeInstanceOf(Error);
  return outcome.error as Error;
}

function policy(candidateContextVersion: string, overrides: Partial<AnalysisPolicy> = {}): AnalysisPolicy {
  return {
    schemaVersion: 2,
    candidateContextVersion,
    dailyAnalysisLimit: 7,
    prioritySlots: 4,
    agingSlots: 3,
    staleAfterDays: 30,
    defaultCompanyTier: 2,
    dailyCompanyTierLimit: 5,
    companyTierStaleAfterDays: 90,
    ...overrides,
  };
}

/**
 * 정책 저장소를 흉내 낸다. `apply` 가 false 를 돌려주는 호출은 멱등 응답이 재생된 것처럼 저장하지 않고 성공만 돌려준다.
 * `apply` 는 몇 번째 PUT 인지(0부터)를 받는다.
 */
function fakePositions(initial: AnalysisPolicy | undefined, options: { apply?: (call: number) => boolean } = {}) {
  let stored = initial;
  const sent: { body: unknown; idempotencyKey: string }[] = [];
  return {
    sent,
    stored: () => stored,
    async getAnalysisPolicy() {
      if (!stored) throw new CareerBackendHttpError(409, "POLICY_NOT_CONFIGURED", "커리어 Backend 요청이 실패했습니다.");
      return stored;
    },
    async configureAnalysisPolicy(body: unknown, idempotencyKey: string) {
      const call = sent.length;
      sent.push({ body, idempotencyKey });
      if (options.apply?.(call) ?? true) stored = body as AnalysisPolicy;
      return body as AnalysisPolicy;
    },
  };
}

function fakeContext(documents: Partial<Record<string, { version: number; body: string }>>) {
  const requested: string[] = [];
  return {
    requested,
    async getDocument(key: string): Promise<CandidateContextDocument> {
      requested.push(key);
      const found = documents[key];
      if (!found) throw new CareerBackendHttpError(404, "NOT_FOUND", "커리어 Backend 요청이 실패했습니다.");
      return { documentKey: key as CandidateContextDocument["documentKey"], version: found.version, body: found.body, note: "메모", updatedAt: "2026-09-01T00:00:00.000Z" };
    },
  };
}

describe("syncPositionPolicy", () => {
  test("버전이 다르면 나머지 칸을 그대로 두고 candidateContextVersion 만 바꿔 보낸다", async () => {
    const positions = fakePositions(policy("position-preferences:v2"));

    const result = await syncPositionPolicy({ positions, version: 3 });

    expect(result).toEqual({ candidateContextVersion: "position-preferences:v3", changed: true });
    expect(positions.sent.map((call) => call.body)).toEqual([policy("position-preferences:v3")]);
    expect(positions.stored()).toEqual(policy("position-preferences:v3"));
  });

  test("이미 같으면 보내지 않는다", async () => {
    const positions = fakePositions(policy("position-preferences:v3"));

    expect(await syncPositionPolicy({ positions, version: 3 })).toEqual({ candidateContextVersion: "position-preferences:v3", changed: false });
    expect(positions.sent).toEqual([]);
  });

  test("멱등 키는 읽은 정책 전체에 따라 달라지고 configure 명령의 키와 겹치지 않는다", async () => {
    const first = fakePositions(policy("position-preferences:v2"));
    const second = fakePositions(policy("position-preferences:v2", { staleAfterDays: 14 }));

    await syncPositionPolicy({ positions: first, version: 3 });
    await syncPositionPolicy({ positions: second, version: 3 });

    const [firstKey, secondKey] = [first.sent[0]!.idempotencyKey, second.sent[0]!.idempotencyKey];
    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).not.toBe("analysis-policy:position-preferences:v3");
  });

  test("첫 PUT 이 재생돼 값이 그대로면 무작위 값을 붙인 다른 키로 한 번 더 보내 적용한다", async () => {
    const positions = fakePositions(policy("position-preferences:v2"), { apply: (call) => call > 0 });

    const result = await syncPositionPolicy({ positions, version: 3, retryNonce: () => "fixed-nonce" });

    expect(result).toEqual({ candidateContextVersion: "position-preferences:v3", changed: true });
    expect(positions.sent.map((call) => call.body)).toEqual([policy("position-preferences:v3"), policy("position-preferences:v3")]);
    const [firstKey, secondKey] = positions.sent.map((call) => call.idempotencyKey);
    expect(secondKey).not.toBe(firstKey);
    expect(secondKey).toBe(`${firstKey}:fixed-nonce`);
    expect(secondKey!.length).toBeLessThanOrEqual(200);
    expect(positions.stored()).toEqual(policy("position-preferences:v3"));
  });

  test("재시도까지 적용되지 않으면 PUT 을 두 번만 보내고 성공으로 보고하지 않는다", async () => {
    const positions = fakePositions(policy("position-preferences:v2"), { apply: () => false });

    const error = await rejection(syncPositionPolicy({ positions, version: 3, retryNonce: () => "fixed-nonce" }));

    expect(error.message).toContain("position-preferences:v2");
    expect(error.message).toContain("position-preferences:v3");
    expect(error.message).toContain("manage_candidate_context.ts sync-position-policy");
    expect(positions.sent).toHaveLength(2);
    expect(positions.sent[1]!.idempotencyKey).not.toBe(positions.sent[0]!.idempotencyKey);
    expect(positions.stored()).toEqual(policy("position-preferences:v2"));
  });

  test("무작위 값을 넘기지 않아도 재시도 키는 첫 키와 다르다", async () => {
    const positions = fakePositions(policy("position-preferences:v2"), { apply: (call) => call > 0 });

    await syncPositionPolicy({ positions, version: 3 });

    const [firstKey, secondKey] = positions.sent.map((call) => call.idempotencyKey);
    expect(secondKey!.startsWith(`${firstKey}:`)).toBe(true);
    expect(secondKey!.length).toBeLessThanOrEqual(200);
  });

  test("정책이 없으면 configure 명령으로 먼저 만들라고 안내한다", async () => {
    const positions = fakePositions(undefined);

    await expect(syncPositionPolicy({ positions, version: 1 })).rejects.toThrow(
      "career-os/scripts/position-recommender/configure_position_analysis_policy.ts",
    );
    expect(positions.sent).toEqual([]);
  });
});

describe("prepareCandidateContext", () => {
  const documents = {
    "position-preferences": { version: 4, body: "예시 선호 문장" },
    "application-state": { version: 2, body: "예시 지원 상태 문장" },
  };

  test("버전이 같으면 두 문서와 기준 버전을 candidate-context.json 에 쓴다", async () => {
    const path = join(tempDir(), "candidate-context.json");

    const result = await prepareCandidateContext({ candidateContext: path }, {
      positions: fakePositions(policy(positionContextVersion(4))),
      context: fakeContext(documents),
    });

    expect(result).toEqual({ candidateContextVersion: "position-preferences:v4" });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      candidateContextVersion: "position-preferences:v4",
      documents: {
        "position-preferences": { version: 4, body: "예시 선호 문장" },
        "application-state": { version: 2, body: "예시 지원 상태 문장" },
      },
    });
  });

  test("버전이 다르면 두 값과 sync 명령을 알리고 파일을 쓰지 않는다", async () => {
    const path = join(tempDir(), "candidate-context.json");

    const error = await rejection(prepareCandidateContext({ candidateContext: path }, {
      positions: fakePositions(policy("position-preferences:v3")),
      context: fakeContext(documents),
    }));

    expect(error.message).toContain("position-preferences:v3");
    expect(error.message).toContain("position-preferences:v4");
    expect(error.message).toContain("career-os/scripts/candidate-context/manage_candidate_context.ts sync-position-policy");
    expect(existsSync(path)).toBe(false);
  });

  test("문서가 없으면 빠진 키를 모두 알리고 파일을 쓰지 않는다", async () => {
    const path = join(tempDir(), "candidate-context.json");

    const error = await rejection(prepareCandidateContext({ candidateContext: path }, {
      positions: fakePositions(policy("position-preferences:v4")),
      context: fakeContext({}),
    }));

    expect(error.message).toContain("position-preferences, application-state");
    expect(error.message).toContain("--expected-version 0");
    expect(existsSync(path)).toBe(false);
  });

  test("정책이 없으면 configure 명령으로 먼저 만들라고 안내한다", async () => {
    const path = join(tempDir(), "candidate-context.json");

    await expect(prepareCandidateContext({ candidateContext: path }, {
      positions: fakePositions(undefined),
      context: fakeContext(documents),
    })).rejects.toThrow("configure_position_analysis_policy.ts");
    expect(existsSync(path)).toBe(false);
  });

  test("저장소 안 경로는 조회 전에 거절한다", async () => {
    const path = join(repositoryRoot, "career-os", "tmp-candidate-context.json");
    const context = fakeContext(documents);

    await expect(prepareCandidateContext({ candidateContext: path }, {
      positions: fakePositions(policy("position-preferences:v4")),
      context,
    })).rejects.toThrow("candidate-context.json 은 저장소 밖");
    expect(context.requested).toEqual([]);
    expect(existsSync(path)).toBe(false);
  });
});
