#!/usr/bin/env bun
import { randomBytes } from "node:crypto";
import { closeSync, openSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { assertOutsideRepository } from "../candidate-context/repository-guard.ts";
import { firstOptionValue } from "../lib/cli.ts";
import { ApplicationProfileHttpError, readApplicationProfile, type ReadApplicationProfileOptions } from "./client.ts";

const usage = `사용법: read_application_profile.ts <get>

로컬 명령:
  help, --help, -h

API 명령:
  get --out <path>
    fos-assistant Memory 의 identity/career-application-profile 본문을 저장소 밖 <path> 에 쓴다.
`;

/**
 * 같은 디렉터리에 0600 임시 파일을 새로 만들어 쓰고 outPath 로 이름을 바꾼다.
 * 이미 있는 파일이나 링크에 쓰지 않으므로 다른 사용자가 미리 만든 파일에 본문이 들어가지 않는다.
 */
function writeAtomically(outPath: string, content: string): void {
  const tmpPath = join(dirname(outPath), `.${basename(outPath)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  const fd = openSync(tmpPath, "wx", 0o600);
  try {
    try {
      writeFileSync(fd, content, "utf8");
    } finally {
      closeSync(fd);
    }
    renameSync(tmpPath, outPath);
  } catch (error) {
    rmSync(tmpPath, { force: true });
    throw error;
  }
}

/**
 * 지원서 공통 프로필을 저장소 밖 파일에 쓴다.
 * 에이전트 실행 기록에 연락처가 남지 않도록 본문을 표준 출력으로 내는 모드는 두지 않는다.
 */
export async function readApplicationProfileCli(
  args = process.argv.slice(2),
  options: ReadApplicationProfileOptions = {},
): Promise<unknown> {
  const command = args[0];
  if (!command || ["help", "--help", "-h"].includes(command)) return usage;
  if (command !== "get") throw new Error(usage);

  const out = firstOptionValue(args, "--out");
  if (!out?.trim() || out.startsWith("--")) throw new Error("--out 값이 필요하다. 저장소 밖 경로를 준다.");
  // 요청 전에 경로를 확인해 본문을 받은 뒤 쓸 곳이 없어 버리는 일을 막는다.
  const outPath = assertOutsideRepository(out);

  const { document, tokenExpiresAt } = await readApplicationProfile(options);
  writeAtomically(outPath, document.content);
  return {
    collection: document.collection,
    documentKey: document.documentKey,
    revision: document.revision,
    updatedAt: document.updatedAt,
    tokenExpiresAt,
    out: outPath,
  };
}

/** 오류는 고정 문구, 상태와 code 만 담는다. 응답 본문과 토큰은 담지 않는다. */
export function formatReadApplicationProfileError(error: unknown): string {
  if (error instanceof ApplicationProfileHttpError) {
    return `${error.message} (status=${error.status ?? "none"}, code=${error.code})`;
  }
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  readApplicationProfileCli()
    .then((result) => {
      if (typeof result === "string") process.stdout.write(result);
      else console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(formatReadApplicationProfileError(error));
      process.exit(1);
    });
}
