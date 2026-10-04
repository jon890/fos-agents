import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { parseMeasurement } from "./measure.ts";
import { SUBPROCESS_TEST_TIMEOUT_MS } from "../lib/test-timeouts.ts";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function writeLines(file: string, lines: object[]): void {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
}

/** 임시 HOME 에서는 mise shim 이 설정을 찾지 못하므로, 실제 HOME 에서 인터프리터의 절대 경로를 얻는다. */
function interpreterPath(): string {
  const result = Bun.spawnSync(["python3", "-c", "import sys; print(sys.executable)"]);
  const value = result.stdout.toString().trim();
  if (result.exitCode !== 0 || !isAbsolute(value)) {
    throw new Error(`python3 인터프리터 경로를 얻지 못했다: exit=${result.exitCode} value=${value}`);
  }
  return value;
}

describe("agent_usage.py --json", () => {
  test("임시 HOME 의 세션 기록을 월별로 센다", () => {
    const home = mkdtempSync(join(tmpdir(), "agent-usage."));
    directories.push(home);
    const usage = (input: number, output: number) => ({
      input_tokens: input,
      output_tokens: output,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
    writeLines(join(home, ".claude/projects/sample/session.jsonl"), [
      { timestamp: "2026-03-10T01:00:00Z", message: { model: "claude-opus-4-7", usage: usage(1000, 200) } },
      { timestamp: "2026-03-10T02:00:00Z", message: { model: "unknown-model", usage: usage(300, 0) } },
    ]);
    writeLines(join(home, ".codex/sessions/2026/03/session.jsonl"), [
      {
        timestamp: "2026-03-11T01:00:00Z",
        model: "gpt-5.5",
        payload: { info: { total_token_usage: { total_tokens: 500, input_tokens: 400, cached_input_tokens: 100, output_tokens: 100 } } },
      },
    ]);

    const result = Bun.spawnSync([interpreterPath(), join(import.meta.dir, "agent_usage.py"), "--json"], {
      env: { ...process.env, HOME: home },
    });
    expect(result.exitCode).toBe(0);
    const stdout = result.stdout.toString();

    const output = JSON.parse(stdout) as { months: Record<string, unknown>[] };
    expect(output.months).toHaveLength(1);
    expect(output.months[0]).toMatchObject({
      month: "2026.03",
      claude_tokens: 1500,
      codex_tokens: 500,
      sessions: 2,
      unpriced_tokens: 300,
      claude_cost: 0.01,
    });
    expect(() => parseMeasurement(stdout)).not.toThrow();
  }, SUBPROCESS_TEST_TIMEOUT_MS);
});
