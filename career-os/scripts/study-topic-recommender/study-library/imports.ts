import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { readingCareerValueSchema, readingCategorySchema } from "../reading_contracts.js";
import type { StudyLibraryClient } from "./client.js";
import {
  studyLibraryImportPayloadSchema,
  studyLibraryImportReportSchema,
  type StudyLibraryImportDryRunResult,
  type StudyLibraryImportItem,
  type StudyLibraryImportPayload,
  type StudyLibraryImportReport,
  type StudyLibraryImportTopic,
} from "./contracts.js";

export interface ImportConversionError {
  path: string;
  message: string;
}

export interface ImportPreviewResult {
  payload: StudyLibraryImportPayload;
  preview: StudyLibraryImportDryRunResult;
  errors: ImportConversionError[];
}

const legacyString = z.string().trim().min(1);
const legacyHttpsUrl = z.string().trim().url().refine((value) => value.startsWith("https://"), {
  message: "HTTPS URL이어야 한다.",
});
const legacyTopicKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const legacyHistorySchema = z.object({
  schemaVersion: z.literal(1),
  reports: z.array(z.object({
    reportId: legacyString,
    recommendedAt: z.iso.datetime(),
  })),
  entries: z.array(z.object({
    contentKey: legacyString.optional(),
    canonicalUrl: legacyHttpsUrl.optional(),
    sourceKey: legacyString.optional(),
    category: readingCategorySchema.optional(),
    title: legacyString.optional(),
    studyTopic: legacyString.optional(),
    studyTopicKey: legacyTopicKey.optional(),
    careerQuestion: z.string().trim().min(1).max(300).optional().nullable(),
    careerValue: readingCareerValueSchema.optional().nullable(),
    recommendedAt: z.iso.datetime().optional(),
    reportId: legacyString,
  }).passthrough()),
}).passthrough();

const pageReportWithProvenanceSchema = studyLibraryImportReportSchema.extend({
  provenance: z.object({
    sourcePageUrl: legacyHttpsUrl,
    localHtmlPath: z.string().trim().min(1).optional(),
  }),
});

const pagesManifestSchema = z.object({
  schemaVersion: z.literal(1),
  reports: z.array(pageReportWithProvenanceSchema),
}).passthrough();

function readJsonFile(path: string): { value?: unknown; error?: ImportConversionError } {
  try {
    return { value: JSON.parse(readFileSync(path, "utf8")) as unknown };
  } catch (error) {
    return {
      error: {
        path,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => {
    return `${JSON.stringify(key)}:${canonicalJson(record[key])}`;
  }).join(",")}}`;
}

export function importKeyForReports(reports: StudyLibraryImportReport[]): string {
  return `import:${createHash("sha256").update(canonicalJson(reports), "utf8").digest("hex")}`;
}

function groupedHistoryTopics(input: {
  entries: z.infer<typeof legacyHistorySchema>["entries"];
  errors: ImportConversionError[];
}): StudyLibraryImportTopic[] {
  const topics = new Map<string, StudyLibraryImportTopic>();
  input.entries.forEach((entry, index) => {
    const path = `history.entries[${index}]`;
    const missing = ["contentKey", "canonicalUrl", "sourceKey", "category", "title", "studyTopic", "studyTopicKey"]
      .filter((key) => entry[key as keyof typeof entry] == null);
    for (const key of missing) {
      input.errors.push({ path: `${path}.${key}`, message: `${key} 값이 필요하다.` });
    }
    if (missing.length > 0) return;

    const topicKey = entry.studyTopicKey as string;
    const topicTitle = entry.studyTopic as string;
    let topic = topics.get(topicKey);
    if (!topic) {
      topic = {
        topicKey,
        title: topicTitle,
        careerQuestion: entry.careerQuestion ?? null,
        items: [],
      };
      topics.set(topicKey, topic);
    }
    const item: StudyLibraryImportItem = {
      contentKey: entry.contentKey as string,
      canonicalUrl: entry.canonicalUrl as string,
      sourceKey: entry.sourceKey as string,
      title: entry.title as string,
      category: entry.category as StudyLibraryImportItem["category"],
      summary: null,
      reason: null,
      careerValue: entry.careerValue ?? null,
    };
    topic.items.push(item);
  });
  return [...topics.values()];
}

export function reportsFromLegacyHistory(path: string): {
  reports: StudyLibraryImportReport[];
  errors: ImportConversionError[];
} {
  const raw = readJsonFile(path);
  if (raw.error) return { reports: [], errors: [{ ...raw.error, path: "history" }] };
  const parsed = legacyHistorySchema.safeParse(raw.value);
  if (!parsed.success) {
    return {
      reports: [],
      errors: parsed.error.issues.map((issue) => ({
        path: `history.${issue.path.join(".")}`,
        message: issue.message,
      })),
    };
  }
  const errors: ImportConversionError[] = [];
  const reportIds = new Set(parsed.data.reports.map((report) => report.reportId));
  parsed.data.entries.forEach((entry, index) => {
    if (!reportIds.has(entry.reportId)) {
      errors.push({
        path: `history.entries[${index}].reportId`,
        message: `reports에 없는 reportId: ${entry.reportId}`,
      });
    }
  });
  const reports = parsed.data.reports.map((report) => ({
    reportId: report.reportId,
    generatedAt: report.recommendedAt,
    topics: groupedHistoryTopics({
      entries: parsed.data.entries.filter((entry) => entry.reportId === report.reportId),
      errors,
    }),
  }));
  return { reports, errors };
}

export function reportsFromPagesManifest(path: string): {
  reports: StudyLibraryImportReport[];
  errors: ImportConversionError[];
} {
  const raw = readJsonFile(path);
  if (raw.error) return { reports: [], errors: [{ ...raw.error, path: "pages" }] };
  const parsed = pagesManifestSchema.safeParse(raw.value);
  if (!parsed.success) {
    return {
      reports: [],
      errors: parsed.error.issues.map((issue) => ({
        path: `pages.${issue.path.join(".")}`,
        message: issue.message,
      })),
    };
  }
  return {
    reports: parsed.data.reports.map(({ provenance: _provenance, ...report }) => report),
    errors: [],
  };
}

export function buildImportPayload(input: {
  historyFile: string;
  pagesManifest: string;
}): { payload?: StudyLibraryImportPayload; errors: ImportConversionError[] } {
  const history = reportsFromLegacyHistory(input.historyFile);
  const pages = reportsFromPagesManifest(input.pagesManifest);
  const reports = [...history.reports, ...pages.reports];
  const errors = [...history.errors, ...pages.errors];
  if (errors.length > 0) return { errors };
  const payload = {
    importKey: importKeyForReports(reports),
    reports,
  };
  const parsed = studyLibraryImportPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((issue) => ({
        path: `payload.${issue.path.join(".")}`,
        message: issue.message,
      })),
    };
  }
  return { payload: parsed.data, errors: [] };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function createImportPreview(input: {
  client: StudyLibraryClient;
  historyFile: string;
  pagesManifest: string;
  output: string;
}): Promise<ImportPreviewResult> {
  const result = buildImportPayload({
    historyFile: input.historyFile,
    pagesManifest: input.pagesManifest,
  });
  const errorsPath = `${input.output}.errors.json`;
  if (result.errors.length > 0 || !result.payload) {
    writeJson(errorsPath, { errors: result.errors });
    return {
      payload: { importKey: "import:invalid", reports: [] },
      preview: { previewHash: "", historyVersion: 0, counts: {}, warnings: [] },
      errors: result.errors,
    };
  }
  if (existsSync(errorsPath)) writeJson(errorsPath, { errors: [] });
  const preview = await input.client.createImportDryRun(result.payload);
  writeJson(input.output, result.payload);
  writeJson(`${input.output}.preview.json`, preview);
  return {
    payload: result.payload,
    preview,
    errors: [],
  };
}
