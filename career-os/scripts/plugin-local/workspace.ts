import path from "node:path";
import { resolveCareerStoreRoot } from "../lib/career-store/database.ts";
import { UsageError } from "../lib/cli.ts";

type Environment = Record<string, string | undefined>;

export const WORKSPACE_USAGE = "사용법: workspace paths --json";

/**
 * plugin 실행기의 작업 폴더와 프로젝트 근거 위치를 정한다.
 * root 는 공고·공부·면접 실행기와 같은 규칙(`CAREER_WORKSPACE_ROOT`, 없으면 `/workspace/career`)으로 정해
 * 지원 폴더와 SQLite 가 같은 작업 폴더에 생기게 한다(ADR-146).
 */
export function resolvePluginWorkspace(environment: Environment): { root: string; evidenceDir: string } {
  const root = resolveCareerStoreRoot(environment);
  // `workspace` 는 근거 위치를 알려만 준다. 최신 여부는 `package check-sources` 가 같은 변수로 본다.
  const configuredEvidence = environment.CAREER_EVIDENCE_DIR?.trim();
  const evidenceDir = configuredEvidence ? path.resolve(configuredEvidence) : path.join(root, "evidence");
  return { root, evidenceDir };
}

/** `paths` 만 받는다. 작업 폴더는 에이전트의 작업 폴더 하나뿐이라 주고받을 사본이 없다(ADR-148). */
export function runPluginWorkspace(args: string[], environment: Environment = process.env): unknown {
  if (args[0] !== "paths") throw new UsageError(WORKSPACE_USAGE);
  return { schemaVersion: 1, action: "paths", ok: true, ...resolvePluginWorkspace(environment) };
}
