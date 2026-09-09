import { describe, expect, test } from "bun:test";
import type { SourceDiagnostic } from "./contracts.ts";
import { DEFAULT_MAX_FAILED_SOURCES, judgeCollectionHealth } from "./collection_health.ts";

function diagnostic(source: string, status: SourceDiagnostic["status"]): SourceDiagnostic {
  return {
    source: source as SourceDiagnostic["source"],
    status,
    collectedCount: status === "failed" ? 0 : 5,
    importedCount: status === "failed" ? 0 : 5,
    skippedCount: 0,
    failedCount: status === "failed" ? 1 : 0,
    discoveryModes: [],
    message: `${source}: ${status}`,
  };
}

/** 후보가 있는 정상 실행의 후보 수. 개수 자체는 판정에 쓰이지 않는다. */
const SOME_CANDIDATES = 195;

describe("judgeCollectionHealth 실패 소스 판정", () => {
  test("모든 소스가 성공하면 통과한다", () => {
    const health = judgeCollectionHealth(
      [diagnostic("wanted", "ok"), diagnostic("toss-careers", "ok"), diagnostic("kakaopay", "ok")],
      DEFAULT_MAX_FAILED_SOURCES,
      SOME_CANDIDATES,
    );

    expect(health.ok).toBe(true);
    expect(health.failedSources).toEqual([]);
    expect(health.reasons).toEqual([]);
    expect(health.warnings).toEqual([]);
  });

  test("결과를 낸 부분 성공은 실패로 세지 않는다", () => {
    const health = judgeCollectionHealth(
      [
        diagnostic("wanted", "ok"),
        diagnostic("toss-careers", "partial"),
        diagnostic("kakaopay", "ok"),
      ],
      DEFAULT_MAX_FAILED_SOURCES,
      SOME_CANDIDATES,
    );

    expect(health.ok).toBe(true);
    expect(health.failedSources).toEqual([]);
  });

  test("오류 없이 결과가 0건인 소스는 실패로 세지 않는다", () => {
    const empty: SourceDiagnostic = {
      ...diagnostic("naver-careers", "ok"),
      collectedCount: 0,
      importedCount: 0,
      failedCount: 0,
    };
    const health = judgeCollectionHealth([diagnostic("wanted", "ok"), empty], 0, SOME_CANDIDATES);

    expect(health.ok).toBe(true);
    expect(health.failedSources).toEqual([]);
  });

  test("하나도 수집하지 못한 채 오류만 낸 부분 성공은 실패로 센다", () => {
    const degraded: SourceDiagnostic = {
      ...diagnostic("samsung-careers", "partial"),
      collectedCount: 0,
      importedCount: 0,
      failedCount: 3,
    };
    const health = judgeCollectionHealth([diagnostic("wanted", "ok"), degraded], 0, SOME_CANDIDATES);

    expect(health.ok).toBe(false);
    expect(health.failedSources).toEqual(["samsung-careers"]);
  });

  test("허용 개수까지의 실패는 통과하고 실패한 소스 이름을 경고로 알린다", () => {
    const health = judgeCollectionHealth(
      [
        diagnostic("wanted", "ok"),
        diagnostic("naver-careers", "failed"),
        diagnostic("samsung-careers", "failed"),
      ],
      DEFAULT_MAX_FAILED_SOURCES,
      SOME_CANDIDATES,
    );

    expect(health.ok).toBe(true);
    expect(health.failedSources).toEqual(["naver-careers", "samsung-careers"]);
    expect(health.warnings.join(" ")).toContain("naver-careers");
    expect(health.warnings.join(" ")).toContain("samsung-careers");
  });

  test("허용 개수를 넘으면 실패로 판정하고 실패한 소스를 사유에 담는다", () => {
    const health = judgeCollectionHealth(
      [
        diagnostic("wanted", "ok"),
        diagnostic("coupang-careers", "failed"),
        diagnostic("woowahan-careers", "failed"),
        diagnostic("kakaopay", "failed"),
      ],
      DEFAULT_MAX_FAILED_SOURCES,
      SOME_CANDIDATES,
    );

    expect(health.ok).toBe(false);
    expect(health.configuredCount).toBe(4);
    expect(health.failedSources).toEqual(["coupang-careers", "woowahan-careers", "kakaopay"]);
    expect(health.reasons.join(" ")).toContain("소스 4개 중 3개가 실패했다");
    expect(health.reasons.join(" ")).toContain("coupang-careers");
    expect(health.reasons.join(" ")).toContain("kakaopay");
  });

  test("단일 소스 수집에서 그 소스가 실패하면 중단한다", () => {
    const health = judgeCollectionHealth([diagnostic("coupang-careers", "failed")], 0, 0);

    expect(health.ok).toBe(false);
    expect(health.reasons.join(" ")).toContain("coupang-careers");
  });
});

describe("judgeCollectionHealth 후보 개수 판정", () => {
  test("소스가 모두 성공했어도 후보가 0건이면 중단한다", () => {
    const health = judgeCollectionHealth(
      [diagnostic("wanted", "ok"), diagnostic("toss-careers", "ok")],
      DEFAULT_MAX_FAILED_SOURCES,
      0,
    );

    expect(health.ok).toBe(false);
    expect(health.reasons.join(" ")).toContain("후보가 0건");
  });

  test("후보가 1건이면 통과한다", () => {
    const health = judgeCollectionHealth(
      [diagnostic("wanted", "ok")],
      DEFAULT_MAX_FAILED_SOURCES,
      1,
    );

    expect(health.ok).toBe(true);
  });
});

describe("judgeCollectionHealth 경고", () => {
  test("허용 개수가 소스 수 이상이면 판정이 없어진다고 경고한다", () => {
    const health = judgeCollectionHealth(
      [diagnostic("wanted", "ok"), diagnostic("toss-careers", "ok")],
      2,
      SOME_CANDIDATES,
    );

    expect(health.ok).toBe(true);
    expect(health.warnings.join(" ")).toContain("실패 판정이 동작하지 않는다");
  });

  test("소스 수보다 작은 허용 개수에는 그 경고를 내지 않는다", () => {
    const health = judgeCollectionHealth(
      [diagnostic("wanted", "ok"), diagnostic("toss-careers", "ok"), diagnostic("kakaopay", "ok")],
      2,
      SOME_CANDIDATES,
    );

    expect(health.warnings).toEqual([]);
  });
});
