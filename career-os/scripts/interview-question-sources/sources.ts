import { z } from "zod";
import {
  interviewQuestionSourcesConfigSchema,
  type InterviewQuestionSource,
  type InterviewQuestionSourcesConfig,
} from "./contracts.ts";

function issueMessage(issue: z.core.$ZodIssue): string {
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

export function validateInterviewQuestionSources(raw: unknown): string[] {
  const result = interviewQuestionSourcesConfigSchema.safeParse(raw);
  return result.success ? [] : result.error.issues.map(issueMessage);
}

export function parseInterviewQuestionSources(raw: unknown): InterviewQuestionSourcesConfig {
  const result = interviewQuestionSourcesConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`면접 질문 출처 설정 오류:\n- ${result.error.issues.map(issueMessage).join("\n- ")}`);
  }
  return result.data;
}

export function activeInterviewQuestionSources(raw: unknown): InterviewQuestionSource[] {
  return parseInterviewQuestionSources(raw).sources.filter((source) => source.enabled !== false);
}

