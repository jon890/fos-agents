#!/usr/bin/env bun
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { morningHtmlFilename } from "./render/html.js";

const ROOT = process.env.CAREER_OS_ROOT
  ? resolve(process.env.CAREER_OS_ROOT)
  : resolve(import.meta.dir, "..", "..");
const inventoryPath = resolve(ROOT, "state", "topic-inventory.json");
const markdownPath = resolve(ROOT, "reports", "morning-topic-recommendation.md");
const requiredKeys = [
  "generatedAt",
  "recommendations",
  "techBlogRecommendations",
  "aiRecommendations",
  "geekRecommendations",
];
const forbiddenHtmlPatterns = [
  /\/Users\//,
  /\/home\//,
  /\/opt\/data\//,
  /file:\/\//i,
  /http:\/\//i,
  /javascript:/i,
];

function requireFile(path: string): void {
  if (!existsSync(path) || statSync(path).size === 0) throw new Error(`산출물이 없거나 비어 있다: ${path}`);
}

function main(): void {
  requireFile(inventoryPath);
  requireFile(markdownPath);
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as Record<string, unknown>;
  const missing = requiredKeys.filter((key) => !(key in inventory));
  if (missing.length > 0) throw new Error(`topic-inventory.json 누락 키: ${missing.join(", ")}`);

  const markdownLines = readFileSync(markdownPath, "utf8").split(/\r?\n/).length;
  if (markdownLines < 10) throw new Error(`마크다운이 너무 짧다: ${markdownLines}줄`);

  const htmlPath = resolve(
    ROOT,
    "reports",
    "downloads",
    morningHtmlFilename(String(inventory.generatedAt ?? ""))
  );
  requireFile(htmlPath);
  const html = readFileSync(htmlPath, "utf8");
  if (!html.includes("<title>") || !html.includes("오늘 아침 읽을거리")) {
    throw new Error("HTML 제목이나 주요 본문이 없다.");
  }
  for (const pattern of forbiddenHtmlPatterns) {
    if (pattern.test(html)) throw new Error(`HTML 공개 경계 위반: ${pattern}`);
  }

  console.log(JSON.stringify({
    status: "ok",
    inventory: inventoryPath,
    markdown: markdownPath,
    html: htmlPath,
    markdownLines,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
