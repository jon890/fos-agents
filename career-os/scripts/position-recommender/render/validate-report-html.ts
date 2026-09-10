#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstOptionValue } from "../../lib/cli.ts";
import { RecommendationRun } from "../recommendation/schema.ts";

const unsafeText = [
  { pattern: /(?:\/Users\/|\/home\/)[^\s"'<>]*/i, message: "로컬 절대 경로가 포함됐다" },
  { pattern: /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)/i, message: "로컬 호스트가 포함됐다" },
  { pattern: /현재 연봉|서류 탈락/, message: "비공개 커리어 정보가 포함됐다" },
];

function htmlAttributeValue(value: string): string {
  return value.replaceAll("&amp;", "&").replaceAll("&#38;", "&");
}

export function validateReportHtml(html: string, recommendation: unknown): string[] {
  const parsed = RecommendationRun.safeParse(recommendation);
  if (!parsed.success)
    return parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  const errors: string[] = [];
  if (!/^\s*<!doctype html>/i.test(html)) errors.push("HTML 문서에 doctype이 없다.");
  if (!/<title>\s*[^<]+\s*<\/title>/i.test(html))
    errors.push("HTML 문서에 비어 있지 않은 title이 필요하다.");
  if (!/<meta\s+[^>]*name=["']viewport["'][^>]*>/i.test(html))
    errors.push("모바일 표시를 위한 viewport meta가 없다.");
  for (const check of unsafeText) {
    if (check.pattern.test(html)) errors.push(check.message);
  }
  const hrefs = [...html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)].map((match) =>
    htmlAttributeValue(match[1]),
  );
  for (const href of hrefs) {
    if (
      !href.startsWith("https://") &&
      !href.startsWith("#") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("tel:")
    ) {
      errors.push(`허용하지 않는 링크 형식이다: ${href.slice(0, 80)}`);
    }
  }
  for (const item of [...parsed.data.tiers.strong, ...parsed.data.tiers.stretch]) {
    if (!hrefs.includes(item.postingUrl))
      errors.push(`추천 공고 링크가 HTML에 없다: ${item.candidateId}`);
  }
  return [...new Set(errors)];
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const htmlPath = firstOptionValue(args, "--html");
  const input = firstOptionValue(args, "--input");
  if (!htmlPath || !input) {
    console.error(
      "사용법: validate-report-html.ts --html <index.html> --input <recommendation.json>",
    );
    process.exit(2);
  }
  const errors = validateReportHtml(
    readFileSync(resolve(htmlPath), "utf8"),
    JSON.parse(readFileSync(resolve(input), "utf8")),
  );
  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }
  console.log("포지션 추천 HTML의 공개 계약이 맞습니다.");
}
