import { describe, expect, test } from "bun:test";
import path from "node:path";
import {
  runCareerStorageS3,
} from "../career-storage-s3.ts";
import { TransportError, type CareerWorkspaceTransport } from "../transport.ts";

describe("career-storage S3 entrypoint", () => {
  test("status, export와 publish를 기존 transport 계약으로 전달한다", async () => {
    const transport = new RecordingTransport();
    const archive = new Uint8Array([0, 1, 2, 255]);

    expect(await runCareerStorageS3(["status"], { transport })).toMatchObject({
      action: "status",
      ok: true,
      current: null,
    });
    expect(await runCareerStorageS3(["export", "--revision", "rev-1"], { transport })).toEqual(
      transport.exportBody,
    );
    expect(await runCareerStorageS3(["publish"], {
      transport,
      environment: { CAREER_STORAGE_MAX_ARCHIVE_BYTES: "4" },
      input: byteStream([archive.subarray(0, 2), archive.subarray(2)]),
    })).toMatchObject({ action: "publish", revision: "rev-published", ok: true });
    expect(transport.publishedArchive).toEqual(archive);
  });

  test("크기 제한을 넘거나 빈 publish 입력이면 transport에 byte를 전달하지 않는다", async () => {
    const transport = new RecordingTransport();

    await expect(runCareerStorageS3(["publish"], {
      transport,
      environment: { CAREER_STORAGE_MAX_ARCHIVE_BYTES: "4" },
      input: byteStream([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]),
    })).rejects.toMatchObject({
      result: { action: "publish", code: "TRANSFER_FAILED" },
    });
    expect(transport.publishCalls).toBe(0);

    await expect(runCareerStorageS3(["publish"], {
      transport,
      environment: { CAREER_STORAGE_MAX_ARCHIVE_BYTES: "4" },
      input: byteStream([]),
    })).rejects.toMatchObject({
      result: { action: "publish", code: "TRANSFER_FAILED" },
    });
    expect(transport.publishCalls).toBe(0);

    await expect(runCareerStorageS3(["publish"], {
      transport,
      environment: { CAREER_STORAGE_MAX_ARCHIVE_BYTES: "4" },
      input: new ReadableStream({
        start(controller) {
          controller.error(new Error("input failed"));
        },
      }),
    })).rejects.toMatchObject({
      result: { action: "publish", code: "TRANSFER_FAILED" },
    });
    expect(transport.publishCalls).toBe(0);
  });

  test("허용하지 않은 인자와 잘못된 크기 설정을 구조화 오류로 거부한다", async () => {
    const transport = new RecordingTransport();
    await expect(runCareerStorageS3(["status", "extra"], { transport })).rejects.toMatchObject({
      result: { action: "status", code: "INVALID_MANIFEST" },
    });
    await expect(runCareerStorageS3(["export", "--revision", "../bad"], { transport })).rejects.toMatchObject({
      result: { action: "export", code: "INVALID_MANIFEST" },
    });
    await expect(runCareerStorageS3(["publish"], {
      transport,
      environment: { CAREER_STORAGE_MAX_ARCHIVE_BYTES: "not-a-number" },
      input: byteStream([new Uint8Array([1])]),
    })).rejects.toMatchObject({
      result: { action: "publish", code: "TRANSPORT_UNAVAILABLE" },
    });
  });

  test("프로세스는 path-style S3 status 성공을 stdout에만 기록한다", async () => {
    const requests: Array<{ method: string; pathname: string }> = [];
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        requests.push({ method: request.method, pathname: url.pathname });
        return new Response(null, { status: 404 });
      },
    });
    try {
      const proc = Bun.spawn(["bun", path.join(import.meta.dir, "../career-storage-s3.ts"), "status"], {
        env: {
          ...process.env,
          CAREER_STORAGE_S3_ENDPOINT: server.url.origin,
          CAREER_STORAGE_S3_BUCKET: "career-os",
          CAREER_STORAGE_S3_ACCESS_KEY: "test-access-key",
          CAREER_STORAGE_S3_SECRET_KEY: "test-secret-key",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toMatchObject({ action: "status", ok: true, current: null });
      expect(stderr).toBe("");
      expect(requests).toContainEqual({ method: "HEAD", pathname: "/career-os/pointers/current.json" });
    } finally {
      server.stop(true);
    }
  });

  test("프로세스 실패는 stdout을 비우고 구조화 오류만 stderr에 기록한다", async () => {
    const accessKey = "process-access-key";
    const secretKey = "process-secret-key";
    const proc = Bun.spawn(["bun", path.join(import.meta.dir, "../career-storage-s3.ts"), "status", "extra"], {
      env: {
        ...process.env,
        CAREER_STORAGE_S3_ENDPOINT: "not-a-url",
        CAREER_STORAGE_S3_BUCKET: "career-os",
        CAREER_STORAGE_S3_ACCESS_KEY: accessKey,
        CAREER_STORAGE_S3_SECRET_KEY: secretKey,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(JSON.parse(stderr)).toEqual({
      schemaVersion: 1,
      action: "status",
      ok: false,
      code: "INVALID_MANIFEST",
    });
    expect(stderr).not.toContain(accessKey);
    expect(stderr).not.toContain(secretKey);
  });
});

class RecordingTransport implements CareerWorkspaceTransport {
  readonly exportBody = new Uint8Array([9, 8, 7, 0, 255]);
  publishedArchive: Uint8Array | undefined;
  publishCalls = 0;

  async status() {
    return {
      schemaVersion: 1 as const,
      action: "status" as const,
      ok: true as const,
      workspace: "career-os" as const,
      current: null,
    };
  }

  async export(): Promise<Uint8Array> {
    return this.exportBody.slice();
  }

  async publish(archive: Uint8Array) {
    this.publishCalls += 1;
    this.publishedArchive = archive.slice();
    return {
      schemaVersion: 1 as const,
      action: "publish" as const,
      ok: true as const,
      revision: "rev-published",
      contentDigest: "a".repeat(64),
      createdAt: "2026-09-03T00:00:00.000Z",
      fileCount: 1,
      noChange: false,
    };
  }
}

function byteStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}
