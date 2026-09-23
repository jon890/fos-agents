import { createHash } from "node:crypto";
import type { PostingCandidate } from "../contracts/posting-candidate.js";

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function companyKey(company: string): string {
  return normalize(company).toLocaleLowerCase("ko-KR");
}

export function positionContentHash(posting: PostingCandidate): string {
  const stable = {
    company: normalize(posting.company),
    title: normalize(posting.title),
    category: normalize(posting.category),
    summary: normalize(posting.summary),
    mainTasks: normalize(posting.mainTasks),
    requirements: normalize(posting.requirements),
    preferred: normalize(posting.preferred),
    skills: posting.skills.map(normalize).sort(),
    tags: posting.tags.map(normalize).sort(),
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(stable)).digest("hex")}`;
}

export function stableUuid(value: string): string {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const compact = hex.join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export function positionIdentity(posting: PostingCandidate): string {
  const identity = posting.identityHash ?? new URL(posting.url).href;
  return `${posting.source}:${identity}`;
}

/**
 * 긴 URL 을 고유 키에 담기 위한 해시다.
 *
 * `company_evidence` 의 `url_hash` 가 이 값이다.
 * `VARCHAR(2048)` 을 그대로 index 에 넣으면 InnoDB 의 key 길이 상한을 넘는다.
 */
export function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}
