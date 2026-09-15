import { expect, test } from "bun:test";
import { groupForPath } from "./store.ts";

test("task 근거는 task 책임 경로로 묶는다", () => {
  expect(groupForPath("career-os/sources/fos-study/task/team/example.md")).toBe(
    "task/team/example.md.json",
  );
});
