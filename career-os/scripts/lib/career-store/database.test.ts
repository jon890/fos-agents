import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  careerStorePath,
  closeCareerStores,
  openCareerStore,
  resolveCareerStoreRoot,
} from "./database.ts";
import { CareerStoreError } from "./errors.ts";

const roots: string[] = [];
function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), "career-store-test-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  closeCareerStores();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("커리어 데이터 파일", () => {
  test("작업 폴더 루트는 환경값이 있으면 그 경로, 없으면 /workspace/career 다", () => {
    expect(resolveCareerStoreRoot({ CAREER_WORKSPACE_ROOT: " /tmp/career " })).toBe("/tmp/career");
    expect(resolveCareerStoreRoot({})).toBe("/workspace/career");
  });

  test("파일이 없으면 빈 상태로 만들고, 다시 열어도 데이터가 남는다", () => {
    const root = workspace();
    const first = openCareerStore({ CAREER_WORKSPACE_ROOT: root });
    expect(existsSync(careerStorePath(root))).toBe(true);
    expect(
      first.get("SELECT history_version FROM study_recommendation_control WHERE singleton_id = 1"),
    ).toEqual({ history_version: 0 });
    first.run("INSERT INTO position_sources (source_key, enabled) VALUES (?, ?)", ["wanted", true]);
    closeCareerStores();

    const second = openCareerStore({ CAREER_WORKSPACE_ROOT: root });
    expect(second.all("SELECT source_key, enabled FROM position_sources")).toEqual([
      { source_key: "wanted", enabled: 1 },
    ]);
    expect(second.get("PRAGMA user_version")).toEqual({ user_version: 1 });
  });

  test("깨진 파일은 덮어쓰지 않고 CAREER_STORE_CORRUPT 로 끝낸다", () => {
    const root = workspace();
    mkdirSync(join(root, "state"), { recursive: true });
    const garbage = "이 파일은 SQLite 가 아니다\n".repeat(200);
    writeFileSync(careerStorePath(root), garbage);

    let thrown: unknown;
    try {
      openCareerStore({ CAREER_WORKSPACE_ROOT: root });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CareerStoreError);
    expect((thrown as CareerStoreError).code).toBe("CAREER_STORE_CORRUPT");
    expect(readFileSync(careerStorePath(root), "utf8")).toBe(garbage);
  });

  test("더 새 실행기가 만든 파일은 깨졌다고 하지 않고 SCHEMA_NEWER 로 끝낸다", () => {
    const root = workspace();
    openCareerStore({ CAREER_WORKSPACE_ROOT: root }).raw.exec("PRAGMA user_version = 99");
    closeCareerStores();
    expect(() => openCareerStore({ CAREER_WORKSPACE_ROOT: root })).toThrow(
      expect.objectContaining({ code: "CAREER_STORE_SCHEMA_NEWER" }),
    );
  });

  test("다른 연결이 쓰는 동안에는 기다리다 CAREER_STORE_BUSY 로 끝낸다", async () => {
    const root = workspace();
    const store = openCareerStore({ CAREER_WORKSPACE_ROOT: root }, { busyTimeoutMs: 50 });
    const other = new Database(careerStorePath(root));
    other.exec("BEGIN IMMEDIATE");
    try {
      const attempt = store.transaction(async () => "쓰기");
      await expect(attempt).rejects.toMatchObject({ code: "CAREER_STORE_BUSY" });
    } finally {
      other.exec("ROLLBACK");
      other.close();
    }
    expect(await store.transaction(async () => "쓰기")).toBe("쓰기");
  });

  test("transaction 안에서 던지면 쓴 것을 되돌린다", async () => {
    const store = openCareerStore({ CAREER_WORKSPACE_ROOT: workspace() });
    await expect(
      store.transaction(async () => {
        store.run("INSERT INTO position_sources (source_key, enabled) VALUES ('a', 1)");
        throw new Error("실패");
      }),
    ).rejects.toThrow("실패");
    expect(store.all("SELECT source_key FROM position_sources")).toEqual([]);
  });
});
