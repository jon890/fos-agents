#!/usr/bin/env bun
import { firstOptionValue } from "../lib/cli.ts";
import { createStudyLibraryClient, StudyLibraryApiError } from "./study-library/client.js";
import { studyLibrarySourcePutPayloadSchema, type StudyLibrarySourcePutPayload } from "./study-library/contracts.js";

const value = (args: readonly string[], name: string) => firstOptionValue(args, `--${name}`);
const required = (args: readonly string[], name: string) => { const found = value(args, name); if (!found?.trim()) throw new Error(`--${name} 값이 필요하다.`); return found; };
const changed = (args: readonly string[], name: string) => args.includes(`--${name}`);
const usage = `사용법: manage_reading_sources.ts <list | add | update | disable | enable | template>\n\n로컬 명령:\n  help, --help, -h\n  template --key <sourceKey> --title <title> --category <category> --adapter <adapter> [--url <url>] [--feed-url <feedUrl>] --note <note>\n\nAPI 명령:\n  list\n  add --key <sourceKey> --title <title> --category <category> --adapter <adapter> [--url <url>] [--feed-url <feedUrl>] --note <note>\n  update --key <sourceKey> [--title <title>] [--category <category>] [--adapter <adapter>] [--url <url> | --clear-url] [--feed-url <feedUrl> | --clear-feed-url] --note <note>\n  disable --key <sourceKey> --note <note>\n  enable --key <sourceKey> --note <note>`;
function sourcePayload(args: readonly string[], current?: { title: string; category: StudyLibrarySourcePutPayload["category"]; adapter: StudyLibrarySourcePutPayload["adapter"]; url: string | null; feedUrl: string | null; enabled: boolean; version: number }): StudyLibrarySourcePutPayload {
  const clearUrl = changed(args, "clear-url"); const clearFeedUrl = changed(args, "clear-feed-url");
  if (clearUrl && value(args, "url")) throw new Error("--url과 --clear-url은 함께 쓸 수 없다."); if (clearFeedUrl && value(args, "feed-url")) throw new Error("--feed-url과 --clear-feed-url은 함께 쓸 수 없다.");
  return { title: value(args, "title") ?? current?.title ?? required(args, "title"), category: (value(args, "category") ?? current?.category ?? required(args, "category")) as StudyLibrarySourcePutPayload["category"], adapter: (value(args, "adapter") ?? current?.adapter ?? required(args, "adapter")) as StudyLibrarySourcePutPayload["adapter"], url: clearUrl ? null : (value(args, "url") ?? current?.url ?? null), feedUrl: clearFeedUrl ? null : (value(args, "feed-url") ?? current?.feedUrl ?? null), enabled: current?.enabled ?? true, note: required(args, "note"), expectedVersion: current?.version ?? 0 };
}
export async function manageReadingSources(args = process.argv.slice(2)): Promise<unknown> {
  const command = args[0];
  if (!command || ["help", "--help", "-h"].includes(command)) return usage;
  if (command === "template") {
    const sourceKey = required(args, "key");
    return { sourceKey, payload: studyLibrarySourcePutPayloadSchema.parse(sourcePayload(args)) };
  }
  if (!["list", "add", "update", "disable", "enable"].includes(command)) throw new Error(usage);
  const client = createStudyLibraryClient();
  if (command === "list") return (await client.getSources()).sources;
  if (command === "add") return client.putSource(required(args, "key"), sourcePayload(args));
  const key = required(args, "key"); required(args, "note"); const found = (await client.getSources()).sources.find((source) => source.sourceKey === key); if (!found) throw new Error(`소스를 찾을 수 없다: ${key}`);
  if (command === "update" && !["title", "category", "adapter", "url", "feed-url", "clear-url", "clear-feed-url"].some((name) => changed(args, name))) throw new Error("update할 필드가 하나 이상 필요하다.");
  const body = sourcePayload(args, found); if (command === "disable") body.enabled = false; if (command === "enable") body.enabled = true;
  try { return await client.putSource(key, body); } catch (error) { if (error instanceof StudyLibraryApiError && error.status === 409) throw new Error("소스가 바뀌었다. 다시 조회한 뒤 명령을 다시 실행한다."); throw error; }
}
if (import.meta.main) manageReadingSources().then((result) => console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2))).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
