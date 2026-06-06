import type { SourceAdapter } from "../types.ts";
import { tossAdapter } from "./toss.ts";
import { wantedAdapter } from "./wanted.ts";

const ADAPTERS: Record<"wanted" | "toss", SourceAdapter> = {
  wanted: wantedAdapter,
  toss: tossAdapter,
};

export type SourceId = keyof typeof ADAPTERS;
export type SourceSelection = SourceId | "all";

export function selectAdapters(
  source: SourceSelection,
  includeTossArticles: boolean
): SourceAdapter[] {
  const adapters: SourceAdapter[] = [];
  if (source === "all" || source === "wanted") adapters.push(ADAPTERS.wanted);
  if (source === "toss" || (source === "all" && includeTossArticles)) adapters.push(ADAPTERS.toss);
  return adapters;
}
