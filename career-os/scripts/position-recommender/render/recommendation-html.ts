import type {
  PendingCandidateType,
  RankedCandidateType,
  RecommendationItemType,
  RecommendationRunType,
} from "../recommendation/schema.ts";
import type { PublicCompanyAssessment } from "../../../services/career-backend/src/positions/schema.ts";
import { fragment, type RenderAssets } from "./template.ts";

function link(assets: RenderAssets, value: string): string {
  return fragment(assets, "report-link", { url: value });
}

const axisLabels = {
  "growth-scope": "기술 성장",
  "team-growth": "팀 성장",
  "compensation-upside": "보상과 복지",
} as const;
const levelLabels = { low: "낮음", medium: "보통", high: "높음" } as const;

function companyAssessment(assets: RenderAssets, company: PublicCompanyAssessment): string {
  const evidenceById = new Map(
    company.evidence.filter((item) => item.id).map((item) => [item.id, item]),
  );
  const axes = company.signals
    .map((signal) => {
      const evidence = signal.evidenceIds
        .flatMap((id) => {
          const item = evidenceById.get(id);
          return item
            ? [
                fragment(assets, "report-evidence-link", {
                  url: item.url,
                  title: item.title ?? item.url,
                }),
              ]
            : [];
        })
        .join(" · ");
      return fragment(
        assets,
        "report-company-axis",
        {
          name: axisLabels[signal.axis],
          level: signal.level === "unknown" ? "근거 없음" : levelLabels[signal.level],
          className: signal.level === "unknown" ? "axis-unknown" : `axis-${signal.level}`,
        },
        { evidence },
      );
    })
    .join("");
  return fragment(
    assets,
    "report-company",
    { company: company.companyName, reason: company.reason ?? "" },
    { axes },
  );
}

function companySections(assets: RenderAssets, run: RecommendationRunType): string {
  const candidates = run.companyAssessments.filter((item) => item.disposition === "analyze");
  return [
    candidates.length
      ? fragment(
          assets,
          "report-section",
          { title: "회사별 판정" },
          {
            content: candidates.map((item) => companyAssessment(assets, item)).join(""),
          },
        )
      : "",
  ].join("\n");
}

function list(assets: RenderAssets, values: string[], name = "report-list"): string {
  return fragment(
    assets,
    name,
    {},
    { items: values.map((value) => fragment(assets, "list-item", { value })).join("") },
  );
}

function card(assets: RenderAssets, item: RecommendationItemType, rank: number): string {
  const fields: [string, string][] = [["공고 링크", link(assets, item.postingUrl)]];
  return fragment(
    assets,
    "report-card",
    { rank, company: item.company, title: item.title },
    {
      fields: fields
        .map(([label, value]) => fragment(assets, "report-field", { label }, { value }))
        .join(""),
    },
  );
}

function recommendationSection(
  assets: RenderAssets,
  items: RecommendationItemType[],
  rankByCandidate: Map<string, number>,
): string {
  const content =
    items.length === 0
      ? fragment(assets, "report-empty")
      : fragment(
          assets,
          "report-cards",
          {},
          {
            cards: items
              .map((item, index) =>
                card(assets, item, rankByCandidate.get(item.candidateId) ?? index + 1),
              )
              .join("\n"),
          },
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

function rankingItem(assets: RenderAssets, item: RankedCandidateType, index: number): string {
  return fragment(assets, "report-ranking-item", {
    rank: index + 1,
    company: item.company,
    title: item.title,
    url: item.postingUrl,
    note: "",
  });
}

function rankingSection(assets: RenderAssets, items: RankedCandidateType[]): string {
  return fragment(
    assets,
    "report-section",
    { title: `분석한 활성 공고 순위 · ${items.length}건` },
    {
      content: fragment(
        assets,
        "report-ranking",
        {},
        { items: items.map((item, index) => rankingItem(assets, item, index)).join("\n") },
      ),
    },
  );
}

function pendingNote(item: PendingCandidateType): string {
  const label = { new: "미분석", changed: "공고 변경", stale: "분석 만료" } as const;
  return label[item.analysisStatus];
}

function pendingSection(assets: RenderAssets, run: RecommendationRunType): string {
  if (run.pendingCandidates.length === 0) return "";
  return fragment(
    assets,
    "report-section",
    { title: `분석 대기 · ${run.pendingCandidates.length}건` },
    {
      content: fragment(
        assets,
        "report-ranking",
        {},
        {
          items: run.pendingCandidates
            .map((item, index) =>
              fragment(assets, "report-ranking-item", {
                rank: index + 1,
                company: item.company,
                title: item.title,
                url: item.postingUrl,
                note: pendingNote(item),
              }),
            )
            .join("\n"),
        },
      ),
    },
  );
}

function collectionWarnings(assets: RenderAssets, run: RecommendationRunType): string {
  if (run.collectionHealth.warningSources.length === 0) return "";
  return fragment(
    assets,
    "report-section",
    { title: "수집 경고" },
    {
      content: list(
        assets,
        run.collectionHealth.warningSources.map(
          (warning) => `${warning.source} · ${warning.status} · 실패 ${warning.failedCount}건`,
        ),
      ),
    },
  );
}

export function renderReportContent(run: RecommendationRunType, assets: RenderAssets): string {
  const rankByCandidate = new Map(
    run.ranking.map((item, index) => [item.candidateId, index + 1] as const),
  );
  const sections = [
    companySections(assets, run),
    fragment(
      assets,
      "report-section",
      { title: "추천 요약" },
      {
        content: list(assets, [
          `활성 공고 ${run.analysisSummary.activeCount}건 중 이번 실행 분석 ${run.analysisSummary.analyzedNowCount}건, 재사용 ${run.analysisSummary.reusedCount}건, 대기 ${run.analysisSummary.pendingCount}건입니다.`,
          `회사 평가 실패 ${run.companyTierSummary.assessmentFailedCount}건입니다.`,
        ]),
      },
    ),
    recommendationSection(assets, run.recommendations, rankByCandidate),
    rankingSection(assets, run.ranking),
    pendingSection(assets, run),
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
      sourceDiagnosticsHtml: collectionWarnings(assets, run),
    },
  );
}
