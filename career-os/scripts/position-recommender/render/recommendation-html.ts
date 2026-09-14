import type { RecommendationItemType, RecommendationRunType } from "../recommendation/schema.ts";
import { escapeHtml, fragment, type RenderAssets } from "./template.ts";

function link(assets: RenderAssets, value: string): string {
  return fragment(assets, "report-link", { url: value });
}

function list(assets: RenderAssets, values: string[], name = "report-list"): string {
  return fragment(
    assets,
    name,
    {},
    { items: values.map((value) => fragment(assets, "list-item", { value })).join("") },
  );
}

function detail(assets: RenderAssets, item: RecommendationItemType["details"][number]): string {
  const evidence = item.evidenceUrls.map((url) => link(assets, url)).join(" · ");
  const assumptions = item.assumptions.length
    ? list(assets, item.assumptions, "report-sub-list")
    : "";
  return fragment(
    assets,
    "report-finding",
    { title: item.title ?? "근거와 해석", content: item.content },
    { evidence, assumptions },
  );
}

function card(assets: RenderAssets, item: RecommendationItemType, index: number): string {
  const fields: [string, string][] = [
    ["공고 링크", link(assets, item.postingUrl)],
    ["추천 이유", escapeHtml(item.reason)],
  ];
  if (item.label) fields.push(["추천 판단", escapeHtml(item.label)]);
  if (item.details.length > 0) {
    fields.push([
      "근거와 해석",
      fragment(
        assets,
        "report-findings",
        {},
        {
          items: item.details.map((value) => detail(assets, value)).join(""),
        },
      ),
    ]);
  }
  if (item.nextActions.length > 0) {
    fields.push(["지원 준비", list(assets, item.nextActions, "report-sub-list")]);
  }
  return fragment(
    assets,
    "report-card",
    { rank: index + 1, company: item.company, title: item.title },
    {
      fields: fields
        .map(([label, value]) => fragment(assets, "report-field", { label }, { value }))
        .join(""),
    },
  );
}

function recommendationSection(assets: RenderAssets, items: RecommendationItemType[]): string {
  const content =
    items.length === 0
      ? fragment(assets, "report-empty")
      : fragment(
          assets,
          "report-cards",
          {},
          { cards: items.map((item, index) => card(assets, item, index)).join("\n") },
        );
  return fragment(
    assets,
    "report-tier",
    { title: "추천 포지션", className: "tier-strong" },
    {
      content,
    },
  );
}

export function renderReportContent(run: RecommendationRunType, assets: RenderAssets): string {
  const sections = [
    run.summary.length > 0
      ? fragment(
          assets,
          "report-section",
          { title: "추천 요약" },
          {
            content: list(assets, run.summary),
          },
        )
      : "",
    recommendationSection(assets, run.recommendations),
    run.nextActions.length > 0
      ? fragment(
          assets,
          "report-section",
          { title: "다음 행동" },
          {
            content: list(assets, run.nextActions),
          },
        )
      : "",
  ].join("\n");
  return fragment(assets, "report-content", {}, { sections });
}

export function renderRecommendationHtml(
  run: RecommendationRunType,
  assets: RenderAssets,
  generatedAt: string,
): string {
  return fragment(
    assets,
    "report",
    { title: `${run.reportDate} 포지션 추천 리포트`, generatedAt },
    {
      css: assets.css,
      reportHtml: renderReportContent(run, assets),
      sourceDiagnosticsHtml: "",
    },
  );
}
