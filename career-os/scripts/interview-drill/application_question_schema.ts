#!/usr/bin/env bun

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "소문자, 숫자와 하이픈만 사용할 수 있다.");

const question = z.object({
  id: slug,
  drillType: z.enum(["tech", "behavioral"]),
  topic: slug,
  category: slug,
  difficulty: z.enum(["basic", "intermediate", "advanced"]),
  question: z.string().min(20),
  intent: z.string().min(10),
  answerSignals: z.array(z.string().min(1)).min(2),
  followUps: z.array(z.string().min(1)).min(1).optional(),
  positionFitHint: z.string().min(10),
  origin: z.enum(["posting_requirement", "evidence_defense", "experience_gap"]),
  evidenceBoundary: z.string().min(10),
  tags: z.array(z.string().min(1)).optional(),
  sequenceHint: z.enum(["opening", "early", "middle", "late", "closing"]).optional(),
});

export const applicationInterviewQuestionsFile = z.object({
  schemaVersion: z.literal(1),
  company: z.string().min(1),
  role: z.string().min(1),
  sourceDocuments: z.array(z.string().min(1)).min(1),
  questions: z.array(question).min(1),
});

export type ApplicationInterviewQuestion = z.infer<typeof question>;
export type ApplicationInterviewQuestionsFile = z.infer<
  typeof applicationInterviewQuestionsFile
>;

export function applicationQuestionFilePath(inputPath: string): string {
  const absolute = resolve(inputPath);
  if (existsSync(absolute) && statSync(absolute).isDirectory()) {
    return join(absolute, "interview-questions.json");
  }
  return absolute;
}

export function loadApplicationInterviewQuestions(
  inputPath: string,
): ApplicationInterviewQuestionsFile {
  const filePath = applicationQuestionFilePath(inputPath);
  if (!existsSync(filePath)) {
    throw new Error(`포지션별 질문 파일을 찾을 수 없다: ${filePath}`);
  }

  const parsed = applicationInterviewQuestionsFile.safeParse(
    JSON.parse(readFileSync(filePath, "utf8")),
  );
  if (!parsed.success) {
    throw new Error(`interview-questions.json 형식이 올바르지 않다.\n${z.prettifyError(parsed.error)}`);
  }

  const ids = new Set<string>();
  const questionTexts = new Set<string>();
  for (const item of parsed.data.questions) {
    if (ids.has(item.id)) throw new Error(`중복 질문 ID가 있다: ${item.id}`);
    ids.add(item.id);

    const normalized = item.question.replace(/\s+/g, " ").trim();
    if (questionTexts.has(normalized)) throw new Error(`중복 질문 문장이 있다: ${item.id}`);
    questionTexts.add(normalized);
  }

  return parsed.data;
}

if (import.meta.main) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("사용법: application_question_schema.ts <application-directory|interview-questions.json>");
    process.exit(2);
  }

  try {
    const result = loadApplicationInterviewQuestions(inputPath);
    console.log(
      JSON.stringify(
        {
          status: "ok",
          company: result.company,
          role: result.role,
          questions: result.questions.length,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
