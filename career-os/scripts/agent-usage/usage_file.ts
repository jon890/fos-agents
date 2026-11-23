import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { z } from "zod";
import type { MonthlyMeasurement } from "./measure.ts";

/**
 * 월별 사용량 기록을 노트북의 JSON 파일 하나에 둔다(ADR-148).
 * 세션 기록이 기기에서 지워진 뒤에는 그 달을 다시 셀 수 없으므로, 이미 기록한 달은 사유 없이 덮어쓰지 않는다.
 */
export const USAGE_FILE_ENV = "CAREER_AGENT_USAGE_FILE";

const count = z.number().int().nonnegative();
const cost = z.number().nonnegative();

const snapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  claudeTokens: count,
  codexTokens: count,
  claudeCostUsd: cost,
  codexCostUsd: cost,
  sessions: count,
  unpricedTokens: count,
  measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.literal("MEASURED"),
  /** 기록을 바꿨을 때의 사유다. */
  note: z.string().min(1).optional(),
});

const usageFileSchema = z.object({ schemaVersion: z.literal(1), snapshots: z.array(snapshotSchema) });

export type UsageSnapshot = z.infer<typeof snapshotSchema>;

/** 수집기가 쓰는 만큼의 기록 저장소. 테스트는 대역을 넣는다. */
export type UsageSnapshotStore = {
  /** 기록된 달(`YYYY-MM`) 목록. */
  listMonths(): Promise<string[]>;
  /** `replaceNote` 가 있을 때만 이미 있는 달을 바꾼다. */
  putMeasured(
    measurement: MonthlyMeasurement,
    measuredOn: string,
    options?: { replaceNote?: string },
  ): Promise<{ created: boolean; replaced: boolean }>;
};

export function resolveUsageFilePath(environment: Record<string, string | undefined>, home: string): string {
  const configured = environment[USAGE_FILE_ENV]?.trim();
  if (!configured) return join(home, ".fos-career", "agent-usage", "snapshots.json");
  if (!isAbsolute(configured)) throw new Error(`${USAGE_FILE_ENV} 는 절대 경로여야 한다.`);
  return configured;
}

/** 파일이 없으면 빈 목록이다. 꼴이 다르면 던지고 파일을 건드리지 않는다. */
export function readUsageFile(filePath: string): UsageSnapshot[] {
  if (!existsSync(filePath)) return [];
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`사용량 파일이 계약과 다르다: ${filePath}`);
  }
  const parsed = usageFileSchema.safeParse(json);
  if (!parsed.success) throw new Error(`사용량 파일이 계약과 다르다: ${filePath}`);
  if (new Set(parsed.data.snapshots.map((snapshot) => snapshot.month)).size !== parsed.data.snapshots.length) {
    throw new Error(`사용량 파일에 같은 달이 두 번 있다: ${filePath}`);
  }
  return parsed.data.snapshots;
}

/** 같은 디렉터리의 임시 파일에 쓰고 이름을 바꿔, 쓰다가 끊겨도 앞 기록이 남게 한다. */
function writeUsageFile(filePath: string, snapshots: UsageSnapshot[]): void {
  const directory = dirname(filePath);
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true, mode: 0o700 });
  const sorted = [...snapshots].sort((left, right) => left.month.localeCompare(right.month));
  const temporary = join(directory, `.snapshots.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify({ schemaVersion: 1, snapshots: sorted }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    chmodSync(temporary, 0o600);
    renameSync(temporary, filePath);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

export function createUsageFileStore(filePath: string): UsageSnapshotStore {
  return {
    async listMonths() {
      return readUsageFile(filePath).map((snapshot) => snapshot.month);
    },
    async putMeasured(measurement, measuredOn, options = {}) {
      const snapshots = readUsageFile(filePath);
      const existing = snapshots.findIndex((snapshot) => snapshot.month === measurement.month);
      const note = options.replaceNote?.trim();
      if (existing >= 0 && !note) return { created: false, replaced: false };
      const snapshot: UsageSnapshot = snapshotSchema.parse({
        ...measurement,
        measuredOn,
        source: "MEASURED",
        ...(existing >= 0 && note ? { note } : {}),
      });
      if (existing >= 0) snapshots[existing] = snapshot;
      else snapshots.push(snapshot);
      writeUsageFile(filePath, snapshots);
      return { created: existing < 0, replaced: existing >= 0 };
    },
  };
}
