import type { PostingCandidatePool } from "../live-postings/contracts.ts";
import type { PositionItemType, RecommendationRunType } from "../recommendation/schema.ts";
import { fragment, type RenderAssets } from "./template.ts";

type PreviewTier = "강력 추천" | "도전 추천" | "보류·주의" | "전체 후보";

interface PreviewRow {
  rank: number;
  tier: PreviewTier;
  company: string;
  title: string;
  url: string;
  why: string;
  assessment?: string;
  confidence?: "high" | "medium" | "low";
  keywords: string[];
}

export interface CandidatePreviewOptions {
  limit?: number | null;
  title?: string;
  candidatePool?: PostingCandidatePool;
}

function positionRow(tier: PreviewTier, item: PositionItemType): PreviewRow {
  return {
    rank: item.rank,
    tier,
    company: item.company,
    title: item.title,
    url: item.postingUrl,
    why: item.whyFit,
    assessment: item.companyAssessment.summary,
    confidence: item.companyAssessment.confidence,
    keywords: item.jdKeywords,
  };
}

function recommendationRows(run: RecommendationRunType): PreviewRow[] {
  const selected = [
    ...run.tiers.strong.map((item) => positionRow("강력 추천", item)),
    ...run.tiers.stretch.map((item) => positionRow("도전 추천", item)),
  ];
  const nextRank = selected.reduce((highest, item) => Math.max(highest, item.rank), 0) + 1;
  return [
    ...selected,
    ...run.tiers.hold
      .filter((item) => item.link !== "-")
      .map((item, index) => ({
        rank: nextRank + index,
        tier: "보류·주의" as const,
        company: item.company,
        title: item.title,
        url: item.link,
        why: item.reason,
        keywords: ["보류"],
      })),
  ].sort((a, b) => a.rank - b.rank);
}

function candidateRows(pool: PostingCandidatePool, run: RecommendationRunType): PreviewRow[] {
  const evaluated = new Set(run.evaluatedCandidateIds);
  const selected = new Map(
    [...run.tiers.strong, ...run.tiers.stretch].map((item) => [item.candidateId, item]),
  );
  return pool.candidates.flatMap((candidate, index) => {
    if (!evaluated.has(candidate.id)) return [];
    const item = selected.get(candidate.id);
    return [
      {
        rank: item?.rank ?? index + 1,
        tier: "전체 후보" as const,
        company: candidate.company,
        title: candidate.title,
        url: candidate.url,
        why: item?.whyFit ?? (candidate.summary || candidate.mainTasks || candidate.activeEvidence),
        assessment: item?.companyAssessment.summary,
        confidence: item?.companyAssessment.confidence,
        keywords:
          candidate.skills.length > 0 ? candidate.skills.slice(0, 8) : candidate.tags.slice(0, 8),
      },
    ];
  });
}

function applyLimit(rows: PreviewRow[], limit: number | null | undefined): PreviewRow[] {
  return limit == null ? rows : rows.slice(0, Math.max(1, limit));
}

function tierClass(tier: PreviewTier): string {
  if (tier === "강력 추천") return "tier-strong";
  if (tier === "도전 추천") return "tier-stretch";
  if (tier === "보류·주의") return "tier-hold";
  return "tier-all";
}

function confidenceClass(confidence: string): string {
  const map: Record<string, string> = {
    high: "up",
    medium: "flat",
    low: "unknown",
  };
  return map[confidence] ?? "unknown";
}

function chips(assets: RenderAssets, row: PreviewRow, limit = 5): string {
  return fragment(
    assets,
    "preview-chips",
    {},
    {
      chips: row.keywords
        .slice(0, limit)
        .map((value) => fragment(assets, "preview-chip", { value }))
        .join(""),
    },
  );
}

function assessment(assets: RenderAssets, row: PreviewRow): string {
  if (!row.assessment) return "";
  return fragment(assets, "preview-assessment", { value: row.assessment });
}

function rowText(row: PreviewRow) {
  return {
    rank: row.rank,
    tier: row.tier,
    company: row.company,
    title: row.title,
    url: row.url,
    why: row.why,
    className: tierClass(row.tier),
  };
}

function board(assets: RenderAssets, rows: PreviewRow[], title: string, className: string): string {
  if (rows.length === 0) return "";
  return fragment(
    assets,
    "preview-board",
    { title, className, count: rows.length },
    {
      rows: rows
        .map((row) =>
          fragment(assets, "preview-board-row", rowText(row), { chips: chips(assets, row, 3) }),
        )
        .join(""),
    },
  );
}

function archive(assets: RenderAssets, rows: PreviewRow[]): string {
  return fragment(
    assets,
    "preview-archive",
    { count: rows.length },
    {
      candidates: rows
        .map((row) =>
          fragment(
            assets,
            "preview-candidate",
            {
              ...rowText(row),
              search: [row.company, row.title, row.why, row.assessment ?? "", ...row.keywords]
                .join(" ")
                .toLowerCase(),
            },
            {
              badge: row.confidence
                ? fragment(assets, "preview-badge", {
                    confidence: row.confidence,
                    className: confidenceClass(row.confidence),
                  })
                : "",
              chips: chips(assets, row, 4),
            },
          ),
        )
        .join("\n"),
    },
  );
}

export function renderCandidatePreview(
  run: RecommendationRunType,
  options: CandidatePreviewOptions,
  assets: RenderAssets,
  collected: { short: string; full: string },
): string {
  const limit = options.limit === undefined ? 10 : options.limit;
  const recommended = recommendationRows(run);
  const candidates = options.candidatePool
    ? applyLimit(candidateRows(options.candidatePool, run), limit)
    : [];
  const strong = recommended.filter((row) => row.tier === "강력 추천");
  const stretch = recommended.filter((row) => row.tier === "도전 추천");
  const prioritized = recommended.filter(
    (row) => row.tier === "강력 추천" || row.tier === "도전 추천",
  );
  const featured = prioritized.slice(0, 3);
  const holds = recommended.filter((row) => row.tier === "보류·주의");
  const collectionRunId =
    options.candidatePool?.collectionRunId ?? run.sourceSnapshot.collectionRunId;
  return fragment(
    assets,
    "preview",
    {
      title: options.title ?? `${run.reportDate} 포지션 추천`,
      recommendationCount: prioritized.length,
      strongCount: strong.length,
      stretchCount: stretch.length,
      featuredCount: featured.length,
      reportDate: run.reportDate.replace(/-/g, "."),
      collectedShort: collected.short,
      collectedFull: collected.full,
      collectionRunId,
      runType: collectionRunId.match(/^(.+?)-\d{4}-\d{2}-\d{2}T/)?.[1] ?? "position-postings",
    },
    {
      css: assets.css,
      conclusions: run.conclusion.map((value) => fragment(assets, "list-item", { value })).join(""),
      heroCards:
        featured.length === 0
          ? fragment(assets, "preview-empty")
          : featured
              .map((row) =>
                fragment(assets, "preview-hero", rowText(row), {
                  axes: assessment(assets, row),
                  chips: chips(assets, row),
                }),
              )
              .join(""),
      additionalSection: board(
        assets,
        prioritized.slice(3),
        "추가 추천",
        "additional-recommendations",
      ),
      holdSection: board(assets, holds, "보류·주의", "hold-recommendations"),
      archive: options.candidatePool ? archive(assets, candidates) : "",
      filterScript: options.candidatePool
        ? fragment(assets, "preview-script", {}, { script: assets.script })
        : "",
    },
  );
}
