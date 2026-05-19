#!/usr/bin/env bun

import { z } from "zod";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const KbLandResultSchema = z
  .object({
    name: z.literal("KB Land"),
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
    snippets: z.array(z.string()),
  })
  .passthrough();

export type KbLandResult = z.infer<typeof KbLandResultSchema>;

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
  if (value.includes("/")) return null;
  let total = 0;
  const mok = /(\d+)억/.exec(value);
  if (mok) total += parseInt(mok[1]) * 10000;
  const rest = value.replace(/\d+억/g, "");
  const mrest = /([\d,]+)/.exec(rest);
  if (mrest) total += parseInt(mrest[1].replace(/,/g, ""));
  return total || null;
}

function extractTitle(html: string): string {
  const m = /<title>(.*?)<\/title>/is.exec(html);
  return m ? compact(m[1]) : "";
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

function extractJsonLdBlocks(html: string): string[] {
  return Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis)
  )
    .slice(0, 5)
    .map((m) => compact(m[1]))
    .filter(Boolean)
    .map((c) => c.slice(0, 2000));
}

function buildText(html: string): string {
  const stripped = html
    .replace(/<script.*?<\/script>|<style.*?<\/style>/gis, " ")
    .replace(/<[^>]+>/g, " ");
  return compact(stripped);
}

interface TypeProfile {
  typeLabel: string;
  supplyAreaM2: number;
  households: number;
  supplyExclusiveText: string;
  roomBath: string;
  exclusiveRatePercent: number;
  exclusiveAreaEstimateM2: number;
  listingCounts: { 매매: number; 전세: number; 월세: number };
}

function extractTypeProfiles(text: string): TypeProfile[] {
  const pattern =
    /(\d+(?:\.\d+)?)m²\s*\((\d+)세대\)\s*공급\/전용\s*([^\s]+)\s*방\/욕실\s*([^\s]+)\s*전용률\s*(\d+(?:\.\d+)?)%\s*매매\s*(\d+)\s*전세\s*(\d+)\s*월세\s*(\d+)/gs;
  const profiles: TypeProfile[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const supplyArea = parseFloat(match[1]);
    const exclusiveRatio = parseFloat(match[5]);
    profiles.push({
      typeLabel: `${supplyArea % 1 === 0 ? Math.trunc(supplyArea) : supplyArea}m²`,
      supplyAreaM2: supplyArea,
      households: parseInt(match[2]),
      supplyExclusiveText: compact(match[3]),
      roomBath: compact(match[4]),
      exclusiveRatePercent: exclusiveRatio,
      exclusiveAreaEstimateM2: Math.round((supplyArea * exclusiveRatio) / 100 * 100) / 100,
      listingCounts: {
        매매: parseInt(match[6]),
        전세: parseInt(match[7]),
        월세: parseInt(match[8]),
      },
    });
  }
  return profiles;
}

function extractPriceBlock(text: string, label: string): Record<string, unknown> | null {
  const pattern = new RegExp(
    `${label}\\s+KB시세(?:\\s+일반가\\s+([0-9억,\\s]+?)\\s+\\d{2}\\.\\d{2}\\.\\d{2})?` +
      `(?:\\s+상위평균가\\s+([0-9억,\\s]+?))?` +
      `(?:\\s+하위평균가\\s+([0-9억,\\s]+?))?` +
      `(?:\\s+최근 실거래가\\s+([0-9억,\\s]+?)\\s+(\\d{2}\\.\\d{2}\\.\\d{2}\\/[^\\s]+))?` +
      `(?:\\s+매물평균가\\s+([0-9억,\\s]+?))?` +
      `(?=\\s+(?:매매|전세|월세)\\s+KB시세|\\s+KB부동산 제공|$)`,
    "s"
  );
  const m = pattern.exec(text);
  if (!m) return null;
  const out: Record<string, unknown> = {};
  if (m[1]) {
    out.general = compact(m[1]);
    out.generalManwon = parseAmountToManwon(m[1]);
  }
  if (m[2]) {
    out.upperAvg = compact(m[2]);
    out.upperAvgManwon = parseAmountToManwon(m[2]);
  }
  if (m[3]) {
    out.lowerAvg = compact(m[3]);
    out.lowerAvgManwon = parseAmountToManwon(m[3]);
  }
  if (m[4]) {
    out.recentTransaction = compact(m[4]);
    out.recentTransactionManwon = parseAmountToManwon(m[4]);
  }
  if (m[5]) {
    out.recentTransactionMeta = compact(m[5]);
  }
  if (m[6]) {
    out.listingAverage = compact(m[6]);
    out.listingAverageManwon = parseAmountToManwon(m[6]);
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function runKbLand(url: string): Promise<KbLandResult> {
  const res = await Bun.fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  const html = await res.text();
  const title = extractTitle(html);
  const description = extractDescription(html);
  const text = buildText(html);

  const numericSignals: Record<string, unknown> = {};

  const mListings = /매매\s*(\d+)\s*전세\s*(\d+)\s*월세\s*(\d+)/.exec(text);
  if (mListings) {
    numericSignals.listingCounts = {
      매매: parseInt(mListings[1]),
      전세: parseInt(mListings[2]),
      월세: parseInt(mListings[3]),
    };
  }

  const mHouseholds = /(\d+)세대/.exec(text);
  if (mHouseholds) numericSignals.households = parseInt(mHouseholds[1]);

  const mCompletion = /(\d{2})\.(\d{2})\s*\((\d+)년차\)/.exec(text);
  if (mCompletion) {
    numericSignals.completionInfo = {
      yy_mm: `${mCompletion[1]}.${mCompletion[2]}`,
      ageYears: parseInt(mCompletion[3]),
    };
  }

  const mArea = /([0-9.]+~[0-9.]+m²)/.exec(text);
  if (mArea) numericSignals.areaRange = mArea[1];

  const pricing: Record<string, unknown> = {};
  for (const label of ["매매", "전세", "월세"]) {
    const block = extractPriceBlock(text, label);
    if (block) pricing[label] = block;
  }
  if (Object.keys(pricing).length > 0) numericSignals.pricing = pricing;

  const typeProfiles = extractTypeProfiles(text);
  if (typeProfiles.length > 0) numericSignals.typeProfiles = typeProfiles;

  const snippets: string[] = [];
  for (const kw of ["매매 KB시세", "전세 KB시세", "월세 KB시세"]) {
    const idx = text.indexOf(kw);
    if (idx >= 0) {
      const snippet = compact(text.slice(Math.max(0, idx - 60), idx + 280));
      if (snippet && !snippets.includes(snippet)) snippets.push(snippet);
    }
  }

  const raw: Record<string, unknown> = {
    name: "KB Land",
    url,
    finalUrl: res.url,
    status: res.status === 200 ? "ok" : `http-${res.status}`,
    host: new URL(url).hostname,
    title,
    description,
    signals: [
      "실거래가",
      "시세",
      "매매",
      "전세",
      "월세",
      "매물",
      "대출",
      "학군",
      "교통",
      "커뮤니티",
      "AI예측시세",
    ].filter((kw) => (title + " " + description + " " + text).includes(kw)),
    numericSignals,
    jsonLd: extractJsonLdBlocks(html),
    note: "KB부동산 HTML 기반 구조화 추출, 시세/최근 실거래/매물평균가 요약 포함",
    snippets: snippets.slice(0, 5),
  };

  return KbLandResultSchema.parse(raw);
}

if (import.meta.main) {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: collect_kbland.ts <url>");
    process.exit(1);
  }
  runKbLand(url)
    .then((result) => console.log(JSON.stringify(result)))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
