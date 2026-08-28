import { describe, expect, test } from "bun:test";
import { link, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { revisionSchema } from "./contracts.ts";
import { buildSshInvocationArgs, validateSshConfig } from "./ssh-transport.ts";
import { createTarFromDirectory, safeRemove, validateTarTopLevel } from "./tar-utils.ts";
import { parseRemoteError } from "./transport.ts";

describe("transport safety boundary", () => {
  test("tar에 symlink가 있으면 추출 전에 거부한다", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "career-tar-"));
    try {
      await mkdir(path.join(root, "applications"), { recursive: true });
      await symlink(path.join(root, "applications"), path.join(root, "applications-link"));
      const archive = await createTarFromDirectory(root, ["applications-link"]);

      await expect(validateTarTopLevel(archive, ["applications-link"], "export")).rejects.toMatchObject({
        result: { code: "INVALID_MANIFEST" },
      });
    } finally {
      await safeRemove(root);
    }
  });

  test("tar에 hardlink가 있으면 추출 전에 거부한다", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "career-tar-"));
    try {
      await mkdir(path.join(root, "applications"), { recursive: true });
      await writeFile(path.join(root, "applications", "source.md"), "source");
      await link(path.join(root, "applications", "source.md"), path.join(root, "applications", "hardlink.md"));
      const archive = await createTarFromDirectory(root, ["applications"]);

      await expect(validateTarTopLevel(archive, ["applications"], "export")).rejects.toMatchObject({
        result: { code: "INVALID_MANIFEST" },
      });
    } finally {
      await safeRemove(root);
    }
  });

  test("tar 경로에 절대경로, 현재/상위/빈/control segment가 있으면 거부한다", async () => {
    for (const unsafeName of ["/abs", "../escape", "applications/./x", "applications//x", "applications/bad\u0001x"]) {
      await expect(validateTarTopLevel(makeTarWithName(unsafeName), ["applications"], "export")).rejects.toMatchObject({
        result: { code: "INVALID_MANIFEST" },
      });
    }
  });

  test("tar 최상위 manifest와 managed root의 타입이 계약과 다르면 거부한다", async () => {
    await expect(validateTarTopLevel(
      makeTarWithName("workspace-manifest.json", "5"),
      ["workspace-manifest.json"],
      "export",
    )).rejects.toMatchObject({ result: { code: "INVALID_MANIFEST" } });
    await expect(validateTarTopLevel(
      makeTarWithName("applications", "0"),
      ["applications"],
      "export",
    )).rejects.toMatchObject({ result: { code: "INVALID_MANIFEST" } });
  });

  test("revision은 path traversal과 argv option 형태를 허용하지 않는다", () => {
    expect(() => revisionSchema.parse("rev-1")).not.toThrow();
    expect(() => revisionSchema.parse("../rev-1")).toThrow();
    expect(() => revisionSchema.parse("-oProxyCommand=x")).toThrow();
  });

  test("SSH 설정은 원격 shell 메타문자와 잘못된 target을 거부하고 요청 action을 보존한다", () => {
    expect(() => validateSshConfig({ sshTarget: "host", remoteCommand: "career-storage", sshArgs: ["-p", "10022"] })).not.toThrow();
    expect(() => validateSshConfig({ sshTarget: "-bad", remoteCommand: "career-storage" })).toThrow();
    expect(() => validateSshConfig({ sshTarget: "host", remoteCommand: "career-storage --bad" })).toThrow();
    expect(() => validateSshConfig({ sshTarget: "host;touch", remoteCommand: "career-storage" })).toThrow();
    expect(() => validateSshConfig({ sshTarget: "host", remoteCommand: "career-storage;touch" })).toThrow();
    expect(() => validateSshConfig({ sshTarget: "host", remoteCommand: "career-storage", sshArgs: ["bad\narg"] })).toThrow();
    try {
      validateSshConfig({ sshTarget: "host", remoteCommand: "bad;command" }, "publish");
      throw new Error("expected validation failure");
    } catch (error) {
      expect(error).toMatchObject({ result: { action: "publish", code: "TRANSPORT_UNAVAILABLE" } });
    }
  });

  test("SSH option 종료 표시는 target 앞에 두고 원격 명령 인자에 섞지 않는다", () => {
    expect(buildSshInvocationArgs(
      { sshTarget: "user@example.com", remoteCommand: "/usr/local/bin/career-storage", sshArgs: ["-p", "10022"] },
      ["export", "--revision", "rev-1"],
    )).toEqual([
      "-p",
      "10022",
      "--",
      "user@example.com",
      "/usr/local/bin/career-storage",
      "export",
      "--revision",
      "rev-1",
    ]);
  });

  test("remote error action이 요청 action과 다르면 transport unavailable로 전환할 수 있게 parse를 실패시킨다", () => {
    expect(() => parseRemoteError("publish", JSON.stringify({
      schemaVersion: 1,
      action: "status",
      ok: false,
      code: "REVISION_CONFLICT",
    }))).toThrow("remote error action mismatch");
  });
});

function makeTarWithName(name: string, typeFlag = "0"): Uint8Array {
  const header = new Uint8Array(1024);
  writeTarString(header, 0, 100, name);
  writeTarString(header, 100, 8, "0000644");
  writeTarString(header, 108, 8, "0000000");
  writeTarString(header, 116, 8, "0000000");
  writeTarString(header, 124, 12, "00000000000");
  writeTarString(header, 136, 12, "00000000000");
  for (let index = 148; index < 156; index += 1) {
    header[index] = 32;
  }
  header[156] = typeFlag.charCodeAt(0);
  writeTarString(header, 257, 6, "ustar");
  const checksum = header.subarray(0, 512).reduce((sum, byte) => sum + byte, 0);
  writeTarString(header, 148, 8, checksum.toString(8).padStart(6, "0"));
  header[154] = 0;
  header[155] = 32;
  return header;
}

function writeTarString(buffer: Uint8Array, start: number, length: number, value: string): void {
  const encoded = new TextEncoder().encode(value);
  buffer.set(encoded.subarray(0, length), start);
}
