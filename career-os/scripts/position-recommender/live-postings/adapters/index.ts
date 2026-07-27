import type { SourceAdapter, SourceId, SourceSelection } from "../types.ts";
import { coupangCareersAdapter } from "./coupang-careers.ts";
import { cjCareersAdapter } from "./cj-careers.ts";
import { daangnCareersAdapter } from "./daangn-careers.ts";
import { lineCareersAdapter } from "./line-careers.ts";
import { woowahanCareersAdapter } from "./woowahan-careers.ts";
import { kakaomobilityAdapter } from "./kakaomobility.ts";
import { kakaobankCareersAdapter } from "./kakaobank-careers.ts";
import { kakaopayAdapter } from "./kakaopay.ts";
import { kakaopaySecuritiesAdapter } from "./kakaopay-securities.ts";
import { kraftonCareersAdapter } from "./krafton-careers.ts";
import { kurlyCareersAdapter } from "./kurly-careers.ts";
import { naverCareersAdapter } from "./naver-careers.ts";
import { samsungCareersAdapter } from "./samsung-careers.ts";
import { skCareersAdapter } from "./sk-careers.ts";
import { tossAdapter } from "./toss.ts";
import { wantedAdapter } from "./wanted.ts";

const ADAPTERS: Record<SourceId, SourceAdapter> = {
  wanted: wantedAdapter,
  "toss-careers": tossAdapter,
  "coupang-careers": coupangCareersAdapter,
  kakaopay: kakaopayAdapter,
  "kakaopay-securities": kakaopaySecuritiesAdapter,
  kakaomobility: kakaomobilityAdapter,
  "kakaobank-careers": kakaobankCareersAdapter,
  "krafton-careers": kraftonCareersAdapter,
  "kurly-careers": kurlyCareersAdapter,
  "naver-careers": naverCareersAdapter,
  "samsung-careers": samsungCareersAdapter,
  "sk-careers": skCareersAdapter,
  "cj-careers": cjCareersAdapter,
  "line-careers": lineCareersAdapter,
  "daangn-careers": daangnCareersAdapter,
  "woowahan-careers": woowahanCareersAdapter,
};

const SOURCE_ALIASES: Record<string, SourceId> = {
  toss: "toss-careers",
  coupang: "coupang-careers",
  kakaobank: "kakaobank-careers",
  krafton: "krafton-careers",
  kurly: "kurly-careers",
  samsung: "samsung-careers",
  sk: "sk-careers",
  cj: "cj-careers",
  line: "line-careers",
  daangn: "daangn-careers",
  woowahan: "woowahan-careers",
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
