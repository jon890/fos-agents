import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectPng } from "./inspect_source.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

function tempFile(name: string, data: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), "accountbook-inspect-test-"));
  tempDirs.push(dir);
  const path = join(dir, name);
  writeFileSync(path, data);
  return path;
}

describe("inspectPng", () => {
  test("PNG header에서 크기와 해시를 읽는다", () => {
    const png = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png, 0);
    png.writeUInt32BE(1179, 16);
    png.writeUInt32BE(2556, 20);

    const result = inspectPng(tempFile("sample.png", png));

    expect(result.fileName).toBe("sample.png");
    expect(result.width).toBe(1179);
    expect(result.height).toBe(2556);
    expect(result.sha256).toHaveLength(64);
  });

  test("PNG가 아닌 파일을 거절한다", () => {
    expect(() => inspectPng(tempFile("sample.txt", Buffer.from("not an image"))))
      .toThrow("SOURCE_FORMAT_UNSUPPORTED:PNG_REQUIRED");
  });
});
