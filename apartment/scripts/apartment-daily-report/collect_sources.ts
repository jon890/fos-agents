#!/usr/bin/env bun

import { runNaverApi } from "./collect_naver_api";
import { runHogangnono } from "./collect_hogangnono";
import { runKbLand } from "./collect_kbland";
import { mkdirSync } from "fs";
import { dirname } from "path";

const TARGET_NAME = process.env.TARGET_NAME ?? "엘지원앙아파트";
const TARGET_ALIAS = process.env.TARGET_ALIAS ?? "LG원앙";
const TARGET_LOCATION = process.env.TARGET_LOCATION ?? "경기 구리시 수택동 854-2 / 체육관로 54";
const TARGET_UNIT_LABEL = process.env.TARGET_UNIT_LABEL ?? "59A";
const TARGET_UNIT_EXCLUSIVE_AREA_M2 = parseFloat(process.env.TARGET_UNIT_EXCLUSIVE_AREA_M2 ?? "59");
const NAVER_URL = process.env.NAVER_LAND_URL ?? "https://new.land.naver.com/complexes/1649";
const HOGANGNONO_URL = process.env.HOGANGNONO_URL ?? "https://hogangnono.com/apt/5V184";
const KB_URL = process.env.KB_LAND_URL ?? "https://kbland.kr/se/c/2906";

interface Source {
  name: string;
  url: string;
  fetcher: (url: string) => Promise<Record<string, unknown>>;
}

interface TypeProfile {
  supplyAreaM2?: number;
  exclusiveAreaEstimateM2?: number;
  typeLabel?: string;
  [key: string]: unknown;
}

const SOURCES: Source[] = [
  { name: "Naver Land", url: NAVER_URL, fetcher: runNaverApi as unknown as (u: string) => Promise<Record<string, unknown>> },
  { name: "Hogangnono", url: HOGANGNONO_URL, fetcher: runHogangnono as unknown as (u: string) => Promise<Record<string, unknown>> },
  { name: "KB Land", url: KB_URL, fetcher: runKbLand as unknown as (u: string) => Promise<Record<string, unknown>> },
];


function getSource(sourceResults: Record<string, unknown>[], name: string): Record<string, unknown> {
  return sourceResults.find((s) => s.name === name) ?? {};
}

function classifyFocusAgainstProfiles(typeProfiles: TypeProfile[]): TypeProfile[] {
  return typeProfiles.filter((p) => {
    const exclusive = p.exclusiveAreaEstimateM2;
    if (exclusive == null) return false;
    return Math.abs(exclusive - TARGET_UNIT_EXCLUSIVE_AREA_M2) <= 1.5;
  });
}

function buildRecentTransactions(sourceResults: Record<string, unknown>[]): unknown[] {
  const hogang = getSource(sourceResults, "Hogangnono");
  const kb = getSource(sourceResults, "KB Land");
  const typeProfiles = ((kb.numericSignals as Record<string, unknown> | undefined)?.typeProfiles as TypeProfile[]) ?? [];

  const knownSupplyAreas = new Map<number, TypeProfile>();
  for (const p of typeProfiles) {
    if (p.supplyAreaM2 != null) {
      knownSupplyAreas.set(Math.round(p.supplyAreaM2), p);
    }
  }

  const rows: unknown[] = [];
  for (const item of (hogang.recentTransactions as unknown[]) ?? []) {
    const row = { ...(item as Record<string, unknown>) };
    const supplyArea = row.supplyAreaApprox as number | undefined;
    if (supplyArea != null && knownSupplyAreas.has(supplyArea)) {
      const profile = knownSupplyAreas.get(supplyArea)!;
      if (!row.unit) row.unit = `${supplyArea}㎡`;
      row.sourceTypeProfile = {
        typeLabel: profile.typeLabel,
        exclusiveAreaEstimateM2: profile.exclusiveAreaEstimateM2,
      };
    }
    rows.push(row);
  }
  return rows;
}

function buildListingSummary(sourceResults: Record<string, unknown>[]): Record<string, unknown> {
  const kb = getSource(sourceResults, "KB Land");
  const numericSignals = (kb.numericSignals as Record<string, unknown>) ?? {};
  const pricing = (numericSignals.pricing as Record<string, unknown>) ?? {};
  const listingCounts = (numericSignals.listingCounts as Record<string, unknown>) ?? {};
  const notes: string[] = [];

  if (Object.keys(listingCounts).length > 0) {
    notes.push(
      `KB Land 기준 매물 수: 매매 ${listingCounts["매매"] ?? "?"}건, 전세 ${listingCounts["전세"] ?? "?"}건, 월세 ${listingCounts["월세"] ?? "?"}건`
    );
  }
  if (numericSignals.areaRange) {
    notes.push(`KB Land 기준 공급면적 범위: ${numericSignals.areaRange}`);
  }

  const typeProfiles = (numericSignals.typeProfiles as TypeProfile[]) ?? [];
  const focusMatches = classifyFocusAgainstProfiles(typeProfiles);
  if (focusMatches.length > 0) {
    notes.push(`KB Land 타입 프로필에서 전용 ${Math.floor(TARGET_UNIT_EXCLUSIVE_AREA_M2)}㎡ 근사 매칭 ${focusMatches.length}개 확인`);
  } else if (typeProfiles.length > 0) {
    notes.push(`KB Land 타입 프로필상 전용 ${Math.floor(TARGET_UNIT_EXCLUSIVE_AREA_M2)}㎡ 근사 매칭이 보이지 않음`);
  }

  const naver = getSource(sourceResults, "Naver Land");
  const naverCounts = ((naver.numericSignals as Record<string, unknown> | undefined)?.listingCounts as Record<string, unknown>) ?? {};
  if (Object.keys(naverCounts).length > 0) {
    notes.push(`Naver API 기준 매물 수: 매매 ${naverCounts["매매"] ?? "?"}건 / 전세 ${naverCounts["전세"] ?? "?"}건`);
  }

  return {
    status: Object.keys(pricing).length > 0 ? "partial" : "limited",
    counts: listingCounts,
    pricing,
    typeProfiles,
    focusUnit: TARGET_UNIT_LABEL,
    focusAreaMatches: focusMatches,
    notes: notes.length > 0 ? notes : ["구조화된 매물 요약을 충분히 추출하지 못했다."],
  };
}

function buildComparison(sourceResults: Record<string, unknown>[]): Record<string, unknown> {
  const naver = getSource(sourceResults, "Naver Land");
  const hogang = getSource(sourceResults, "Hogangnono");
  const kb = getSource(sourceResults, "KB Land");

  return {
    naver: (naver.note as string) ?? "Naver Land 확인 결과 없음",
    hogangnono: (hogang.note as string) ?? "호갱노노 확인 결과 없음",
    kbland: (kb.note as string) ?? "KB Land 확인 결과 없음",
  };
}

async function main(): Promise<void> {
  if (process.argv.length !== 3) {
    process.stderr.write("usage: collect_sources.ts <output-json>\n");
    process.exit(1);
  }

  const outPath = process.argv[2];
  mkdirSync(dirname(outPath), { recursive: true });

  const sourceResults: Record<string, unknown>[] = [];
  const notes: string[] = [];

  for (const src of SOURCES) {
    try {
      const result = await src.fetcher(src.url);
      sourceResults.push(result);
    } catch (e) {
      const errName = e instanceof Error ? e.constructor.name : "Error";
      const errMsg = e instanceof Error ? e.message : String(e);
      sourceResults.push({
        name: src.name,
        url: src.url,
        status: "error",
        note: `수집 실패: ${errName}: ${errMsg}`,
      });
      notes.push(`${src.name} 수집 실패: ${errName}`);
    }
  }

  const naver = getSource(sourceResults, "Naver Land");
  const hogang = getSource(sourceResults, "Hogangnono");
  const kb = getSource(sourceResults, "KB Land");

  const naverStatus = naver.status as string | undefined;
  if (naverStatus === "api-ok") {
    const counts = ((naver.numericSignals as Record<string, unknown>)?.listingCounts as Record<string, unknown>) ?? {};
    notes.push(`Naver API 매물 수집 성공: 매매 ${counts["매매"] ?? "?"}건 / 전세 ${counts["전세"] ?? "?"}건`);
  } else if (naverStatus === "skipped-no-cookie") {
    notes.push("Naver API 수집은 NAVER_COOKIE 부재로 건너뛰었다 — apartment/.env에 쿠키를 설정하라.");
  } else if (naverStatus === "auth-failed" || naverStatus === "rate-limited") {
    notes.push(`Naver API 수집 실패 (${naverStatus}) — 쿠키/토큰 갱신이 필요하다.`);
  } else if (naverStatus) {
    notes.push(`Naver API 상태: ${naverStatus}.`);
  }

  const hogangSignals = (hogang.numericSignals as Record<string, unknown>) ?? {};
  const areaTradeSummary = hogangSignals.areaTradeSummary as Record<string, unknown> | undefined;
  if (areaTradeSummary) {
    notes.push(`호갱노노에서 ${areaTradeSummary.areaLabel} 최근 1개월 평균 ${areaTradeSummary.monthlyAverage} 추출`);
  }

  const kbSignals = (kb.numericSignals as Record<string, unknown>) ?? {};
  const kbPricing = (kbSignals.pricing as Record<string, unknown>) ?? {};
  const kbSale = (kbPricing["매매"] as Record<string, unknown>) ?? {};
  if (kbSale.general) {
    notes.push(`KB Land에서 매매 일반가 ${kbSale.general} 추출`);
  }

  const kbTypeProfiles = (kbSignals.typeProfiles as TypeProfile[]) ?? [];
  const focusMatches = classifyFocusAgainstProfiles(kbTypeProfiles);
  if (focusMatches.length > 0) {
    notes.push(`KB Land 타입 정보 기준 전용 ${Math.floor(TARGET_UNIT_EXCLUSIVE_AREA_M2)}㎡ 후보를 찾음`);
  } else if (kbTypeProfiles.length > 0) {
    notes.push(`KB Land 타입 정보 기준 전용 ${Math.floor(TARGET_UNIT_EXCLUSIVE_AREA_M2)}㎡ 후보를 찾지 못함`);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    target: {
      name: TARGET_NAME,
      alias: TARGET_ALIAS,
      location: TARGET_LOCATION,
      focusUnit: {
        label: TARGET_UNIT_LABEL,
        exclusiveAreaM2: TARGET_UNIT_EXCLUSIVE_AREA_M2,
      },
    },
    sources: sourceResults,
    recentTransactions: buildRecentTransactions(sourceResults),
    listingSummary: buildListingSummary(sourceResults),
    comparison: buildComparison(sourceResults),
    notes: [
      ...notes,
      "collector -> normalize -> Claude synthesis 구조는 유지했다.",
      "외부 전달은 runner 밖의 호출자가 담당한다.",
      "수집 결과에 없는 값은 Claude가 채우지 말고 불확실성으로 남겨야 한다.",
    ],
  };

  await Bun.write(outPath, JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
