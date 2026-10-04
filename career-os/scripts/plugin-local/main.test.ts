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

test("help 는 열한 실행기를 모두 보여 주고 0 으로 끝난다", async () => {
  expect(await runPluginLocal(["help"])).toBe(0);
  const output = logged.join("\n");
  expect(PLUGIN_LOCAL_EXECUTORS).toHaveLength(11);
  for (const name of PLUGIN_LOCAL_EXECUTORS) expect(output).toContain(name);
  expect(output).toContain("position");
  expect(output).toContain("commit-company-tiers");
  expect(output).toContain("resume");
  expect(output).toContain("search-claims");
  expect(output).toMatch(/^ {2}package +/m);
  expect(output).toMatch(/^ {2}application-profile +/m);
  expect(output).toMatch(/^ {2}usage +기록이 없는 끝난 달의 에이전트 사용량을 측정해 Backend 에 올린다$/m);
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

test("position 은 모르는 하위 명령이면 도움말과 메시지를 stderr 에 쓰고 2 로 끝난다", async () => {
  expect(await runPluginLocal(["position", "nope"])).toBe(2);
  const output = errored.join("\n");
  expect(output).toContain("모르는 하위 명령입니다: nope");
  expect(output).toContain("commit-analyses");
  expect(process.argv.slice(2)).toEqual(["nope"]);
});

test("resume 은 하위 명령이 없으면 하위 명령 목록을 stderr 에 쓰고 2 로 끝난다", async () => {
  expect(await runPluginLocal(["resume"])).toBe(2);
  const output = errored.join("\n");
  for (const command of ["export", "check-html", "validate-ledger", "assess-reuse", "search-claims", "promote-claims", "build-bundle", "validate-bundle"]) {
    expect(output).toContain(command);
  }
});

test("resume 은 모르는 하위 명령이면 하위 명령 목록과 함께 2 로 끝난다", async () => {
  expect(await runPluginLocal(["resume", "nope"])).toBe(2);
  const output = errored.join("\n");
  expect(output).toContain("모르는 하위 명령입니다: nope");
  expect(output).toContain("search-claims");
});

test("package 는 모르는 하위 명령이면 사용법을 stderr 에 쓰고 2 로 끝난다", async () => {
  expect(await runPluginLocal(["package", "nope"])).toBe(2);
  const output = errored.join("\n");
  expect(output).toContain("모르는 하위 명령입니다: nope");
  for (const command of ["check-sources", "validate", "render", "question-schema"]) {
    expect(output).toContain(command);
  }
});

test("application-profile 은 get 이 아닌 하위 명령이면 사용법을 stderr 에 쓰고 1 로 끝난다", async () => {
  expect(await runPluginLocal(["application-profile", "put"])).toBe(1);
  const output = errored.join("\n");
  expect(output).toContain("get --out <path>");
  expect(logged).toEqual([]);
});
