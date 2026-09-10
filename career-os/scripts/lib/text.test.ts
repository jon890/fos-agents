import { expect, test } from "bun:test";
import { cleanMarkupText, containsKeyword, normalizeText } from "./text.ts";

test("텍스트 유틸은 공백과 대소문자를 같은 방식으로 처리한다", () => {
  expect(normalizeText("  Java\n  Backend  ")).toBe("Java Backend");
  expect(normalizeText(null)).toBe("");
  expect(containsKeyword("AI Platform Engineer", ["backend", "platform"])).toBe(true);
  expect(containsKeyword("Frontend Engineer", ["backend", "server"])).toBe(false);
});

test("외부 HTML을 평문으로 바꾸고 길이를 제한한다", () => {
  expect(cleanMarkupText("<p>Java&nbsp;&amp; Spring</p>")).toBe("Java & Spring");
  expect(cleanMarkupText("abcdef", 3)).toBe("abc…");
});
