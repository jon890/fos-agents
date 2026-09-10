import { formatSeoulIsoDate } from "../../lib/date-format.ts";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { morningReadingReportSchema, type MorningReadingReport } from "../reading_contracts.js";
import type { StudyLibraryClient } from "./client.js";

export interface StudyLibraryRecommendationRunPayload {
  reportId: string;
  generatedAt: string;
  topics: Array<{
    topicKey: string;
    title: string;
    careerQuestion: string;
    items: Array<{
      contentKey: string;
      summary: string;
      reason: string;
      careerValue: string;
    }>;
  }>;
}

export interface StudyLibraryPublicationPayload {
  idempotencyKey: string;
  reportId: string;
  channel: string;
  publishedAt: string;
  externalId: string;
  url: string | null;
}

export interface RecordPublicationInput {
  client: StudyLibraryClient;
  reportId: string;
  channel: string;
  externalId: string;
  publishedAt: string;
  url: string | null;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => {
    return `${JSON.stringify(key)}:${canonicalJson(record[key])}`;
  }).join(",")}}`;
}

function assertUtcIso(value: string, label: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new Error(`${label}은 UTC ISO 문자열이어야 한다.`);
  }
}

function assertHttpsUrlOrNull(value: string | null): void {
  if (value === null) return;
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("--url은 HTTPS URL이어야 한다.");
}

export function reportIdForMorningReading(report: MorningReadingReport): string {
  return `morning-${formatSeoulIsoDate(report.generatedAt)}`;
}

export function loadMorningReadingReport(path: string): MorningReadingReport {
  return morningReadingReportSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

export function toRecommendationRunPayload(report: MorningReadingReport): StudyLibraryRecommendationRunPayload {
  return {
    reportId: reportIdForMorningReading(report),
    generatedAt: report.generatedAt,
    topics: report.topics.map((topic) => ({
      topicKey: topic.topicKey,
      title: topic.title,
      careerQuestion: topic.careerQuestion,
      items: topic.items.map((item) => ({
        contentKey: item.contentKey,
        summary: item.summary,
        reason: item.reason,
        careerValue: item.careerValue,
      })),
    })),
  };
}

export async function commitRecommendationRun(input: {
  client: StudyLibraryClient;
  reportPath: string;
}): Promise<{ reportId: string; historyVersion: number }> {
  const payload = toRecommendationRunPayload(loadMorningReadingReport(input.reportPath));
  return await input.client.createRecommendationRun(payload);
}

export function publicationIdempotencyKey(input: {
  reportId: string;
  channel: string;
  publishedAt: string;
  externalId: string;
  url: string | null;
}): string {
  const ordered = {
    reportId: input.reportId,
    channel: input.channel,
    publishedAt: input.publishedAt,
    externalId: input.externalId,
    url: input.url,
  };
  return `publication:${createHash("sha256").update(canonicalJson(ordered), "utf8").digest("hex")}`;
}

export function toPublicationPayload(input: Omit<RecordPublicationInput, "client">): StudyLibraryPublicationPayload {
  assertUtcIso(input.publishedAt, "--published-at");
  assertHttpsUrlOrNull(input.url);
  return {
    idempotencyKey: publicationIdempotencyKey(input),
    reportId: input.reportId,
    channel: input.channel,
    publishedAt: input.publishedAt,
    externalId: input.externalId,
    url: input.url,
  };
}

export async function recordPublication(input: RecordPublicationInput): Promise<{ publicationId: string }> {
  return await input.client.createPublication(toPublicationPayload(input));
}
