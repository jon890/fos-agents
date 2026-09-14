import type { PostingCandidatePool } from "../live-postings/contracts.ts";
import type { RecommendationItemType, RecommendationRunType } from "../recommendation/schema.ts";
import { fragment, type RenderAssets } from "./template.ts";

interface PreviewRow {
  rank: number;
  tier: string;
  company: string;
  title: string;
  url: string;
  why: string;
  keywords: string[];
  searchTerms: string[];
}

export interface CandidatePreviewOptions {
  limit?: number | null;
  title?: string;
  candidatePool?: PostingCandidatePool;
}

function positionRow(item: RecommendationItemType, index: number): PreviewRow {
  return {
    rank: index + 1,
    tier: item.label ?? "추천",
    company: item.company,
    title: item.title,
    url: item.postingUrl,
    why: item.reason,
    keywords: item.details.flatMap((detail) => (detail.title ? [detail.title] : [])).slice(0, 8),
    searchTerms: item.details.flatMap((detail) => [detail.content, ...detail.assumptions]),
  };
}

function recommendationRows(run: RecommendationRunType): PreviewRow[] {
  return run.recommendations.map(positionRow);
}

function candidateRows(pool: PostingCandidatePool, run: RecommendationRunType): PreviewRow[] {
  const selected = new Map(run.recommendations.map((item) => [item.candidateId, item]));
  const candidates = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  return run.ranking.flatMap((ranked, index) => {
    const candidate = candidates.get(ranked.candidateId);
    if (!candidate) return [];
    const item = selected.get(candidate.id);
    return [
      {
        rank: index + 1,
        tier: item?.label ?? (item ? "추천" : "전체 후보"),
        company: candidate.company,
        title: candidate.title,
        url: candidate.url,
        why:
          ranked.note ??
          item?.reason ??
          (candidate.summary || candidate.mainTasks || candidate.activeEvidence),
        keywords:
          candidate.skills.length > 0 ? candidate.skills.slice(0, 8) : candidate.tags.slice(0, 8),
        searchTerms: [
          candidate.category,
          candidate.summary,
          candidate.mainTasks,
          candidate.requirements,
          candidate.preferred,
          ...candidate.skills,
          ...candidate.tags,
        ],
      },
    ];
  });
}

function applyLimit(rows: PreviewRow[], limit: number | null | undefined): PreviewRow[] {
  return limit == null ? rows : rows.slice(0, Math.max(1, limit));
}

function tierClass(tier: string): string {
  return tier === "전체 후보" ? "tier-all" : "tier-strong";
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
              search: [row.company, row.title, row.why, ...row.keywords, ...row.searchTerms]
                .join(" ")
                .toLowerCase(),
            },
            {
              badge: "",
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
  const featured = recommended.slice(0, 3);
  const collectionRunId =
    options.candidatePool?.collectionRunId ?? run.sourceSnapshot.collectionRunId;
  return fragment(
    assets,
    "preview",
    {
      title: options.title ?? `${run.reportDate} 포지션 추천`,
      recommendationCount: recommended.length,
      featuredCount: featured.length,
      reportDate: run.reportDate.replace(/-/g, "."),
      collectedShort: collected.short,
      collectedFull: collected.full,
      collectionRunId,
      runType: collectionRunId.match(/^(.+?)-\d{4}-\d{2}-\d{2}T/)?.[1] ?? "position-postings",
    },
    {
      css: assets.css,
      conclusions: run.summary.map((value) => fragment(assets, "list-item", { value })).join(""),
      heroCards:
        featured.length === 0
          ? fragment(assets, "preview-empty")
          : featured
              .map((row) =>
                fragment(assets, "preview-hero", rowText(row), {
                  axes: "",
                  chips: chips(assets, row),
                }),
              )
              .join(""),
      additionalSection: board(
        assets,
        recommended.slice(3),
        "추가 추천",
        "additional-recommendations",
      ),
      archive: options.candidatePool ? archive(assets, candidates) : "",
      filterScript: options.candidatePool
        ? fragment(assets, "preview-script", {}, { script: assets.script })
        : "",
    },
  );
}
