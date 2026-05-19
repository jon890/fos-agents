#!/usr/bin/env bun

import { z } from "zod";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const HogangnonoResultSchema = z
  .object({
    name: z.literal("Hogangnono"),
    url: z.string(),
    finalUrl: z.string(),
    status: z.string(),
    host: z.string(),
    title: z.string(),
    description: z.string(),
    signals: z.array(z.string()),
    numericSignals: z.record(z.string(), z.unknown()),
    jsonLd: z.array(z.string()),
    note: z.string(),
    recentTransactions: z.array(z.unknown()).optional(),
    snippets: z.array(z.string()),
  })
  .passthrough();

export type HogangnonoResult = z.infer<typeof HogangnonoResultSchema>;

function htmlUnescape(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function compact(text: string | null | undefined): string {
  if (!text) return "";
  return htmlUnescape(text).replace(/\s+/g, " ").trim();
}

function parseAmountToManwon(text: string | null | undefined): number | null {
  const value = compact(text).replace("만원", "").replace(/ /g, "");
  if (!value) return null;
  let total = 0;
  const mok = /(\d+)억/.exec(value);
  if (mok) total += parseInt(mok[1]) * 10000;
  const rest = value.replace(/\d+억/g, "");
  const mrest = /([\d,]+)/.exec(rest);
  if (mrest) total += parseInt(mrest[1].replace(/,/g, ""));
  return total || null;
}

function extractDescription(html: string): string {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["'](.*?)["']/is,
    /<meta[^>]+property=["']og:description["'][^>]+content=["'](.*?)["']/is,
  ];
  for (const p of patterns) {
    const m = p.exec(html);
    if (m) return compact(m[1]);
  }
  return "";
}

function buildText(html: string): string {
  const stripped = html
    .replace(/<script.*?<\/script>|<style.*?<\/style>/gis, " ")
    .replace(/<[^>]+>/g, " ");
  return compact(stripped);
}

function extractComplexInfo(text: string): Record<string, number> {
  const info: Record<string, number> = {};
  const mBase = /(\d+)세대\s*\|\s*(\d{4})년\s*(\d+)월\((\d+)년차\)/.exec(text);
  if (mBase) {
    info.households = parseInt(mBase[1]);
    info.builtYear = parseInt(mBase[2]);
    info.builtMonth = parseInt(mBase[3]);
    info.ageYears = parseInt(mBase[4]);
  }
  const keyPatterns: [string, RegExp][] = [
    ["floorAreaRatio", /용적률\s*(\d+)%/],
    ["buildingCoverage", /건폐율\s*(\d+)%/],
    ["groundParking", /지상주차\s*(\d+)대/],
    ["undergroundParking", /지하주차\s*(\d+)대/],
  ];
  for (const [key, pattern] of keyPatterns) {
    const m = pattern.exec(text);
    if (m) info[key] = parseInt(m[1]);
  }
  return info;
}

function extractAreaTradeSummary(text: string): Record<string, unknown> | null {
  const m =
    /매매\s+전월세\s+(\d+평)\s+최근 실거래 기준\s*1개월 평균\s*([0-9억,\s]+)/.exec(text);
  if (!m) return null;
  const amount = compact(m[2]);
  return {
    areaLabel: m[1],
    monthlyAverage: amount,
    monthlyAverageManwon: parseAmountToManwon(amount),
  };
}

function extractRecentTransactions(text: string): unknown[] {
  const start = text.indexOf("계약일 면적(공급) 가격");
  if (start < 0) return [];
  const window = text.slice(start, start + 1200);
  const pattern =
    /(\d{2}\.\d{2}\.\d{2})\s+(\d+)\s+(등기\s+)?([0-9억,\s]+)\s+((?:\d+동\/)?\d+층)/g;
  const rows: unknown[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(window)) !== null) {
    const supplyArea = parseInt(match[2]);
    const row = {
      date: match[1],
      supplyAreaApprox: supplyArea,
      unit: `${supplyArea}㎡`,
      price: compact(match[4]),
      priceManwon: parseAmountToManwon(match[4]),
      floor: compact(match[5]),
      registeredLater: Boolean(match[3]),
    };
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      rows.push(row);
    }
  }
  return rows.slice(0, 5);
}

export async function runHogangnono(url: string): Promise<HogangnonoResult> {
  const res = await Bun.fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  const text = buildText(html);
  const desc = extractDescription(html);

  const numericSignals: Record<string, unknown> = {};

  const complexInfo = extractComplexInfo(text);
  if (Object.keys(complexInfo).length > 0) numericSignals.complexInfo = complexInfo;

  const areaTradeSummary = extractAreaTradeSummary(text);
  if (areaTradeSummary) numericSignals.areaTradeSummary = areaTradeSummary;

  const recentTransactions = extractRecentTransactions(text);

  const snippets: string[] = [];
  for (const kw of ["최근 실거래 기준", "용적률", "건폐율", "관리비"]) {
    const idx = text.indexOf(kw);
    if (idx >= 0) {
      const snippet = compact(text.slice(Math.max(0, idx - 80), idx + 260));
      if (snippet && !snippets.includes(snippet)) snippets.push(snippet);
    }
  }

  const raw: Record<string, unknown> = {
    name: "Hogangnono",
    url,
    finalUrl: res.url,
    status: res.status === 200 ? "ok" : `http-${res.status}`,
    host: new URL(url).hostname,
    title: "",
    description: desc,
    signals: [
      "실거래가",
      "시세",
      "매매",
      "전세",
      "월세",
      "매물",
      "학군",
      "교통",
      "주변정보",
      "전세가율",
      "거래량",
      "신고가",
    ].filter((kw) => (desc + " " + text).includes(kw)),
    numericSignals,
    jsonLd: [],
    note: "호갱노노 HTML 기반 구조화 추출, 기본 단지정보와 대표 평형 최근 거래 추출",
    ...(recentTransactions.length > 0 ? { recentTransactions } : {}),
    snippets: snippets.slice(0, 5),
  };

  return HogangnonoResultSchema.parse(raw);
}

if (import.meta.main) {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: collect_hogangnono.ts <url>");
    process.exit(1);
  }
  runHogangnono(url)
    .then((result) => console.log(JSON.stringify(result)))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
