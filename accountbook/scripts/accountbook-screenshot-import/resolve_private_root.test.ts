import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolvePrivateRoot } from "./resolve_private_root.ts";
import { securePrivateRun } from "./secure_private_run.ts";

test("선택 변수가 없으면 기존 비공개 루트를 사용한다", () => {
  expect(resolvePrivateRoot({})).toBe(resolve("accountbook/private"));
  expect(resolvePrivateRoot({ ACCOUNTBOOK_PRIVATE_DIR: " " })).toBe(resolve("accountbook/private"));
  expect(resolvePrivateRoot({ ACCOUNTBOOK_PRIVATE_DIR: "${ACCOUNTBOOK_PRIVATE_DIR}" })).toBe(
    resolve("accountbook/private"),
  );
});

test("두 profile은 같은 이미지 식별자도 별도 비공개 경로에 저장한다", () => {
  const root = mkdtempSync(join(tmpdir(), "accountbook-profiles-"));
  try {
    const first = resolvePrivateRoot({ ACCOUNTBOOK_PRIVATE_DIR: join(root, "first/private") });
    const second = resolvePrivateRoot({ ACCOUNTBOOK_PRIVATE_DIR: join(root, "second/private") });
    const batch = "toss-1234567890abcdef";
    const run = securePrivateRun(first, batch);
    expect(existsSync(join(second, "imports", batch))).toBe(false);
    expect(securePrivateRun(second, batch)).not.toBe(run);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
