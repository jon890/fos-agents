import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBundle, buildLocalBundle } from "./build.ts";

test("커밋한 실행 파일이 원본 빌드와 일치한다", async () => {
  const out = mkdtempSync(join(tmpdir(), "career-bundle-"));
  try {
    await buildBundle(out);
    expect(readFileSync(join(out, "career-mcp.js"), "utf8")).toBe(
      readFileSync(join(import.meta.dir, "../dist/career-mcp.js"), "utf8"),
    );
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("커밋한 로컬 실행기 번들이 원본 빌드와 일치한다", async () => {
  const out = mkdtempSync(join(tmpdir(), "career-local-bundle-"));
  try {
    await buildLocalBundle(out);
    expect(readFileSync(join(out, "career-local.js"), "utf8")).toBe(
      readFileSync(join(import.meta.dir, "../dist/career-local.js"), "utf8"),
    );
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
