#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { firstOptionValue } from "../lib/cli.ts";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { createCareerBackendClient } from "../position-recommender/career-backend/client.ts";
import { createCandidateContextClient } from "./client.ts";
import { candidateContextDocumentKeySchema } from "./contracts.ts";
import { SYNC_POSITION_POLICY_COMMAND, syncPositionPolicy } from "./position-policy.ts";
import { assertOutsideRepository } from "./repository-guard.ts";

const value = (args: readonly string[], name: string) => firstOptionValue(args, `--${name}`);
const required = (args: readonly string[], name: string) => {
  const found = value(args, name);
  if (!found?.trim()) throw new Error(`--${name} 값이 필요하다.`);
  return found;
};
const usage = `사용법: manage_candidate_context.ts <list | get | put | sync-position-policy>\n\n로컬 명령:\n  help, --help, -h\n\nAPI 명령:\n  list\n  get --key <documentKey> [--out <path>]\n  put --key <documentKey> --file <markdownPath> --expected-version <n> --note <note>\n    position-preferences 를 저장하면 분석 정책의 기준 버전도 맞춘다.\n  sync-position-policy\n    분석 정책의 기준 버전을 position-preferences 문서 version 에 맞춘다.\n`;

function documentKey(args: readonly string[]) {
  const parsed = candidateContextDocumentKeySchema.safeParse(required(args, "key"));
  if (!parsed.success) throw new Error("--key 는 learning-interests, position-preferences, application-state, career-status 중 하나여야 한다.");
  return parsed.data;
}

export async function manageCandidateContext(args = process.argv.slice(2)): Promise<unknown> {
  const command = args[0];
  if (!command || ["help", "--help", "-h"].includes(command)) return usage;
  if (!["list", "get", "put", "sync-position-policy"].includes(command)) throw new Error(usage);

  if (command === "list") return (await createCandidateContextClient().listDocuments()).documents;
  if (command === "sync-position-policy") {
    let document;
    try {
      document = await createCandidateContextClient().getDocument("position-preferences");
    } catch (error) {
      if (error instanceof CareerBackendHttpError && error.status === 404) {
        throw new Error("문서가 없다: position-preferences. put --expected-version 0 으로 새 문서를 만든다.");
      }
      throw error;
    }
    return syncPositionPolicy({ positions: createCareerBackendClient(), version: document.version });
  }

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
  let saved;
  try {
    saved = (await createCandidateContextClient().putDocument(key, { body, note, expectedVersion })).document;
  } catch (error) {
    if (error instanceof CareerBackendHttpError && error.status === 409) {
      throw new Error("문서가 바뀌었다. get 으로 다시 조회하고 변경을 검토한 뒤 명령을 다시 실행한다.");
    }
    throw error;
  }
  if (key !== "position-preferences") return saved;

  // 문서가 원본이다. 정책 갱신이 실패해도 저장한 문서는 되돌리지 않고, 정책만 다시 맞추는 명령을 알린다.
  try {
    const positionPolicy = await syncPositionPolicy({ positions: createCareerBackendClient(), version: saved.version });
    return { ...saved, positionPolicy };
  } catch (error) {
    throw new Error(
      `문서는 저장했다 (documentKey=${saved.documentKey}, version=${saved.version}). 분석 정책 기준 버전을 맞추지 못했다: ${formatManageCandidateContextError(error)} 정책만 다시 맞추려면 ${SYNC_POSITION_POLICY_COMMAND} 를 실행한다.`,
      { cause: error },
    );
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
    .then((result) => {
      // 문자열 본문은 줄바꿈을 더하지 않고 그대로 낸다. get > file 후 put 하면 저장할 때마다 끝 줄바꿈이 늘기 때문이다.
      if (typeof result === "string") process.stdout.write(result);
      else console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(formatManageCandidateContextError(error));
      process.exit(1);
    });
}
