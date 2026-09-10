import { expect, test } from "bun:test";
import { run } from "./fixture.ts";
import { validateReportHtml } from "./validate-report-html.ts";

const recommended = run.tiers.strong[0];
const links = [...run.tiers.strong, ...run.tiers.stretch]
  .map((item) => `<a href="${item.postingUrl}">${item.title}</a>`)
  .join("");

test("고정된 절과 카드 구조 없이 서로 다른 HTML 구성을 허용한다", () => {
  const minimal = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>추천</title></head><body>${links}</body></html>`;
  const editorial = `<!doctype html><html><head><title>오늘의 선택</title><meta content="width=device-width" name="viewport"></head><body><article><h1>${recommended.company}</h1><p>${recommended.whyFit}</p>${links}</article></body></html>`;
  expect(validateReportHtml(minimal, run)).toEqual([]);
  expect(validateReportHtml(editorial, run)).toEqual([]);
});

test("추천 링크 누락과 공개 경계 위반을 거부한다", () => {
  const html =
    '<!doctype html><html><head><title>추천</title><meta name="viewport" content="width=device-width"></head><body><a href="file:///Users/test/private">내부 파일</a><p>서류 탈락</p></body></html>';
  const errors = validateReportHtml(html, run);
  expect(errors.some((error) => error.includes("추천 공고 링크"))).toBe(true);
  expect(errors).toContain("로컬 절대 경로가 포함됐다");
  expect(errors).toContain("비공개 커리어 정보가 포함됐다");
  expect(errors.some((error) => error.includes("허용하지 않는 링크"))).toBe(true);
});
