import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toHtml, toReportHtml } from "../render_recommendation.ts";
import { run } from "./fixture.ts";

test("상세 추천은 순서와 자유 라벨과 근거 묶음을 보존한다", () => {
  const html = toReportHtml(run);
  expect(html.match(/<li class="card">/g)).toHaveLength(7);
  expect(html.match(/<span class="ranking-number">/g)).toHaveLength(11);
  expect(html).toContain("분석한 활성 공고 순위 · 11건");
  expect(html).toContain("우선 검토");
  expect(html).toContain("회사와 역할");
  expect(html).toContain("성장 중인 제품의 핵심 백엔드를 맡을 가능성이 있다.");
  expect(html).toContain('<a href="https://example.com/jobs/1">https://example.com/jobs/1</a>');
  for (const label of [
    "추천 요약",
    "추천 포지션",
    "추천 이유",
    "근거와 해석",
    "분석한 활성 공고 순위",
    "다음 행동",
  ])
    expect(html).toContain(label);
});

test("추천이 없으면 빈 추천 목록만 표시한다", () => {
  const sample = structuredClone(run);
  sample.recommendations = [];
  const html = toReportHtml(sample);
  expect(html.match(/<p class="empty">해당 없음<\/p>/g)).toHaveLength(1);
});

test("선택 자료가 없으면 빈 절을 만들지 않는다", () => {
  const sample = structuredClone(run);
  sample.summary = [];
  sample.nextActions = [];
  sample.recommendations = [
    {
      ...run.recommendations[0],
      candidateId: run.recommendations[0].candidateId,
      company: run.recommendations[0].company,
      title: run.recommendations[0].title,
      postingUrl: run.recommendations[0].postingUrl,
      reason: run.recommendations[0].reason,
      details: [],
      nextActions: [],
    },
  ];
  delete sample.recommendations[0].label;
  const html = toReportHtml(sample);
  for (const text of ["추천 요약", "다음 행동", "추천 판단", "근거와 해석", "지원 준비"])
    expect(html).not.toContain(text);
});

test("회사 세 축과 축별 근거를 그리고 비교 기준은 위에 한 번만 둔다", () => {
  const html = toReportHtml(run);
  expect(html.indexOf("현재 직장 비교 기준")).toBeLessThan(html.indexOf("추천 요약"));
  expect(html.match(/<h3>현재 직장<\/h3>/g)).toHaveLength(1);
  expect(html).toContain("기술 성장");
  expect(html).toContain("팀 성장");
  expect(html).toContain("보상과 복지");
  expect(html).toContain('class="axis-level axis-high">높음');
  expect(html).toContain('class="axis-level axis-unknown">근거 없음');
  expect(html).toContain('<a href="https://example.com/blog/1">기술 블로그</a>');
  expect(html.match(/https:\/\/example.com\/blog\/1/g)).toHaveLength(1);
  expect(html).not.toContain("Tier ");
  expect(html).not.toContain("비공개 판정 메모");
});

test("세 축에 근거가 없어도 공고를 그린다", () => {
  const sample = structuredClone(run);
  sample.companyAssessments = sample.companyAssessments
    .filter((item) => item.disposition === "analyze")
    .map((item) => ({
      ...item,
      reason: null,
      evidence: [],
      signals: item.signals.map((signal) => ({
        ...signal,
        level: "unknown" as const,
        evidenceIds: [],
      })),
    }));
  const html = toReportHtml(sample);
  expect(html).toContain("백엔드 개발자");
  expect(html).toContain("근거 없음");
  expect(html).not.toContain("Tier ");
});

test("custom template의 diagnostics 슬롯과 사용자 슬롯 문자열을 안전하게 처리한다", () => {
  const directory = mkdtempSync("/tmp/position-template.");
  try {
    const path = join(directory, "custom.html");
    writeFileSync(path, "{{title}}|{{generatedAt}}|{{reportHtml}}|{{sourceDiagnosticsHtml}}");
    const sample = structuredClone(run);
    sample.summary = ['<script>alert("x")</script> & {{title}}'];
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
