import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { PLUGIN_LOCAL_EXECUTORS } from "./executors.ts";
import { runPluginLocal } from "./main.ts";

let savedArgv: string[];
let logged: string[];
let errored: string[];
let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  savedArgv = [...process.argv];
  logged = [];
  errored = [];
  logSpy = spyOn(console, "log").mockImplementation((...values: unknown[]) => { logged.push(values.join(" ")); });
  errorSpy = spyOn(console, "error").mockImplementation((...values: unknown[]) => { errored.push(values.join(" ")); });
});

afterEach(() => {
  process.argv = savedArgv;
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

test("help 는 여섯 실행기를 모두 보여 주고 0 으로 끝난다", async () => {
  expect(await runPluginLocal(["help"])).toBe(0);
  const output = logged.join("\n");
  for (const name of PLUGIN_LOCAL_EXECUTORS) expect(output).toContain(name);
});

test("인자가 없으면 help 와 같다", async () => {
  expect(await runPluginLocal([])).toBe(0);
  expect(logged.join("\n")).toContain("study-validate");
});

test("모르는 실행기는 사용법과 함께 2 로 끝난다", async () => {
  expect(await runPluginLocal(["nope"])).toBe(2);
  expect(errored.join("\n")).toContain("nope");
});

test("interview 는 select 가 아니면 MCP 도구를 안내하고 2 로 끝난다", async () => {
  expect(await runPluginLocal(["interview", "record"])).toBe(2);
  expect(errored.join("\n")).toContain("save_interview_attempt");
  expect(process.argv.slice(2)).toEqual(["record"]);
});
