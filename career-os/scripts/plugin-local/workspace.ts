import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beginSkillWorkspace, createCareerWorkspaceTransport, finishSkillWorkspace, isManagedSkill } from "../career-workspace/cli.ts";
import { CAREER_WORKSPACE_MANAGED_ROOTS, CAREER_WORKSPACE_SCHEMA_VERSION } from "../career-workspace/contracts.ts";
import { makeRemoteError, TransportError } from "../career-workspace/transport.ts";

type Environment = Record<string, string | undefined>;

/**
 * plugin 실행기의 작업본 위치와 동기화 방식을 정한다.
 * 기본 root 는 저장소 경로가 아니라 사용자 홈 아래라서, 동기화 설정을 빠뜨려도
 * 저장소의 오래된 작업본을 고치지 않는다(ADR-138).
 */
export function resolvePluginWorkspace(
  environment: Environment,
  home: string,
): { root: string; mode: "local" | "remote"; evidenceDir: string } {
  const configuredRoot = environment.CAREER_WORKSPACE_ROOT?.trim();
  const root = configuredRoot ? path.resolve(configuredRoot) : path.join(home, ".fos-career", "workspace");
  const remote = Boolean(environment.CAREER_WORKSPACE_COMMAND?.trim() || environment.CAREER_WORKSPACE_SSH_TARGET?.trim());
  // 프로젝트 근거 위치는 실행기가 읽지 않는다. 스킬이 paths 결과로 알고 모델이 읽는다.
  const configuredEvidence = environment.CAREER_EVIDENCE_DIR?.trim();
  const evidenceDir = configuredEvidence ? path.resolve(configuredEvidence) : path.join(root, "evidence");
  return { root, mode: remote ? "remote" : "local", evidenceDir };
}

export async function runPluginWorkspace(args: string[], environment: Environment = process.env, home = os.homedir()): Promise<unknown> {
  const { root, mode, evidenceDir } = resolvePluginWorkspace(environment, home);
  const [command, skill] = args;
  if (command === "paths") {
    return { schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION, action: "paths", ok: true, root, mode, evidenceDir };
  }
  if (command !== "begin" && command !== "finish") {
    throw new TransportError(makeRemoteError("check", "INVALID_MANIFEST"));
  }
  if (!isManagedSkill(skill)) {
    throw new TransportError(makeRemoteError("check", "INVALID_MANIFEST"));
  }
  const action = command === "begin" ? "skill-begin" : "skill-finish";
  if (mode === "local") {
    if (command === "begin") {
      for (const managedRoot of CAREER_WORKSPACE_MANAGED_ROOTS) {
        await mkdir(path.join(root, managedRoot), { recursive: true });
      }
    }
    return { schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION, action, ok: true, skill, mode, root, noChange: true };
  }
  const context = {
    root,
    transport: createCareerWorkspaceTransport(environment),
    producer: { skill: "career-workspace", mode: "interactive" as const },
  };
  const result = command === "begin"
    ? await beginSkillWorkspace(context, skill)
    : await finishSkillWorkspace(context, skill);
  return { ...result, mode, root };
}
