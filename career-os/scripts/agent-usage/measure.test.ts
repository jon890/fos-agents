import { describe, expect, test } from "bun:test";
import { measureUsage, parseMeasurement } from "./measure.ts";

const valid = {
  months: [
    { month: "2026.03", claude_tokens: 1200, codex_tokens: 500, claude_cost: 0.01, codex_cost: 0.0, sessions: 2, unpriced_tokens: 7 },
  ],
  total: { tokens: 1700, claude_cost: 0.01, codex_cost: 0.0, total_cost: 0.01, sessions: 2, unpriced_tokens: 7 },
};

function messageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("던져야 하는데 성공했다");
}

describe("parseMeasurement", () => {
  test("month 를 YYYY-MM 으로 바꾸고 나머지 값을 그대로 돌려준다", () => {
    expect(parseMeasurement(JSON.stringify(valid))).toEqual([
      { month: "2026-03", claudeTokens: 1200, codexTokens: 500, claudeCostUsd: 0.01, codexCostUsd: 0, sessions: 2, unpricedTokens: 7 },
    ]);
  });

  test("달이 없으면 빈 배열을 돌려준다", () => {
    expect(parseMeasurement(JSON.stringify({ months: [], total: {} }))).toEqual([]);
  });

  test("unpriced_tokens 가 없는 줄은 던진다", () => {
    const { unpriced_tokens: _omitted, ...row } = valid.months[0]!;
    const input = JSON.stringify({ months: [row] });
    expect(messageOf(() => parseMeasurement(input))).toBe("측정 출력이 계약과 다르다.");
  });

  test("음수 토큰은 던진다", () => {
    const input = JSON.stringify({ months: [{ ...valid.months[0], claude_tokens: -1 }] });
    expect(messageOf(() => parseMeasurement(input))).toBe("측정 출력이 계약과 다르다.");
  });

  test("JSON 이 아니면 던지고 오류 문구에 입력이 들어 있지 않다", () => {
    const input = "비밀-본문 not json";
    const message = messageOf(() => parseMeasurement(input));
    expect(message).toBe("측정 출력이 계약과 다르다.");
    expect(message).not.toContain(input);
  });
});

describe("measureUsage", () => {
  test("넘겨받은 대역의 출력을 파싱한다", async () => {
    const result = await measureUsage(async () => JSON.stringify(valid));
    expect(result).toHaveLength(1);
    expect(result[0]?.month).toBe("2026-03");
  });
});
