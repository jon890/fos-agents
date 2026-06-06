import type { SourceAdapter, SourceId, SourceSelection } from "../types.ts";
import { tossAdapter } from "./toss.ts";
import { wantedAdapter } from "./wanted.ts";

const ADAPTERS: Record<SourceId, SourceAdapter> = {
  wanted: wantedAdapter,
  "toss-careers": tossAdapter,
};

const SOURCE_ALIASES: Record<string, SourceId> = {
  toss: "toss-careers",
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
