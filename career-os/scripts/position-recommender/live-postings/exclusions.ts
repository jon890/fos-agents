import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { POSITION_EXCLUSIONS_PATH } from "../../../config/position-exclusions.ts";
import { sourceIdSchema } from "./contracts.ts";
import type { Posting } from "./types.ts";

export const defaultExclusionsPath = resolve(import.meta.dir, "../../..", POSITION_EXCLUSIONS_PATH);

export function normalizePostingUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid posting URL");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ["fbclid", "gclid"].includes(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.href;
}

const exclusionSchema = z.object({
  source: sourceIdSchema,
  identityHash: z.string().trim().min(1).optional(),
  url: z.string().refine((value) => {
    try { normalizePostingUrl(value); return true; } catch { return false; }
  }).optional(),
}).strict().refine((rule) => Boolean(rule.identityHash || rule.url));

export const positionExclusionsSchema = z.object({
  schemaVersion: z.literal(1),
  exclusions: z.array(exclusionSchema),
}).strict();
export type PositionExclusions = z.infer<typeof positionExclusionsSchema>;

export function loadPositionExclusions(path = defaultExclusionsPath): PositionExclusions {
  try {
    return positionExclusionsSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    // 개인 식별자와 파일 본문을 오류나 후보풀에 남기지 않는다.
    throw new Error("FAIL position exclusions: 설정을 읽거나 검증할 수 없습니다. 비공개 작업본과 설정을 확인하세요.");
  }
}

export function filterExcludedPostings(posts: Posting[], config: PositionExclusions) {
  const rules = positionExclusionsSchema.parse(config).exclusions;
  const identities = new Set(rules.filter((rule) => rule.identityHash).map((rule) => `${rule.source}|${rule.identityHash}`));
  const urls = new Set(rules.filter((rule) => rule.url).map((rule) => `${rule.source}|${normalizePostingUrl(rule.url!)}`));
  const rejectedBySource = new Map<string, number>();
  const eligible = posts.filter((post) => {
    let urlMatch = false;
    try { urlMatch = urls.has(`${post.source}|${normalizePostingUrl(post.url)}`); } catch { /* 후보 스키마에서 검사한다. */ }
    if (!identities.has(`${post.source}|${post.identityHash ?? ""}`) && !urlMatch) return true;
    rejectedBySource.set(post.source, (rejectedBySource.get(post.source) ?? 0) + 1);
    return false;
  });
  return { eligible, rejectedBySource };
}
