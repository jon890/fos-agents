import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PossibleDuplicate } from "../duplicate_detection.js";
import { buildUpdateExisting } from "../transform/recommend.js";
import type { BackendItem, Recommendation, UpdateExistingItem } from "../transform/types.js";
import { buildMorningHtml, morningHtmlFilename } from "./html.js";
import { buildMorningMarkdown } from "./markdown.js";

interface RenderableInventory {
  generatedAt?: string;
  recommendations?: BackendItem[];
  techBlogRecommendations?: Recommendation[];
  aiRecommendations?: Recommendation[];
  geekRecommendations?: Recommendation[];
  claudeDuplicateReview?: { status: string; items?: UpdateExistingItem[] };
  excluded?: { possibleDuplicates?: PossibleDuplicate[] };
  counts?: {
    remainingCuratedStudyTopics?: number;
    remainingLiveCodingSeeds?: number;
    remainingLiveCodingCandidateSeeds?: number;
    techBlogSources?: number;
    aiSources?: number;
    geekSources?: number;
    duplicateCandidates?: number;
  };
  sourceOfTruth?: { scannedMarkdownCount?: number };
  reportPlan?: { targetMinutes?: number };
}

export function renderExistingInventory(input: {
  stateDir: string;
  reportsDir: string;
  downloadsDir: string;
}): { inventoryPath: string; markdownPath: string; htmlPath: string; reviewStatus: string; updateExistingCount: number } {
  mkdirSync(input.reportsDir, { recursive: true });
  mkdirSync(input.downloadsDir, { recursive: true });
  const inventoryPath = join(input.stateDir, "topic-inventory.json");
  if (!existsSync(inventoryPath)) {
    throw new Error("topic-inventory.json이 없다. 먼저 일반 refresh를 실행해야 한다.");
  }

  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8")) as RenderableInventory;
  const review = inventory.claudeDuplicateReview ?? { status: "skipped", items: [] };
  const updateExisting = buildUpdateExisting(
    review,
    inventory.excluded?.possibleDuplicates ?? []
  );
  const markdownPath = join(input.reportsDir, "morning-topic-recommendation.md");
  writeFileSync(markdownPath, buildMorningMarkdown(
    inventory.recommendations ?? [],
    inventory.techBlogRecommendations ?? [],
    inventory.aiRecommendations ?? [],
    inventory.geekRecommendations ?? [],
    updateExisting,
    review.status,
    {
      uncoveredCurated: inventory.counts?.remainingCuratedStudyTopics ?? 0,
      remainingLive: inventory.counts?.remainingLiveCodingSeeds ?? 0,
      remainingLiveCandidates: inventory.counts?.remainingLiveCodingCandidateSeeds ?? 0,
      techBlogItems: inventory.counts?.techBlogSources ?? 0,
      aiTopicItems: inventory.counts?.aiSources ?? 0,
      geekNewsItems: inventory.counts?.geekSources ?? 0,
      scannedMarkdownCount: inventory.sourceOfTruth?.scannedMarkdownCount ?? 0,
      possibleDuplicates: inventory.counts?.duplicateCandidates ?? 0,
    }
  ), "utf8");

  const htmlPath = join(input.downloadsDir, morningHtmlFilename(inventory.generatedAt));
  writeFileSync(htmlPath, buildMorningHtml({
    generatedAt: inventory.generatedAt,
    recommendations: inventory.recommendations ?? [],
    techBlogRecommendations: inventory.techBlogRecommendations ?? [],
    aiRecommendations: inventory.aiRecommendations ?? [],
    geekRecommendations: inventory.geekRecommendations ?? [],
    targetMinutes: inventory.reportPlan?.targetMinutes,
    reviewStatus: review.status,
    updateExistingCount: updateExisting.length,
  }), "utf8");

  return {
    inventoryPath,
    markdownPath,
    htmlPath,
    reviewStatus: review.status,
    updateExistingCount: updateExisting.length,
  };
}
