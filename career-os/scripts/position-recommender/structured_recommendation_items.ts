import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type RecommendationTier = "strong" | "stretch";

export type ParsedRecommendationCandidate = {
  section: RecommendationTier;
  title: string;
  postingLink: string;
  evidence: string;
  summary: string;
  check: string;
  action: string;
};

type LivePostingRecord = {
  company: string;
  title: string;
  source: string;
  url: string;
  closesAt: string;
  activeEvidence: string;
  skills: string[];
  tags: string[];
};

export type StructuredRecommendationItem = {
  itemId: string;
  rank: number;
  tier: RecommendationTier;
  source: string;
  company: string;
  title: string;
  postingUrl: string;
  normalizedPostingUrl: string;
  closeDate: string | null;
  snapshot: {
    reportDate: string;
    generatedAt: string;
    recommendationTier: RecommendationTier;
    recommendationTitle: string;
    priorityReason: string;
    nextAction: string;
    riskFlags: string[];
    evidenceUrls: string[];
    evidence: string;
    fitSummary: string;
    ambiguityCheck: string;
    preparationAction: string;
    sourceSnapshot?: {
      activeEvidence?: string;
      skills?: string[];
      tags?: string[];
    };
  };
};

export type StructuredRecommendationRun = {
  schemaVersion: 1;
  runId: string;
  reportDate: string;
  generatedAt: string;
  sourceSnapshotPath: string;
  markdownReportPath: string;
  htmlReportPath: string;
  itemCount: number;
  items: StructuredRecommendationItem[];
};

function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export function normalizePostingUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|fbclid$|gclid$|_gl$|source$|ref$|referrer$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    const rendered = url.toString();
    return rendered.endsWith("/") && url.pathname !== "/" ? rendered.slice(0, -1) : rendered;
  } catch {
    return rawUrl.trim();
  }
}

function parseRecommendationTitle(rawTitle: string): { company: string; title: string } {
  const clean = rawTitle.replace(/\*\*/g, "").trim();
  const match = clean.match(/^(.+?)\s+[—-]\s+(.+)$/);
  if (match) return { company: match[1].trim(), title: match[2].trim() };
  return { company: "unknown", title: clean };
}

function parseLivePostingSnapshot(snapshotPath: string): Map<string, LivePostingRecord> {
  const records = new Map<string, LivePostingRecord>();
  if (!existsSync(snapshotPath)) return records;

  const content = readFileSync(snapshotPath, "utf-8");
  let current: Partial<LivePostingRecord> | null = null;

  const flush = () => {
    if (current?.url) {
      records.set(normalizePostingUrl(current.url), {
        company: current.company ?? "",
        title: current.title ?? "",
        source: current.source ?? "position-recommender",
        url: current.url,
        closesAt: current.closesAt ?? "",
        activeEvidence: current.activeEvidence ?? "",
        skills: current.skills ?? [],
        tags: current.tags ?? [],
      });
    }
    current = null;
  };

  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^-\s+\[([^\]]+)\]\s+(.+)$/);
    if (heading) {
      flush();
      current = { company: heading[1].trim(), title: heading[2].trim(), skills: [], tags: [] };
      continue;
    }
    if (!current) continue;
    const field = line.match(/^\s+-\s+([^:]+):\s*(.*)$/);
    if (!field) continue;
    const key = field[1].trim();
    const value = field[2].trim();
    if (key === "source") current.source = value;
    else if (key === "url") current.url = value;
    else if (key === "closes_at") current.closesAt = value;
    else if (key === "active_evidence") current.activeEvidence = value;
    else if (key === "skills") current.skills = value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
    else if (key === "tags") current.tags = value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
  }
  flush();

  return records;
}

function closeDateFromLivePosting(live?: LivePostingRecord): string | null {
  if (!live?.closesAt || live.closesAt === "no_deadline" || live.closesAt === "unknown") return null;
  return live.closesAt;
}

function riskFlagsFromCheck(value: string): string[] {
  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
}

export function buildStructuredRecommendationRun(args: {
  reportDate: string;
  sourceSnapshotPath: string;
  markdownReportPath: string;
  htmlReportPath: string;
  candidates: ParsedRecommendationCandidate[];
}): StructuredRecommendationRun {
  const generatedAt = new Date().toISOString();
  const liveByUrl = parseLivePostingSnapshot(args.sourceSnapshotPath);
  const items = args.candidates.map((candidate, index) => {
    const normalizedPostingUrl = normalizePostingUrl(candidate.postingLink);
    const live = liveByUrl.get(normalizedPostingUrl);
    const parsed = parseRecommendationTitle(candidate.title);
    const company = live?.company || parsed.company;
    const title = live?.title || parsed.title;
    const source = live?.source || "position-recommender";

    return {
      itemId: `recitem-${sha1(`${args.reportDate}|${normalizedPostingUrl}|${index + 1}`).slice(0, 16)}`,
      rank: index + 1,
      tier: candidate.section,
      source,
      company,
      title,
      postingUrl: candidate.postingLink,
      normalizedPostingUrl,
      closeDate: closeDateFromLivePosting(live),
      snapshot: {
        reportDate: args.reportDate,
        generatedAt,
        recommendationTier: candidate.section,
        recommendationTitle: candidate.title,
        priorityReason: candidate.summary,
        nextAction: candidate.action,
        riskFlags: riskFlagsFromCheck(candidate.check),
        evidenceUrls: [candidate.postingLink],
        evidence: candidate.evidence,
        fitSummary: candidate.summary,
        ambiguityCheck: candidate.check,
        preparationAction: candidate.action,
        sourceSnapshot: live
          ? {
              activeEvidence: live.activeEvidence || undefined,
              skills: live.skills.length > 0 ? live.skills : undefined,
              tags: live.tags.length > 0 ? live.tags : undefined,
            }
          : undefined,
      },
    };
  });

  return {
    schemaVersion: 1,
    runId: `posrec-${args.reportDate}-${sha1(`${args.markdownReportPath}|${generatedAt}`).slice(0, 10)}`,
    reportDate: args.reportDate,
    generatedAt,
    sourceSnapshotPath: args.sourceSnapshotPath,
    markdownReportPath: args.markdownReportPath,
    htmlReportPath: args.htmlReportPath,
    itemCount: items.length,
    items,
  };
}

export function summarizeStructuredRecommendationQuality(run: StructuredRecommendationRun): {
  missingRequiredCardFields: Array<{
    itemId: string;
    rank: number;
    company: string;
    title: string;
    missing: string[];
  }>;
} {
  return {
    missingRequiredCardFields: run.items
      .map((item) => {
        const missing: string[] = [];
        if (!item.snapshot.priorityReason.trim()) missing.push("priorityReason");
        if (!item.snapshot.nextAction.trim()) missing.push("nextAction");
        if (item.snapshot.evidenceUrls.length === 0) missing.push("evidenceUrls");
        return {
          itemId: item.itemId,
          rank: item.rank,
          company: item.company,
          title: item.title,
          missing,
        };
      })
      .filter((item) => item.missing.length > 0),
  };
}

export function writeStructuredRecommendationRun(
  run: StructuredRecommendationRun,
  outputPath: string,
): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(run, null, 2)}\n`, "utf-8");
}
