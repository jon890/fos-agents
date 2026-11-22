import { afterEach, describe, expect, test } from "bun:test";
import { CareerStoreError } from "../lib/career-store/errors.ts";
import { restoreCareerWorkspaceEnv, useCareerWorkspaceEnv } from "../lib/career-store/test-support.ts";
import { formatManageReadingSourcesError, manageReadingSources } from "./manage_reading_sources.ts";

afterEach(restoreCareerWorkspaceEnv);

describe("manage_reading_sources", () => {
  test("help와 template는 저장소를 열지 않고 성공한다", async () => {

    for (const args of [[], ["help"], ["--help"], ["-h"]]) {
      await expect(manageReadingSources(args)).resolves.toContain("사용법:");
    }
    await expect(manageReadingSources([
      "template",
      "--key", "example-test-feed",
      "--title", "예시",
      "--category", "techBlog",
      "--feed-url", "https://example.com/feed.xml",
      "--adapter", "feed",
      "--note", "새 기술 블로그를 수집한다",
    ])).resolves.toEqual({
      sourceKey: "example-test-feed",
      payload: {
        title: "예시",
        category: "techBlog",
        adapter: "feed",
        url: null,
        feedUrl: "https://example.com/feed.xml",
        enabled: true,
        note: "새 기술 블로그를 수집한다",
        expectedVersion: 0,
      },
    });
  });

  test("잘못된 template는 거부한다", async () => {

    await expect(manageReadingSources([
      "template",
      "--key", "example-test-feed",
      "--title", "예시",
      "--category", "invalid-category",
      "--url", "https://example.com/engineering",
      "--adapter", "page",
      "--note", "잘못된 category다",
    ])).rejects.toThrow("Invalid option");
    await expect(manageReadingSources([
      "template",
      "--key", "example-test-feed",
      "--title", "예시",
      "--category", "techBlog",
      "--url", "http://example.com/engineering",
      "--adapter", "page",
      "--note", "HTTPS URL이 아니다",
    ])).rejects.toThrow("HTTPS URL이어야 한다.");
  });

  test("저장소 명령은 작업 폴더의 소스를 추가하고 고치고 끄고 켠다", async () => {
    useCareerWorkspaceEnv();
    const add = ["add", "--key", "source-1", "--title", "예시", "--category", "techBlog", "--url", "https://example.com", "--adapter", "page", "--note", "추가"];
    expect(await manageReadingSources(add)).toMatchObject({ version: 1, source: { sourceKey: "source-1", enabled: true } });
    expect(await manageReadingSources(["update", "--key", "source-1", "--title", "새 제목", "--note", "수정"])).toMatchObject({ version: 2, source: { title: "새 제목" } });
    expect(await manageReadingSources(["disable", "--key", "source-1", "--note", "중지"])).toMatchObject({ version: 3, source: { enabled: false } });
    expect(await manageReadingSources(["enable", "--key", "source-1", "--note", "복구"])).toMatchObject({ version: 4, source: { enabled: true } });
    expect(await manageReadingSources(["list"])).toEqual([
      { sourceKey: "source-1", title: "새 제목", category: "techBlog", url: "https://example.com", feedUrl: null, adapter: "page", enabled: true, note: "복구", version: 4 },
    ]);
  });

  test("없는 소스와 바꿀 것이 없는 update 는 거부한다", async () => {
    useCareerWorkspaceEnv();
    await expect(manageReadingSources(["disable", "--key", "missing", "--note", "중지"])).rejects.toThrow("소스를 찾을 수 없다: missing");
    await manageReadingSources(["add", "--key", "source-1", "--title", "예시", "--category", "techBlog", "--url", "https://example.com", "--adapter", "page", "--note", "추가"]);
    await expect(manageReadingSources(["update", "--key", "source-1", "--note", "수정"])).rejects.toThrow("update할 필드가 하나 이상 필요하다.");
  });

  test("disable에 --note가 없으면 저장하기 전에 거부한다", async () => {
    useCareerWorkspaceEnv();
    await expect(manageReadingSources(["disable", "--key", "source-1"]))
      .rejects.toThrow("--note 값이 필요하다.");
  });
});

describe("오류 출력", () => {
  test("저장소 오류는 code 를 앞에 낸다", () => {
    const error = new CareerStoreError(503, "CAREER_STORE_BUSY", "다른 실행이 쓰고 있습니다.");
    expect(formatManageReadingSourcesError(error)).toBe("CAREER_STORE_BUSY: 다른 실행이 쓰고 있습니다.");
  });

  test("다른 오류는 message 만 낸다", () => {
    expect(formatManageReadingSourcesError(new Error("--key 값이 필요하다."))).toBe("--key 값이 필요하다.");
  });
});
