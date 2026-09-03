import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CommandCareerWorkspaceTransport } from "./command-transport.ts";
import { createCareerWorkspaceTransport } from "./cli.ts";
import { LocalCareerWorkspaceTransport } from "./local-transport.ts";
import { SshCareerWorkspaceTransport } from "./ssh-transport.ts";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("command career workspace transport", () => {
  test("status JSON, export byte와 publish stdin을 shell 없이 전달한다", async () => {
    const fixture = await createCommandFixture();
    const transport = new CommandCareerWorkspaceTransport({ command: fixture.command });
    const archive = new Uint8Array([0, 1, 2, 255, 10]);

    expect(await transport.status()).toEqual({
      schemaVersion: 1,
      action: "status",
      ok: true,
      workspace: "career-os",
      current: null,
    });
    expect(await transport.export("rev-1")).toEqual(fixture.exportBody);
    expect(await transport.publish(archive)).toMatchObject({
      schemaVersion: 1,
      action: "publish",
      ok: true,
      revision: "rev-command",
    });
    expect(new Uint8Array(await readFile(fixture.capture))).toEqual(archive);
  });

  test("명령의 구조화 오류를 같은 action과 code로 보존한다", async () => {
    const fixture = await createCommandFixture({ failPublish: true });
    const transport = new CommandCareerWorkspaceTransport({ command: fixture.command });

    await expect(transport.publish(new Uint8Array([1]))).rejects.toMatchObject({
      result: { action: "publish", code: "TRANSFER_FAILED" },
    });
  });

  test("상대 경로, directory, shell 구문과 추가 인자가 섞인 명령 문자열을 거부한다", async () => {
    const fixture = await createCommandFixture();
    const marker = path.join(fixture.root, "injected");
    for (const command of [
      "relative-command",
      fixture.root,
      `${fixture.command};touch ${marker}`,
      `${fixture.command} --extra-argument`,
      `${fixture.command}\nignored`,
    ]) {
      await expect(new CommandCareerWorkspaceTransport({ command }).status()).rejects.toMatchObject({
        result: { action: "status", code: "TRANSPORT_UNAVAILABLE" },
      });
    }
    expect(await exists(marker)).toBe(false);
  });

  test("command, local, SSH 순으로 transport를 선택하고 client는 S3 credential을 요구하지 않는다", async () => {
    const fixture = await createCommandFixture();
    const command = createCareerWorkspaceTransport({
      CAREER_WORKSPACE_COMMAND: fixture.command,
      CAREER_WORKSPACE_LOCAL_TRANSPORT_ROOT: path.join(fixture.root, "local-storage"),
    });
    expect(command).toBeInstanceOf(CommandCareerWorkspaceTransport);
    expect(await command.status()).toMatchObject({ action: "status", ok: true });

    expect(createCareerWorkspaceTransport({
      CAREER_WORKSPACE_LOCAL_TRANSPORT_ROOT: path.join(fixture.root, "local-storage"),
    })).toBeInstanceOf(LocalCareerWorkspaceTransport);
    expect(createCareerWorkspaceTransport({
      CAREER_WORKSPACE_SSH_TARGET: "host",
      CAREER_WORKSPACE_REMOTE_COMMAND: "career-storage",
    })).toBeInstanceOf(SshCareerWorkspaceTransport);
  });

  test("CLI command transport는 client 환경에 S3 credential이 없어도 동작한다", async () => {
    const fixture = await createCommandFixture();
    const environment = { ...process.env };
    delete environment.CAREER_STORAGE_S3_ENDPOINT;
    delete environment.CAREER_STORAGE_S3_BUCKET;
    delete environment.CAREER_STORAGE_S3_ACCESS_KEY;
    delete environment.CAREER_STORAGE_S3_SECRET_KEY;
    environment.CAREER_WORKSPACE_COMMAND = fixture.command;
    environment.CAREER_WORKSPACE_ROOT = path.join(fixture.root, "workspace");
    environment.CAREER_WORKSPACE_ENV_FILE = path.join(fixture.root, "missing.env");
    const proc = Bun.spawn(["bun", path.join(import.meta.dir, "cli.ts"), "check"], {
      env: environment,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({
      action: "check",
      ok: true,
      remote: { action: "status", ok: true },
    });
    expect(stderr).toBe("");
  });
});

interface CommandFixture {
  root: string;
  command: string;
  capture: string;
  exportBody: Uint8Array;
}

async function createCommandFixture(options: { failPublish?: boolean } = {}): Promise<CommandFixture> {
  const root = await createTemporaryRoot("career-command-");
  const command = path.join(root, "career-storage-fixture");
  const capture = path.join(root, "captured.tar");
  const exportFile = path.join(root, "export.tar");
  const exportBody = new Uint8Array([255, 0, 13, 10, 42]);
  await writeFile(exportFile, exportBody);
  await writeFile(command, `#!/bin/sh
case "$1" in
  status)
    printf '%s\\n' '{"schemaVersion":1,"action":"status","ok":true,"workspace":"career-os","current":null}'
    ;;
  export)
    cat '${exportFile}'
    ;;
  publish)
    ${options.failPublish
      ? "printf '%s\\n' '{\"schemaVersion\":1,\"action\":\"publish\",\"ok\":false,\"code\":\"TRANSFER_FAILED\"}' >&2\n    exit 1"
      : `cat > '${capture}'
    printf '%s\\n' '{"schemaVersion":1,"action":"publish","ok":true,"revision":"rev-command","contentDigest":"${"a".repeat(64)}","createdAt":"2026-09-03T00:00:00.000Z","fileCount":1,"noChange":false}'`}
    ;;
esac
`);
  await chmod(command, 0o700);
  return { root, command, capture, exportBody };
}

async function createTemporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}
