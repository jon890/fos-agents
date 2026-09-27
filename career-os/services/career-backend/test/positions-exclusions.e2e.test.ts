import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startE2eHarness, type E2eHarness } from "./support/e2e-harness.js";

let harness: E2eHarness;

beforeAll(async () => {
  harness = await startE2eHarness();
});

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.clearAll();
});

const postingRule = {
  scope: "posting",
  source: "wanted",
  identityHash: "wanted:example-id",
  decisionKind: "manual",
  reason: "지원 결과가 나와 후보풀에서 뺀다.",
  evidenceUrls: ["https://example.com/jobs/example-id"],
  confidence: "medium",
  decidedAt: "2026-09-10",
};

const companyRule = {
  scope: "company",
  company: "예시 주식회사",
  decisionKind: "career-downside",
  reason: "역할 범위가 희망하는 모듈 소유권과 맞지 않는다.",
  evidenceUrls: ["https://example.com/report/one", "https://example.com/report/two"],
  decidedAt: "2026-09-11",
};

/**
 * Seoul 기준 날짜를 낸다.
 *
 * 만료일 경계는 하루 단위라 지금이 언제인지에 따라 어제와 오늘이 달라진다.
 * 기대값을 고정한 날짜로 적으면 그 날이 지난 뒤부터 경계를 확인하지 못한다.
 */
function seoulDate(value: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function put(exclusions: unknown[], idempotencyKey: string) {
  return harness.send("PUT", "/api/positions/v1/exclusions", {
    body: { schemaVersion: 2, exclusions },
    idempotencyKey,
  });
}

function get() {
  return harness.send("GET", "/api/positions/v1/exclusions", {});
}

async function countRows(): Promise<number> {
  const rows = await harness.prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    "SELECT COUNT(*) AS total FROM position_exclusions",
  );
  return Number(rows[0]!.total);
}

describe("개인 공고 제외 규칙", () => {
  it("대체한 규칙을 조회가 그대로 돌려준다", async () => {
    const replaced = await put([postingRule, companyRule], "exclusions-roundtrip");
    expect(replaced.status).toBe(200);

    const read = await get();
    expect(read.status).toBe(200);
    const rules = read.json as Array<Record<string, unknown>>;
    expect(rules).toHaveLength(2);
    expect(
      [...rules].sort((left, right) => String(left.scope).localeCompare(String(right.scope))),
    ).toEqual([companyRule, postingRule]);
    expect(replaced.json).toEqual(read.json);
  });

  it("대체는 이전 규칙을 남기지 않는다", async () => {
    await put([postingRule, companyRule], "exclusions-first");
    const replaced = await put([companyRule], "exclusions-second");

    expect(replaced.json).toEqual([companyRule]);
    expect(await countRows()).toBe(1);
  });

  it("만료일이 어제인 규칙은 조회에 나오지 않는다", async () => {
    const now = new Date();
    const seoulToday = seoulDate(now);
    const yesterday = seoulDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));

    const expiredRule = { ...postingRule, identityHash: "wanted:expired", expiresAt: yesterday };
    const activeRule = { ...postingRule, identityHash: "wanted:active", expiresAt: seoulToday };
    await put([expiredRule, activeRule], "exclusions-expiry");

    const rules = (await get()).json as Array<Record<string, unknown>>;
    expect(rules).toEqual([activeRule]);
    expect(await countRows()).toBe(2);
  });

  it("회사 전체 제외를 career-downside 로 내면서 근거가 하나면 400 이다", async () => {
    const reply = await put(
      [{ ...companyRule, evidenceUrls: ["https://example.com/report/one"] }],
      "exclusions-weak-evidence",
    );

    expect(reply.status).toBe(400);
    expect(await countRows()).toBe(0);
  });

  it("직무 keyword 가 없는 company-role 행은 CHECK 가 막는다", async () => {
    // 계약 검증을 우회해 직접 넣는다. 이관 명령이나 손으로 넣은 행도 막히는지가 이 검사의 목적이다.
    const insert = harness.prisma.$executeRawUnsafe(
      `INSERT INTO position_exclusions
         (position_exclusion_id, scope, company_key, decision_kind, reason,
          evidence_urls_json, decided_at)
       VALUES ('11111111-1111-5111-8111-111111111111', 'company-role', '예시 주식회사',
               'manual', '직무 keyword 없이 넣는다', JSON_ARRAY(), '2026-09-11')`,
    );

    await expect(insert).rejects.toThrow();
    expect(await countRows()).toBe(0);
  });

  it("같은 멱등 키로 두 번 대체하면 저장된 응답을 돌려주고 행이 늘지 않는다", async () => {
    const first = await put([postingRule], "exclusions-idempotent");
    const second = await put([postingRule], "exclusions-idempotent");

    expect(second.status).toBe(first.status);
    expect(second.json).toEqual(first.json);
    expect(await countRows()).toBe(1);
  });
});
