#!/usr/bin/env bun

/**
 * 근거 원본 저장소가 원격보다 뒤처졌는지 검사한다.
 *
 * 뒤처진 사본은 오류를 내지 않는다. 없는 문서는 없는 경험으로 판정되고 적합도 점수만 낮아진다.
 * 실측에서 로컬 `fos-study` 가 388커밋, 넉 달 뒤처진 채 지원 한 건을 준비했고,
 * 그 사이 추가된 문서 넷이 적합도 판정과 이력서 문장을 바꿨다.
 *
 * 검사만 하고 당기지 않는다. 읽기 전용 저장소이며 당기는 과정에 사람이 판단할 것이 있다.
 * 판정별 다음 행동은 `references/evidence-source-freshness.md` 가 소유한다.
 */

import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { runCli } from "../../../../scripts/lib/cli.ts";

export type EvidenceSourceSpec = {
  /** 결과와 문서에서 이 원본을 부르는 이름. */
  name: string;
  /**
   * 이 원본을 찾을 자리를 순서대로 담는다.
   * 저장소 루트 기준 경로이거나 `${VARIABLE}` 로 시작하는 환경 변수 경로다.
   * 앞의 자리에서 저장소를 찾으면 뒤는 보지 않는다.
   */
  paths: readonly string[];
  /** 최신 여부를 대조할 원격 브랜치. */
  branch: string;
  /** 이 원본이 바꾸는 판정. 사용자에게 무엇이 걸려 있는지 알릴 때 쓴다. */
  affects: string;
};

/**
 * 홈서버 작업본은 여기 없다. `skill begin <SKILL_NAME>` 이 이미 받아 온다.
 * 이 목록은 그 CLI 가 다루지 않는 읽기 전용 원본만 담는다.
 *
 * `career-os/sources/fos-study` 는 추적하지 않는 clone 이거나 symlink 라서 워크트리에는 없다.
 * 그래서 `${PERSONAL_ROOT}` 아래의 실제 저장소를 두 번째 자리로 둔다.
 */
export const EVIDENCE_SOURCES: readonly EvidenceSourceSpec[] = [
  {
    name: "fos-study",
    paths: ["career-os/sources/fos-study", "${PERSONAL_ROOT}/fos-study"],
    branch: "main",
    affects: "적합도 판정과 이력서의 대표 근거",
  },
  {
    name: "private brain",
    paths: ["${PERSONAL_ROOT}/fos-brain"],
    branch: "main",
    affects: "현재 경력, 역할 선호와 경험 경계",
  },
] as const;

export type EvidenceSourceStatus =
  /** 원격과 같은 커밋이다. */
  | "up_to_date"
  /** 원격에만 있는 커밋이 있다. 멈추고 사용자에게 알린다. */
  | "behind"
  /**
   * 경로를 풀 환경 변수가 없어 어디를 볼지조차 정하지 못했다.
   * 저장소가 없는 것과 가른다. 사용자가 할 일이 다르다. 이쪽은 값을 설정하는 일이다.
   */
  | "not_configured"
  /** 볼 자리는 정했으나 그 자리에 저장소가 없다. 사용자가 clone 하거나 연결하는 일이다. */
  | "unavailable"
  /** 저장소는 있으나 원격을 받지 못했다. */
  | "unreachable";

export type EvidenceSourceResult = {
  name: string;
  /**
   * 검사한 자리를 계약에 적힌 표기 그대로 둔다.
   * 해석한 절대 경로는 담지 않는다. 이 결과를 지원 문서에 옮겨 적으면 호스트 경로가 함께 나간다.
   */
  path: string;
  status: EvidenceSourceStatus;
  affects: string;
  /** `behind` 일 때 원격에만 있는 커밋 수. */
  behindCommits?: number;
  /** `behind` 일 때 원격 최신 커밋의 시각. 얼마나 오래 뒤처졌는지 보여준다. */
  remoteCommittedAt?: string;
  /** `up_to_date` 가 아닐 때 그렇게 판정한 이유. */
  detail?: string;
};

export type EvidenceSourceCheck = {
  passed: boolean;
  sources: EvidenceSourceResult[];
};

export type CheckOptions = {
  /** 저장소 루트. 상대 경로 원본을 여기서 푼다. 주지 않으면 현재 위치에서 찾는다. */
  repositoryRoot?: string;
  /** 원격을 새로 받을지. false 면 현재 remote-tracking ref 만 본다. */
  fetch?: boolean;
  /** 검사할 원본 목록. 테스트가 임시 저장소를 넣을 때 쓴다. */
  sources?: readonly EvidenceSourceSpec[];
  /** 환경 변수 경로를 풀 때 읽을 값. */
  env?: Record<string, string | undefined>;
};

type GitResult = { ok: boolean; stdout: string; stderr: string };

function git(directory: string, args: readonly string[]): GitResult {
  const result = Bun.spawnSync(["git", "-C", directory, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    // 자격 증명이나 호스트 키를 물으면 동기 호출이 그대로 멈춘다. 묻는 대신 실패하게 한다.
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: "ssh -o BatchMode=yes" },
  });
  const decoder = new TextDecoder();
  return {
    ok: result.exitCode === 0,
    stdout: decoder.decode(result.stdout).trim(),
    stderr: decoder.decode(result.stderr).trim(),
  };
}

/** git stderr 는 여러 줄이다. 사용자에게 보일 한 줄만 남긴다. */
function firstLine(text: string): string {
  return text.split("\n")[0]?.trim() ?? "";
}

const ENVIRONMENT_PATH = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}(?:\/(.*))?$/;

type ResolvedPath = { path: string } | { reason: string };

/** 경로를 절대 경로로 푼다. 환경 변수가 없으면 경로를 추측하지 않고 이유를 돌려준다. */
function resolveSourcePath(
  specPath: string,
  repositoryRoot: string,
  env: Record<string, string | undefined>,
): ResolvedPath {
  const match = ENVIRONMENT_PATH.exec(specPath);
  if (match) {
    const [, variable, rest] = match;
    const base = env[variable];
    if (!base) return { reason: `${variable} 환경 변수가 없어 이 자리를 확인할 수 없습니다.` };
    return { path: rest ? resolve(base, rest) : resolve(base) };
  }
  return { path: isAbsolute(specPath) ? specPath : resolve(repositoryRoot, specPath) };
}

/**
 * 그 경로 자체가 저장소 루트일 때만 참이다.
 *
 * `rev-parse --git-dir` 로는 가릴 수 없다. 상위 저장소의 `.git` 을 찾아 종료 코드 0 을 내기 때문이다.
 * 실측에서 빈 `career-os/sources/fos-study` 디렉터리가 그 검사를 통과했고,
 * 이어지는 명령이 fos-study 가 아니라 fos-agents 모노레포를 재 `up_to_date` 로 판정했다.
 * 이 변경이 막으려던 실패, 경고 없이 틀린 판정이 나오는 상황을 그대로 만든다.
 */
function isRepositoryRoot(path: string): boolean {
  const toplevel = git(path, ["rev-parse", "--show-toplevel"]);
  if (!toplevel.ok) return false;
  try {
    // fos-study 는 symlink 일 수 있어 양쪽을 realpath 로 맞춘다.
    return realpathSync(toplevel.stdout) === realpathSync(path);
  } catch {
    return false;
  }
}

/**
 * 계약에 적힌 자리를 순서대로 보고 저장소를 찾는다.
 * 찾지 못하면 자리마다의 이유와 함께, 어느 자리도 풀지 못한 것인지를 함께 돌려준다.
 */
function locateSource(
  spec: EvidenceSourceSpec,
  repositoryRoot: string,
  env: Record<string, string | undefined>,
): { path: string; spelling: string } | { reasons: string[]; everyPlaceUnresolved: boolean } {
  const reasons: string[] = [];
  let resolvedAnyPlace = false;

  for (const spelling of spec.paths) {
    const resolved = resolveSourcePath(spelling, repositoryRoot, env);
    if ("reason" in resolved) {
      reasons.push(`${spelling}: ${resolved.reason}`);
      continue;
    }
    resolvedAnyPlace = true;
    if (!existsSync(resolved.path)) {
      reasons.push(`${spelling}: 경로가 없습니다.`);
      continue;
    }
    if (!isRepositoryRoot(resolved.path)) {
      reasons.push(`${spelling}: 그 자리가 Git 저장소의 루트가 아닙니다.`);
      continue;
    }
    return { path: resolved.path, spelling };
  }
  return { reasons, everyPlaceUnresolved: !resolvedAnyPlace };
}

function checkSource(
  spec: EvidenceSourceSpec,
  repositoryRoot: string,
  shouldFetch: boolean,
  env: Record<string, string | undefined>,
): EvidenceSourceResult {
  const base = { name: spec.name, affects: spec.affects };

  const located = locateSource(spec, repositoryRoot, env);
  if ("reasons" in located) {
    return {
      ...base,
      path: spec.paths.join(", "),
      status: located.everyPlaceUnresolved ? "not_configured" : "unavailable",
      detail: located.everyPlaceUnresolved
        ? `볼 자리를 정하지 못했습니다. ${located.reasons.join(" ")}`
        : `저장소를 찾지 못했습니다. ${located.reasons.join(" ")}`,
    };
  }
  const { path, spelling } = located;
  const withPath = { ...base, path: spelling };

  if (shouldFetch) {
    const fetched = git(path, ["fetch", "--quiet", "origin", spec.branch]);
    if (!fetched.ok) {
      return { ...withPath, status: "unreachable", detail: firstLine(fetched.stderr) || "origin 을 받지 못했습니다." };
    }
  }

  const remote = `origin/${spec.branch}`;
  const counted = git(path, ["rev-list", "--count", `HEAD..${remote}`]);
  if (!counted.ok) {
    return { ...withPath, status: "unavailable", detail: firstLine(counted.stderr) || `${remote} 을 찾지 못했습니다.` };
  }

  const behindCommits = Number(counted.stdout);
  if (!Number.isInteger(behindCommits)) {
    return { ...withPath, status: "unavailable", detail: `커밋 수를 읽지 못했습니다: ${firstLine(counted.stdout)}` };
  }
  if (behindCommits === 0) return { ...withPath, status: "up_to_date" };

  const committedAt = git(path, ["log", "-1", "--format=%cI", remote]);
  return {
    ...withPath,
    status: "behind",
    behindCommits,
    remoteCommittedAt: committedAt.ok ? committedAt.stdout : "확인하지 못함",
    detail: `${remote} 에만 있는 커밋이 ${behindCommits}개입니다.`,
  };
}

/**
 * 저장소 루트를 현재 위치에서 찾는다.
 * 호출하는 쪽이 저장소 루트에 있는지 `career-os` 안에 있는지에 따라 결과가 달라지지 않게 한다.
 */
function findRepositoryRoot(): string {
  const found = git(process.cwd(), ["rev-parse", "--show-toplevel"]);
  return found.ok ? found.stdout : process.cwd();
}

/**
 * `PERSONAL_ROOT` 는 셸이 아니라 `career-os/.env` 에 두는 값이다.
 * 실행한 디렉터리가 아니라 저장소 루트에서 그 파일을 찾는다. 어디서 실행해도 같은 값을 읽게 한다.
 * 셸에 이미 있는 값은 덮지 않는다.
 */
function loadWorkspaceEnvironment(repositoryRoot: string): Record<string, string | undefined> {
  const file = process.env.CAREER_WORKSPACE_ENV_FILE || join(repositoryRoot, "career-os", ".env");
  const loaded = existsSync(file) ? (loadEnv({ path: file, processEnv: {}, quiet: true }).parsed ?? {}) : {};
  return { ...loaded, ...process.env };
}

/**
 * 모든 원본이 원격과 같을 때만 통과한다.
 * `unavailable` 과 `unreachable` 도 통과시키지 않는다. 확인하지 못한 것을 최신으로 보면 검사가 없는 것과 같다.
 */
export function checkEvidenceSources(options: CheckOptions = {}): EvidenceSourceCheck {
  const repositoryRoot = resolve(options.repositoryRoot ?? findRepositoryRoot());
  const shouldFetch = options.fetch ?? true;
  const env = options.env ?? loadWorkspaceEnvironment(repositoryRoot);
  const sources = (options.sources ?? EVIDENCE_SOURCES).map((spec) =>
    checkSource(spec, repositoryRoot, shouldFetch, env),
  );

  return { passed: sources.every((source) => source.status === "up_to_date"), sources };
}

if (import.meta.main) {
  await runCli(
    {
      name: "check_evidence_sources.ts",
      summary: "근거 원본 저장소가 원격보다 뒤처졌는지 검사한다. 검사만 하고 당기지 않는다.",
      positional: [
        { name: "<repository-root>", description: "저장소 루트. 주지 않으면 현재 위치에서 찾는다", required: false },
      ],
      options: {
        "--no-fetch": { description: "원격을 새로 받지 않고 현재 remote-tracking ref 만 본다" },
      },
    },
    ({ positional, options }) =>
      checkEvidenceSources({
        repositoryRoot: positional[0],
        fetch: options["--no-fetch"] !== true,
      }),
  );
}
