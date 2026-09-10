import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { toHtml, toReportHtml } from "./render_recommendation.ts";
import { run } from "./render_fixture.ts";

test("상세 추천은 모든 티어와 필드, 축별 근거와 추가 대상을 보존한다", () => {
  const sample = structuredClone(run);
  sample.additionalTargets = [
    {
      company: "추가 회사",
      exploreLink: "https://example.com/search",
      reason: "탐색 필요",
      nextCollectionPoint: "공식 공고",
    },
  ];
  const html = toReportHtml(sample);
  expect(html.match(/<li class="card">/g)).toHaveLength(7);
  expect(html.match(/<li class="card hold">/g)).toHaveLength(4);
  expect(html).toContain("Stretch gap");
  expect(html).toContain("공고가 대규모 트래픽 환경을 명시한다.");
  expect(html).toContain('<a href="https://example.com/search">https://example.com/search</a>');
  for (const label of [
    "한 줄 결론",
    "추천 배경 요약",
    "마감일",
    "상시/미정",
    "후보자 경험 근거",
    "최근 반복 점검",
    "이번 주 액션 플랜",
    "공식 공고",
  ])
    expect(html).toContain(label);
});

test("빈 추천과 텍스트 링크는 기존 표시를 유지한다", () => {
  const sample = structuredClone(run);
  sample.tiers.strong = [];
  sample.tiers.stretch = [];
  sample.tiers.hold[0].link = "확인 필요";
  const html = toReportHtml(sample);
  expect(html.match(/<p class="empty">해당 없음<\/p>/g)).toHaveLength(2);
  expect(html).toMatch(/<dt>링크<\/dt>\s*<dd>확인 필요<\/dd>/);
});

test("custom template과 빈 diagnostics 슬롯을 지원하고 사용자 슬롯 문자열은 재치환하지 않는다", () => {
  const directory = mkdtempSync("/tmp/position-template.");
  try {
    const path = join(directory, "custom.html");
    writeFileSync(path, "{{title}}|{{generatedAt}}|{{reportHtml}}|{{sourceDiagnosticsHtml}}");
    const sample = structuredClone(run);
    sample.conclusion = ['<script>alert("x")</script> & {{title}}'];
    const html = toHtml(sample, path);
    expect(html).toStartWith("2026-08-13 포지션 추천 리포트|");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; {{title}}");
    expect(html).toEndWith("|");
    writeFileSync(path, "{{unknown}}");
    expect(() => toHtml(sample, path)).toThrow("Unknown template placeholder");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
