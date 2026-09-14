import type { PositionItemType, RecommendationRunType } from "../recommendation/schema.ts";
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
  const confidenceClass: Record<string, string> = {
    high: "badge-strong",
    medium: "badge-mid",
    low: "badge-weak",
  };
  const findings = item.companyAssessment.findings
    .map((finding) => {
      const evidence = finding.evidenceUrls
        .map((url) => fragment(assets, "report-link", { url }))
        .join(" · ");
      const assumptions = finding.assumptions.length
        ? list(assets, finding.assumptions, "report-sub-list")
        : "";
      return fragment(
        assets,
        "report-finding",
        {
          kind: finding.kind === "fact" ? "확인한 사실" : "근거 기반 추론",
          topic: finding.topic,
          statement: finding.statement,
          className: confidenceClass[finding.confidence] ?? "badge-mid",
          confidence: finding.confidence,
        },
        { evidence, assumptions },
      );
    })
    .join("");
  const fields: [string, string][] = [
    ["공고 링크", link(assets, item.postingUrl)],
    ["링크 근거 수준", escapeHtml(item.linkEvidenceLevel)],
    ["공고 기간", escapeHtml(item.postingPeriod)],
    ["수집 source", escapeHtml(item.source)],
    ["마감일", escapeHtml(item.closeDate ?? "상시/미정")],
    ["왜 맞는가", escapeHtml(item.whyFit)],
    ["후보자 경험 근거", list(assets, item.candidateEvidence, "report-sub-list")],
    ["JD에서 노려야 할 키워드", codeList(item.jdKeywords)],
    [
      "회사와 역할 판단",
      `${fragment(assets, "report-badge", { className: confidenceClass[item.companyAssessment.confidence] ?? "badge-mid", value: item.companyAssessment.confidence })} ${escapeHtml(item.companyAssessment.summary)}`,
    ],
    ["판단 근거", fragment(assets, "report-findings", {}, { items: findings })],
    ["준비 액션", escapeHtml(item.prepAction)],
  ];
  if (item.openQuestions.length > 0) {
    fields.push([
      "면접이나 추가 조사에서 확인할 것",
      list(assets, item.openQuestions, "report-sub-list"),
    ]);
  }
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
