import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startE2eHarness, type E2eHarness } from "./support/e2e-harness.js";

let harness: E2eHarness;

beforeAll(async () => {
  harness = await startE2eHarness();
});

afterAll(async () => {
  await harness?.close();
});

const collectionRunId = "collection-run-evidence";
const companyTierRunId = "22222222-2222-5222-8222-222222222222";
const companyKey = "예시 주식회사";

/**
 * Seoul 기준 날짜를 낸다.
 *
 * 유효기간 경계는 하루 단위라 지금이 언제인지에 따라 어제와 오늘이 달라진다.
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

const now = new Date();
const today = seoulDate(now);
const yesterday = seoulDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
const later = seoulDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));

const blogEvidence = {
  sourceType: "tech-blog",
  url: "https://example.com/blog/platform",
  title: "플랫폼 팀이 옮긴 적재 경로",
  summary: "기술 블로그가 적재 경로를 다시 세운 과정을 적었다.",
  payloadJson: { postCount: 12, lastPublishedAt: "2026-09-20" },
  observedAt: `${today}T00:30:00.000Z`,
  validUntil: later,
};

const dartEvidence = {
  sourceType: "dart-employment",
  url: "https://example.com/dart/employment",
  summary: "직원 수와 평균 근속이 담겼다.",
  payloadJson: { headcount: 320, averageTenureYears: 4.1 },
  observedAt: `${today}T00:30:00.000Z`,
  validUntil: later,
};

/** 회사 tier 실행을 만든다. 근거 저장 경로가 그 실행을 잠그므로 선행 행이 필요하다. */
async function seedCompanyTierRun(status: "pending" | "completed"): Promise<void> {
  await harness.prisma.$executeRawUnsafe(
    `INSERT INTO position_collection_runs
       (run_id, idempotency_key, collected_at, status, active_count, personal_excluded_count)
     VALUES ('${collectionRunId}', 'evidence-collection', '2026-09-23 00:00:00.000',
             'completed', 0, 0)`,
  );
  await harness.prisma.$executeRawUnsafe(
    `INSERT INTO company_tier_assessment_runs
       (company_tier_run_id, collection_run_id, candidate_context_version, contract_version,
        status, assessed_now_count)
     VALUES ('${companyTierRunId}', '${collectionRunId}', 'career-priority-2026-09', 1,
             '${status}', 0)`,
  );
}

function put(evidence: unknown[], idempotencyKey: string, key = companyKey) {
  return harness.send("PUT", `/api/positions/v1/company-tier-runs/${companyTierRunId}/evidence`, {
    body: { schemaVersion: 1, companies: [{ companyKey: key, evidence }] },
    idempotencyKey,
  });
}

function get(key = companyKey) {
  return harness.send("GET", `/api/positions/v1/companies/${encodeURIComponent(key)}/evidence`, {});
}

async function countRows(): Promise<number> {
  const rows = await harness.prisma.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    "SELECT COUNT(*) AS total FROM company_evidence",
  );
  return Number(rows[0]!.total);
}

describe("회사 근거", () => {
  beforeEach(async () => {
    await harness.clearAll();
  });

  it("저장한 근거를 조회가 그대로 돌려준다", async () => {
    await seedCompanyTierRun("pending");
    const saved = await put([blogEvidence, dartEvidence], "evidence-roundtrip");

    expect(saved.status).toBe(200);
    expect(saved.json).toEqual({
      companyTierRunId,
      companies: [{ companyKey, savedCount: 2 }],
    });

    const read = await get();
    expect(read.status).toBe(200);
    expect(read.json).toEqual([dartEvidence, blogEvidence]);
  });

  it("같은 출처를 다시 저장하면 행이 늘지 않고 요약이 갱신된다", async () => {
    await seedCompanyTierRun("pending");
    await put([blogEvidence], "evidence-first");

    const updated = { ...blogEvidence, summary: "새로 읽은 글이 배포 절차를 설명한다." };
    const second = await put([updated], "evidence-second");

    expect(second.status).toBe(200);
    expect(await countRows()).toBe(1);
    expect((await get()).json).toEqual([updated]);
  });

  it("유효기간이 어제인 근거는 조회에 나오지 않는다", async () => {
    await seedCompanyTierRun("pending");
    const expired = {
      ...dartEvidence,
      url: "https://example.com/dart/expired",
      observedAt: `${yesterday}T00:30:00.000Z`,
      validUntil: yesterday,
    };
    const active = { ...dartEvidence, url: "https://example.com/dart/active", validUntil: today };
    await put([expired, active], "evidence-expiry");

    expect((await get()).json).toEqual([active]);
    expect(await countRows()).toBe(2);
  });

  it("http 로 시작하는 url 은 CHECK 가 막는다", async () => {
    // 계약 검증을 우회해 직접 넣는다. 이관 명령이나 손으로 넣은 행도 막히는지가 이 검사의 목적이다.
    const insert = harness.prisma.$executeRawUnsafe(
      `INSERT INTO company_evidence
         (company_evidence_id, company_key, source_type, url, url_hash, summary,
          payload_json, observed_at, valid_until)
       VALUES ('33333333-3333-5333-8333-333333333333', '${companyKey}', 'official',
               'http://example.com/about',
               '0000000000000000000000000000000000000000000000000000000000000000',
               '평문 http 로 들어온 근거', JSON_OBJECT(), '2026-09-23 00:30:00.000',
               '2026-12-21')`,
    );

    await expect(insert).rejects.toThrow();
    expect(await countRows()).toBe(0);
  });

  it("이미 끝난 회사 tier 실행에 저장하면 409 다", async () => {
    await seedCompanyTierRun("completed");
    const reply = await put([blogEvidence], "evidence-completed");

    expect(reply.status).toBe(409);
    expect((reply.json as { error: { code: string } }).error.code).toBe("VERSION_CONFLICT");
    expect(await countRows()).toBe(0);
  });

  it("같은 멱등 키로 두 번 저장하면 저장된 응답을 돌려주고 행이 늘지 않는다", async () => {
    await seedCompanyTierRun("pending");
    const first = await put([blogEvidence], "evidence-idempotent");
    const second = await put([blogEvidence], "evidence-idempotent");

    expect(second.status).toBe(first.status);
    expect(second.json).toEqual(first.json);
    expect(await countRows()).toBe(1);
  });
});
