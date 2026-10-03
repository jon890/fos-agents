import { writeFile } from "node:fs/promises";
import { firstOptionValue, UsageError } from "../lib/cli.ts";
import { createProfileClient } from "../profile/client.ts";
import { formatBillions, renderUsageChart, selectUsageBars, type UsageTokens } from "./chart.ts";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type RenderChartDependencies = {
  listSnapshots?: () => Promise<UsageTokens[]>;
  write?: (path: string, text: string) => Promise<void>;
};

async function listBackendSnapshots(): Promise<UsageTokens[]> {
  const snapshots = await createProfileClient().listUsageSnapshots();
  return snapshots.map(({ month, claudeTokens, codexTokens }) => ({ month, claudeTokens, codexTokens }));
}

export async function renderChartCommand(
  args: string[],
  dependencies: RenderChartDependencies = {},
): Promise<{ total: string; months: string[]; out: string }> {
  const monthsArg = firstOptionValue(args, "--months");
  const out = firstOptionValue(args, "--out");
  if (!monthsArg) throw new UsageError("--months 가 필요하다. 예: --months 2026-06,2026-07");
  if (!out) throw new UsageError("--out 이 필요하다.");
  const months = monthsArg.split(",");
  if (months.length < 1 || months.length > 6 || !months.every((month) => MONTH_PATTERN.test(month))) {
    throw new UsageError("--months 는 YYYY-MM 을 쉼표로 이은 1개에서 6개여야 한다.");
  }

  const records = await (dependencies.listSnapshots ?? listBackendSnapshots)();
  const { bars, totalTenths, missing } = selectUsageBars(records, months);
  if (missing.length > 0) throw new Error(`사용량 기록이 없는 달이 있다: ${missing.join(", ")}`);

  await (dependencies.write ?? ((target, text) => writeFile(target, text, "utf8")))(out, renderUsageChart(bars));
  return { total: formatBillions(totalTenths), months: bars.map((bar) => bar.month), out };
}

if (import.meta.main) {
  renderChartCommand(process.argv.slice(2))
    .then(({ total, months, out }) => {
      console.log(`total=${total} months=${months.length} out=${out}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(error instanceof UsageError ? 2 : 1);
    });
}
