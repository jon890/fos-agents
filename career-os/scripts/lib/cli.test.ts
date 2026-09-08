import { describe, expect, test } from "bun:test";
import { formatHelp, parseArgs, UsageError, type CliSpec } from "./cli.ts";

const spec: CliSpec = {
  name: "example.ts",
  summary: "예시 스크립트",
  positional: [
    { name: "<입력>", description: "입력 경로" },
    { name: "<선택>", description: "선택 경로", required: false },
  ],
  options: {
    "--artifact": { value: true, description: "대조할 산출물" },
    "--accent": { value: true, description: "강조색", pattern: /^#[0-9a-fA-F]{6}$/ },
    "--strict": { description: "엄격 모드" },
    "--out": { value: true, description: "출력 경로", fallback: "review/out.json" },
  },
};

describe("parseArgs", () => {
  test("위치 인자와 값 옵션을 나눈다", () => {
    const r = parseArgs(["a.json", "--artifact", "b.html"], spec);
    expect(r.positional).toEqual(["a.json"]);
    expect(r.options["--artifact"]).toBe("b.html");
  });

  test("값이 없는 옵션은 true 로 둔다", () => {
    expect(parseArgs(["a.json", "--strict"], spec).options["--strict"]).toBe(true);
  });

  test("주지 않은 옵션에 fallback 을 채운다", () => {
    expect(parseArgs(["a.json"], spec).options["--out"]).toBe("review/out.json");
  });

  test("required 가 아닌 위치 인자는 없어도 된다", () => {
    expect(() => parseArgs(["a.json"], spec)).not.toThrow();
  });

  test("필수 위치 인자가 없으면 UsageError", () => {
    expect(() => parseArgs([], spec)).toThrow(UsageError);
  });

  test("모르는 옵션이면 UsageError", () => {
    expect(() => parseArgs(["a.json", "--nope"], spec)).toThrow(UsageError);
  });

  test("값이 필요한 옵션에 값이 없으면 UsageError", () => {
    expect(() => parseArgs(["a.json", "--artifact"], spec)).toThrow(UsageError);
    expect(() => parseArgs(["a.json", "--artifact", "--strict"], spec)).toThrow(UsageError);
  });

  test("pattern 에 맞지 않으면 UsageError", () => {
    expect(() => parseArgs(["a.json", "--accent", "orange"], spec)).toThrow(UsageError);
    expect(() => parseArgs(["a.json", "--accent", "#FF6F0F"], spec)).not.toThrow();
  });

  test("--help 는 옵션으로 남긴다", () => {
    expect(parseArgs(["--help"], spec).options["--help"]).toBe(true);
  });
});

describe("formatHelp", () => {
  test("이름에 이미 꺾쇠가 있으면 겹쳐 감싸지 않는다", () => {
    expect(formatHelp(spec)).not.toContain("<<입력>>");
  });

  test("이름, 요약, 인자와 옵션을 담는다", () => {
    const help = formatHelp(spec);
    expect(help).toContain("example.ts");
    expect(help).toContain("예시 스크립트");
    expect(help).toContain("<입력>");
    expect(help).toContain("[<선택>]");
    expect(help).toContain("--artifact");
    expect(help).toContain("기본값: review/out.json");
    expect(help).toContain("--help");
  });
});
