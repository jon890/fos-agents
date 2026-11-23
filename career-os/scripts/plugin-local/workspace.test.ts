import { describe, expect, test } from "bun:test";
import { UsageError } from "../lib/cli.ts";
import { resolvePluginWorkspace, runPluginWorkspace } from "./workspace.ts";

describe("resolvePluginWorkspace", () => {
  test("설정이 없으면 실행 공간의 기본 작업 폴더를 쓴다", () => {
    expect(resolvePluginWorkspace({})).toEqual({ root: "/workspace/career", evidenceDir: "/workspace/career/evidence" });
  });

  test("CAREER_WORKSPACE_ROOT 를 작업 폴더 위치로 쓴다", () => {
    expect(resolvePluginWorkspace({ CAREER_WORKSPACE_ROOT: " /data/career " }).root).toBe("/data/career");
  });

  test("공백만 있는 값은 없는 값으로 본다", () => {
    expect(resolvePluginWorkspace({ CAREER_WORKSPACE_ROOT: "   ", CAREER_EVIDENCE_DIR: "  " })).toEqual({
      root: "/workspace/career",
      evidenceDir: "/workspace/career/evidence",
    });
  });

  test("CAREER_EVIDENCE_DIR 가 있으면 그 경로를 프로젝트 근거 위치로 쓴다", () => {
    expect(resolvePluginWorkspace({ CAREER_EVIDENCE_DIR: " /data/evidence " }).evidenceDir).toBe("/data/evidence");
  });

  test("CAREER_EVIDENCE_DIR 가 없으면 작업 폴더 아래 evidence 를 쓴다", () => {
    expect(resolvePluginWorkspace({ CAREER_WORKSPACE_ROOT: "/data/career" }).evidenceDir).toBe("/data/career/evidence");
  });

  test("지운 동기화 설정은 결과를 바꾸지 않는다", () => {
    expect(resolvePluginWorkspace({ CAREER_WORKSPACE_ROOT: "/data/career", CAREER_WORKSPACE_SSH_TARGET: "example" })).toEqual({
      root: "/data/career",
      evidenceDir: "/data/career/evidence",
    });
  });
});

describe("runPluginWorkspace", () => {
  test("paths 는 작업 폴더와 프로젝트 근거 위치를 내고 동기화 모드를 내지 않는다", () => {
    expect(runPluginWorkspace(["paths", "--json"], { CAREER_WORKSPACE_ROOT: "/data/career" })).toEqual({
      schemaVersion: 1,
      action: "paths",
      ok: true,
      root: "/data/career",
      evidenceDir: "/data/career/evidence",
    });
  });

  test("지운 begin, finish 와 모르는 하위 명령은 사용법 오류다", () => {
    for (const args of [["begin", "resume-preparer", "--json"], ["finish", "resume-preparer"], ["sync"], []])
      expect(() => runPluginWorkspace(args, {})).toThrow(UsageError);
  });
});
