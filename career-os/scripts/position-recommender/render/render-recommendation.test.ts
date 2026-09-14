import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toHtml, toReportHtml } from "../render_recommendation.ts";
import { run } from "./fixture.ts";

test("상세 추천은 순서와 자유 라벨과 근거 묶음을 보존한다", () => {
  const html = toReportHtml(run);
  expect(html.match(/<li class="card">/g)).toHaveLength(7);
  expect(html).toContain("우선 검토");
  expect(html).toContain("회사와 역할");
  expect(html).toContain("성장 중인 제품의 핵심 백엔드를 맡을 가능성이 있다.");
  expect(html).toContain('<a href="https://example.com/jobs/1">https://example.com/jobs/1</a>');
  for (const label of ["추천 요약", "추천 포지션", "추천 이유", "근거와 해석", "다음 행동"])
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
      candidateId: run.recommendations[0].candidateId,
      company: run.recommendations[0].company,
      title: run.recommendations[0].title,
      postingUrl: run.recommendations[0].postingUrl,
      reason: run.recommendations[0].reason,
      details: [],
      nextActions: [],
    },
  ];
  const html = toReportHtml(sample);
  for (const text of ["추천 요약", "다음 행동", "추천 판단", "근거와 해석", "지원 준비"])
    expect(html).not.toContain(text);
});

test("custom template과 빈 diagnostics 슬롯을 지원하고 사용자 슬롯 문자열은 재치환하지 않는다", () => {
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
