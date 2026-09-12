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

import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { runCli } from "../../../../scripts/lib/cli.ts";

export type EvidenceSourceSpec = {
  /** 결과와 문서에서 이 원본을 부르는 이름. */
  name: string;
  /** 저장소 루트 기준 경로이거나 `${VARIABLE}` 로 시작하는 환경 변수 경로다. */
  path: string;
  /** 최신 여부를 대조할 원격 브랜치. */
  branch: string;
  /** 이 원본이 바꾸는 판정. 사용자에게 무엇이 걸려 있는지 알릴 때 쓴다. */
  affects: string;
};

/**
 * 홈서버 작업본은 여기 없다. `skill begin <SKILL_NAME>` 이 이미 받아 온다.
 * 이 목록은 그 CLI 가 다루지 않는 읽기 전용 원본만 담는다.
 */
export const EVIDENCE_SOURCES: readonly EvidenceSourceSpec[] = [
  {
    name: "fos-study",
    path: "career-os/sources/fos-study",
    branch: "main",
    affects: "적합도 판정과 이력서의 대표 근거",
  },
  {
    name: "private brain",
    path: "${PERSONAL_ROOT}/fos-brain",
    branch: "main",
    affects: "현재 경력, 역할 선호와 경험 경계",
  },
] as const;

export type EvidenceSourceStatus =
  /** 원격과 같은 커밋이다. */
  | "up_to_date"
  /** 원격에만 있는 커밋이 있다. 멈추고 사용자에게 알린다. */
  | "behind"
  /** 경로나 환경 변수가 없어 최신 여부를 판정할 수 없다. */
  | "unavailable"
  /** 저장소는 있으나 원격을 받지 못했다. */
  | "unreachable";

export type EvidenceSourceResult = {
  name: string;
  /** 실제로 검사한 절대 경로. 판정하지 못했으면 계약에 적힌 경로를 그대로 둔다. */
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
  const result = Bun.spawnSync(["git", "-C", directory, ...args], { stdout: "pipe", stderr: "pipe" });
  const decoder = new TextDecoder();
  return {
    ok: result.exitCode === 0,
    stdout: decoder.decode(result.stdout).trim(),
    stderr: decoder.decode(result.stderr).trim(),
  };
}

const ENVIRONMENT_PATH = /^\$\{([A-Z0-9_]+)\}\/(.+)$/;

/** 경로를 절대 경로로 푼다. 환경 변수가 없으면 경로를 추측하지 않고 이유를 돌려준다. */
function resolveSourcePath(
  specPath: string,
  repositoryRoot: string,
  env: Record<string, string | undefined>,
): { path: string } | { reason: string } {
  const match = ENVIRONMENT_PATH.exec(specPath);
  if (match) {
    const [, variable, rest] = match;
    const base = env[variable];
    if (!base) return { reason: `${variable} 환경 변수가 없어 경로를 확인할 수 없습니다.` };
    return { path: resolve(base, rest) };
  }
  return { path: isAbsolute(specPath) ? specPath : resolve(repositoryRoot, specPath) };
}

function checkSource(
  spec: EvidenceSourceSpec,
  repositoryRoot: string,
  shouldFetch: boolean,
  env: Record<string, string | undefined>,
): EvidenceSourceResult {
  const base = { name: spec.name, affects: spec.affects };

  const resolved = resolveSourcePath(spec.path, repositoryRoot, env);
  if ("reason" in resolved) {
    return { ...base, path: spec.path, status: "unavailable", detail: resolved.reason };
  }
  const path = resolved.path;
  if (!existsSync(path)) {
    return { ...base, path, status: "unavailable", detail: "경로가 없습니다. 이 원본을 아예 읽을 수 없습니다." };
  }
  if (!git(path, ["rev-parse", "--git-dir"]).ok) {
    return { ...base, path, status: "unavailable", detail: "Git 저장소가 아닙니다." };
  }

  if (shouldFetch) {
    const fetched = git(path, ["fetch", "--quiet", "origin", spec.branch]);
    if (!fetched.ok) {
      return { ...base, path, status: "unreachable", detail: fetched.stderr || "origin 을 받지 못했습니다." };
    }
  }

  const remote = `origin/${spec.branch}`;
  const counted = git(path, ["rev-list", "--count", `HEAD..${remote}`]);
  if (!counted.ok) {
    return { ...base, path, status: "unavailable", detail: counted.stderr || `${remote} 을 찾지 못했습니다.` };
  }

  const behindCommits = Number(counted.stdout);
  if (behindCommits === 0) return { ...base, path, status: "up_to_date" };

  const committedAt = git(path, ["log", "-1", "--format=%cI", remote]);
  return {
    ...base,
    path,
    status: "behind",
    behindCommits,
    remoteCommittedAt: committedAt.ok ? committedAt.stdout : undefined,
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
 * 모든 원본이 원격과 같을 때만 통과한다.
 * `unavailable` 과 `unreachable` 도 통과시키지 않는다. 확인하지 못한 것을 최신으로 보면 검사가 없는 것과 같다.
 */
export function checkEvidenceSources(options: CheckOptions = {}): EvidenceSourceCheck {
  const repositoryRoot = resolve(options.repositoryRoot ?? findRepositoryRoot());
  const shouldFetch = options.fetch ?? true;
  const env = options.env ?? process.env;
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
