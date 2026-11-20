/**
 * `agent-skills/` 의 일반 에이전트용 사본을 Claude Code 전용 `skills/` 에서 만든다(ADR-141 개정).
 *
 * 사본은 `SKILL.md` 와 `references/`, `templates/` 만 갖는다. fos-assistant 가 그 밖의 파일을 복사하지 않기 때문이다.
 * `SKILL.md` 는 아래 교체만 거치고 나머지는 원본 그대로다. 교체할 문장이 원본에 정확히 한 번 없으면 실패해,
 * 원본의 실행 환경 문장이 바뀌면 사본 규칙도 함께 고치게 한다.
 *
 *   bun run scripts/agent-skills.ts          사본을 다시 쓴다
 *   bun run scripts/agent-skills.ts --check  사본이 원본과 어긋나면 종료 코드 1
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const pluginRoot = join(import.meta.dir, "..");
export const SOURCE_DIRECTORY = join(pluginRoot, "skills");
export const AGENT_SKILLS_DIRECTORY = join(pluginRoot, "agent-skills");
const COPIED_PARTS = ["references", "templates"];

type Replacement = readonly [from: string, to: string];

const LAUNCHER_LINE = '실행기 명령은 `bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js"` 이다.\n';

// 두 실행기 스킬이 같은 문장으로 실행 환경을 밝힌다. 사본은 이 문장만 fos-assistant 에이전트의 셸 실행 공간 기준으로 바꾼다.
const SHELL_ENVIRONMENT: readonly Replacement[] = [
  [
    "이 스킬은 Claude Code 에서만 돈다.\n셸이 없는 환경이면 할 수 없다고 알리고 끝낸다.\n",
    "이 스킬은 fos-assistant 에이전트의 셸 실행 공간에서 돈다.\n셸(`terminal`) 도구가 없으면 할 수 없다고 알리고 끝낸다.\n",
  ],
  [
    LAUNCHER_LINE,
    LAUNCHER_LINE +
      "`${CLAUDE_PLUGIN_ROOT}` 와 아래 환경 변수는 실행 공간이 넘긴 값을 셸이 푼다. 명령을 셸에 그대로 넘기고 경로를 짐작해 바꿔 쓰지 않는다.\n",
  ],
];

/**
 * 사본을 내는 스킬과 `SKILL.md` 교체 목록이다. 셸에 요구하는 env 는 `connector.json` 의 `agent_skills.sandbox_env` 가 갖는다.
 */
export const AGENT_SKILL_COPIES: Readonly<Record<string, readonly Replacement[]>> = {
  "position-recommender": [
    [" Claude Code 에서만 돈다.\n---\n", "\n---\n"],
    ...SHELL_ENVIRONMENT,
    // 실행 공간 셸에는 브라우저가 없을 수 있다. 확인하지 않은 배치를 확인했다고 전하지 않게 한다.
    [
      "브라우저에서 데스크톱과 모바일 배치, 가로 넘침과 주요 링크를 확인한다.\n",
      "브라우저 도구가 있으면 데스크톱과 모바일 배치, 가로 넘침과 주요 링크를 확인한다.\n없으면 `finalize` 의 HTML 검증 결과만 전하고, 화면 배치는 확인하지 못했다고 최종 답변에 적는다.\n",
    ],
  ],
  "study-collection": SHELL_ENVIRONMENT,
};

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`링크는 사본에 넣지 않는다: ${path}`);
      return entry.isDirectory() ? filesUnder(path) : [path];
    });
}

/** 스킬 하나의 사본이다. `{스킬 안 상대 경로: 내용}` 이다. */
export function renderAgentSkill(name: string): Map<string, string> {
  const replacements = AGENT_SKILL_COPIES[name];
  if (!replacements) throw new Error(`사본 목록에 없는 스킬이다: ${name}`);
  const source = join(SOURCE_DIRECTORY, name);
  let skill = readFileSync(join(source, "SKILL.md"), "utf8");
  for (const [from, to] of replacements) {
    const count = skill.split(from).length - 1;
    if (count !== 1) throw new Error(`${name}/SKILL.md 에 교체할 문장이 ${count}번 있다: ${JSON.stringify(from)}`);
    skill = skill.replace(from, () => to);
  }
  const files = new Map<string, string>([["SKILL.md", skill]]);
  for (const part of COPIED_PARTS) {
    const directory = join(source, part);
    if (!existsSync(directory)) continue;
    for (const file of filesUnder(directory)) files.set(relative(source, file), readFileSync(file, "utf8"));
  }
  return files;
}

/** 지금 `agent-skills/` 에 있는 스킬 디렉터리의 파일이다. README.md 같은 맨 위 파일은 보지 않는다. */
function committedAgentSkills(): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>();
  for (const entry of readdirSync(AGENT_SKILLS_DIRECTORY, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(AGENT_SKILLS_DIRECTORY, entry.name);
    result.set(entry.name, new Map(filesUnder(directory).map((file) => [relative(directory, file), readFileSync(file, "utf8")])));
  }
  return result;
}

/** 원본에서 만든 사본과 커밋된 사본의 차이다. 비었으면 맞다. */
export function agentSkillDrift(): string[] {
  const committed = committedAgentSkills();
  const problems: string[] = [];
  for (const name of committed.keys())
    if (!(name in AGENT_SKILL_COPIES)) problems.push(`${name}: 사본 목록에 없는 디렉터리다`);
  for (const name of Object.keys(AGENT_SKILL_COPIES)) {
    const expected = renderAgentSkill(name);
    const actual = committed.get(name) ?? new Map<string, string>();
    for (const path of new Set([...expected.keys(), ...actual.keys()]))
      if (expected.get(path) !== actual.get(path)) problems.push(`${name}/${path}: 원본에서 만든 사본과 다르다`);
  }
  return problems;
}

export function writeAgentSkills(): void {
  for (const name of committedAgentSkills().keys()) rmSync(join(AGENT_SKILLS_DIRECTORY, name), { recursive: true });
  for (const name of Object.keys(AGENT_SKILL_COPIES))
    for (const [path, content] of renderAgentSkill(name)) {
      const target = join(AGENT_SKILLS_DIRECTORY, name, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const problems = agentSkillDrift();
    for (const problem of problems) console.error(problem);
    if (problems.length > 0) {
      console.error("bun run scripts/agent-skills.ts 로 사본을 다시 만든다.");
      process.exit(1);
    }
  } else {
    writeAgentSkills();
  }
}
