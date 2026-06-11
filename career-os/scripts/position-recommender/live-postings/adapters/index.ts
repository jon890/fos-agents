import type { SourceAdapter, SourceId, SourceSelection } from "../types.ts";
import { coupangCareersAdapter } from "./coupang-careers.ts";
import { kakaomobilityAdapter } from "./kakaomobility.ts";
import { kakaopayAdapter } from "./kakaopay.ts";
import { kakaopaySecuritiesAdapter } from "./kakaopay-securities.ts";
import { naverCareersAdapter } from "./naver-careers.ts";
import { tossAdapter } from "./toss.ts";
import { wantedAdapter } from "./wanted.ts";

const ADAPTERS: Record<SourceId, SourceAdapter> = {
  wanted: wantedAdapter,
  "toss-careers": tossAdapter,
  "coupang-careers": coupangCareersAdapter,
  kakaopay: kakaopayAdapter,
  "kakaopay-securities": kakaopaySecuritiesAdapter,
  kakaomobility: kakaomobilityAdapter,
  "naver-careers": naverCareersAdapter,
};

const SOURCE_ALIASES: Record<string, SourceId> = {
  toss: "toss-careers",
  coupang: "coupang-careers",
};

function normalizeSource(source: SourceSelection): SourceSelection {
  if (source === "all") return source;
  return SOURCE_ALIASES[source] ?? source;
}

export function configuredSourceIds(source: SourceSelection): SourceId[] {
  const normalized = normalizeSource(source);
  if (normalized === "all") return Object.keys(ADAPTERS) as SourceId[];
  return [normalized as SourceId];
}

export function selectAdapters(
  source: SourceSelection,
  _includeTossArticles: boolean
): SourceAdapter[] {
  return configuredSourceIds(source).map((id) => ADAPTERS[id]);
}
