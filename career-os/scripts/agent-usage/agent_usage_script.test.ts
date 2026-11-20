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

function runScript(home: string, args: string[] = []): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync([interpreterPath(), join(import.meta.dir, "agent_usage.py"), "--json", ...args], {
    env: { ...process.env, HOME: home },
  });
  return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

type Row = { month: string; claude_tokens: number; codex_tokens: number; claude_cost: number; codex_cost: number; sessions: number; unpriced_tokens: number };

function rowsOf(home: string, args: string[] = []): Row[] {
  const { exitCode, stdout, stderr } = runScript(home, args);
  if (exitCode !== 0) throw new Error(`exit=${exitCode} ${stderr}`);
  expect(() => parseMeasurement(stdout)).not.toThrow();
  return (JSON.parse(stdout) as { months: Row[] }).months;
}

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "agent-usage."));
  directories.push(home);
  return home;
}

/** Claude Code 가 응답 하나를 나눠 쓴 줄. 같은 id 와 requestId 에 output 만 늘어난다. */
function claudeLine(opts: { id?: string; requestId?: string; sessionId?: string; output: number; input?: number; cacheWrite?: number; cacheWrite1h?: number; cacheRead?: number; model?: string; timestamp?: string }) {
  return {
    timestamp: opts.timestamp ?? "2026-03-10T01:00:00Z",
    ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    ...(opts.requestId ? { requestId: opts.requestId } : {}),
    message: {
      ...(opts.id ? { id: opts.id } : {}),
      model: opts.model ?? "claude-opus-4-7",
      usage: {
        input_tokens: opts.input ?? 0,
        output_tokens: opts.output,
        cache_creation_input_tokens: opts.cacheWrite ?? 0,
        cache_read_input_tokens: opts.cacheRead ?? 0,
        ...(opts.cacheWrite1h !== undefined ? { cache_creation: { ephemeral_1h_input_tokens: opts.cacheWrite1h, ephemeral_5m_input_tokens: (opts.cacheWrite ?? 0) - opts.cacheWrite1h } } : {}),
      },
    },
  };
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

  test("같은 message.id 와 requestId 의 줄은 한 응답으로 세고 칸마다 최댓값을 쓴다", () => {
    const home = tempHome();
    writeLines(join(home, ".claude/projects/sample/s1.jsonl"), [
      claudeLine({ id: "msg_a", requestId: "req_a", sessionId: "s1", input: 1000, cacheRead: 5000, output: 10 }),
      claudeLine({ id: "msg_a", requestId: "req_a", sessionId: "s1", input: 1000, cacheRead: 5000, output: 200 }),
      claudeLine({ id: "msg_a", requestId: "req_a", sessionId: "s1", input: 1000, cacheRead: 5000, output: 300 }),
    ]);
    // input 1000 + cache read 5000 + output 300. 중복을 빼지 않으면 18510 이 된다.
    expect(rowsOf(home)[0]).toMatchObject({ claude_tokens: 6300, sessions: 1 });
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("message.id 가 다르거나 키가 없는 줄은 따로 센다", () => {
    const home = tempHome();
    writeLines(join(home, ".claude/projects/sample/s1.jsonl"), [
      claudeLine({ id: "msg_a", requestId: "req_a", sessionId: "s1", output: 100 }),
      claudeLine({ id: "msg_b", requestId: "req_b", sessionId: "s1", output: 100 }),
      claudeLine({ id: "msg_c", requestId: "req_a", sessionId: "s1", output: 100 }),
      claudeLine({ sessionId: "s1", output: 100 }),
      claudeLine({ sessionId: "s1", output: 100 }),
    ]);
    expect(rowsOf(home)[0]).toMatchObject({ claude_tokens: 500 });
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("세션 수는 sessionId 로 세고 subagents 아래 파일은 빼되 그 토큰은 센다", () => {
    const home = tempHome();
    writeLines(join(home, ".claude/projects/sample/s1.jsonl"), [
      claudeLine({ id: "m1", requestId: "r1", sessionId: "s1", output: 100 }),
    ]);
    // 이어 쓴 세션이 다른 파일에 같은 sessionId 로 남은 경우
    writeLines(join(home, ".claude/projects/other/s1-resumed.jsonl"), [
      claudeLine({ id: "m2", requestId: "r2", sessionId: "s1", output: 100 }),
    ]);
    writeLines(join(home, ".claude/projects/sample/s1/subagents/agent-1.jsonl"), [
      claudeLine({ id: "m3", requestId: "r3", sessionId: "s1", output: 100 }),
    ]);
    writeLines(join(home, ".claude/projects/sample/s1/subagents/agent-2.jsonl"), [
      claudeLine({ id: "m4", requestId: "r4", sessionId: "s1", output: 100 }),
    ]);
    writeLines(join(home, ".claude/projects/sample/s2.jsonl"), [
      claudeLine({ id: "m5", requestId: "r5", sessionId: "s2", output: 100 }),
    ]);
    expect(rowsOf(home)[0]).toMatchObject({ claude_tokens: 500, sessions: 2 });
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("1시간 cache 쓰기는 2배, 나머지 cache 쓰기는 1.25배 단가로 환산한다", () => {
    const home = tempHome();
    // opus 입력 단가 $5/1M. 1시간 1M → $10, 5분 1M → $6.25
    writeLines(join(home, ".claude/projects/sample/s1.jsonl"), [
      claudeLine({ id: "m1", requestId: "r1", sessionId: "s1", output: 0, cacheWrite: 2_000_000, cacheWrite1h: 1_000_000 }),
    ]);
    expect(rowsOf(home)[0]).toMatchObject({ claude_tokens: 2_000_000, claude_cost: 16.25 });
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("cache_creation 상세가 없으면 cache 쓰기를 모두 1.25배로 환산한다", () => {
    const home = tempHome();
    writeLines(join(home, ".claude/projects/sample/s1.jsonl"), [
      claudeLine({ id: "m1", requestId: "r1", sessionId: "s1", output: 0, cacheWrite: 2_000_000 }),
    ]);
    expect(rowsOf(home)[0]).toMatchObject({ claude_cost: 12.5 });
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("--merge 는 다른 기기의 월별 합계를 더하고 같은 단가로 환산한다", () => {
    const home = tempHome();
    writeLines(join(home, ".claude/projects/sample/s1.jsonl"), [
      claudeLine({ id: "m1", requestId: "r1", sessionId: "s1", output: 1000, timestamp: "2026-03-10T01:00:00Z" }),
    ]);
    const totals = join(home, "company.json");
    writeFileSync(
      totals,
      JSON.stringify({
        source: "company",
        months: {
          "2026-03": {
            claude: { "claude-opus-4-7": { input: 1_000_000, cache_write_5m: 0, cache_write_1h: 1_000_000, cache_read: 0, output: 0 } },
            codex: { "gpt-5.5": { input: 1_000_000, cached: 0, output: 0, total: 1_000_000 } },
            claude_sessions: 3,
            codex_sessions: 2,
          },
          "2026-04": {
            claude: { "mystery-model": { input: 70, cache_write_5m: 0, cache_write_1h: 0, cache_read: 0, output: 0 } },
            codex: {},
            claude_sessions: 1,
            codex_sessions: 0,
          },
        },
      }),
    );
    const rows = rowsOf(home, ["--merge", totals]);
    expect(rows).toHaveLength(2);
    // 이 기기의 output 1000 → $0.025, 회사 input $5 + 1시간 cache 쓰기 $10
    expect(rows[0]).toMatchObject({ month: "2026.03", claude_tokens: 2_001_000, codex_tokens: 1_000_000, claude_cost: 15.03, codex_cost: 5, sessions: 6 });
    expect(rows[1]).toMatchObject({ month: "2026.04", claude_tokens: 70, unpriced_tokens: 70, sessions: 1 });
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("--merge 파일의 꼴이 다르면 종료 코드 2 로 거절한다", () => {
    const home = tempHome();
    const totals = join(home, "broken.json");
    writeFileSync(totals, JSON.stringify({ source: "company", months: { "2026-03": { claude: { "claude-opus-4-7": { input: -1 } } } } }));
    const result = runScript(home, ["--merge", totals]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--merge");
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("message.id 만 있거나 requestId 만 있는 줄도 한 응답으로 세고, 한 줄에만 requestId 가 빠져도 두 번 세지 않는다", () => {
    const home = tempHome();
    writeLines(join(home, ".claude/projects/sample/s1.jsonl"), [
      claudeLine({ id: "msg_only", sessionId: "s1", output: 10 }),
      claudeLine({ id: "msg_only", sessionId: "s1", output: 40 }),
      claudeLine({ requestId: "req_only", sessionId: "s1", output: 20 }),
      claudeLine({ requestId: "req_only", sessionId: "s1", output: 60 }),
      claudeLine({ id: "msg_mixed", requestId: "req_mixed", sessionId: "s1", output: 30 }),
      claudeLine({ id: "msg_mixed", sessionId: "s1", output: 100 }),
    ]);
    expect(rowsOf(home)[0]).toMatchObject({ claude_tokens: 200 });
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("UTC 달 경계를 넘는 같은 응답은 처음 본 줄의 달에 한 번만 센다", () => {
    const home = tempHome();
    writeLines(join(home, ".claude/projects/sample/s1.jsonl"), [
      claudeLine({ id: "m1", requestId: "r1", sessionId: "s1", output: 10, timestamp: "2026-03-31T23:59:59Z" }),
      claudeLine({ id: "m1", requestId: "r1", sessionId: "s1", output: 50, timestamp: "2026-04-01T00:00:01Z" }),
    ]);
    const rows = rowsOf(home);
    expect(rows.map((row) => [row.month, row.claude_tokens])).toEqual([
      ["2026.03", 50],
      ["2026.04", 0],
    ]);
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("깨진 줄과 정수가 아닌 usage 값은 그 값만 건너뛴다", () => {
    const home = tempHome();
    const file = join(home, ".claude/projects/sample/s1.jsonl");
    mkdirSync(join(file, ".."), { recursive: true });
    const good = claudeLine({ id: "m1", requestId: "r1", sessionId: "s1", output: 100, input: 5 });
    const odd = claudeLine({ id: "m2", requestId: "r2", sessionId: "s1", output: 7 });
    (odd.message.usage as Record<string, unknown>).input_tokens = "12";
    writeFileSync(file, `{"usage": broken\n${JSON.stringify(good)}\n${JSON.stringify(odd)}\n`);
    expect(rowsOf(home)[0]).toMatchObject({ claude_tokens: 112 });
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("--totals-json 으로 내보낸 파일을 다른 HOME 에서 --merge 하면 원래 기기의 측정값과 같다", () => {
    const company = tempHome();
    writeLines(join(company, ".claude/projects/sample/s1.jsonl"), [
      claudeLine({ id: "m1", requestId: "r1", sessionId: "s1", input: 300, output: 10, cacheWrite: 2_000, cacheWrite1h: 500, cacheRead: 9_000 }),
      claudeLine({ id: "m1", requestId: "r1", sessionId: "s1", input: 300, output: 90, cacheWrite: 2_000, cacheWrite1h: 500, cacheRead: 9_000 }),
      claudeLine({ id: "m2", requestId: "r2", sessionId: "s1", output: 50, model: "mystery-model" }),
    ]);
    writeLines(join(company, ".codex/sessions/2026/03/session.jsonl"), [
      {
        timestamp: "2026-03-11T01:00:00Z",
        model: "gpt-5.5",
        payload: { info: { total_token_usage: { total_tokens: 500, input_tokens: 400, cached_input_tokens: 100, output_tokens: 100 } } },
      },
    ]);
    const exported = runScript(company, []);
    expect(exported.exitCode).toBe(0);
    const totalsRun = Bun.spawnSync([interpreterPath(), join(import.meta.dir, "agent_usage.py"), "--totals-json", "--source", "company"], {
      env: { ...process.env, HOME: company },
    });
    expect(totalsRun.exitCode).toBe(0);
    const totalsFile = join(company, "company.json");
    writeFileSync(totalsFile, totalsRun.stdout.toString());

    const home = tempHome();
    expect(rowsOf(home, ["--merge", totalsFile])).toEqual(rowsOf(company));
  }, SUBPROCESS_TEST_TIMEOUT_MS);

  test("--merge 는 정해진 칸 밖의 키, 어긋난 Codex 칸, 겹치는 source 를 거절한다", () => {
    const home = tempHome();
    const month = (claude: object, codex: object = {}) => ({ claude, codex, claude_sessions: 1, codex_sessions: 0 });
    const claudeModel = { input: 1, cache_write_5m: 0, cache_write_1h: 0, cache_read: 0, output: 1 };
    const cases: Record<string, object> = {
      typo: { source: "a", months: { "2026-03": { ...month({}), cluade: {} } } },
      oldField: { source: "a", months: { "2026-03": month({ "claude-opus-4-7": { ...claudeModel, cache_write: 5 } }) } },
      cachedOverInput: { source: "a", months: { "2026-03": month({}, { "gpt-5.5": { input: 10, cached: 20, output: 0, total: 30 } }) } },
      totalUnder: { source: "a", months: { "2026-03": month({}, { "gpt-5.5": { input: 10, cached: 0, output: 10, total: 15 } }) } },
    };
    for (const [name, body] of Object.entries(cases)) {
      const file = join(home, `${name}.json`);
      writeFileSync(file, JSON.stringify(body));
      const result = runScript(home, ["--merge", file]);
      expect([name, result.exitCode]).toEqual([name, 2]);
    }
    const valid = { source: "company", months: { "2026-03": month({ "claude-opus-4-7": claudeModel }) } };
    const first = join(home, "first.json");
    const second = join(home, "second.json");
    writeFileSync(first, JSON.stringify(valid));
    writeFileSync(second, JSON.stringify(valid));
    expect(runScript(home, ["--merge", first]).exitCode).toBe(0);
    const duplicated = runScript(home, ["--merge", first, "--merge", second]);
    expect(duplicated.exitCode).toBe(2);
    expect(duplicated.stderr).toContain("source");
  }, SUBPROCESS_TEST_TIMEOUT_MS);
});
