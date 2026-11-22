import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contextDocumentPath, contextVersion, readContextDocument } from "./context.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workspaceWith(key: "position-preferences", body: string | undefined): string {
  const root = mkdtempSync(join(tmpdir(), "career-context-test-"));
  roots.push(root);
  if (body !== undefined) {
    mkdirSync(join(root, "context"), { recursive: true });
    writeFileSync(contextDocumentPath(root, key), body);
  }
  return root;
}

describe("맥락 문서의 기준 버전", () => {
  test("줄바꿈 종류와 줄끝 공백, 앞뒤 빈 줄만 다르면 같은 버전이다", () => {
    const base = contextVersion("position-preferences", "# 역할 선호\n\n- 백엔드\n- AI 서비스");
    expect(contextVersion("position-preferences", "\n\n# 역할 선호  \r\n\r\n- 백엔드\t\r\n- AI 서비스\n\n")).toBe(base);
    expect(base).toMatch(/^position-preferences:sha256:[0-9a-f]{64}$/);
  });

  test("본문이 바뀌면 버전이 바뀌고, 문서 키가 다르면 같은 본문도 다른 버전이다", () => {
    const base = contextVersion("position-preferences", "- 백엔드");
    expect(contextVersion("position-preferences", "- 백엔드와 AI")).not.toBe(base);
    expect(contextVersion("learning-interests", "- 백엔드")).not.toBe(base);
  });

  test("파일을 읽어 정규화한 본문과 버전을 돌려준다", () => {
    const root = workspaceWith("position-preferences", "- 백엔드  \r\n");
    expect(readContextDocument(root, "position-preferences")).toEqual({
      key: "position-preferences",
      body: "- 백엔드",
      version: contextVersion("position-preferences", "- 백엔드"),
    });
  });

  test("문서가 없거나 비었으면 CANDIDATE_CONTEXT_MISSING 으로 멈춘다", () => {
    for (const body of [undefined, "  \n\n"]) {
      const root = workspaceWith("position-preferences", body);
      expect(() => readContextDocument(root, "position-preferences")).toThrow(
        expect.objectContaining({ code: "CANDIDATE_CONTEXT_MISSING", status: 409 }),
      );
    }
  });
});
