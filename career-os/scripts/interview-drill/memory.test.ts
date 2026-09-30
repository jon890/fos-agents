import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { candidateMemorySchema, loadCandidateMemory } from "./memory.ts";

const template = join(
  import.meta.dir,
  "..",
  "..",
  ".claude",
  "skills",
  "interview-practice",
  "templates",
  "candidate-memory.example.json",
);
const valid = JSON.parse(readFileSync(template, "utf8"));

test("후보자 맥락 템플릿은 계약을 통과한다", () => {
  expect(candidateMemorySchema.safeParse(valid).success).toBeTrue();
});

const noDocuments = async () => {
  throw new Error("문서를 읽으면 안 됩니다.");
};
const careerStatus = { documentKey: "career-status" as const, version: 3, body: "# 합성 경력 상태\n\n가상 역할" };
const applicationState = { documentKey: "application-state" as const, version: 1, body: "# 합성 지원 상태\n\n가상 회사" };

test("backend 공급자는 파일을 읽지 않고 두 문서 본문과 계약 필드를 낸다", async () => {
  const requested: string[][] = [];
  const result = await loadCandidateMemory(
    { CAREER_MEMORY: "backend" },
    () => {
      throw new Error("파일을 읽으면 안 됩니다.");
    },
    async (keys) => {
      requested.push([...keys]);
      return { "career-status": careerStatus, "application-state": applicationState };
    },
  );
  expect(requested).toEqual([["career-status", "application-state"]]);
  expect(result.provider).toBe("backend");
  if (result.provider !== "backend") throw new Error(`backend 결과가 아닙니다: ${result.provider}`);
  expect(result.documents).toEqual([careerStatus, applicationState]);
  expect(result.instruction).toBe("documents 본문으로 아래 칸을 채운다. 본문에 없는 칸은 비워 두고 사용자에게 묻는다.");
  expect(result.fields.map((field) => field.path)).toEqual([
    "schemaVersion",
    "currentRole.title",
    "currentRole.yearsOfExperience",
    "currentRole.bar",
    "experience.direct",
    "experience.adjacent",
    "experience.studyOnly",
    "targets",
    "targets[].company",
    "targets[].role",
    "targets[].applicationDir",
  ]);
});

test("backend 문서가 하나라도 없으면 빠진 키를 담아 실패한다", async () => {
  await expect(
    loadCandidateMemory({ CAREER_MEMORY: "backend" }, () => "", async () => ({ "career-status": careerStatus })),
  ).rejects.toThrow("application-state");
});

test("backend 문서가 모두 없으면 두 키를 모두 담아 실패한다", async () => {
  const run = loadCandidateMemory({ CAREER_MEMORY: "backend" }, () => "", async () => ({}));
  await expect(run).rejects.toThrow("career-status, application-state");
});

test("backend 문서를 읽지 못하면 doctor 안내와 원인을 담아 실패한다", async () => {
  const run = loadCandidateMemory({ CAREER_MEMORY: "backend" }, () => "", async () => {
    throw new Error("CAREER_BACKEND_URL 환경값이 필요하다.");
  });
  await expect(run).rejects.toThrow(/doctor.*CAREER_BACKEND_URL 환경값이 필요하다/);
});

test("알 수 없는 공급자 값은 backend 나 file 안내와 그 값을 담아 실패한다", async () => {
  const run = loadCandidateMemory({ CAREER_MEMORY: "unknown-provider" }, () => JSON.stringify(valid), noDocuments);
  await expect(run).rejects.toThrow(/CAREER_MEMORY 는 backend 나 file 이어야 한다.*unknown-provider/);
});

test("필수 칸이 빠진 파일은 칸 이름을 담아 실패한다", async () => {
  const invalid = { ...valid, currentRole: { ...valid.currentRole } };
  delete invalid.currentRole.title;
  await expect(loadCandidateMemory({ CAREER_MEMORY: "file", CAREER_MEMORY_FILE: "memory.json" }, () => JSON.stringify(invalid), noDocuments)).rejects.toThrow("currentRole.title");
});

test("최상위의 알 수 없는 칸 이름을 오류에 담는다", async () => {
  const invalid = { ...valid, unexpected: true };
  await expect(loadCandidateMemory({ CAREER_MEMORY: "file", CAREER_MEMORY_FILE: "memory.json" }, () => JSON.stringify(invalid), noDocuments)).rejects.toThrow("unexpected");
});

test("중첩 객체의 알 수 없는 칸 이름을 오류에 담는다", async () => {
  const invalid = { ...valid, currentRole: { ...valid.currentRole, level: "senior" } };
  await expect(loadCandidateMemory({ CAREER_MEMORY: "file", CAREER_MEMORY_FILE: "memory.json" }, () => JSON.stringify(invalid), noDocuments)).rejects.toThrow("currentRole.level");
});

test("상위 경로를 포함한 지원 디렉터리를 거절한다", async () => {
  const invalid = { ...valid, targets: [{ company: "테스트", role: "Backend", applicationDir: "../outside" }] };
  await expect(loadCandidateMemory({ CAREER_MEMORY: "file", CAREER_MEMORY_FILE: "memory.json" }, () => JSON.stringify(invalid), noDocuments)).rejects.toThrow("applicationDir");
});

test("공급자가 없으면 doctor 안내로 실패한다", async () => {
  await expect(loadCandidateMemory({}, () => JSON.stringify(valid), noDocuments)).rejects.toThrow("doctor");
});
