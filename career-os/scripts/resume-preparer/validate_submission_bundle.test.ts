import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { artifactTextSha256 } from "./artifact_identity.ts";
import { fileSha256 } from "./submission_manifest.ts";
import { validateSubmissionBundle } from "./validate_submission_bundle.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function write(directory: string, relativePath: string, content: string): void {
  const path = join(directory, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "submission-bundle-"));
  directories.push(directory);
  write(directory, "evidence/status.md", "# 지원\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n");
  write(directory, "review/resume.html", "<main>검증된 이력서</main>");
  write(directory, "resume.pdf", "pdf");
  const hash = artifactTextSha256(join(directory, "review", "resume.html"));
  write(directory, "review/claim-ledger.json", JSON.stringify({
    schemaVersion: 2,
    artifact: "resume.html",
    artifactTextSha256: hash,
    generatedAt: "2026-08-26T00:00:00.000Z",
    claims: [{
      id: "claim-1",
      text: "검증된 이력서",
      location: "프로필",
      type: "implementation",
      implementation: { status: "artifact_verified", evidence: [{ kind: "artifact", path: join(directory, "review", "resume.html"), supports: "제출 문구" }] },
      ownership: { status: "not_claimed", evidence: [] },
      outcome: { status: "not_claimed", evidence: [] },
      verdict: "safe",
      proposedText: "검증된 이력서",
    }],
  }));
  write(
    directory,
    "review/resume-scorecard.md",
    `# 평가\n\n- artifact: \`resume.html\`\n- artifactTextSha256: \`${hash}\`\n- verdict: \`pass\`\n`,
  );
  write(directory, "review/submission-manifest.json", JSON.stringify({
    schemaVersion: 1,
    generatedAt: "2026-08-26T00:00:00.000Z",
    artifacts: [{
      kind: "resume",
      file: "resume.pdf",
      sha256: fileSha256(join(directory, "resume.pdf")),
      sourceHtml: "review/resume.html",
      sourceTextSha256: hash,
    }],
  }));
  return directory;
}

describe("validateSubmissionBundle", () => {
  test.each(["revise", "needs_user_input", "do_not_apply", ""])("준비 상태 %s는 최종 제출 묶음으로 통과하지 않는다", (readiness) => {
    const directory = fixture();
    write(directory, "evidence/status.md", `# 지원\n\n- readiness: ${readiness}\n- evidence: safe\n- human-confirmation: complete\n`);
    const result = validateSubmissionBundle(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("readiness가 ready");
  });

  test("현재 이력서와 원장·점수표가 같은 버전이면 통과한다", () => {
    expect(validateSubmissionBundle(fixture()).passed).toBe(true);
  });

  test("점수표 이후 제출 문구가 바뀌면 거부한다", () => {
    const directory = fixture();
    write(directory, "review/resume.html", "<main>바뀐 이력서</main>");
    const result = validateSubmissionBundle(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("현재 제출 문구");
  });

  test("경력기술서가 있으면 경력기술서 검증과 통합 PDF를 요구한다", () => {
    const directory = fixture();
    write(directory, "evidence/career-description-draft.md", "# 경력기술서");
    const result = validateSubmissionBundle(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("submission.pdf");
  });

  test("manifest 이후 PDF가 바뀌면 거부한다", () => {
    const directory = fixture();
    write(directory, "resume.pdf", "changed pdf");
    const result = validateSubmissionBundle(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("resume.pdf 해시");
  });

  test("review 파일이 최상위에 있으면 제출 묶음 파일을 찾지 못해 거부한다", () => {
    const directory = fixture();
    renameSync(join(directory, "review", "resume.html"), join(directory, "resume.html"));
    const result = validateSubmissionBundle(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("제출 묶음 파일이 없습니다: review/resume.html");
  });

  test("사람 확인이 남으면 제출 묶음을 통과시키지 않는다", () => {
    const directory = fixture();
    write(
      directory,
      "evidence/status.md",
      "# 지원\n\n- readiness: needs_user_input\n- evidence: safe\n- human-confirmation: needs_input\n",
    );
    const result = validateSubmissionBundle(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("human-confirmation이 complete");
  });
});
