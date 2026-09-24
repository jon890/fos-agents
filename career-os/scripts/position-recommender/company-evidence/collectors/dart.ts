import { readFileSync, statSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";

import type {
  CompanyEvidence,
  CompanyPreference,
} from "../../../../services/recommendation-api/src/positions/schema.ts";
import type { CompanyEvidenceCollector, EvidenceFetcher } from "./types.ts";
import { compactSummary, dateAfter } from "./types.ts";

type DartRow = Record<string, string>;
type DartResponse = { status: string; message?: string; list?: DartRow[] };

export function loadDartApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CAREER_DART_API_KEY?.trim()) return env.CAREER_DART_API_KEY.trim();
  const path = env.CAREER_DART_API_KEY_FILE;
  if (!path) return null;
  if ((statSync(path).mode & 0o777) !== 0o600)
    throw new Error("DART 인증키 파일 권한은 600이어야 합니다.");
  return readFileSync(path, "utf8").trim() || null;
}

function unzipXml(data: Buffer): string {
  const first = Math.max(0, data.length - 65_557);
  let end = -1;
  for (let at = data.length - 22; at >= first; at--) {
    if (data.readUInt32LE(at) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error("DART 회사 목록 ZIP 끝을 찾지 못했습니다.");
  let at = data.readUInt32LE(end + 16);
  const count = data.readUInt16LE(end + 10);
  for (let index = 0; index < count; index++) {
    if (data.readUInt32LE(at) !== 0x02014b50)
      throw new Error("DART 회사 목록 ZIP 형식이 잘못됐습니다.");
    const method = data.readUInt16LE(at + 10);
    const size = data.readUInt32LE(at + 20);
    const nameLength = data.readUInt16LE(at + 28);
    const extraLength = data.readUInt16LE(at + 30);
    const commentLength = data.readUInt16LE(at + 32);
    const local = data.readUInt32LE(at + 42);
    const name = data.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    at += 46 + nameLength + extraLength + commentLength;
    if (name.toUpperCase() !== "CORPCODE.XML") continue;
    const offset = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    const compressed = data.subarray(offset, offset + size);
    if (compressed.length > 30_000_000) throw new Error("DART 회사 목록 ZIP이 너무 큽니다.");
    const xml = method === 8 ? inflateRawSync(compressed) : method === 0 ? compressed : null;
    if (!xml || xml.length > 100_000_000)
      throw new Error("DART 회사 목록 압축 형식이 지원되지 않습니다.");
    return xml.toString("utf8");
  }
  throw new Error("DART 회사 목록 XML이 없습니다.");
}

export function findDartCorpCode(zip: Buffer, companyName: string): string | null {
  const xml = unzipXml(zip);
  const parsed = new XMLParser().parse(xml);
  const entries = parsed?.result?.list;
  const rows: DartRow[] = Array.isArray(entries) ? entries : entries ? [entries] : [];
  const matching = rows.filter((row) => String(row.corp_name).trim() === companyName.trim());
  if (matching.length === 1) return String(matching[0]!.corp_code).padStart(8, "0");
  const listed = matching.filter((row) => /^\d{6}$/.test(String(row.stock_code ?? "")));
  return listed.length === 1 ? String(listed[0]!.corp_code).padStart(8, "0") : null;
}

async function getDartJson(
  fetcher: EvidenceFetcher,
  endpoint: string,
  params: URLSearchParams,
): Promise<DartResponse> {
  const response = await fetcher(`https://opendart.fss.or.kr/api/${endpoint}.json?${params}`);
  if (!response.ok) return { status: `HTTP ${response.status}` };
  return (await response.json()) as DartResponse;
}

function reportUrl(rows: DartRow[]): string {
  const receipt = rows.find((row) => /^\d{14}$/.test(String(row.rcept_no ?? "")))?.rcept_no;
  return receipt
    ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receipt}`
    : "https://dart.fss.or.kr/";
}

function employmentEvidence(
  rows: DartRow[],
  input: { companyName: string; now: Date },
): CompanyEvidence | null {
  if (rows.length === 0) return null;
  const salaries = rows
    .filter((row) => row.jan_salary_am && row.jan_salary_am !== "-")
    .map((row) => `${row.sexdstn ?? "전체"} ${row.jan_salary_am}원`)
    .slice(0, 3);
  const tenures = [...new Set(rows.map((row) => row.avrg_cnwk_sdytrn).filter(Boolean))].slice(0, 3);
  const headcount = rows
    .map((row) => Number(String(row.sm ?? "").replaceAll(",", "")))
    .filter(Number.isFinite)
    .reduce((sum, count) => sum + count, 0);
  return {
    sourceType: "dart-employment",
    url: reportUrl(rows),
    title: `${input.companyName} 직원 현황`,
    summary: compactSummary(
      `1인 평균 급여 ${salaries.join(", ") || "미확인"}; 평균 근속 ${tenures.join(", ") || "미확인"}; 직원 수 ${headcount}명.`,
    ),
    payloadJson: { rows },
    observedAt: input.now.toISOString(),
    validUntil: dateAfter(input.now, 180),
  };
}

function financialEvidence(
  rows: DartRow[],
  input: { companyName: string; now: Date },
): CompanyEvidence | null {
  const preferred = rows.filter((row) => row.fs_div === "CFS");
  const accounts = preferred.length ? preferred : rows;
  const sales = accounts.find((row) => /매출액|수익\(매출액\)/.test(row.account_nm ?? ""));
  const profit = accounts.find((row) => /영업이익/.test(row.account_nm ?? ""));
  if (!sales && !profit) return null;
  return {
    sourceType: "dart-financial",
    url: reportUrl(rows),
    title: `${input.companyName} 재무정보`,
    summary: compactSummary(
      `최근 사업연도 매출 ${sales?.thstrm_amount ?? "미확인"}원, 영업이익 ${profit?.thstrm_amount ?? "미확인"}원.`,
    ),
    payloadJson: { rows },
    observedAt: input.now.toISOString(),
    validUntil: dateAfter(input.now, 180),
  };
}

export const dartCollector: CompanyEvidenceCollector = {
  name: "dart",
  sourceTypes: ["dart-employment", "dart-financial"],
  enabled: () => true,
  async collect(input) {
    const key = input.dartApiKey;
    if (!key) return { evidence: [], diagnostics: ["dart: 인증키 없음"] };
    let corpCode = input.preference?.dartCorpCode;
    if (!corpCode) {
      const response = await input.fetcher(
        `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(key)}`,
      );
      if (!response.ok)
        return { evidence: [], diagnostics: [`dart: 회사 목록 HTTP ${response.status}`] };
      corpCode = findDartCorpCode(Buffer.from(await response.arrayBuffer()), input.companyName);
      if (!corpCode) return { evidence: [], diagnostics: ["dart: 회사 고유번호를 확정하지 못함"] };
      await input.persistDartCorpCode?.(input.companyKey, corpCode);
    }
    const year = String(input.now.getUTCFullYear() - 1);
    const params = new URLSearchParams({
      crtfc_key: key,
      corp_code: corpCode,
      bsns_year: year,
      reprt_code: "11011",
    });
    const employees = await getDartJson(input.fetcher, "empSttus", params);
    if (employees.status !== "000")
      return { evidence: [], diagnostics: [`dart: 직원 현황 ${employees.status}`] };
    const evidence: CompanyEvidence[] = [];
    const employed = employmentEvidence(employees.list ?? [], input);
    if (employed) evidence.push(employed);
    const financial = await getDartJson(input.fetcher, "fnlttSinglAcnt", params);
    const financed =
      financial.status === "000" ? financialEvidence(financial.list ?? [], input) : null;
    if (financed) evidence.push(financed);
    return {
      evidence,
      diagnostics: financial.status === "000" ? [] : [`dart: 재무정보 ${financial.status}`],
    };
  },
};
