import { mkdir } from "node:fs/promises";
import path from "node:path";
import { beginSkillWorkspace, createCareerWorkspaceTransport, finishSkillWorkspace, isManagedSkill } from "../career-workspace/cli.ts";
import { CAREER_WORKSPACE_MANAGED_ROOTS, CAREER_WORKSPACE_SCHEMA_VERSION } from "../career-workspace/contracts.ts";
import { makeRemoteError, TransportError } from "../career-workspace/transport.ts";
import { resolveCareerStoreRoot } from "../lib/career-store/database.ts";

type Environment = Record<string, string | undefined>;

/**
 * plugin 실행기의 작업 폴더 위치와 동기화 방식을 정한다.
 * root 는 공고·공부·면접 실행기와 같은 규칙(`CAREER_WORKSPACE_ROOT`, 없으면 `/workspace/career`)으로 정해
 * 지원 폴더와 SQLite 가 같은 작업 폴더에 생기게 한다(ADR-146).
 */
export function resolvePluginWorkspace(
  environment: Environment,
): { root: string; mode: "local" | "remote"; evidenceDir: string } {
  const root = resolveCareerStoreRoot(environment);
  const remote = Boolean(environment.CAREER_WORKSPACE_SSH_TARGET?.trim());
  // `workspace` 는 근거 위치를 알려만 준다. 최신 여부는 `package check-sources` 가 같은 변수로 본다.
  const configuredEvidence = environment.CAREER_EVIDENCE_DIR?.trim();
  const evidenceDir = configuredEvidence ? path.resolve(configuredEvidence) : path.join(root, "evidence");
  return { root, mode: remote ? "remote" : "local", evidenceDir };
}

export async function runPluginWorkspace(args: string[], environment: Environment = process.env): Promise<unknown> {
  const { root, mode, evidenceDir } = resolvePluginWorkspace(environment);
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
