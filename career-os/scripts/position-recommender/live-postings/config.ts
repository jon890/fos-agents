// Loads externalized collection settings (ADR-099).
// Config lives in career-os/config and is resolved by script location
// (import.meta.dir) so it is found regardless of cwd (ADR-091 principle).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../config");

export interface WantedCollectionConfig {
  jobGroupId: number;
  targetKeywords: string[];
}

export interface CandidateConfig {
  experienceYears: number;
}

function loadJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(resolve(CONFIG_DIR, file), "utf-8")) as Record<string, unknown>;
  } catch (error) {
    console.error(`WARN config load ${file}: ${error}`);
    return null;
  }
}

/**
 * 회사별 탐색 키워드를 verified-company-research-targets.json에서 읽는다.
 * 단일 출처는 priorityCompanies[].wantedKeywords + secondaryCompanies[].wantedKeywords다(ADR-103).
 * 파일을 못 읽으면 회사 키워드 없이 role 키워드만으로 진행한다(수집 자체를 막지 않는다).
 */
function loadCompanyWantedKeywords(): string[] {
  const json = loadJson("verified-company-research-targets.json");
  if (json === null) return [];
  const companyGroups = [
    ...(Array.isArray(json.priorityCompanies) ? json.priorityCompanies : []),
    ...(Array.isArray(json.secondaryCompanies) ? json.secondaryCompanies : []),
  ] as Record<string, unknown>[];
  const keywords: string[] = [];
  for (const company of companyGroups) {
    const wantedKeywords = company.wantedKeywords;
    if (Array.isArray(wantedKeywords)) {
      for (const k of wantedKeywords) if (typeof k === "string") keywords.push(k);
    }
  }
  return keywords;
}

/**
 * wanted 수집 설정. 파일이 없거나 깨지면 안전한 기본값으로 폴백한다.
 * targetKeywords는 position-collection.json의 회사 비종속 role 키워드와
 * verified-company-research-targets.json의 회사 키워드를 merge한 결과다(ADR-103).
 */
export function loadWantedCollectionConfig(): WantedCollectionConfig {
  const json = loadJson("position-collection.json");
  const companyKeywords = loadCompanyWantedKeywords();
  if (json === null) {
    console.error("WARN position-collection.json 미존재 — 기본값(jobGroupId=518)과 회사 키워드만 사용");
    return { jobGroupId: 518, targetKeywords: [...new Set(companyKeywords)] };
  }
  const wanted = (json.wanted ?? {}) as Record<string, unknown>;
  const jobGroupId = typeof wanted.jobGroupId === "number" ? wanted.jobGroupId : 518;
  const roleKeywords = Array.isArray(wanted.targetKeywords)
    ? wanted.targetKeywords.filter((k): k is string => typeof k === "string")
    : [];
  const targetKeywords = [...new Set([...roleKeywords, ...companyKeywords])];
  return { jobGroupId, targetKeywords };
}

/** 후보자 구조화 사실. 파일이 없거나 깨지면 7년차로 폴백한다. */
export function loadCandidateConfig(): CandidateConfig {
  const json = loadJson("candidate-config.json");
  if (json === null) {
    console.error("WARN candidate-config.json 미존재 — 기본값(experienceYears=7) 사용");
    return { experienceYears: 7 };
  }
  const experienceYears = typeof json.experienceYears === "number" ? json.experienceYears : 7;
  return { experienceYears };
}
