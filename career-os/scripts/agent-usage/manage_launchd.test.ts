import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { XMLParser } from "fast-xml-parser";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LAUNCHD_LABEL, manageLaunchd, renderPlist, type LaunchdDeps } from "./manage_launchd.ts";

const templatePath = join(import.meta.dir, "launchd", "agent-usage.plist.template");
const template = readFileSync(templatePath, "utf8");
const values = { bunPath: "/opt/example/bin/bun", repoRoot: "/opt/example/repo", logDir: "/opt/example/logs" };

type Node = Record<string, unknown>;

/** preserveOrder 로 파싱한 dict 를 키와 값의 짝으로 바꾼다. */
function dictToMap(dict: Node[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (let i = 0; i < dict.length; i += 2) {
    const key = ((dict[i]!.key as Node[])[0] as Node)["#text"] as string;
    map.set(key, dict[i + 1]);
  }
  return map;
}

function parsePlist(xml: string): Map<string, unknown> {
  const parsed = new XMLParser({ preserveOrder: true, ignoreAttributes: true }).parse(xml) as Node[];
  const plist = parsed.find((node) => "plist" in node)!.plist as Node[];
  return dictToMap((plist[0]!.dict as Node[]));
}

function textOf(node: unknown, tag: string): string {
  return String((((node as Node)[tag] as Node[])[0] as Node)["#text"]);
}

describe("plist 틀", () => {
  const rendered = renderPlist(template, values);

  test("자리표시자가 남지 않는다", () => {
    expect(rendered).not.toContain("{{");
  });

  test("연결값과 외부 주소가 없다", () => {
    expect(rendered).not.toMatch(/CAREER_BACKEND|TOKEN/);
    expect(template).not.toMatch(/CAREER_BACKEND|TOKEN/);
    const body = rendered.split("\n").filter((line) => !line.startsWith("<!DOCTYPE"));
    expect(body.join("\n")).not.toContain("http");
    expect(template).not.toContain("/Users/");
  });

  test("Label 이 상수와 같다", () => {
    expect(textOf(parsePlist(rendered).get("Label"), "string")).toBe(LAUNCHD_LABEL);
  });

  test("ProgramArguments 가 순서대로 bun, env 파일, 수집기다", () => {
    const array = (parsePlist(rendered).get("ProgramArguments") as Node).array as Node[];
    expect(array.map((item) => textOf(item, "string"))).toEqual([
      "/opt/example/bin/bun",
      "--env-file=/opt/example/repo/career-os/.env",
      "/opt/example/repo/career-os/scripts/agent-usage/collect_usage.ts",
    ]);
  });

  test("매일 10시 0분이고 RunAtLoad 가 꺼져 있다", () => {
    const map = parsePlist(rendered);
    const interval = dictToMap((map.get("StartCalendarInterval") as Node).dict as Node[]);
    expect(textOf(interval.get("Hour"), "integer")).toBe("10");
    expect(textOf(interval.get("Minute"), "integer")).toBe("0");
    expect(map.get("RunAtLoad")).toHaveProperty("false");
  });

  test("& 가 든 경로도 파싱된다", () => {
    const xml = renderPlist(template, { ...values, repoRoot: "/opt/a&b/repo" });
    const array = (parsePlist(xml).get("ProgramArguments") as Node).array as Node[];
    expect(textOf(array[1], "string")).toBe("--env-file=/opt/a&b/repo/career-os/.env");
  });

  test("상대 경로는 던진다", () => {
    expect(() => renderPlist(template, { ...values, repoRoot: "relative/repo" })).toThrow();
  });
});

describe("manageLaunchd", () => {
  let home: string;
  let repoRoot: string;
  let calls: string[][];
  let output: string[];
  let status: number;
  let deps: LaunchdDeps;
  const uid = 501;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "launchd-home-"));
    repoRoot = mkdtempSync(join(tmpdir(), "launchd-repo-"));
    calls = [];
    output = [];
    status = 0;
    deps = {
      home,
      uid,
      repoRoot,
      bunPath: "/opt/example/bin/bun",
      run: (command, args) => {
        calls.push([command, ...args]);
        return { status, stdout: "" };
      },
      write: (line) => output.push(line),
    };
  });

  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(repoRoot, { recursive: true, force: true });
  });

  const plistPath = () => join(home, "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`);
  const makeEnv = () => {
    mkdirSync(join(repoRoot, "career-os"), { recursive: true });
    writeFileSync(join(repoRoot, "career-os", ".env"), "");
  };

  test("install --dry-run 은 .env 없이도 0 이고 아무것도 쓰지 않고 실행하지 않는다", () => {
    expect(manageLaunchd(["install", "--dry-run"], deps)).toBe(0);
    expect(calls).toHaveLength(0);
    expect(existsSync(join(home, "Library"))).toBe(false);
    const text = output.join("\n");
    expect(text).toContain(plistPath());
    expect(text).toContain(`launchctl bootstrap gui/${uid}`);
  });

  test("uninstall --dry-run 은 plist 를 남기고 실행하지 않는다", () => {
    mkdirSync(join(home, "Library", "LaunchAgents"), { recursive: true });
    writeFileSync(plistPath(), "x");
    expect(manageLaunchd(["uninstall", "--dry-run"], deps)).toBe(0);
    expect(existsSync(plistPath())).toBe(true);
    expect(calls).toHaveLength(0);
  });

  test("install 은 plist 를 쓰고 bootout 뒤 bootstrap 을 실행한다", () => {
    makeEnv();
    expect(manageLaunchd(["install"], deps)).toBe(0);
    expect(existsSync(plistPath())).toBe(true);
    expect(calls).toEqual([
      ["launchctl", "bootout", `gui/${uid}/${LAUNCHD_LABEL}`],
      ["launchctl", "bootstrap", `gui/${uid}`, plistPath()],
    ]);
  });

  test("install 은 .env 가 없으면 1 이고 아무것도 만들지 않는다", () => {
    expect(manageLaunchd(["install"], deps)).toBe(1);
    expect(existsSync(plistPath())).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test("uninstall 은 plist 를 지우고 다시 실행해도 0 이다", () => {
    makeEnv();
    manageLaunchd(["install"], deps);
    expect(manageLaunchd(["uninstall"], deps)).toBe(0);
    expect(existsSync(plistPath())).toBe(false);
    expect(manageLaunchd(["uninstall"], deps)).toBe(0);
  });

  test("status 는 launchctl 결과에 따라 LOADED 나 NOT_LOADED 를 낸다", () => {
    status = 0;
    expect(manageLaunchd(["status"], deps)).toBe(0);
    expect(output).toContain("LOADED");
    output.length = 0;
    status = 1;
    expect(manageLaunchd(["status"], deps)).toBe(0);
    expect(output).toContain("NOT_LOADED");
    expect(output).toContain("PLIST_MISSING");
  });

  test("모르는 명령은 2 다", () => {
    expect(manageLaunchd(["bogus"], deps)).toBe(2);
  });
});
