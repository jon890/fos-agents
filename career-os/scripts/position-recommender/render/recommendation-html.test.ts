import { expect, test } from "bun:test";
import { run } from "./fixture.ts";
import { loadRenderAssets } from "./assets.ts";
import { renderRecommendationHtml } from "./recommendation-html.ts";
import { validateReportHtml } from "./validate-report-html.ts";

test("공개 HTML은 비공개 분석과 지원 준비를 출력하지 않는다", () => {
  const sample = structuredClone(run);
  const privateValues = [
    "PRIVATE_SUMMARY",
    "PRIVATE_REASON",
    "PRIVATE_DETAIL",
    "PRIVATE_ASSUMPTION",
    "PRIVATE_NEXT_ACTION",
    "PRIVATE_RANKING_NOTE",
    "PRIVATE_CURRENT_EMPLOYER",
    "PRIVATE_COLLECTION_ERROR",
  ];
  sample.summary = [privateValues[0]];
  sample.recommendations[0].reason = privateValues[1];
  sample.recommendations[0].details[0].content = privateValues[2];
  sample.recommendations[0].details[0].assumptions = [privateValues[3]];
  sample.recommendations[0].nextActions = [privateValues[4]];
  sample.nextActions = [privateValues[4]];
  sample.ranking[0].note = privateValues[5];
  sample.companyAssessments[0].companyName = privateValues[6];
  sample.collectionHealth.warningSources = [
    {
      source: "wanted",
      status: "partial",
      failedCount: 2,
      reason: privateValues[7],
    },
  ];
  const original = structuredClone(sample);
  const html = renderRecommendationHtml(sample, loadRenderAssets(), sample.generatedAt);

  for (const value of privateValues) expect(html).not.toContain(value);
  expect(html).toContain(sample.recommendations[0].postingUrl);
  expect(html).toContain("기술 블로그");
  expect(html).toContain("실패 2건");
  expect(validateReportHtml(html, sample)).toEqual([]);
  expect(sample).toEqual(original);
});
