import { expect, test } from "bun:test";
import { fillTemplate, fragment } from "./template.ts";
import { loadRenderAssets, readTemplateParts } from "./assets.ts";
import { formatSeoulDisplayTime } from "../../lib/date-format.ts";
import { renderRecommendationHtml } from "./recommendation-html.ts";
import { renderCandidatePreview } from "./candidate-preview-html.ts";
import { run, pool } from "./fixture.ts";

test("텍스트와 신뢰된 조각을 구분하고 데이터 속 슬롯은 한 번만 치환한다", () => {
  expect(
    fillTemplate("{{value}}|{{html}}", { value: '<b> & " {{html}}' }, { html: "<p>조립</p>" }),
  ).toBe("&lt;b&gt; &amp; &quot; {{html}}|<p>조립</p>");
  for (const key of ["unknown", "constructor", "toString", "__proto__"]) {
    expect(() => fillTemplate(`{{${key}}}`)).toThrow("Unknown template placeholder");
  }
  expect(() => fillTemplate("{{missing}}", { missing: undefined } as never)).toThrow(
    "missing value",
  );
  expect(() => fillTemplate("{{value}}", { value: "a" }, { value: "b" })).toThrow("Duplicate");
  expect(() => fragment({ templates: {}, css: "", script: "" }, "constructor")).toThrow(
    "Missing template",
  );
});

test("표준 template 요소의 줄바꿈을 허용하고 잘못된 조각과 중복 이름을 거부한다", () => {
  expect(
    readTemplateParts('<!-- 카드 설명 --><template id="card"><!-- 내부 설명 -->카드</template>'),
  ).toEqual({ card: "<!-- 내부 설명 -->카드" });
  expect(readTemplateParts('<template\n id="a"\n>내용</template\n>')).toEqual({ a: "내용" });
  expect(() =>
    readTemplateParts('<template id="a">1</template><template id="a">2</template>'),
  ).toThrow("Duplicate template");
  expect(() => readTemplateParts('<template id="a">닫히지 않음')).toThrow("Invalid template parts");
});

test("상세 렌더는 주입한 시간과 카드·화면 자산으로 결정적으로 조립한다", () => {
  const assets = loadRenderAssets("report");
  const original = structuredClone(assets);
  const first = renderRecommendationHtml(run, assets, "고정 시각 <09:00>");
  expect(first).toBe(renderRecommendationHtml(run, assets, "고정 시각 <09:00>"));
  expect(first).toContain("고정 시각 &lt;09:00&gt;");
  expect(assets).toEqual(original);
  assets.templates["report-card"] =
    '<section data-card="{{rank}}">{{company}} {{fields}}</section>';
  assets.templates.report = '<main data-custom="true">{{reportHtml}}</main>';
  expect(renderRecommendationHtml(run, assets, "다른 시각")).toContain(
    '<section data-card="1">예시 회사 1',
  );
  delete assets.templates["report-card"];
  expect(() => renderRecommendationHtml(run, assets, "시각")).toThrow(
    "Missing template: report-card",
  );
});

test("미리보기는 카드·목록·CSS·JS·메타 변경을 입력에서 받는다", () => {
  const assets = loadRenderAssets("preview");
  const options = { candidatePool: pool, limit: null };
  const metadata = { short: "주입한 짧은 시각", full: "주입한 전체 시각" };
  const first = renderCandidatePreview(run, options, assets, metadata);
  expect(first).toBe(renderCandidatePreview(run, options, assets, metadata));
  expect(first).toContain("주입한 짧은 시각 수집");
  expect(first).toContain("주입한 전체 시각 수집");
  assets.templates["preview-hero"] = '<article data-featured="{{rank}}">{{title}}</article>';
  assets.templates["preview-candidate"] = '<article data-candidate="{{rank}}">{{why}}</article>';
  assets.css = "body { color: tomato; }";
  assets.script = "window.templateTest = true;";
  const changed = renderCandidatePreview(run, options, assets, metadata);
  expect(changed).toContain('<article data-featured="1">');
  expect(changed.match(/data-candidate=/g)).toHaveLength(11);
  expect(changed).toContain(assets.css);
  expect(changed).toContain(assets.script);
});

test("script 종료와 속성 탈출 입력은 실행 코드나 inline JSON으로 삽입하지 않는다", () => {
  const sample = structuredClone(run);
  const candidatePool = structuredClone(pool);
  const attack =
    '</script><script>window.pwned=true</script>" onmouseover="window.pwned=true {{title}}';
  sample.tiers.strong[0].company = attack;
  sample.tiers.strong[0].postingUrl = `https://example.com/?q=${attack}`;
  sample.candidateRanking[0].oneLineReason = attack;
  candidatePool.candidates[0].title = attack;
  const assets = loadRenderAssets("preview");
  const html = renderCandidatePreview(sample, { candidatePool }, assets, { short: "s", full: "f" });
  expect(html.match(/<script>/g)).toHaveLength(1);
  expect(html.match(/<script>([\s\S]*?)<\/script>/)?.[1].trim()).toBe(assets.script.trim());
  expect(html).toContain("&lt;/script&gt;");
  expect(html).toContain("&quot; onmouseover=&quot;");
  expect(html).toContain("{{title}}");
  expect(html).not.toContain('type="application/json"');
  const detail = renderRecommendationHtml(sample, loadRenderAssets("report"), "시각");
  expect(detail).not.toContain("<script>");
  expect(detail).toContain("&lt;/script&gt;");
});

test("날짜 경계는 KST 표시와 잘못된 입력의 확인 필요 표시를 보존한다", () => {
  expect(formatSeoulDisplayTime("2026-08-13T00:00:00Z")).toEqual({
    short: "08.13 09:00",
    full: "2026.08.13 09:00 KST",
  });
  expect(formatSeoulDisplayTime("invalid")).toEqual({ short: "확인 필요", full: "확인 필요" });
});
