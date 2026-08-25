import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { stageDiscordAttachment } from "./stage_attachment.ts";

const tempDirs: string[] = [];

const pngBytes = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1,
  8, 6, 0, 0, 0, 31, 21, 196,
  137,
]);

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

function tempDir(): string {
  const path = mkdtempSync(join(tmpdir(), "accountbook-discord-import-"));
  tempDirs.push(path);
  return path;
}

function writeInput(dir: string, data = pngBytes, name = "capture.png"): string {
  const path = join(dir, name);
  writeFileSync(path, data, { mode: 0o600 });
  return path;
}

function sha256(data = pngBytes): string {
  return createHash("sha256").update(data).digest("hex");
}

function runCli(args: string[]): ReturnType<typeof Bun.spawnSync> {
  return Bun.spawnSync(["bun", "accountbook/scripts/accountbook-discord-import/stage_attachment.ts", ...args], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
}

async function runCliAsync(args: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const proc = Bun.spawn(["bun", "accountbook/scripts/accountbook-discord-import/stage_attachment.ts", ...args], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

describe("stageDiscordAttachment", () => {
  test("Discord PNG를 입력함에 보조 정보 파일과 함께 적재한다", () => {
    const dir = tempDir();
    const privateRoot = join(dir, "private");
    const inputPath = writeInput(dir);

    const result = stageDiscordAttachment({
      inputPath,
      privateRoot,
      receivedAt: new Date("2026-08-20T01:17:53.000Z"),
    });

    expect(result).toEqual({
      status: "staged",
      imageSha256: sha256(),
      imagePath: join(privateRoot, "inbox", "new", `discord-${sha256().slice(0, 16)}.png`),
      manifestPath: join(privateRoot, "inbox", "new", `discord-${sha256().slice(0, 16)}.json`),
    });
    expect(JSON.parse(readFileSync(result.manifestPath, "utf8"))).toEqual({
      schemaVersion: 1,
      source: "hermes-discord",
      imageFile: `discord-${sha256().slice(0, 16)}.png`,
      capturedAt: "2026-08-20T01:17:53.000Z",
      receivedAt: "2026-08-20T01:17:53.000Z",
    });
  });

  test("대상 디렉터리와 파일 권한, 마지막 줄바꿈을 고정한다", () => {
    const dir = tempDir();
    const privateRoot = join(dir, "private");
    const result = stageDiscordAttachment({
      inputPath: writeInput(dir),
      privateRoot,
      receivedAt: new Date("2026-08-20T01:17:53.000Z"),
    });

    expect(statSync(privateRoot).mode & 0o777).toBe(0o700);
    expect(statSync(join(privateRoot, "inbox")).mode & 0o777).toBe(0o700);
    expect(statSync(join(privateRoot, "inbox", "new")).mode & 0o777).toBe(0o700);
    expect(statSync(result.imagePath).mode & 0o777).toBe(0o600);
    expect(statSync(result.manifestPath).mode & 0o777).toBe(0o600);
    expect(readFileSync(result.manifestPath, "utf8").endsWith("\n")).toBe(true);
  });

  test("같은 이미지 해시의 완성된 pair는 수신 시각이 달라도 재적재하지 않는다", () => {
    const dir = tempDir();
    const privateRoot = join(dir, "private");
    const inputPath = writeInput(dir);
    stageDiscordAttachment({
      inputPath,
      privateRoot,
      receivedAt: new Date("2026-08-20T01:17:53.000Z"),
    });

    expect(stageDiscordAttachment({
      inputPath,
      privateRoot,
      receivedAt: new Date("2026-08-21T01:17:53.000Z"),
    }).status)
      .toBe("already_staged");
  });

  test("PNG 확장자나 PNG 서명이 아니면 거부한다", () => {
    const dir = tempDir();
    const privateRoot = join(dir, "private");

    expect(() => stageDiscordAttachment({
      inputPath: writeInput(dir, pngBytes, "capture.jpg"),
      privateRoot,
      receivedAt: new Date("2026-08-20T01:17:53.000Z"),
    })).toThrow("DISCORD_ATTACHMENT_NOT_PNG");
    expect(() => stageDiscordAttachment({
      inputPath: writeInput(dir, Buffer.from("not png"), "capture.png"),
      privateRoot,
      receivedAt: new Date("2026-08-20T01:17:53.000Z"),
    })).toThrow("DISCORD_ATTACHMENT_NOT_PNG");
  });

  test("32 MiB 초과 파일은 거부한다", () => {
    const dir = tempDir();
    const inputPath = writeInput(dir, Buffer.concat([pngBytes, Buffer.alloc(32 * 1024 * 1024)]));

    expect(() => stageDiscordAttachment({
      inputPath,
      privateRoot: join(dir, "private"),
      receivedAt: new Date("2026-08-20T01:17:53.000Z"),
    })).toThrow("DISCORD_ATTACHMENT_TOO_LARGE");
  });

  test("부분 pair나 기존 내용 충돌은 덮어쓰지 않는다", () => {
    const dir = tempDir();
    const privateRoot = join(dir, "private");
    const base = `discord-${sha256().slice(0, 16)}`;
    const newDir = join(privateRoot, "inbox", "new");
    mkdirSync(newDir, { recursive: true, mode: 0o700 });
    writeFileSync(join(newDir, `${base}.json`), "{}\n", { mode: 0o600 });

    expect(() => stageDiscordAttachment({
      inputPath: writeInput(dir),
      privateRoot,
      receivedAt: new Date("2026-08-20T01:17:53.000Z"),
    })).toThrow("DISCORD_INBOX_PAIR_CONFLICT");
    expect(existsSync(join(newDir, `${base}.png`))).toBe(false);
  });

  test("CLI는 원본 이름 없이 상태와 private 경로만 JSON으로 출력한다", () => {
    const dir = tempDir();
    const result = runCli([
      "--input", writeInput(dir, pngBytes, "sensitive-original-name.png"),
      "--private-root", join(dir, "private"),
      "--received-at", "2026-08-20T01:17:53.000Z",
    ]);

    expect(result.exitCode).toBe(0);
    const stdout = new TextDecoder().decode(result.stdout);
    expect(stdout).not.toContain("sensitive-original-name");
    expect(JSON.parse(stdout).status).toBe("staged");
  });

  test("동시에 같은 이미지를 수신해도 하나의 완성된 pair만 남긴다", async () => {
    const dir = tempDir();
    const privateRoot = join(dir, "private");
    const inputPath = writeInput(dir);

    const results = await Promise.all([
      runCliAsync([
        "--input", inputPath,
        "--private-root", privateRoot,
        "--received-at", "2026-08-20T01:17:53.000Z",
      ]),
      runCliAsync([
        "--input", inputPath,
        "--private-root", privateRoot,
        "--received-at", "2026-08-20T01:17:53.000Z",
      ]),
    ]);

    expect(results.map((result) => result.exitCode)).toEqual([0, 0]);
    const statuses = results.map((result) => JSON.parse(result.stdout).status).sort();
    expect(statuses).toEqual(["already_staged", "staged"]);
    const base = `discord-${sha256().slice(0, 16)}`;
    expect(existsSync(join(privateRoot, "inbox", "new", `${base}.png`))).toBe(true);
    expect(existsSync(join(privateRoot, "inbox", "new", `${base}.json`))).toBe(true);
  });
});
