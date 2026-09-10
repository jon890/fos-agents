import type { PostingCandidatePool } from "./live-postings/contracts.ts";
import type {
  PositionItemType,
  RecommendationRunType,
  UpsideAxisJudgmentType,
} from "./recommendation_schema.ts";
import { fragment, type RenderAssets } from "./template.ts";

type PreviewTier = "강력 추천" | "도전 추천" | "보류·주의" | "전체 후보";

interface PreviewRow {
  rank: number;
  tier: PreviewTier;
  company: string;
  title: string;
  url: string;
  why: string;
  /** 현재 직장 대비 업사이드 종합 방향. 보류 항목은 판정하지 않아 비운다. */
  upsideDirection?: string;
  /** 축별 판정. 추천 티어만 갖는다. */
  upsideAxes?: UpsideAxisJudgmentType[];
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
    upsideDirection: summarizeDirection(item.companyUpside.axes.map((axis) => axis.direction)),
    upsideAxes: item.companyUpside.axes,
    keywords: item.jdKeywords,
  };
}

/**
 * 축별 방향을 한 값으로 줄인다.
 * 하향이 하나라도 있으면 하향으로 보여, 올라가는 축에 가려지지 않게 한다.
 */
function summarizeDirection(directions: string[]): string {
  if (directions.includes("하향")) return "하향";
  if (directions.includes("상향")) return "상향";
  if (directions.every((direction) => direction === "확인 필요")) return "확인 필요";
  return "동일";
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
  const byId = new Map(pool.candidates.map((candidate) => [candidate.id, candidate]));
  return run.candidateRanking
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .flatMap((ranking) => {
      const candidate = byId.get(ranking.candidateId);
      if (!candidate) return [];
      return [
        {
          rank: ranking.rank,
          tier: "전체 후보" as const,
          company: candidate.company,
          title: candidate.title,
          url: candidate.url,
          why: ranking.oneLineReason,
          upsideDirection: ranking.upsideDirection,
          keywords: candidate.skills.length > 0 ? candidate.skills.slice(0, 8) : ["기술 정보 없음"],
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

function directionClass(direction: string): string {
  const map: Record<string, string> = {
    상향: "up",
    동일: "flat",
    하향: "down",
    "확인 필요": "unknown",
  };
  return map[direction] ?? "unknown";
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

function axes(assets: RenderAssets, row: PreviewRow): string {
  if (!row.upsideAxes || row.upsideAxes.length === 0) return "";
  return fragment(
    assets,
    "preview-axes",
    {},
    {
      items: row.upsideAxes
        .map((axis) =>
          fragment(assets, "preview-axis", {
            ...axis,
            className: directionClass(axis.direction),
          }),
        )
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
              search: [row.company, row.title, row.why, row.upsideDirection ?? "", ...row.keywords]
                .join(" ")
                .toLowerCase(),
            },
            {
              badge: row.upsideDirection
                ? fragment(assets, "preview-badge", {
                    direction: row.upsideDirection,
                    className: directionClass(row.upsideDirection),
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
                  axes: axes(assets, row),
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
