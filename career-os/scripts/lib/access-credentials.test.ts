import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accessHeaders, resolveAccessCredentials } from "./access-credentials.ts";
import { resolveCareerBackendConnection } from "./career-backend-config.ts";

const secret = "fake-secret-value-0001";
const id = "fake-id.access";

function secretFile(mode: number, content = `${secret}\n`): string {
  const file = join(mkdtempSync(join(tmpdir(), "access-")), "secret");
  writeFileSync(file, content);
  chmodSync(file, mode);
  return file;
}

function failure(environment: Record<string, string>, prefix: "CAREER_BACKEND" | "FOS_ASSISTANT" = "CAREER_BACKEND"): string {
  try {
    resolveAccessCredentials(environment, prefix);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("실패해야 한다.");
}

describe("resolveAccessCredentials", () => {
  test("값이 모두 없으면 undefined 이고 머리말이 없다", () => {
    expect(resolveAccessCredentials({}, "CAREER_BACKEND")).toBeUndefined();
    expect(accessHeaders(undefined)).toEqual({});
  });

  test("접두사별로 ID 와 secret 을 읽어 머리말을 만든다", () => {
    const env = { FOS_ASSISTANT_ACCESS_CLIENT_ID: ` ${id} `, FOS_ASSISTANT_ACCESS_CLIENT_SECRET: secret };
    const access = resolveAccessCredentials(env, "FOS_ASSISTANT");
    expect(accessHeaders(access)).toEqual({ "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret });
    expect(resolveAccessCredentials(env, "CAREER_BACKEND")).toBeUndefined();
  });

  test("secret 파일은 0600 일 때 읽고 trim 한다", () => {
    const access = resolveAccessCredentials(
      { CAREER_BACKEND_ACCESS_CLIENT_ID: id, CAREER_BACKEND_ACCESS_CLIENT_SECRET_FILE: secretFile(0o600) },
      "CAREER_BACKEND",
    );
    expect(access).toEqual({ clientId: id, clientSecret: secret });
  });

  test("파일 권한이 0600 이 아니면 실패하고 값을 담지 않는다", () => {
    const message = failure({ CAREER_BACKEND_ACCESS_CLIENT_ID: id, CAREER_BACKEND_ACCESS_CLIENT_SECRET_FILE: secretFile(0o644) });
    expect(message).toContain("CAREER_BACKEND_ACCESS_CLIENT_SECRET_FILE");
    expect(message).not.toContain(secret);
  });

  test("ID 만 있거나 secret 만 있으면 실패한다", () => {
    expect(failure({ CAREER_BACKEND_ACCESS_CLIENT_ID: id })).toContain("CAREER_BACKEND_ACCESS_CLIENT_SECRET");
    const message = failure({ CAREER_BACKEND_ACCESS_CLIENT_SECRET: secret });
    expect(message).toContain("CAREER_BACKEND_ACCESS_CLIENT_ID");
    expect(message).not.toContain(secret);
  });

  test("직접 secret 과 파일을 함께 주면 실패한다", () => {
    const message = failure({
      CAREER_BACKEND_ACCESS_CLIENT_ID: id,
      CAREER_BACKEND_ACCESS_CLIENT_SECRET: secret,
      CAREER_BACKEND_ACCESS_CLIENT_SECRET_FILE: secretFile(0o600),
    });
    expect(message).not.toContain(secret);
  });

  test("공백이 든 값은 머리말 주입을 막으려 거절한다", () => {
    const message = failure({ CAREER_BACKEND_ACCESS_CLIENT_ID: id, CAREER_BACKEND_ACCESS_CLIENT_SECRET: "fake secret\nX-Evil: 1" });
    expect(message).toContain("CAREER_BACKEND_ACCESS_CLIENT_SECRET");
    expect(message).not.toContain("X-Evil");
  });
});

describe("resolveCareerBackendConnection 의 access", () => {
  const base = { CAREER_BACKEND_URL: "https://backend.example", CAREER_BACKEND_TOKEN: "t".repeat(40) };

  test("Access 값이 없으면 access 칸이 없다", () => {
    expect("access" in resolveCareerBackendConnection(base)).toBe(false);
  });

  test("Access 값이 있으면 연결값에 실린다", () => {
    const connection = resolveCareerBackendConnection({
      ...base,
      CAREER_BACKEND_ACCESS_CLIENT_ID: id,
      CAREER_BACKEND_ACCESS_CLIENT_SECRET: secret,
    });
    expect(connection.access).toEqual({ clientId: id, clientSecret: secret });
  });

  test("ID 만 있으면 연결 해석이 실패한다", () => {
    expect(() => resolveCareerBackendConnection({ ...base, CAREER_BACKEND_ACCESS_CLIENT_ID: id })).toThrow(
      "CAREER_BACKEND_ACCESS_CLIENT_SECRET",
    );
  });
});
