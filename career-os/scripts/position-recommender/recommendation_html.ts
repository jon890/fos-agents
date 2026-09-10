import type { PositionItemType, RecommendationRunType } from "./recommendation_schema.ts";
import { escapeHtml, fragment, type RenderAssets } from "./template.ts";

function link(assets: RenderAssets, value: string): string {
  return /^https?:\/\//.test(value)
    ? fragment(assets, "report-link", { url: value })
    : escapeHtml(value);
}

function list(assets: RenderAssets, values: string[], name = "report-list"): string {
  return fragment(
    assets,
    name,
    {},
    {
      items: values.map((value) => fragment(assets, "list-item", { value })).join(""),
    },
  );
}

function card(assets: RenderAssets, item: PositionItemType, isStretch: boolean): string {
  const codeList = (values: string[]) =>
    values.map((value) => fragment(assets, "report-code", { value })).join(", ");
  const levels: Record<string, string> = {
    강함: "badge-strong",
    중간: "badge-mid",
    약함: "badge-weak",
  };
  const directions: Record<string, string> = {
    상향: "badge-strong",
    동일: "badge-mid",
    하향: "badge-weak",
    "확인 필요": "badge-mid",
  };
  const axes = item.companyUpside.axes
    .map((axis) =>
      fragment(assets, "report-axis", {
        ...axis,
        className: directions[axis.direction] ?? "badge-mid",
      }),
    )
    .join("");
  const fields: [string, string][] = [
    ["공고 링크", link(assets, item.postingUrl)],
    ["링크 근거 수준", escapeHtml(item.linkEvidenceLevel)],
    ["공고 기간", escapeHtml(item.postingPeriod)],
    ["수집 source", escapeHtml(item.source)],
    ["마감일", escapeHtml(item.closeDate ?? "상시/미정")],
    ["검색 키워드", codeList(item.searchKeywords)],
    ["왜 맞는가", escapeHtml(item.whyFit)],
    ["후보자 경험 근거", list(assets, item.candidateEvidence, "report-sub-list")],
    ["JD에서 노려야 할 키워드", codeList(item.jdKeywords)],
    [
      "회사/규모 업사이드",
      `${fragment(assets, "report-badge", { className: levels[item.companyUpside.level] ?? "badge-mid", value: item.companyUpside.level })} ${escapeHtml(item.companyUpside.reason)}`,
    ],
    ["현재 직장 대비 축별 판정", fragment(assets, "report-axes", {}, { items: axes })],
    ["복지/학습 환경 판단", escapeHtml(item.welfareLearning)],
    ["기술블로그/엔지니어링 시그널", escapeHtml(item.techBlogSignal)],
    ["사업/조직/seniority 리스크", escapeHtml(item.businessRisk)],
    ["확인해야 할 모호점", escapeHtml(item.ambiguity)],
    ["준비 액션", escapeHtml(item.prepAction)],
  ];
  if (isStretch && item.stretchGap) fields.push(["Stretch gap", escapeHtml(item.stretchGap)]);
  return fragment(
    assets,
    "report-card",
    { rank: item.rank, company: item.company, title: item.title },
    {
      fields: fields
        .map(([label, value]) => fragment(assets, "report-field", { label }, { value }))
        .join(""),
    },
  );
}

function tier(
  assets: RenderAssets,
  title: string,
  className: string,
  items: PositionItemType[],
  isStretch: boolean,
): string {
  const content =
    items.length === 0
      ? fragment(assets, "report-empty")
      : fragment(
          assets,
          "report-cards",
          {},
          {
            cards: items.map((item) => card(assets, item, isStretch)).join("\n"),
          },
        );
  return fragment(assets, "report-tier", { title, className }, { content });
}

export function renderReportContent(run: RecommendationRunType, assets: RenderAssets): string {
  return fragment(
    assets,
    "report-content",
    { ...run.weeklyActions },
    {
      conclusion: list(assets, run.conclusion),
      background: list(assets, run.background),
      strong: tier(assets, "강력 추천 포지션", "tier-strong", run.tiers.strong, false),
      stretch: tier(assets, "도전 추천 포지션", "tier-stretch", run.tiers.stretch, true),
      targets: run.additionalTargets
        .map((target) =>
          fragment(
            assets,
            "report-target",
            {
              company: target.company,
              reason: target.reason,
              nextCollectionPoint: target.nextCollectionPoint,
            },
            { link: link(assets, target.exploreLink) },
          ),
        )
        .join("\n"),
      holds: run.tiers.hold
        .map((hold) =>
          fragment(
            assets,
            "report-hold",
            {
              company: hold.company,
              title: hold.title,
              reason: hold.reason,
            },
            { link: link(assets, hold.link) },
          ),
        )
        .join("\n"),
      recentCheck: list(assets, run.recentCheck),
    },
  );
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
      // 이전 기본 템플릿과 --template 소비자가 사용하는 명시적 호환 슬롯이다.
      sourceDiagnosticsHtml: "",
    },
  );
}
