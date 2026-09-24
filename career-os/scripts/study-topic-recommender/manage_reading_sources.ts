#!/usr/bin/env bun
import { firstOptionValue } from "../lib/cli.ts";
import { createStudyLibraryClient, StudyLibraryApiError } from "./study-library/client.js";
import type { StudyLibrarySourcePutPayload } from "./study-library/contracts.js";

const value = (args: readonly string[], name: string) => firstOptionValue(args, `--${name}`);
const required = (args: readonly string[], name: string) => { const found = value(args, name); if (!found?.trim()) throw new Error(`--${name} 값이 필요하다.`); return found; };
const changed = (args: readonly string[], name: string) => args.includes(`--${name}`);
function sourcePayload(args: readonly string[], current?: { title: string; category: StudyLibrarySourcePutPayload["category"]; adapter: StudyLibrarySourcePutPayload["adapter"]; url: string | null; feedUrl: string | null; enabled: boolean; version: number }): StudyLibrarySourcePutPayload {
  const clearUrl = changed(args, "clear-url"); const clearFeedUrl = changed(args, "clear-feed-url");
  if (clearUrl && value(args, "url")) throw new Error("--url과 --clear-url은 함께 쓸 수 없다."); if (clearFeedUrl && value(args, "feed-url")) throw new Error("--feed-url과 --clear-feed-url은 함께 쓸 수 없다.");
  return { title: value(args, "title") ?? current?.title ?? required(args, "title"), category: (value(args, "category") ?? current?.category ?? required(args, "category")) as StudyLibrarySourcePutPayload["category"], adapter: (value(args, "adapter") ?? current?.adapter ?? required(args, "adapter")) as StudyLibrarySourcePutPayload["adapter"], url: clearUrl ? null : (value(args, "url") ?? current?.url ?? null), feedUrl: clearFeedUrl ? null : (value(args, "feed-url") ?? current?.feedUrl ?? null), enabled: current?.enabled ?? true, note: required(args, "note"), expectedVersion: current?.version ?? 0 };
}
export async function manageReadingSources(args = process.argv.slice(2)): Promise<unknown> {
  const command = args[0]; const client = createStudyLibraryClient(); if (command === "list") return (await client.getSources()).sources; if (command === "add") return client.putSource(required(args, "key"), sourcePayload(args));
  if (!command || !["update", "disable", "enable"].includes(command)) throw new Error("사용법: list | add | update | disable | enable");
  const key = required(args, "key"); required(args, "note"); const found = (await client.getSources()).sources.find((source) => source.sourceKey === key); if (!found) throw new Error(`소스를 찾을 수 없다: ${key}`);
  if (command === "update" && !["title", "category", "adapter", "url", "feed-url", "clear-url", "clear-feed-url"].some((name) => changed(args, name))) throw new Error("update할 필드가 하나 이상 필요하다.");
  const body = sourcePayload(args, found); if (command === "disable") body.enabled = false; if (command === "enable") body.enabled = true;
  try { return await client.putSource(key, body); } catch (error) { if (error instanceof StudyLibraryApiError && error.status === 409) throw new Error("소스가 바뀌었다. 다시 조회한 뒤 명령을 다시 실행한다."); throw error; }
}
if (import.meta.main) manageReadingSources().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
