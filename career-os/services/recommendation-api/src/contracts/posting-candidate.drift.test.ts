import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * 벤더링한 사본이 원본과 어긋나지 않았는지 확인한다.
 * 사본 머리의 안내 주석 두 줄만 빼고 나머지가 바이트 단위로 같아야 한다.
 */
const VENDORED_HEADER_LINE_COUNT = 2;

const originalPath = fileURLToPath(
  new URL("../../../../scripts/position-recommender/live-postings/contracts.ts", import.meta.url),
);
const copyPath = fileURLToPath(new URL("./posting-candidate.ts", import.meta.url));

function readOriginal(): Buffer {
  // 원본이 없으면 대조할 것이 없다. 건너뛰지 않고 실패시킨다.
  return readFileSync(originalPath);
}

function readCopyBody(): Buffer {
  const copy = readFileSync(copyPath);
  let offset = 0;
  for (let line = 0; line < VENDORED_HEADER_LINE_COUNT; line += 1) {
    const newlineIndex = copy.indexOf(0x0a, offset);
    if (newlineIndex === -1) {
      throw new Error(
        `사본 ${copyPath} 의 머리에 안내 주석 ${VENDORED_HEADER_LINE_COUNT} 줄이 없다.`,
      );
    }
    offset = newlineIndex + 1;
  }
  return copy.subarray(offset);
}

describe("posting-candidate 벤더링 대조", () => {
  it("사본 머리에 원본을 가리키는 안내 주석 두 줄이 있다", () => {
    const headerLines = readFileSync(copyPath, "utf8").split("\n").slice(0, VENDORED_HEADER_LINE_COUNT);
    expect(headerLines).toEqual([
      "// 이 파일은 career-os/scripts/position-recommender/live-postings/contracts.ts 의 사본이다.",
      "// 고치지 말고 원본을 고친 뒤 다시 복사한다.",
    ]);
  });

  it("안내 주석을 뺀 사본이 원본과 바이트 단위로 같다", () => {
    const original = readOriginal();
    const copyBody = readCopyBody();
    expect(copyBody.byteLength).toBe(original.byteLength);
    expect(copyBody.equals(original)).toBe(true);
  });
});
