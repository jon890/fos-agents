import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

/** `--input` 은 설정 파일 꼴과, 조회 명령이나 옛 Backend 조회 응답이 내는 배열 꼴을 모두 받는다. */
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

/**
 * 설정 명령은 부를 때마다 새 멱등 키를 쓴다. 값을 덮어쓰는 명령이라 다시 넣어도 결과가 같다.
 * 본문 hash 를 키로 쓰면 값을 예전 것으로 되돌리는 요청이 처음 응답의 재전송으로 읽혀 반영되지 않는다.
 */
export function settingsKey(kind: string): string {
  return `${kind}:${crypto.randomUUID()}`;
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
      settingsKey("analysis-policy"),
    );
    writeLine(`분석 정책 저장: ${JSON.stringify(configured)}`);
    return 0;
  }
  if (command === "configure-companies") {
    const path = inputPath(rest);
    const input = readJson(path);
    // 배열이면 저장소가 돌려주는 회사 선호 목록 꼴이다(옛 Backend 의 조회 응답도 같다). 그대로 다시 넣는다.
    if (Array.isArray(input)) {
      const store = createStore();
      for (const entry of input) {
        const { updatedAt: _updatedAt, ...body } = entry as Record<string, unknown>;
        await store.updateCompanyPreference(
          String(body.companyKey),
          body,
          settingsKey("company-preference"),
        );
      }
      writeLine(`회사 선호 저장: ${input.length}곳`);
      return 0;
    }
    const result = await configurePositionCompanyPreferences(path, createStore);
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
    const input = readJson(inputPath(actionArgs));
    // 배열이면 `exclusions get` 이 내는 목록 꼴로 본다(옛 Backend 의 조회 응답도 같다).
    const body = Array.isArray(input) ? { schemaVersion: 2, exclusions: input } : input;
    const saved = await createStore().replaceExclusions(body, settingsKey("exclusions"));
    writeLine(`제외 규칙 저장: ${saved.length}건(만료되지 않은 규칙)`);
    return 0;
  }
  throw new PositionSettingsUsageError(
    "exclusions에는 get 이나 put --input <JSON 파일>이 필요합니다.",
  );
}
