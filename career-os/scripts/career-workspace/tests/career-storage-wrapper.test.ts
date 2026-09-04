import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const wrapper = path.join(import.meta.dir, "../career-storage");
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("career-storage publish lock wrapper", () => {
  test("status와 export는 flock을 거치지 않고 실행 파일에 직접 전달한다", async () => {
    const fixture = await createWrapperFixture();
    const environment = wrapperEnvironment(fixture, { FAKE_FLOCK_CONFLICT: "1" });

    const status = await runWrapper(["status"], environment);
    expect(status.exitCode).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({ action: "status", ok: true });

    const exported = await runWrapper(["export", "--revision", "rev-1"], environment);
    expect(exported.exitCode).toBe(0);
    expect(exported.stdoutBytes).toEqual(fixture.exportBody);
  });

  test("publish는 flock 인자 배열 안에서 stdin byte를 그대로 전달한다", async () => {
    const fixture = await createWrapperFixture();
    const archive = new Uint8Array([0, 1, 2, 255, 10]);

    const result = await runWrapper(["publish"], wrapperEnvironment(fixture), archive);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ action: "publish", ok: true });
    expect(new Uint8Array(await readFile(fixture.capture))).toEqual(archive);
    expect(await readFile(fixture.flockArguments, "utf8")).toBe(
      "--nonblock\n9\n",
    );
  });

  test("publish 잠금 충돌은 REVISION_CONFLICT 구조화 오류를 반환한다", async () => {
    const fixture = await createWrapperFixture();

    const result = await runWrapper(
      ["publish"],
      wrapperEnvironment(fixture, { FAKE_FLOCK_CONFLICT: "1" }),
      new Uint8Array([1]),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      schemaVersion: 1,
      action: "publish",
      ok: false,
      code: "REVISION_CONFLICT",
    });
  });

  test("실행 파일 누락과 shell 구문이 섞인 실행 파일 값은 실행하지 않는다", async () => {
    const fixture = await createWrapperFixture();
    const marker = path.join(fixture.root, "injected");
    for (const executable of [
      path.join(fixture.root, "missing"),
      `${fixture.executable};touch ${marker}`,
      `${fixture.executable} --extra`,
    ]) {
      const result = await runWrapper(["status"], {
        ...wrapperEnvironment(fixture),
        CAREER_STORAGE_S3_EXECUTABLE: executable,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(JSON.parse(result.stderr)).toMatchObject({
        action: "status",
        code: "TRANSPORT_UNAVAILABLE",
      });
    }
    expect(await exists(marker)).toBe(false);
  });
});

interface WrapperFixture {
  root: string;
  executable: string;
  capture: string;
  exportBody: Uint8Array;
  lockFile: string;
  fakeBin: string;
  flockArguments: string;
}

async function createWrapperFixture(): Promise<WrapperFixture> {
  const root = await createTemporaryRoot("career-wrapper-");
  const executable = path.join(root, "career-storage-s3");
  const capture = path.join(root, "captured.tar");
  const exportFile = path.join(root, "export.tar");
  const exportBody = new Uint8Array([3, 2, 1, 0, 255]);
  const lockFile = path.join(root, "publish.lock");
  const fakeBin = path.join(root, "bin");
  const flockArguments = path.join(root, "flock-arguments.txt");
  await mkdir(fakeBin);
  await writeFile(exportFile, exportBody);
  await writeFile(executable, `#!/bin/sh
case "$1" in
  status)
    printf '%s\\n' '{"schemaVersion":1,"action":"status","ok":true,"workspace":"career-os","current":null}'
    ;;
  export)
    cat '${exportFile}'
    ;;
  publish)
    cat > '${capture}'
    printf '%s\\n' '{"schemaVersion":1,"action":"publish","ok":true,"revision":"rev-wrapper","contentDigest":"${"a".repeat(64)}","createdAt":"2026-09-03T00:00:00.000Z","fileCount":1,"noChange":false}'
    ;;
esac
`);
  await chmod(executable, 0o700);
  const fakeFlock = path.join(fakeBin, "flock");
  await writeFile(fakeFlock, `#!/bin/sh
printf '%s\\n' "$@" > '${flockArguments}'
if [ "\${FAKE_FLOCK_CONFLICT-}" = 1 ]; then
  exit 1
fi
`);
  await chmod(fakeFlock, 0o700);
  return { root, executable, capture, exportBody, lockFile, fakeBin, flockArguments };
}

function wrapperEnvironment(
  fixture: WrapperFixture,
  overrides: Readonly<Record<string, string>> = {},
): Record<string, string | undefined> {
  return {
    ...process.env,
    PATH: `${fixture.fakeBin}:${process.env.PATH ?? ""}`,
    CAREER_STORAGE_S3_EXECUTABLE: fixture.executable,
    CAREER_STORAGE_LOCK_FILE: fixture.lockFile,
    ...overrides,
  };
}

async function runWrapper(
  args: string[],
  environment: Record<string, string | undefined>,
  stdin?: Uint8Array,
): Promise<{ exitCode: number; stdout: string; stdoutBytes: Uint8Array; stderr: string }> {
  const proc = Bun.spawn([wrapper, ...args], {
    env: environment,
    stdin: stdin ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (stdin && proc.stdin) {
    await proc.stdin.write(stdin);
    await proc.stdin.end();
  }
  const [stdoutBytes, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).bytes(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return {
    exitCode,
    stdout: new TextDecoder().decode(stdoutBytes),
    stdoutBytes,
    stderr,
  };
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
