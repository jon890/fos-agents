#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, isAbsolute } from "node:path";
import { firstOptionValue } from "../lib/cli.ts";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { createCandidateContextClient } from "./client.ts";
import { candidateContextDocumentKeySchema } from "./contracts.ts";

const value = (args: readonly string[], name: string) => firstOptionValue(args, `--${name}`);
const required = (args: readonly string[], name: string) => {
  const found = value(args, name);
  if (!found?.trim()) throw new Error(`--${name} 값이 필요하다.`);
  return found;
};
const usage = `사용법: manage_candidate_context.ts <list | get | put>\n\n로컬 명령:\n  help, --help, -h\n\nAPI 명령:\n  list\n  get --key <documentKey> [--out <path>]\n  put --key <documentKey> --file <markdownPath> --expected-version <n> --note <note>`;

function documentKey(args: readonly string[]) {
  const parsed = candidateContextDocumentKeySchema.safeParse(required(args, "key"));
  if (!parsed.success) throw new Error("--key 는 learning-interests, position-preferences, application-state, career-status 중 하나여야 한다.");
  return parsed.data;
}

/** 개인 맥락이 저장소에 남지 않도록 `--out` 의 부모 디렉터리가 저장소 안이면 거절한다. */
function assertOutsideRepository(out: string): string {
  const target = resolve(out);
  const parent = realpathSync(dirname(target));
  const root = realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  const rel = relative(root, parent);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    throw new Error("--out 은 저장소 밖 경로여야 한다. 개인 맥락을 저장소에 두지 않는다.");
  }
  return join(parent, basename(target));
}

export async function manageCandidateContext(args = process.argv.slice(2)): Promise<unknown> {
  const command = args[0];
  if (!command || ["help", "--help", "-h"].includes(command)) return usage;
  if (!["list", "get", "put"].includes(command)) throw new Error(usage);

  if (command === "list") return (await createCandidateContextClient().listDocuments()).documents;

  const key = documentKey(args);
  if (command === "get") {
    const out = value(args, "out");
    const outPath = out === undefined ? undefined : assertOutsideRepository(out);
    let document;
    try {
      document = await createCandidateContextClient().getDocument(key);
    } catch (error) {
      if (error instanceof CareerBackendHttpError && error.status === 404) {
        throw new Error(`문서가 없다: ${key}. put --expected-version 0 으로 새 문서를 만든다.`);
      }
      throw error;
    }
    if (outPath === undefined) return document.body;
    writeFileSync(outPath, document.body, "utf8");
    return { documentKey: document.documentKey, version: document.version, updatedAt: document.updatedAt, out: outPath };
  }

  const file = required(args, "file");
  const expectedVersion = Number(required(args, "expected-version"));
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new Error("--expected-version 은 0 이상의 정수여야 한다.");
  const note = required(args, "note");
  const body = readFileSync(file, "utf8");
  try {
    return (await createCandidateContextClient().putDocument(key, { body, note, expectedVersion })).document;
  } catch (error) {
    if (error instanceof CareerBackendHttpError && error.status === 409) {
      throw new Error("문서가 바뀌었다. get 으로 다시 조회하고 변경을 검토한 뒤 명령을 다시 실행한다.");
    }
    throw error;
  }
}

/** 오류는 상태, code, requestId 만 담는다. 문서 본문은 담지 않는다. */
export function formatManageCandidateContextError(error: unknown): string {
  if (error instanceof CareerBackendHttpError) {
    const detail = [`status=${error.status ?? "none"}`, `code=${error.code}`];
    if (error.requestId) detail.push(`requestId=${error.requestId}`);
    return `${error.message} (${detail.join(", ")})`;
  }
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  manageCandidateContext()
    .then((result) => console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(formatManageCandidateContextError(error));
      process.exit(1);
    });
}
