import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { loadConfig } from "./config.js";

const token = "t".repeat(32);

describe("recommendation-api config", () => {
  test("loopback host와 안전한 기본값을 사용한다", () => {
    const config = loadConfig({
      CAREER_RECOMMENDATION_DATABASE_URL: "mysql://user:secret@db/fos_career",
      CAREER_RECOMMENDATION_API_TOKEN: token,
    });
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(4318);
    expect(config.maxBodyBytes).toBe(2 * 1024 * 1024);
  });

  test("infra 운영 계약의 API_HOST와 API_PORT를 읽는다", () => {
    const config = loadConfig({
      CAREER_RECOMMENDATION_DATABASE_URL: "mysql://user:secret@db/fos_career",
      CAREER_RECOMMENDATION_API_TOKEN: token,
      API_HOST: "0.0.0.0",
      API_PORT: "8080",
    });
    expect(config.host).toBe("0.0.0.0");
    expect(config.port).toBe(8080);
  });

  test("오류에 token과 database URL을 포함하지 않는다", () => {
    expect(() =>
      loadConfig({
        CAREER_RECOMMENDATION_DATABASE_URL: "mysql://user:secret@db/fos_career",
        CAREER_RECOMMENDATION_API_TOKEN: "short-secret",
      }),
    ).toThrow("추천 API 환경 설정을 읽거나 검증할 수 없습니다.");
    try {
      loadConfig({
        CAREER_RECOMMENDATION_DATABASE_URL: "mysql://user:secret@db/fos_career",
        CAREER_RECOMMENDATION_API_TOKEN: "short-secret",
      });
    } catch (error) {
      expect(String(error)).not.toContain("short-secret");
      expect(String(error)).not.toContain("mysql://");
    }
  });

  test("운영 DB 설정과 mode 600 token 파일을 읽는다", () => {
    const directory = mkdtempSync(join(tmpdir(), "recommendation-config-"));
    const path = join(directory, "token");
    try {
      writeFileSync(path, token);
      chmodSync(path, 0o600);
      const config = loadConfig({
        DB_HOST: "mysql",
        DB_PORT: "3306",
        DB_NAME: "fos_career",
        DB_USERNAME: "career",
        DB_PASSWORD: "p@ss word",
        CAREER_RECOMMENDATION_API_TOKEN_FILE: path,
      });
      expect(config.databaseUrl).toContain("career:p%40ss%20word@mysql:3306/fos_career");
      expect(config.apiToken).toBe(token);
      chmodSync(path, 0o644);
      expect(() =>
        loadConfig({
          CAREER_RECOMMENDATION_DATABASE_URL: "mysql://local/fos_career",
          CAREER_RECOMMENDATION_API_TOKEN_FILE: path,
        }),
      ).toThrow("token 파일을 읽거나 검증할 수 없습니다");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("개발용과 운영용 DB 설정을 함께 주면 실패한다", () => {
    expect(() =>
      loadConfig({
        CAREER_RECOMMENDATION_DATABASE_URL: "mysql://local/fos_career",
        DB_HOST: "mysql",
        DB_NAME: "fos_career",
        DB_USERNAME: "career",
        DB_PASSWORD: "secret",
        CAREER_RECOMMENDATION_API_TOKEN: token,
      }),
    ).toThrow("database 설정 형식을 하나만");
  });
});
