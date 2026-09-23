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
const dayMs = 24 * 60 * 60 * 1000;

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

/**
 * 기대값을 검사가 시작한 시각에서 만든다.
 *
 * module 을 읽는 시점에 한 번만 만들면 실행이 Seoul 자정을 넘길 때
 * 어제와 오늘의 경계가 어긋나 간헐로 깨진다.
 */
function fixtures(now = new Date()) {
  const today = seoulDate(now);
  const yesterday = seoulDate(new Date(now.getTime() - dayMs));
  const later = seoulDate(new Date(now.getTime() + 30 * dayMs));
  const blog = {
    sourceType: "tech-blog",
    url: "https://example.com/blog/platform",
    title: "플랫폼 팀이 옮긴 적재 경로",
    summary: "기술 블로그가 적재 경로를 다시 세운 과정을 적었다.",
    payloadJson: { postCount: 12, lastPublishedAt: "2026-09-20" },
    observedAt: `${today}T00:30:00.000Z`,
    validUntil: later,
  };
  const dart = {
    sourceType: "dart-employment",
    url: "https://example.com/dart/employment",
    summary: "직원 수와 평균 근속이 담겼다.",
    payloadJson: { headcount: 320, averageTenureYears: 4.1 },
    observedAt: `${today}T00:30:00.000Z`,
    validUntil: later,
  };
  return { today, yesterday, later, blog, dart };
}

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

function put(companies: unknown[], idempotencyKey: string) {
  return harness.send("PUT", `/api/positions/v1/company-tier-runs/${companyTierRunId}/evidence`, {
    body: { schemaVersion: 1, companies },
    idempotencyKey,
  });
}

function putOne(evidence: unknown[], idempotencyKey: string) {
  return put([{ companyKey, evidence }], idempotencyKey);
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
    const { blog, dart } = fixtures();
    await seedCompanyTierRun("pending");
    const saved = await putOne([blog, dart], "evidence-roundtrip");

    expect(saved.status).toBe(200);
    expect(saved.json).toEqual({
      companyTierRunId,
      companies: [{ companyKey, savedCount: 2 }],
    });

    const read = await get();
    expect(read.status).toBe(200);
    expect(read.json).toEqual([dart, blog]);
  });

  it("같은 출처를 다시 저장하면 행이 늘지 않고 요약이 갱신된다", async () => {
    const { blog } = fixtures();
    await seedCompanyTierRun("pending");
    await putOne([blog], "evidence-first");

    const updated = {
      ...blog,
      summary: "새로 읽은 글이 배포 절차를 설명한다.",
      observedAt: blog.observedAt.replace("T00:30", "T01:30"),
    };
    const second = await putOne([updated], "evidence-second");

    expect(second.status).toBe(200);
    expect(await countRows()).toBe(1);
    expect((await get()).json).toEqual([updated]);
  });

  it("더 오래된 관측은 저장된 근거를 덮지 않는다", async () => {
    const { blog } = fixtures();
    await seedCompanyTierRun("pending");
    await putOne([blog], "evidence-newer");

    const older = {
      ...blog,
      summary: "옛 파일에서 옮겨 온 요약이다.",
      payloadJson: { postCount: 1 },
      observedAt: blog.observedAt.replace("T00:30", "T00:10"),
    };
    const second = await putOne([older], "evidence-older");

    expect(second.status).toBe(200);
    // 바뀐 칸이 없어도 그 키로 행은 있다. savedCount 는 이 요청이 다룬 출처 수다.
    expect(second.json).toEqual({
      companyTierRunId,
      companies: [{ companyKey, savedCount: 1 }],
    });
    expect(await countRows()).toBe(1);
    expect((await get()).json).toEqual([blog]);
  });

  it("같은 시각으로 다시 저장하면 나중에 보낸 값이 남는다", async () => {
    const { blog } = fixtures();
    await seedCompanyTierRun("pending");
    await putOne([blog], "evidence-same-instant-first");

    // 수집기가 observedAt 을 날짜 단위로 적거나 재시도가 같은 시각을 다시 보낸다.
    // 요청을 나눠 보냈을 때와 한 요청에 담았을 때의 결과가 같아야 한다.
    const resent = { ...blog, summary: "같은 시각으로 다시 보낸 요약이다." };
    const second = await putOne([resent], "evidence-same-instant-second");

    expect(second.status).toBe(200);
    expect(await countRows()).toBe(1);
    expect((await get()).json).toEqual([resent]);
  });

  it("한 요청에 같은 출처가 두 번 들어오면 저장 건수가 1이다", async () => {
    const { blog } = fixtures();
    await seedCompanyTierRun("pending");
    const duplicated = { ...blog, summary: "같은 글을 두 번 담았다." };
    const saved = await putOne([blog, duplicated], "evidence-duplicate");

    expect(saved.json).toEqual({
      companyTierRunId,
      companies: [{ companyKey, savedCount: 1 }],
    });
    expect(await countRows()).toBe(1);
    expect((await get()).json).toEqual([duplicated]);
  });

  it("한 요청에 회사가 둘이면 회사별로 나눠 세고 같은 회사는 합친다", async () => {
    const { blog, dart } = fixtures();
    const otherKey = "다른 주식회사";
    await seedCompanyTierRun("pending");
    const saved = await put(
      [
        { companyKey, evidence: [blog] },
        { companyKey: otherKey, evidence: [dart] },
        { companyKey, evidence: [dart] },
      ],
      "evidence-two-companies",
    );

    expect(saved.status).toBe(200);
    expect(saved.json).toEqual({
      companyTierRunId,
      companies: [
        { companyKey, savedCount: 2 },
        { companyKey: otherKey, savedCount: 1 },
      ],
    });
    expect(await countRows()).toBe(3);
    expect((await get()).json).toEqual([dart, blog]);
    expect((await get(otherKey)).json).toEqual([dart]);
  });

  it("유효기간이 어제인 근거는 조회에 나오지 않는다", async () => {
    const { today, yesterday, dart } = fixtures();
    await seedCompanyTierRun("pending");
    const expired = {
      ...dart,
      url: "https://example.com/dart/expired",
      observedAt: `${yesterday}T00:30:00.000Z`,
      validUntil: yesterday,
    };
    const active = { ...dart, url: "https://example.com/dart/active", validUntil: today };
    await putOne([expired, active], "evidence-expiry");

    expect((await get()).json).toEqual([active]);
    expect(await countRows()).toBe(2);
  });

  it("https 를 대문자로 적은 url 은 CHECK 가 막는다", async () => {
    // 계약 검증을 우회해 직접 넣는다. 이관 명령이나 손으로 넣은 행도 막히는지가 이 검사의 목적이다.
    // table collation 이 대소문자를 가리지 않아 대문자로 적은 url 이 https 판정을 통과할 수 있다.
    const insert = harness.prisma.$executeRawUnsafe(
      `INSERT INTO company_evidence
         (company_evidence_id, company_key, source_type, url, summary,
          payload_json, observed_at, valid_until)
       VALUES ('33333333-3333-5333-8333-333333333333', '${companyKey}', 'official',
               'HTTPS://example.com/about', '대문자로 적은 https 근거', JSON_OBJECT(),
               '2026-09-23 00:30:00.000', '2026-12-21')`,
    );

    await expect(insert).rejects.toThrow();
    expect(await countRows()).toBe(0);
  });

  it("http 로 시작하는 url 은 CHECK 가 막는다", async () => {
    const insert = harness.prisma.$executeRawUnsafe(
      `INSERT INTO company_evidence
         (company_evidence_id, company_key, source_type, url, summary,
          payload_json, observed_at, valid_until)
       VALUES ('33333333-3333-5333-8333-333333333334', '${companyKey}', 'official',
               'http://example.com/about', '평문 http 로 들어온 근거', JSON_OBJECT(),
               '2026-09-23 00:30:00.000', '2026-12-21')`,
    );

    await expect(insert).rejects.toThrow();
    expect(await countRows()).toBe(0);
  });

  it("이미 끝난 회사 tier 실행에 저장하면 409 다", async () => {
    const { blog } = fixtures();
    await seedCompanyTierRun("completed");
    const reply = await putOne([blog], "evidence-completed");

    expect(reply.status).toBe(409);
    expect((reply.json as { error: { code: string } }).error.code).toBe("VERSION_CONFLICT");
    expect(await countRows()).toBe(0);
  });

  it("같은 멱등 키로 두 번 저장하면 저장된 응답을 돌려주고 행이 늘지 않는다", async () => {
    const { blog } = fixtures();
    await seedCompanyTierRun("pending");
    const first = await putOne([blog], "evidence-idempotent");
    const second = await putOne([blog], "evidence-idempotent");

    expect(second.status).toBe(first.status);
    expect(second.json).toEqual(first.json);
    expect(await countRows()).toBe(1);
  });
});
