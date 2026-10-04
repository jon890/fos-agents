import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

/**
 * 실제 파이썬 실행 파일이 있는 디렉터리.
 * python3 가 mise shim 이면 shim 은 HOME 아래 설정과 설치 위치를 찾으므로, HOME 을 비우면 설치를 새로 내려받는다.
 * 실행 파일 디렉터리를 PATH 앞에 두어 shim 을 거치지 않게 한다.
 */
function pythonDirectory(): string {
  const result = Bun.spawnSync(["python3", "-c", "import sys; print(sys.executable)"], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`python3 를 찾지 못했다: ${result.stderr.toString()}`);
  return dirname(result.stdout.toString().trim());
}

describe("runAgentUsageScript", () => {
  test("측정 스크립트를 소스 옆 파일 경로로 찾지 않는다", () => {
    const source = readFileSync(join(import.meta.dir, "measure.ts"), "utf8");
    expect(source).not.toContain("import.meta.dir");
    expect(source).not.toMatch(/join\([^)]*agent_usage\.py"/);
  });

  test("세션 기록이 없는 HOME 에서 달이 없는 측정 결과를 낸다", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "agent-usage-home-")));
    try {
      const proc = Bun.spawn(
        [
          "bun",
          "--no-env-file",
          "-e",
          `const { runAgentUsageScript } = await import(${JSON.stringify(join(import.meta.dir, "measure.ts"))});
process.stdout.write(await runAgentUsageScript());`,
        ],
        {
          cwd: home,
          env: { PATH: `${pythonDirectory()}:${process.env.PATH ?? ""}`, HOME: home },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
      expect(parseMeasurement(stdout)).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
