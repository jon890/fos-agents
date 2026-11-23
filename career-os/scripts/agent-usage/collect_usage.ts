import os from "node:os";
import { measureUsage, runAgentUsageScript, type MonthlyMeasurement } from "./measure.ts";
import { createUsageFileStore, resolveUsageFilePath, USAGE_FILE_ENV, type UsageSnapshotStore } from "./usage_file.ts";

export type { UsageSnapshotStore } from "./usage_file.ts";

export type CollectResult = { month: string; code: "CREATED" | "EXISTS" | "REPLACED" | "NO_SESSIONS" | "UP_TO_DATE" | "FAILED" };

const usage = `사용법: collect_usage.ts [--merge <파일>]... [--replace <YYYY-MM> --note <사유>]

기록이 없는 끝난 달만 측정해 노트북의 사용량 파일에 쓴다. 커리어 Backend 를 부르지 않는다.
파일은 ${USAGE_FILE_ENV}(절대 경로)이고 없으면 ~/.fos-career/agent-usage/snapshots.json 이다.

옵션:
  --merge <파일>              다른 기기에서 agent_usage.py --totals-json 으로 내보낸 합계 파일을 더해 측정한다. 여러 번 줄 수 있다
  --replace <YYYY-MM>         이미 기록한 끝난 달을 다시 측정한 값으로 바꾼다. --note 가 있어야 한다
  --note <사유>               기록을 바꾸는 사유. 파일에 함께 남는다

로컬 명령:
  help, --help, -h
`;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `YYYY-MM` 을 연*12+(월-1) 의 정수로 바꾼다. 달 계산을 정수로 해야 연도를 넘을 때 `2026-00` 같은 달이 생기지 않는다. */
function monthIndex(month: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`달은 YYYY-MM 이어야 한다: ${month}`);
  return Number(match[1]) * 12 + (Number(match[2]) - 1);
}

function monthOf(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/**
 * UTC 로 끝난 달을 오름차순으로 돌려준다. 측정 스크립트가 세션 기록의 UTC 시각으로 달을 나누기 때문이다.
 * `after` 가 없으면 가장 최근에 끝난 달 하나, 있으면 `after` 보다 뒤이고 가장 최근에 끝난 달 이하인 달 전부다.
 */
export function endedMonths(now: Date, after?: string): string[] {
  const latest = now.getUTCFullYear() * 12 + now.getUTCMonth() - 1;
  if (after === undefined) return [monthOf(latest)];
  const months: string[] = [];
  for (let index = monthIndex(after) + 1; index <= latest; index += 1) months.push(monthOf(index));
  return months;
}

/**
 * 측정해 기록할 달. 기록이 없으면 가장 최근에 끝난 달 하나다.
 * 기록이 있으면 가장 오래된 기록보다 앞의 달은 기록하지 않는다. 그 달은 세션 기록이 일부만 남아 실제보다 작게 측정된다.
 */
export function targetMonths(recorded: readonly string[], now: Date): string[] {
  if (recorded.length === 0) return endedMonths(now);
  const earliest = recorded.reduce((min, month) => (monthIndex(month) < monthIndex(min) ? month : min));
  const known = new Set(recorded.map((month) => monthOf(monthIndex(month))));
  return endedMonths(now, earliest).filter((month) => !known.has(month));
}

function seoulDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

export async function collectUsage(deps: {
  store: UsageSnapshotStore;
  measure: () => Promise<MonthlyMeasurement[]>;
  now: Date;
  write: (line: string) => void;
  /** 실패 원인 한 줄. 달과 오류 문구만 담고 측정값은 담지 않는다. */
  writeError: (line: string) => void;
  /** 기록이 있어도 다시 측정해 바꿀 달과 그 사유. */
  replace?: { month: string; note: string };
}): Promise<{ results: CollectResult[]; exitCode: 0 | 1 }> {
  const { store, measure, now, write, writeError, replace } = deps;
  const recorded = await store.listMonths();
  if (replace && recorded.length > 0 && recorded.every((month) => monthIndex(month) > monthIndex(replace.month))) {
    // 가장 오래된 기록보다 앞의 달은 세션 기록이 일부만 남아 실제보다 작게 측정된다.
    throw new CollectUsageArgumentError("--replace 는 가장 오래된 기록보다 앞의 달을 받지 않는다.");
  }
  const missing = targetMonths(recorded, now);
  const targets = replace ? [...new Set([...missing, replace.month])].sort() : missing;
  if (targets.length === 0) {
    write("- UP_TO_DATE");
    return { results: [{ month: "-", code: "UP_TO_DATE" }], exitCode: 0 };
  }

  const measured = new Map((await measure()).map((row) => [row.month, row]));
  const measuredOn = seoulDate(now);
  const results: CollectResult[] = [];
  let replaceMissed = false;
  for (const month of targets) {
    const measurement = measured.get(month);
    let code: CollectResult["code"];
    let failure: unknown;
    if (!measurement || measurement.claudeTokens + measurement.codexTokens === 0) {
      code = "NO_SESSIONS";
      // 바꾸라고 지정한 달을 바꾸지 못했는데 성공으로 끝나면 바뀐 줄 안다.
      if (replace?.month === month) replaceMissed = true;
    } else {
      try {
        const options = replace?.month === month ? { replaceNote: replace.note } : undefined;
        const result = await store.putMeasured(measurement, measuredOn, options);
        code = result.created ? "CREATED" : result.replaced ? "REPLACED" : "EXISTS";
      } catch (error) {
        // 실패한 달은 다음 실행이 다시 대상으로 잡는다. 남은 달은 마저 쓴다.
        code = "FAILED";
        failure = error;
      }
    }
    results.push({ month, code });
    write(`${month} ${code}`);
    if (code === "FAILED") writeError(`${month} ${messageOf(failure)}`);
  }
  if (replaceMissed) writeError(`${replace!.month} 세션 기록이 없어 기록을 바꾸지 않았다.`);
  return { results, exitCode: replaceMissed || results.some((result) => result.code === "FAILED") ? 1 : 0 };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class CollectUsageArgumentError extends Error {}

/** `--merge` 로 받은 합계 파일을 측정 스크립트 인자로 바꾼다. */
export function mergeScriptArguments(files: readonly string[]): string[] {
  return files.flatMap((file) => ["--merge", file]);
}

/** 인자를 읽는다. 측정하기 전에 틀린 인자를 거절한다. */
export function parseCollectArguments(
  args: readonly string[],
  now: Date,
): { merge: string[]; replace?: { month: string; note: string } } {
  const merge: string[] = [];
  let replaceMonth: string | undefined;
  let note: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    const value = args[index + 1];
    if (name !== "--merge" && name !== "--replace" && name !== "--note") throw new CollectUsageArgumentError(`모르는 인자: ${name}`);
    if (value === undefined || value.startsWith("--")) throw new CollectUsageArgumentError(`${name} 에 값이 필요하다.`);
    if (name === "--merge") merge.push(value);
    else if (name === "--replace") replaceMonth = value;
    else note = value.trim();
    index += 1;
  }
  if (replaceMonth === undefined) {
    if (note !== undefined) throw new CollectUsageArgumentError("--note 는 --replace 와 함께 준다.");
    return { merge };
  }
  if (!MONTH_PATTERN.test(replaceMonth)) throw new CollectUsageArgumentError("--replace 는 YYYY-MM 이어야 한다.");
  if (monthIndex(replaceMonth) > monthIndex(endedMonths(now)[0]!)) throw new CollectUsageArgumentError("--replace 는 끝난 달만 받는다.");
  if (!note) throw new CollectUsageArgumentError("--replace 는 --note <사유> 와 함께 준다.");
  return { merge, replace: { month: replaceMonth, note } };
}

export async function main(args: readonly string[]): Promise<number> {
  if (args.length === 1 && ["help", "--help", "-h"].includes(args[0]!)) {
    process.stdout.write(usage);
    return 0;
  }
  const now = new Date();
  let parsed: ReturnType<typeof parseCollectArguments>;
  try {
    parsed = parseCollectArguments(args, now);
  } catch (error) {
    process.stderr.write(`${messageOf(error)}\n\n${usage}`);
    return 2;
  }
  try {
    const store = createUsageFileStore(resolveUsageFilePath(process.env, os.homedir()));
    const mergeArguments = mergeScriptArguments(parsed.merge);
    const { exitCode } = await collectUsage({
      store,
      measure: () => measureUsage(() => runAgentUsageScript(mergeArguments)),
      now,
      write: (line) => process.stdout.write(`${line}\n`),
      writeError: (line) => process.stderr.write(`${line}\n`),
      replace: parsed.replace,
    });
    return exitCode;
  } catch (error) {
    process.stderr.write(`${messageOf(error)}\n`);
    return error instanceof CollectUsageArgumentError ? 2 : 1;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
