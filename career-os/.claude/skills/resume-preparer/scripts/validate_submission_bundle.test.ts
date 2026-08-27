import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactTextSha256 } from "./artifact_identity.ts";
import { fileSha256 } from "./submission_manifest.ts";
import { validateSubmissionBundle } from "./validate_submission_bundle.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "submission-bundle-"));
  directories.push(directory);
  writeFileSync(join(directory, "application-package.md"), "# 지원\n\n- readiness: revise\n- evidence: safe\n- human-confirmation: complete\n");
  writeFileSync(join(directory, "resume.html"), "<main>검증된 이력서</main>");
  writeFileSync(join(directory, "resume.pdf"), "pdf");
  const hash = artifactTextSha256(join(directory, "resume.html"));
  writeFileSync(join(directory, "claim-ledger.json"), JSON.stringify({
    schemaVersion: 2,
    artifact: "resume.html",
    artifactTextSha256: hash,
    generatedAt: "2026-08-26T00:00:00.000Z",
    claims: [{
      id: "claim-1",
      text: "검증된 이력서",
      location: "프로필",
      type: "implementation",
      implementation: { status: "artifact_verified", evidence: [{ kind: "artifact", path: join(directory, "resume.html"), supports: "제출 문구" }] },
      ownership: { status: "not_claimed", evidence: [] },
      outcome: { status: "not_claimed", evidence: [] },
      verdict: "safe",
      proposedText: "검증된 이력서",
    }],
  }));
  writeFileSync(
    join(directory, "resume-scorecard.md"),
    `# 평가\n\n- artifact: \`resume.html\`\n- artifactTextSha256: \`${hash}\`\n- verdict: \`pass\`\n`,
  );
  writeFileSync(join(directory, "submission-manifest.json"), JSON.stringify({
    schemaVersion: 1,
    generatedAt: "2026-08-26T00:00:00.000Z",
    artifacts: [{
      kind: "resume",
      file: "resume.pdf",
      sha256: fileSha256(join(directory, "resume.pdf")),
      sourceHtml: "resume.html",
      sourceTextSha256: hash,
    }],
  }));
  return directory;
}

describe("validateSubmissionBundle", () => {
  test("현재 이력서와 원장·점수표가 같은 버전이면 통과한다", () => {
    expect(validateSubmissionBundle(fixture()).passed).toBe(true);
  });

  test("점수표 이후 제출 문구가 바뀌면 거부한다", () => {
    const directory = fixture();
    writeFileSync(join(directory, "resume.html"), "<main>바뀐 이력서</main>");
    const result = validateSubmissionBundle(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("현재 제출 문구");
  });

  test("경력기술서가 있으면 경력기술서 검증과 통합 PDF를 요구한다", () => {
    const directory = fixture();
    writeFileSync(join(directory, "career-description-draft.md"), "# 경력기술서");
    const result = validateSubmissionBundle(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("submission.pdf");
  });

  test("manifest 이후 PDF가 바뀌면 거부한다", () => {
    const directory = fixture();
    writeFileSync(join(directory, "resume.pdf"), "changed pdf");
    const result = validateSubmissionBundle(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("resume.pdf 해시");
  });

  test("사람 확인이 남으면 제출 묶음을 통과시키지 않는다", () => {
    const directory = fixture();
    writeFileSync(
      join(directory, "application-package.md"),
      "# 지원\n\n- readiness: needs_user_input\n- evidence: safe\n- human-confirmation: needs_input\n",
    );
    const result = validateSubmissionBundle(directory);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("human-confirmation이 complete");
  });
});
