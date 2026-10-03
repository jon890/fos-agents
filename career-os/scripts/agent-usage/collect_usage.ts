import { createProfileClient, type ProfileClient } from "../profile/client.ts";
import { formatManageProfileError } from "../profile/manage_profile.ts";
import { measureUsage, type MonthlyMeasurement } from "./measure.ts";

/** 수집기가 쓰는 만큼의 기록 저장소. 테스트는 대역을, main 은 Backend client 를 넣는다. */
export type UsageSnapshotStore = {
  /** 기록된 달(`YYYY-MM`) 목록. */
  listMonths(): Promise<string[]>;
  putMeasured(measurement: MonthlyMeasurement, measuredOn: string): Promise<{ created: boolean }>;
};

export type CollectResult = { month: string; code: "CREATED" | "EXISTS" | "NO_SESSIONS" | "UP_TO_DATE" | "FAILED" };

const usage = `사용법: collect_usage.ts\n\n기록이 없는 끝난 달만 측정해 Backend 에 올린다. 인자는 받지 않는다.\n연결값은 CAREER_BACKEND_URL 과 CAREER_BACKEND_TOKEN(또는 CAREER_BACKEND_TOKEN_FILE)에서 읽는다.\n\n로컬 명령:\n  help, --help, -h\n`;

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
 * 측정해 올릴 달. 기록이 없으면 가장 최근에 끝난 달 하나다.
 * 기록이 있으면 가장 오래된 기록보다 앞의 달은 올리지 않는다. 그 달은 세션 기록이 일부만 남아 실제보다 작게 측정된다.
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
}): Promise<{ results: CollectResult[]; exitCode: 0 | 1 }> {
  const { store, measure, now, write } = deps;
  const targets = targetMonths(await store.listMonths(), now);
  if (targets.length === 0) {
    write("- UP_TO_DATE");
    return { results: [{ month: "-", code: "UP_TO_DATE" }], exitCode: 0 };
  }

  const measured = new Map((await measure()).map((row) => [row.month, row]));
  const measuredOn = seoulDate(now);
  const results: CollectResult[] = [];
  for (const month of targets) {
    const measurement = measured.get(month);
    let code: CollectResult["code"];
    if (!measurement || measurement.claudeTokens + measurement.codexTokens === 0) {
      code = "NO_SESSIONS";
    } else {
      try {
        code = (await store.putMeasured(measurement, measuredOn)).created ? "CREATED" : "EXISTS";
      } catch {
        // 실패한 달은 다음 실행이 다시 대상으로 잡는다. 남은 달은 마저 올린다.
        code = "FAILED";
      }
    }
    results.push({ month, code });
    write(`${month} ${code}`);
  }
  return { results, exitCode: results.some((result) => result.code === "FAILED") ? 1 : 0 };
}

/**
 * Backend client 를 수집기의 저장소로 잇는다. 이미 기록된 달을 바꾸지 않도록 교체 플래그와 note 는 보내지 않는다.
 * 기록된 달을 바꾸면 세션 기록이 지워진 뒤의 작은 값으로 덮어쓰게 된다.
 */
export function createUsageSnapshotStore(client: Pick<ProfileClient, "listUsageSnapshots" | "putUsageSnapshot">): UsageSnapshotStore {
  return {
    async listMonths() {
      return (await client.listUsageSnapshots()).map((snapshot) => snapshot.month);
    },
    async putMeasured(measurement, measuredOn) {
      const response = await client.putUsageSnapshot(measurement.month, {
        claudeTokens: measurement.claudeTokens,
        codexTokens: measurement.codexTokens,
        claudeCostUsd: measurement.claudeCostUsd,
        codexCostUsd: measurement.codexCostUsd,
        sessions: measurement.sessions,
        unpricedTokens: measurement.unpricedTokens,
        measuredOn,
        source: "MEASURED",
      });
      return { created: response.created };
    },
  };
}

async function main(args: readonly string[]): Promise<number> {
  if (args.length > 0) {
    if (args.length === 1 && ["help", "--help", "-h"].includes(args[0])) {
      process.stdout.write(usage);
      return 0;
    }
    process.stderr.write(`모르는 인자: ${args.join(" ")}\n\n${usage}`);
    return 2;
  }
  try {
    const store = createUsageSnapshotStore(createProfileClient());
    const { exitCode } = await collectUsage({
      store,
      measure: () => measureUsage(),
      now: new Date(),
      write: (line) => process.stdout.write(`${line}\n`),
    });
    return exitCode;
  } catch (error) {
    process.stderr.write(`${formatManageProfileError(error)}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
