import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatBillions, renderUsageChart } from "./chart.ts";

const script = join(import.meta.dir, "../../.claude/skills/sync-profile/scripts/agent_usage_chart.py");

const cases: Array<[string[], Array<[string, number, number]>]> = [
  [["2031.01=1.3,11.6", "2031.02=18.9,5.7"], [["2031-01", 13, 116], ["2031-02", 189, 57]]],
  [
    ["2031.01=0.4,2.0", "2031.02=3.1,0.9", "2031.03=7.7,7.7", "2031.04=12.0,0.1", "2031.05=20.5,4.4", "2031.06=9.9,30.2"],
    [["2031-01", 4, 20], ["2031-02", 31, 9], ["2031-03", 77, 77], ["2031-04", 120, 1], ["2031-05", 205, 44], ["2031-06", 99, 302]],
  ],
  [["2031.01=4.2,0.0", "2031.02=6.0,1.5"], [["2031-01", 42, 0], ["2031-02", 60, 15]]],
  [["2031.01=0.0,3.3"], [["2031-01", 0, 33]]],
  [["2031.01=0.3,0.2"], [["2031-01", 3, 2]]],
  [["2031.01=12.2,0.0", "2031.02=0.7,0.0"], [["2031-01", 122, 0], ["2031-02", 7, 0]]],
];

test.each(cases)("파이썬 출력과 글자까지 같다: %p", async (args, rows) => {
  const dir = mkdtempSync(join(tmpdir(), "chart-parity-"));
  try {
    const out = join(dir, "chart.svg");
    const child = Bun.spawn(["python3", script, ...args.flatMap((arg) => ["--month", arg]), "--out", out], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);
    expect(exitCode).toBe(0);
    const bars = rows.map(([month, claudeTenths, codexTenths]) => ({ month, claudeTenths, codexTenths }));
    expect(renderUsageChart(bars)).toBe(readFileSync(out, "utf8"));
    const totalTenths = bars.reduce((sum, bar) => sum + bar.claudeTenths + bar.codexTenths, 0);
    expect(stdout).toContain(`total=${formatBillions(totalTenths)} `);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
