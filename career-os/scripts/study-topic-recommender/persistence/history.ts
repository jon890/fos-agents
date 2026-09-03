import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import {
  morningReadingReportSchema,
  morningStudyHistorySchema,
  type MorningReadingReport,
  type MorningStudyHistory,
} from "../reading_contracts.js";

export const EMPTY_MORNING_STUDY_HISTORY: MorningStudyHistory = {
  schemaVersion: 1,
  reports: [],
  entries: [],
};

export function resolveMorningStudyHistoryPath(value: string | undefined): string {
  if (!value) throw new Error("--history-file이 필요하다.");
  const path = resolve(value);
  if (basename(path) !== "morning-study-history.json" || basename(dirname(path)) !== "state") {
    throw new Error("이력 파일은 state/morning-study-history.json이어야 한다.");
  }
  return path;
}

export function loadMorningStudyHistory(path: string): MorningStudyHistory {
  if (!existsSync(path)) return structuredClone(EMPTY_MORNING_STUDY_HISTORY);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`아침 공부 추천 이력을 읽을 수 없다: ${error instanceof Error ? error.message : String(error)}`);
  }
  const parsed = morningStudyHistorySchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`아침 공부 추천 이력 검증 실패:\n- ${issues.join("\n- ")}`);
  }
  return parsed.data;
}

export function historyContentKeys(history: MorningStudyHistory): Set<string> {
  return new Set(history.entries.map((entry) => entry.contentKey));
}

export function recentStudyTopicKeys(history: MorningStudyHistory): Set<string> {
  const latestReportId = history.reports.at(-1)?.reportId;
  if (!latestReportId) return new Set();
  return new Set(
    history.entries
      .filter((entry) => entry.reportId === latestReportId)
      .map((entry) => entry.studyTopicKey)
  );
}

function reportId(report: MorningReadingReport): string {
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(report.generatedAt));
  return `morning-${date}`;
}

export function appendReportToHistory(path: string, rawReport: unknown): MorningStudyHistory {
  const report = morningReadingReportSchema.parse(rawReport);
  const history = loadMorningStudyHistory(path);
  const id = reportId(report);
  if (history.reports.some((entry) => entry.reportId === id)) {
    throw new Error(`이미 이력에 반영한 reportId: ${id}`);
  }

  const existingKeys = historyContentKeys(history);
  const recentTopicKeys = recentStudyTopicKeys(history);
  for (const topic of report.topics) {
    if (recentTopicKeys.has(topic.topicKey)) {
      throw new Error(`직전 리포트에서 추천한 topicKey: ${topic.topicKey}`);
    }
  }
  const entries = report.topics.flatMap((topic) => topic.items.map((item) => {
    if (existingKeys.has(item.contentKey)) {
      throw new Error(`이미 추천한 contentKey: ${item.contentKey}`);
    }
    existingKeys.add(item.contentKey);
    return {
      contentKey: item.contentKey,
      canonicalUrl: item.canonicalUrl,
      sourceKey: item.sourceKey,
      category: item.category,
      title: item.title,
      studyTopic: topic.title,
      studyTopicKey: topic.topicKey,
      careerValue: item.careerValue,
      recommendedAt: report.generatedAt,
      reportId: id,
    };
  }));
  const next: MorningStudyHistory = {
    schemaVersion: 1,
    reports: [...history.reports, { reportId: id, recommendedAt: report.generatedAt }],
    entries: [...history.entries, ...entries],
  };
  morningStudyHistorySchema.parse(next);

  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, path);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
  return next;
}

export function loadReportForHistory(path: string): MorningReadingReport {
  return morningReadingReportSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
}
