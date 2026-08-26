import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSubmissionBundle } from "./build_submission_bundle.ts";
import { SubmissionManifestSchema } from "./submission_manifest.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

describe("buildSubmissionBundle", () => {
  test("이력서 HTML과 PDF의 현재 해시를 manifest에 기록한다", () => {
    const directory = mkdtempSync(join(tmpdir(), "submission-manifest-"));
    directories.push(directory);
    writeFileSync(join(directory, "resume.html"), "<main>이력서</main>");
    writeFileSync(join(directory, "resume.pdf"), "pdf");

    const output = buildSubmissionBundle(directory);
    const manifest = SubmissionManifestSchema.parse(JSON.parse(readFileSync(output, "utf8")));
    expect(manifest.artifacts).toHaveLength(1);
    expect(manifest.artifacts[0]).toMatchObject({ kind: "resume", file: "resume.pdf" });
  });
});
