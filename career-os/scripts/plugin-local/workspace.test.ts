import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { TransportError } from "../career-workspace/transport.ts";
import { resolvePluginWorkspace, runPluginWorkspace } from "./workspace.ts";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "plugin-workspace-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function expectTransportCode(run: Promise<unknown>, code: TransportError["result"]["code"]): Promise<void> {
  const error = await run.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(TransportError);
  expect((error as TransportError).result.code).toBe(code);
}

describe("resolvePluginWorkspace", () => {
  test("설정이 없으면 실행 공간의 기본 작업 폴더와 로컬 모드를 쓴다", () => {
    expect(resolvePluginWorkspace({})).toEqual({
      root: "/workspace/career",
      mode: "local",
      evidenceDir: "/workspace/career/evidence",
    });
  });

  test("CAREER_WORKSPACE_ROOT 를 작업본 위치로 쓴다", () => {
    expect(resolvePluginWorkspace({ CAREER_WORKSPACE_ROOT: " /data/career " }).root).toBe("/data/career");
  });

  test("SSH 대상이 있으면 원격 모드다", () => {
    expect(resolvePluginWorkspace({ CAREER_WORKSPACE_SSH_TARGET: "example" }).mode).toBe("remote");
  });

  test("공백만 있는 값은 없는 값으로 본다", () => {
    expect(resolvePluginWorkspace({
      CAREER_WORKSPACE_ROOT: "   ",
      CAREER_WORKSPACE_SSH_TARGET: " ",
      CAREER_EVIDENCE_DIR: "  ",
    })).toEqual({
      root: "/workspace/career",
      mode: "local",
      evidenceDir: "/workspace/career/evidence",
    });
  });

  test("CAREER_EVIDENCE_DIR 가 있으면 그 경로를 프로젝트 근거 위치로 쓴다", () => {
    expect(resolvePluginWorkspace({ CAREER_EVIDENCE_DIR: " /data/evidence " }).evidenceDir).toBe("/data/evidence");
  });

  test("CAREER_EVIDENCE_DIR 가 없으면 작업본 아래 evidence 를 쓴다", () => {
    expect(resolvePluginWorkspace({ CAREER_WORKSPACE_ROOT: "/data/career" }).evidenceDir).toBe("/data/career/evidence");
  });
});

describe("runPluginWorkspace", () => {
  test("로컬 모드 begin 은 관리 디렉터리를 만들고 원격 상태 파일은 만들지 않는다", async () => {
    const root = path.join(temporaryDirectory(), "workspace");
    const result = await runPluginWorkspace(["begin", "interview-question-prep", "--json"], { CAREER_WORKSPACE_ROOT: root });
    expect(result).toMatchObject({ action: "skill-begin", ok: true, skill: "interview-question-prep", mode: "local", root, noChange: true });
    for (const managedRoot of ["applications", "library", "state"]) {
      expect(existsSync(path.join(root, managedRoot))).toBe(true);
    }
    expect(existsSync(path.join(root, ".career-sync"))).toBe(false);

    const finished = await runPluginWorkspace(["finish", "interview-question-prep", "--json"], { CAREER_WORKSPACE_ROOT: root });
    expect(finished).toMatchObject({ action: "skill-finish", ok: true, mode: "local", root, noChange: true });
    expect(existsSync(path.join(root, ".career-sync"))).toBe(false);
  });

  test("paths 는 작업본 위치와 모드, 프로젝트 근거 위치를 낸다", async () => {
    const root = temporaryDirectory();
    expect(await runPluginWorkspace(["paths", "--json"], { CAREER_WORKSPACE_ROOT: root }))
      .toMatchObject({ action: "paths", ok: true, root, mode: "local", evidenceDir: path.join(root, "evidence") });
  });

  test("관리하지 않는 스킬과 빠진 스킬 이름은 INVALID_MANIFEST 다", async () => {
    const environment = { CAREER_WORKSPACE_ROOT: temporaryDirectory() };
    await expectTransportCode(runPluginWorkspace(["begin", "position-recommender", "--json"], environment), "INVALID_MANIFEST");
    await expectTransportCode(runPluginWorkspace(["begin"], environment), "INVALID_MANIFEST");
    await expectTransportCode(runPluginWorkspace(["sync"], environment), "INVALID_MANIFEST");
  });

  test("원격 모드는 로컬 결과를 내지 않고 원격 transport 오류로 끝난다", async () => {
    const base = temporaryDirectory();
    const root = path.join(base, "workspace");
    const environment = {
      CAREER_WORKSPACE_ROOT: root,
      CAREER_WORKSPACE_SSH_TARGET: "invalid ssh target",
    };
    const error = await runPluginWorkspace(["begin", "interview-question-prep", "--json"], environment)
      .then(() => null, (caught: unknown) => caught);
    expect(error).toBeInstanceOf(TransportError);
    for (const managedRoot of ["applications", "library", "state"]) {
      expect(existsSync(path.join(root, managedRoot))).toBe(false);
    }
  });
});
