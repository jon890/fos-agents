import { expect, test } from "bun:test";
import { renderCandidatePreviewHtml } from "../render_candidate_preview.ts";
import { run, pool } from "./fixture.ts";

test("추천 없는 화면과 후보 없음, hold와 stretch 표시를 보존한다", () => {
  const sample = structuredClone(run);
  sample.tiers.strong = [];
  sample.tiers.stretch = [];
  const html = renderCandidatePreviewHtml(sample);
  expect(html).toContain("오늘 기준을 통과한 추천 공고가 없습니다.");
  expect(html).not.toContain('<details class="archive">');
  expect(html).not.toContain("추가 추천</h2>");
  expect(html).toContain("보류·주의</h2>");
  expect(html).not.toContain("<script>");
  const stretch = renderCandidatePreviewHtml({ ...run, tiers: { ...run.tiers, strong: [] } });
  expect(stretch.match(/class="hero-card tier-stretch"/g)).toHaveLength(3);
});

test("사용자 문자열과 script 종료 문자는 텍스트로 남고 검색 조건과 순서를 보존한다", () => {
  const sample = structuredClone(run);
  sample.conclusion = ['</script><script>alert("x")</script> & {{title}}'];
  const html = renderCandidatePreviewHtml(sample, {
    candidatePool: pool,
    limit: 2,
    title: "<b>제목</b>",
  });
  expect(html).toContain(
    "&lt;/script&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; {{title}}",
  );
  expect(html).toContain("<title>&lt;b&gt;제목&lt;/b&gt;</title>");
  expect(html.match(/<article class="candidate-row"/g)).toHaveLength(2);
  expect(html).toContain('data-filter="java|spring" aria-pressed="false"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("matchesQuery && matchesFilter");
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html.indexOf('href="https://example.com/jobs/1"')).toBeLessThan(
    html.indexOf('href="https://example.com/jobs/2"'),
  );
  expect(renderCandidatePreviewHtml(sample, { candidatePool: pool })).toBe(
    renderCandidatePreviewHtml(sample, { candidatePool: pool }),
  );
});

test("추천 공고와 외부 후보풀을 같은 HTML에 표시한다", () => {
  const html = renderCandidatePreviewHtml(run, { candidatePool: pool, limit: null })
    .replace(/\s+>/g, ">")
    .replace(/>\s+</g, "><");
  expect(html.match(/<article class="hero-card /g)).toHaveLength(3);
  expect(html).toContain(
    '<strong>7</strong><span class="recommendation-label"><span>추천 공고</span><small>강력 4 · 도전 3</small>',
  );
  expect(html).toContain('<h2>우선 검토</h2><span class="count">상위 3건</span>');
  expect(html).toContain('<h2>추가 추천</h2><span class="count">4건</span>');
  expect(html.match(/<article class="board-row tier-/g)).toHaveLength(8);
  expect(html).toContain('<h2>보류·주의</h2><span class="count">4건</span>');
  expect(html).toContain("전체 후보 적합도 순위");
  expect(html).toContain("Java·Spring 운영 경험이 역할과 직접 연결된다.");
  expect(html).toContain("candidate-filter");
  expect(html).toMatch(/\.candidate-row\[hidden\]\s*\{\s*display:\s*none;?\s*\}/);
  expect(html).toMatch(/\.priority-grid\s*\{\s*grid-template-columns:\s*1fr;?\s*\}/);
  expect(html).toMatch(/min-height:\s*44px/);
  expect(html).toContain("08.13 09:00 수집");
  expect(html).toContain(pool.candidates[0].url);
  expect(html).toContain("백엔드 운영 경험과 맞는다.");
  expect(html).toContain(pool.collectionRunId);
  expect(html).not.toContain("<table");
  expect(html).not.toContain("min-width:900px");
});
