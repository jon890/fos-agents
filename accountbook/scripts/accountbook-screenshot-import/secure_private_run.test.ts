import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { securePrivateRun } from "./secure_private_run.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("securePrivateRun", () => {
  test("private 전체 디렉터리는 0700, 파일은 0600으로 강제한다", () => {
    const base = mkdtempSync(join(tmpdir(), "accountbook-private-test-"));
    tempDirs.push(base);
    const root = join(base, "private");
    const runDir = join(root, "imports", "toss-aaaaaaaaaaaaaaaa");
    mkdirSync(runDir, { recursive: true, mode: 0o755 });
    const json = join(runDir, "extracted.json");
    writeFileSync(json, "{}\n", { mode: 0o644 });
    const sibling = join(root, "runtime", "nested");
    mkdirSync(sibling, { recursive: true, mode: 0o755 });
    const image = join(sibling, "source.png");
    writeFileSync(image, "private", { mode: 0o644 });

    securePrivateRun(root, "toss-aaaaaaaaaaaaaaaa");

    expect(statSync(root).mode & 0o777).toBe(0o700);
    expect(statSync(join(root, "imports")).mode & 0o777).toBe(0o700);
    expect(statSync(runDir).mode & 0o777).toBe(0o700);
    expect(statSync(json).mode & 0o777).toBe(0o600);
    expect(statSync(join(root, "runtime")).mode & 0o777).toBe(0o700);
    expect(statSync(sibling).mode & 0o777).toBe(0o700);
    expect(statSync(image).mode & 0o777).toBe(0o600);
  });

  test("허용된 batch ID가 아니면 경로를 만들지 않는다", () => {
    const base = mkdtempSync(join(tmpdir(), "accountbook-private-test-"));
    tempDirs.push(base);
    expect(() => securePrivateRun(join(base, "private"), "../outside"))
      .toThrow("INVALID_BATCH_ID");
  });
});
