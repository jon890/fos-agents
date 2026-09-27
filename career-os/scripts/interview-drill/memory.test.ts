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

test("brain 공급자는 파일을 읽지 않고 계약 필드를 낸다", () => {
  const result = loadCandidateMemory({ CAREER_MEMORY: "brain" }, () => {
    throw new Error("파일을 읽으면 안 됩니다.");
  });
  expect(result.provider).toBe("brain");
  if (result.provider === "brain")
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

test("필수 칸이 빠진 파일은 칸 이름을 담아 실패한다", () => {
  const invalid = { ...valid, currentRole: { ...valid.currentRole } };
  delete invalid.currentRole.title;
  expect(() => loadCandidateMemory({ CAREER_MEMORY: "file", CAREER_MEMORY_FILE: "memory.json" }, () => JSON.stringify(invalid))).toThrow("currentRole.title");
});

test("최상위의 알 수 없는 칸 이름을 오류에 담는다", () => {
  const invalid = { ...valid, unexpected: true };
  expect(() => loadCandidateMemory({ CAREER_MEMORY: "file", CAREER_MEMORY_FILE: "memory.json" }, () => JSON.stringify(invalid))).toThrow("unexpected");
});

test("중첩 객체의 알 수 없는 칸 이름을 오류에 담는다", () => {
  const invalid = { ...valid, currentRole: { ...valid.currentRole, level: "senior" } };
  expect(() => loadCandidateMemory({ CAREER_MEMORY: "file", CAREER_MEMORY_FILE: "memory.json" }, () => JSON.stringify(invalid))).toThrow("currentRole.level");
});

test("상위 경로를 포함한 지원 디렉터리를 거절한다", () => {
  const invalid = { ...valid, targets: [{ company: "테스트", role: "Backend", applicationDir: "../outside" }] };
  expect(() => loadCandidateMemory({ CAREER_MEMORY: "file", CAREER_MEMORY_FILE: "memory.json" }, () => JSON.stringify(invalid))).toThrow("applicationDir");
});

test("공급자가 없으면 doctor 안내로 실패한다", () => {
  expect(() => loadCandidateMemory({}, () => JSON.stringify(valid))).toThrow("doctor");
});
