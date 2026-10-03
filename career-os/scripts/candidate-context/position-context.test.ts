import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import type { CandidateContextDocument } from "./contracts.ts";
import { prepareCandidateContext } from "./position-context.ts";

const directories: string[] = [];
const repositoryRoot = dirname(dirname(dirname(import.meta.dir)));

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function tempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "position-context."));
  directories.push(directory);
  return directory;
}

/** 성공하면 테스트를 실패시키고, 거절되면 그 오류를 돌려준다. */
async function rejection(promise: Promise<unknown>): Promise<Error> {
  const outcome = await promise.then((value) => ({ value }), (error: unknown) => ({ error }));
  if (!("error" in outcome)) throw new Error(`거절되어야 하는데 성공했다: ${JSON.stringify(outcome.value)}`);
  expect(outcome.error).toBeInstanceOf(Error);
  return outcome.error as Error;
}

function fakeContext(documents: Partial<Record<string, { version: number; body: string }>>) {
  const requested: string[] = [];
  return {
    requested,
    async getDocument(key: string): Promise<CandidateContextDocument> {
      requested.push(key);
      const found = documents[key];
      if (!found) throw new CareerBackendHttpError(404, "NOT_FOUND", "커리어 Backend 요청이 실패했습니다.");
      return { documentKey: key as CandidateContextDocument["documentKey"], version: found.version, body: found.body, note: "메모", updatedAt: "2026-09-01T00:00:00.000Z" };
    },
  };
}

describe("prepareCandidateContext", () => {
  const documents = {
    "position-preferences": { version: 4, body: "예시 선호 문장" },
    "application-state": { version: 2, body: "예시 지원 상태 문장" },
  };

  test("두 문서가 있으면 두 문서와 기준 버전을 candidate-context.json 에 쓴다", async () => {
    const path = join(tempDir(), "candidate-context.json");

    const result = await prepareCandidateContext({ candidateContext: path }, {
      context: fakeContext(documents),
    });

    expect(result).toEqual({ candidateContextVersion: "position-preferences:v4" });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      candidateContextVersion: "position-preferences:v4",
      documents: {
        "position-preferences": { version: 4, body: "예시 선호 문장" },
        "application-state": { version: 2, body: "예시 지원 상태 문장" },
      },
    });
  });

  test("문서가 없으면 빠진 키를 모두 알리고 파일을 쓰지 않는다", async () => {
    const path = join(tempDir(), "candidate-context.json");

    const error = await rejection(prepareCandidateContext({ candidateContext: path }, {
      context: fakeContext({}),
    }));

    expect(error.message).toContain("position-preferences, application-state");
    expect(error.message).toContain("--expected-version 0");
    expect(existsSync(path)).toBe(false);
  });

  test("저장소 안 경로는 조회 전에 거절한다", async () => {
    const path = join(repositoryRoot, "career-os", "tmp-candidate-context.json");
    const context = fakeContext(documents);

    await expect(prepareCandidateContext({ candidateContext: path }, {
      context,
    })).rejects.toThrow("candidate-context.json 은 저장소 밖");
    expect(context.requested).toEqual([]);
    expect(existsSync(path)).toBe(false);
  });
});
