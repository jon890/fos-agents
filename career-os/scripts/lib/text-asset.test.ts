import { describe, expect, test } from "bun:test";
import { textAsset } from "./text-asset.ts";

describe("textAsset", () => {
  test("문자열은 그대로 돌려준다", () => {
    expect(textAsset("<p>본문</p>", "report.html")).toBe("<p>본문</p>");
  });

  test("빈 문자열도 문자열이라 그대로 돌려준다", () => {
    expect(textAsset("", "empty.css")).toBe("");
  });

  test("문자열이 아닌 값은 이름을 담은 오류를 던진다", () => {
    expect(() => textAsset({}, "report.html")).toThrow("텍스트 자산이 문자열이 아니다: report.html");
  });
});
