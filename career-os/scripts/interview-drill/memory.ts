import { join, relative, resolve } from "node:path";
import { z } from "zod";
import { INTERVIEW_BARS } from "./follow-up-policy.ts";

const applicationDirectorySchema = z.string().min(1).refine(
  (value) => !value.startsWith("/") && !value.split(/[\\/]+/).includes(".."),
  "targets[].applicationDir은 career-os 기준 상대 경로여야 합니다.",
);

export const candidateMemorySchema = z
  .object({
    schemaVersion: z.literal(1),
    currentRole: z
      .object({
        title: z.string().min(1),
        yearsOfExperience: z.number().min(0),
        bar: z.enum(INTERVIEW_BARS),
      })
      .strict(),
    experience: z
      .object({
        direct: z.array(z.string()),
        adjacent: z.array(z.string()),
        studyOnly: z.array(z.string()),
      })
      .strict(),
    targets: z.array(
      z
        .object({
          company: z.string().min(1),
          role: z.string().min(1),
          applicationDir: applicationDirectorySchema,
        })
        .strict(),
    ),
  })
  .strict();

export type CandidateMemory = z.infer<typeof candidateMemorySchema>;
export type CandidateMemoryField = { path: string; description: string };
export const candidateMemoryDocumentKeys = ["career-status", "application-state"] as const;
export type CandidateMemoryDocumentKey = (typeof candidateMemoryDocumentKeys)[number];
export type CandidateMemoryDocument = {
  documentKey: CandidateMemoryDocumentKey;
  version: number;
  body: string;
};
/** 문서가 없는 키는 `undefined` 로 돌려준다. */
export type ReadCandidateMemoryDocuments = (
  keys: readonly CandidateMemoryDocumentKey[],
) => Promise<Partial<Record<CandidateMemoryDocumentKey, CandidateMemoryDocument | undefined>>>;
export type CandidateMemoryResult =
  | { provider: "file"; path: string; memory: CandidateMemory }
  | {
      provider: "backend";
      fields: CandidateMemoryField[];
      instruction: string;
      documents: CandidateMemoryDocument[];
    };

const fields: CandidateMemoryField[] = [
  { path: "schemaVersion", description: "고정값 1" },
  { path: "currentRole.title", description: "현재 역할" },
  { path: "currentRole.yearsOfExperience", description: "현재 역할의 경력 연차" },
  { path: "currentRole.bar", description: "현재 책임지는 문제 규모" },
  { path: "experience.direct", description: "직접 설계하거나 운영한 기술과 영역" },
  { path: "experience.adjacent", description: "옆에서 함께 다룬 기술과 영역" },
  { path: "experience.studyOnly", description: "학습만 한 기술과 영역" },
  { path: "targets", description: "현재 지원 대상이며 없으면 빈 배열" },
  { path: "targets[].company", description: "지원 대상 회사" },
  { path: "targets[].role", description: "지원 대상 역할" },
  { path: "targets[].applicationDir", description: "career-os 기준 지원 디렉터리" },
];

function careerOsRoot(): string {
  return join(import.meta.dir, "..", "..");
}

function defaultPath(): string {
  return join(careerOsRoot(), "library", "candidate-memory.json");
}

function validateApplicationDirectories(memory: CandidateMemory): CandidateMemory {
  const root = resolve(careerOsRoot());
  for (const target of memory.targets) {
    const resolved = resolve(root, target.applicationDir);
    if (relative(root, resolved).startsWith(".."))
      throw new Error("targets[].applicationDir은 career-os 기준 상대 경로여야 합니다.");
  }
  return memory;
}

// 본문은 모델이 읽는다. 스크립트는 개인 맥락을 해석하지 않는다(ADR-130).
async function loadBackendMemory(
  readDocuments: ReadCandidateMemoryDocuments,
): Promise<CandidateMemoryResult> {
  let found: Awaited<ReturnType<ReadCandidateMemoryDocuments>>;
  try {
    found = await readDocuments(candidateMemoryDocumentKeys);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `커리어 Backend 에서 후보자 맥락 문서를 읽지 못했다. drill-engine.ts doctor 로 연결값을 점검한다: ${message}`,
    );
  }
  const missing = candidateMemoryDocumentKeys.filter((key) => !found[key]);
  if (missing.length > 0)
    throw new Error(`커리어 Backend 에 후보자 맥락 문서가 없다: ${missing.join(", ")}`);
  return {
    provider: "backend",
    fields,
    instruction: "documents 본문으로 아래 칸을 채운다. 본문에 없는 칸은 비워 두고 사용자에게 묻는다.",
    documents: candidateMemoryDocumentKeys.map((key) => {
      const { documentKey, version, body } = found[key]!;
      return { documentKey, version, body };
    }),
  };
}

function memoryIssues(error: z.ZodError): string {
  return error.issues
    .flatMap((issue) => {
      const path = issue.path.join(".");
      if (issue.code === "unrecognized_keys")
        return issue.keys.map((key) => [path, key].filter(Boolean).join("."));
      return `${path}${path ? ": " : ""}${issue.message}`;
    })
    .join(", ");
}

export async function loadCandidateMemory(
  environment: Record<string, string | undefined>,
  readFile: (path: string) => string,
  readDocuments: ReadCandidateMemoryDocuments,
): Promise<CandidateMemoryResult> {
  const provider = environment.CAREER_MEMORY?.trim();
  if (provider === "backend") return loadBackendMemory(readDocuments);
  if (provider !== "file")
    throw new Error(
      `CAREER_MEMORY 는 backend 나 file 이어야 한다 (현재 값: ${provider || "없음"}). drill-engine.ts doctor 로 설정을 점검한다.`,
    );
  const path = environment.CAREER_MEMORY_FILE?.trim() || defaultPath();
  try {
    const parsed = candidateMemorySchema.safeParse(JSON.parse(readFile(path)));
    if (!parsed.success) throw new Error(memoryIssues(parsed.error));
    return { provider, path, memory: validateApplicationDirectories(parsed.data) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`후보자 맥락 파일을 읽거나 검사하지 못했습니다 (${path}): ${message}`);
  }
}
