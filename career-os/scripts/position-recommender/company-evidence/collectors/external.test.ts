import { describe, expect, test } from "bun:test";

import { dartCollector, findDartCorpCode } from "./dart.ts";
import { jobPostingCollector } from "./job-posting.ts";
import { collectCompanyEvidence } from "./registry.ts";
import { reviewCollector } from "./review.ts";
import type { CollectorInput, EvidenceFetcher } from "./types.ts";

const now = new Date("2026-09-24T00:00:00.000Z");
const employees = {
  status: "000",
  list: [
    {
      rcept_no: "20260331000001",
      fo_bbm: "전사",
      sexdstn: "남",
      sm: "503",
      jan_salary_am: "98,159,000",
      avrg_cnwk_sdytrn: "3년 7개월",
    },
  ],
};
const financial = {
  status: "000",
  list: [
    {
      rcept_no: "20260331000001",
      fs_div: "CFS",
      account_nm: "매출액",
      thstrm_amount: "1,000,000,000",
    },
    {
      rcept_no: "20260331000001",
      fs_div: "CFS",
      account_nm: "영업이익",
      thstrm_amount: "100,000,000",
    },
  ],
};

function input(fetcher: EvidenceFetcher, overrides: Partial<CollectorInput> = {}): CollectorInput {
  return {
    companyKey: "example",
    companyName: "예시",
    now,
    fetcher,
    dartApiKey: "stub-key",
    preference: {
      companyKey: "example",
      companyName: "예시",
      tier: null,
      disposition: "analyze",
      updatedAt: now.toISOString(),
      dartCorpCode: "00123456",
      blindCompanySlug: "Example",
    },
    existingEvidence: [],
    activePostings: [
      { title: "개발자", url: "https://example.com/job", firstSeenAt: "2026-09-18T00:00:00.000Z" },
    ],
    ...overrides,
  };
}

const dartFetcher: EvidenceFetcher = async (request) => {
  const url = String(request);
  if (url.includes("empSttus")) return Response.json(employees);
  if (url.includes("fnlttSinglAcnt")) return Response.json(financial);
  throw new Error("예상하지 않은 요청");
};

function storedZip(xml: string): Buffer {
  const name = Buffer.from("CORPCODE.xml");
  const data = Buffer.from(xml);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]);
}

describe("DART와 Blind 근거", () => {
  test("직원 현황은 급여와 근속과 인원을 함께 요약하고 재무정보도 저장한다", async () => {
    const result = await dartCollector.collect(input(dartFetcher));
    expect(result.evidence.map((entry) => entry.sourceType)).toEqual([
      "dart-employment",
      "dart-financial",
    ]);
    const summary = result.evidence[0]!.summary;
    expect(summary).toContain("98,159,000");
    expect(summary).toContain("3년 7개월");
    expect(summary).toContain("503명");
    expect(result.evidence[0]!.payloadJson.rows).toEqual(employees.list);
    expect(result.evidence[1]!.summary).toContain("100,000,000");
  });

  test("직원 현황 013은 근거 없이 진단만 남긴다", async () => {
    const result = await dartCollector.collect(input(async () => Response.json({ status: "013" })));
    expect(result.evidence).toEqual([]);
    expect(result.diagnostics).toEqual(["dart: 직원 현황 013"]);
  });

  test("인증키가 없으면 DART만 건너뛰고 공고 근거는 남긴다", async () => {
    const result = await collectCompanyEvidence(input(dartFetcher, { dartApiKey: undefined }), [
      dartCollector,
      jobPostingCollector,
    ]);
    expect(result.evidence.map((entry) => entry.sourceType)).toEqual(["job-posting"]);
    expect(result.diagnostics).toContain("dart: 인증키 없음");
  });

  test("고유번호가 저장돼 있으면 회사 목록 ZIP을 받지 않는다", async () => {
    let calls = 0;
    const fetcher: EvidenceFetcher = async (request) => {
      calls++;
      return dartFetcher(request);
    };
    await dartCollector.collect(input(fetcher));
    expect(calls).toBe(2);
  });

  test("회사명이 겹치면 상장 회사 고유번호를 선택해 저장한다", async () => {
    const zip =
      storedZip(`<result><list><corp_code>123</corp_code><corp_name>예시</corp_name><stock_code></stock_code></list>
      <list><corp_code>456</corp_code><corp_name>예시</corp_name><stock_code>123456</stock_code></list></result>`);
    expect(findDartCorpCode(zip, "예시")).toBe("00000456");
    let persisted: string | undefined;
    const fetcher: EvidenceFetcher = async (request) =>
      String(request).includes("corpCode.xml")
        ? new Response(new Uint8Array(zip))
        : dartFetcher(request);
    const preference = { ...input(fetcher).preference!, dartCorpCode: null };
    const result = await dartCollector.collect(
      input(fetcher, {
        preference,
        persistDartCorpCode: async (_companyKey, code) => {
          persisted = code;
        },
      }),
    );
    expect(result.evidence).toHaveLength(2);
    expect(persisted).toBe("00000456");
  });

  test("Blind가 200이 아니면 근거를 만들지 않는다", async () => {
    const result = await reviewCollector.collect(
      input(async () => new Response("", { status: 404 })),
    );
    expect(result.evidence).toEqual([]);
    expect(result.diagnostics[0]).toContain("404");
  });

  test("Blind는 회사 평점만 담고 리뷰 본문을 저장하지 않는다", async () => {
    const html = `<html><body>Rating Score3.5 1,419개 리뷰 <h2>항목별 평점</h2>
      3.1 커리어 향상 4.1 업무와 삶의 균형 3.1 급여 및 복지 3.6 사내 문화 2.6 경영진
      <h3>개별 리뷰</h3>개인 리뷰의 긴 본문</body></html>`;
    const result = await reviewCollector.collect(input(async () => new Response(html)));
    expect(result.evidence[0]?.sourceType).toBe("review");
    expect(result.evidence[0]?.summary).toContain("급여 및 복지 3.1점");
    expect(JSON.stringify(result.evidence[0]?.payloadJson)).not.toContain("개인 리뷰");
  });
});
