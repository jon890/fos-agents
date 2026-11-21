import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalRequestHash } from "../lib/career-store/request-hash.ts";
import { configurePositionCompanyPreferences } from "./configure_position_company_preferences.ts";
import { createPositionStore, type PositionStore } from "./position-store.ts";

/**
 * 사람이 정하는 공고 추천 설정을 작업 폴더 저장소에 넣는 명령이다.
 * 새 저장소에는 분석 정책, 회사 선호, 제외 규칙이 없고 기본값을 넣지 않는다.
 */
export const POSITION_SETTINGS_COMMANDS = [
  "configure-policy",
  "configure-companies",
  "exclusions",
] as const;

export const POSITION_SETTINGS_HELP = `  position_run.ts configure-policy --input <JSON>
  position_run.ts configure-companies --input <JSON>
  position_run.ts exclusions get
  position_run.ts exclusions put --input <JSON>`;

export class PositionSettingsUsageError extends Error {}

export function isPositionSettingsCommand(command: string | undefined): boolean {
  return (POSITION_SETTINGS_COMMANDS as readonly string[]).includes(command ?? "");
}

function inputPath(args: string[]): string {
  if (args.length !== 2 || args[0] !== "--input" || !args[1]?.trim()) {
    throw new PositionSettingsUsageError("--input <JSON 파일>이 필요합니다.");
  }
  return resolve(args[1]);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

/** 본문 전체의 hash 를 멱등 키로 쓴다. 같은 설정을 다시 넣으면 처음 응답을 돌려준다. */
function settingsKey(kind: string, body: unknown): string {
  return `${kind}:${canonicalRequestHash(body)}`;
}

export async function runPositionSettingsCommand(
  argv: string[],
  writeLine: (line: string) => void,
  createStore: () => PositionStore = createPositionStore,
): Promise<number> {
  const [command, ...rest] = argv;
  if (command === "configure-policy") {
    const policy = readJson(inputPath(rest));
    const configured = await createStore().configureAnalysisPolicy(
      policy,
      settingsKey("analysis-policy", policy),
    );
    writeLine(`분석 정책 저장: ${JSON.stringify(configured)}`);
    return 0;
  }
  if (command === "configure-companies") {
    const result = await configurePositionCompanyPreferences(inputPath(rest), createStore);
    writeLine(`회사 선호 저장: ${JSON.stringify(result)}`);
    return 0;
  }
  const [action, ...actionArgs] = rest;
  if (action === "get" && actionArgs.length === 0) {
    const exclusions = await createStore().getExclusions();
    writeLine(JSON.stringify({ schemaVersion: 2, exclusions }, null, 2));
    return 0;
  }
  if (action === "put") {
    const body = readJson(inputPath(actionArgs));
    const saved = await createStore().replaceExclusions(body, settingsKey("exclusions", body));
    writeLine(`제외 규칙 저장: ${saved.length}건(만료되지 않은 규칙)`);
    return 0;
  }
  throw new PositionSettingsUsageError(
    "exclusions에는 get 이나 put --input <JSON 파일>이 필요합니다.",
  );
}
