#!/usr/bin/env bun
/**
 * 비공개 작업본 `library/profiles/` 의 원고 셋과 사용량 표를 Backend 로 한 번 옮기는 명령이다.
 * ADR-133 에 따라 원고와 사용량 기록의 저장소가 Backend 로 바뀌어, 스킬이 Backend 에서 읽기 전에 지금 값이 그곳에 있어야 한다.
 *
 * 다시 실행해도 안전하다. 이미 있는 원고와 이미 기록된 달에는 요청을 보내지 않고, `replace` 도 보내지 않는다.
 * 출력에는 키, 달, 결과 코드, 줄 번호만 낸다. 원고 본문과 토큰 값은 내지 않는다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { firstOptionValue, UsageError } from "../lib/cli.ts";
import { createProfileClient, type ProfileClient } from "./client.ts";
import { profileDocumentPutPayloadSchema, type UsageSnapshotPutPayload } from "./contracts.ts";
import { formatManageProfileError } from "./manage_profile.ts";

export type BackfillRow = {
  month: string;
  claudeTokens: number;
  codexTokens: number;
  measuredOn: string;
  /** 「비고」 칸. 비어 있으면 빈 문자열이다. */
  note: string;
};

type DocumentKey = "wanted" | "linkedin" | "github";
type UsageSource = "MEASURED" | "BACKFILLED";

/** 이 명령이 쓰는 만큼의 저장소. 테스트는 대역을, main 은 Backend client 를 넣는다. */
export type ProfileMigrationStore = {
  listMonths(): Promise<string[]>;
  documentExists(key: DocumentKey): Promise<boolean>;
  createDocument(key: DocumentKey, body: string, note: string): Promise<void>;
  putBackfilled(row: BackfillRow, source: UsageSource): Promise<{ created: boolean }>;
};

const documentFiles: ReadonlyArray<[DocumentKey, string]> = [
  ["wanted", "wanted-profile.md"],
  ["linkedin", "linkedin-profile.md"],
  ["github", "github-profile.md"],
];
const usageFile = "github-agent-usage-snapshots.md";
const documentNote = "library/profiles 의 원고를 옮긴다";
const headerNames = ["월", "Claude Code", "Codex", "측정한 날", "비고"] as const;

const splitCells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const isSeparator = (cells: readonly string[]) => cells.every((cell) => /^:?-+:?$/.test(cell));

/** `1.3B` 를 정수로 바꾼다. 부동소수 곱셈은 `0.07 * 1e9` 같은 오차를 내므로 소수점 아래를 아홉 자리로 채워 문자열로 붙인다. */
function billions(cell: string): number | null {
  const match = /^(\d+)(?:\.(\d+))?B$/.exec(cell);
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > 9) return null;
  const value = Number(`${match[1]}${fraction.padEnd(9, "0")}`);
  return Number.isSafeInteger(value) ? value : null;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseUsageTable(markdown: string): BackfillRow[] {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    if (!line.trim().startsWith("|")) return false;
    const cells = splitCells(line);
    return headerNames.every((name) => cells.includes(name));
  });
  if (headerIndex < 0) throw new Error(`사용량 표의 머리 줄을 찾지 못했다. ${headerNames.join(", ")} 칸이 모두 있어야 한다.`);

  const header = splitCells(lines[headerIndex]);
  const column = Object.fromEntries(headerNames.map((name) => [name, header.indexOf(name)])) as Record<(typeof headerNames)[number], number>;
  const rows: BackfillRow[] = [];
  const seen = new Set<string>();

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim().startsWith("|")) break;
    const cells = splitCells(line);
    if (isSeparator(cells)) continue;
    if (!/^\d{4}\.\d{2}$/.test(cells[column["월"]] ?? "")) continue;

    const lineError = () => new Error(`사용량 표의 ${index + 1}번째 줄을 읽지 못했다.`);
    if (cells.length !== header.length) throw lineError();
    const month = cells[column["월"]].replace(".", "-");
    const monthNumber = Number(month.slice(5));
    const claudeTokens = billions(cells[column["Claude Code"]]);
    const codexTokens = billions(cells[column["Codex"]]);
    const measuredOn = cells[column["측정한 날"]];
    const note = cells[column["비고"]];
    if (monthNumber < 1 || monthNumber > 12 || claudeTokens === null || codexTokens === null || !isCalendarDate(measuredOn) || note.length > 500) {
      throw lineError();
    }
    if (seen.has(month)) throw new Error(`사용량 표의 ${index + 1}번째 줄은 앞 줄과 같은 달이다.`);
    seen.add(month);
    rows.push({ month, claudeTokens, codexTokens, measuredOn, note });
  }

  if (rows.length === 0) throw new Error("사용량 표에 자료 줄이 없다.");
  return rows;
}

/** 실패 줄에는 상태와 code 만 붙인다. 오류 문구가 요청 값을 담을 수 있어서다. */
function failureDetail(error: unknown): string {
  if (error instanceof CareerBackendHttpError) return ` (status=${error.status ?? "none"}, code=${error.code})`;
  return error instanceof Error ? ` (${error.name})` : "";
}

export async function migrateLibraryProfiles(deps: {
  profilesDir: string;
  measuredMonths: readonly string[];
  dryRun: boolean;
  store: ProfileMigrationStore;
  readFile: (path: string) => string | null;
  write: (line: string) => void;
}): Promise<{ exitCode: 0 | 1 }> {
  const { profilesDir, dryRun, store, write } = deps;

  // 요청을 보내기 전에 모두 읽고 검사한다. 표의 한 줄이 잘못됐는데 앞 줄만 올라간 상태를 만들지 않기 위해서다.
  const documents = documentFiles.map(([key, file]) => {
    const body = deps.readFile(join(profilesDir, file));
    if (body !== null && !profileDocumentPutPayloadSchema.safeParse({ body, note: documentNote, expectedVersion: 0 }).success) {
      throw new Error(`원고 ${key} 는 비어 있거나 UTF-8 64 KiB 를 넘어 옮길 수 없다.`);
    }
    return { key, body };
  });
  const usagePath = join(profilesDir, usageFile);
  const usageMarkdown = deps.readFile(usagePath);
  if (usageMarkdown === null) throw new Error(`사용량 표 파일을 읽지 못했다: ${usagePath}`);
  const rows = parseUsageTable(usageMarkdown).sort((a, b) => a.month.localeCompare(b.month));
  const tableMonths = new Set(rows.map((row) => row.month));
  const unknown = deps.measuredMonths.filter((month) => !tableMonths.has(month));
  if (unknown.length > 0) throw new Error(`--measured 의 달이 사용량 표에 없다: ${unknown.join(", ")}`);
  const measured = new Set(deps.measuredMonths);

  let failed = false;

  for (const { key, body } of documents) {
    if (body === null) {
      write(`document ${key} MISSING_FILE`);
      failed = true;
      continue;
    }
    if (dryRun) {
      write(`document ${key} WOULD_CREATE`);
      continue;
    }
    try {
      if (await store.documentExists(key)) {
        write(`document ${key} EXISTS`);
        continue;
      }
      await store.createDocument(key, body, documentNote);
      write(`document ${key} CREATED`);
    } catch (error) {
      write(`document ${key} FAILED${failureDetail(error)}`);
      failed = true;
    }
  }

  // 응답의 created 에 기대지 않고 목록으로 먼저 거른다. 같은 값의 PUT 은 같은 멱등 키라 처음 응답 created=true 가 재생되기 때문이다.
  const recorded = dryRun ? new Set<string>() : new Set(await store.listMonths());
  for (const row of rows) {
    const source: UsageSource = measured.has(row.month) ? "MEASURED" : "BACKFILLED";
    if (dryRun) {
      write(`usage ${row.month} WOULD_CREATE ${source}`);
      continue;
    }
    if (recorded.has(row.month)) {
      write(`usage ${row.month} EXISTS`);
      continue;
    }
    try {
      const { created } = await store.putBackfilled(row, source);
      // created=false 는 목록을 읽은 뒤 다른 곳에서 먼저 기록한 경우다. 저장된 값은 바뀌지 않았다.
      write(created ? `usage ${row.month} CREATED ${source}` : `usage ${row.month} EXISTS`);
    } catch (error) {
      write(`usage ${row.month} FAILED${failureDetail(error)}`);
      failed = true;
    }
  }

  return { exitCode: failed ? 1 : 0 };
}

export function createProfileMigrationStore(client: ProfileClient): ProfileMigrationStore {
  return {
    async listMonths() {
      return (await client.listUsageSnapshots()).map((snapshot) => snapshot.month);
    },
    async documentExists(key) {
      try {
        await client.getDocument(key);
        return true;
      } catch (error) {
        if (error instanceof CareerBackendHttpError && error.status === 404) return false;
        throw error;
      }
    },
    async createDocument(key, body, note) {
      await client.putDocument(key, { body, note, expectedVersion: 0 });
    },
    async putBackfilled(row, source) {
      // 옮긴 달은 환산 비용과 세션 수를 비우고 unpricedTokens 를 0 으로 둔다. data-schema.md 의 「옮긴 달의 값」 을 따른다.
      // 기존 기록을 바꾸지 않도록 교체 플래그는 넣지 않는다.
      const payload: UsageSnapshotPutPayload = {
        claudeTokens: row.claudeTokens,
        codexTokens: row.codexTokens,
        claudeCostUsd: null,
        codexCostUsd: null,
        sessions: null,
        unpricedTokens: 0,
        measuredOn: row.measuredOn,
        source,
      };
      // 계약의 note 는 1자 이상이다. 빈 비고를 그대로 넣으면 요청 전에 거절된다.
      if (row.note) payload.note = row.note;
      const { created } = await client.putUsageSnapshot(row.month, payload);
      return { created };
    },
  };
}

const usage = `사용법: migrate_library_profiles.ts --profiles-dir <library/profiles 의 경로> [--measured <YYYY-MM>]... [--dry-run]

  library/profiles 의 원고 셋(wanted, linkedin, github)과 사용량 표를 Backend 로 옮긴다.
  이미 있는 원고와 이미 기록된 달은 건드리지 않는다. 여러 번 실행해도 된다.

  --profiles-dir  원고와 사용량 표가 있는 디렉터리. 필수다
  --measured      한 달 전체를 측정한 달. 여러 번 줄 수 있다. 주지 않은 달은 BACKFILLED 로 옮긴다
  --dry-run       Backend 에 연결하지 않고 할 일만 출력한다
  help, --help, -h
`;

type MigrationArgs = { profilesDir: string; measuredMonths: string[]; dryRun: boolean };

function parseMigrationArgs(args: readonly string[]): MigrationArgs {
  const measuredMonths: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--dry-run") continue;
    if (token !== "--profiles-dir" && token !== "--measured") throw new UsageError(`모르는 인자다: ${token}`);
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--") || !next.trim()) throw new UsageError(`${token} 값이 필요하다.`);
    if (token === "--measured") {
      if (!/^\d{4}-\d{2}$/.test(next)) throw new UsageError("--measured 는 YYYY-MM 이어야 한다.");
      measuredMonths.push(next);
    }
    index += 1;
  }
  const profilesDir = firstOptionValue(args, "--profiles-dir");
  if (profilesDir === undefined) throw new UsageError("--profiles-dir 값이 필요하다.");
  return { profilesDir, measuredMonths, dryRun: args.includes("--dry-run") };
}

function readOptionalFile(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function main(args: readonly string[]): Promise<number> {
  if (args.length === 0 || ["help", "--help", "-h"].some((flag) => args.includes(flag))) {
    process.stdout.write(usage);
    return 0;
  }
  let parsed: MigrationArgs;
  try {
    parsed = parseMigrationArgs(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage);
    return 2;
  }
  try {
    // dry-run 은 client 를 만들지 않는다. 연결값 없이 할 일을 확인할 수 있어야 한다.
    const unreachable: ProfileMigrationStore = {
      listMonths: () => Promise.reject(new Error("dry-run 은 Backend 를 부르지 않는다.")),
      documentExists: () => Promise.reject(new Error("dry-run 은 Backend 를 부르지 않는다.")),
      createDocument: () => Promise.reject(new Error("dry-run 은 Backend 를 부르지 않는다.")),
      putBackfilled: () => Promise.reject(new Error("dry-run 은 Backend 를 부르지 않는다.")),
    };
    const store = parsed.dryRun ? unreachable : createProfileMigrationStore(createProfileClient());
    const { exitCode } = await migrateLibraryProfiles({
      ...parsed,
      store,
      readFile: readOptionalFile,
      write: (line) => console.log(line),
    });
    return exitCode;
  } catch (error) {
    console.error(formatManageProfileError(error));
    return 1;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
