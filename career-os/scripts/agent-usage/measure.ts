import { join } from "node:path";
import { z } from "zod";

export type MonthlyMeasurement = {
  month: string;
  claudeTokens: number;
  codexTokens: number;
  claudeCostUsd: number;
  codexCostUsd: number;
  sessions: number;
  unpricedTokens: number;
};

/** 측정 스크립트의 표준 출력을 돌려준다. 테스트가 대역을 넣는 자리다. */
export type MeasurementRunner = () => Promise<string>;

const count = z.number().int().nonnegative();
const cost = z.number().nonnegative();

const measurementSchema = z.object({
  months: z.array(
    z.object({
      month: z.string().regex(/^\d{4}\.\d{2}$/),
      claude_tokens: count,
      codex_tokens: count,
      claude_cost: cost,
      codex_cost: cost,
      sessions: count,
      unpriced_tokens: count,
    }),
  ),
});

export function parseMeasurement(stdout: string): MonthlyMeasurement[] {
  let json: unknown;
  try {
    json = JSON.parse(stdout);
  } catch {
    throw new Error("측정 출력이 계약과 다르다.");
  }
  const parsed = measurementSchema.safeParse(json);
  if (!parsed.success) throw new Error("측정 출력이 계약과 다르다.");
  return parsed.data.months.map((row) => ({
    month: row.month.replace(".", "-"),
    claudeTokens: row.claude_tokens,
    codexTokens: row.codex_tokens,
    claudeCostUsd: row.claude_cost,
    codexCostUsd: row.codex_cost,
    sessions: row.sessions,
    unpricedTokens: row.unpriced_tokens,
  }));
}

export async function runAgentUsageScript(): Promise<string> {
  const process = Bun.spawn(["python3", join(import.meta.dir, "agent_usage.py"), "--json"], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const [stdout, exitCode] = await Promise.all([new Response(process.stdout).text(), process.exited]);
  if (exitCode !== 0) throw new Error("측정 스크립트가 실패했다.");
  return stdout;
}

export async function measureUsage(run: MeasurementRunner = runAgentUsageScript): Promise<MonthlyMeasurement[]> {
  return parseMeasurement(await run());
}
