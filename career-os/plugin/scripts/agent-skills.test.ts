import { expect, test } from "bun:test";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  AGENT_SKILL_COPIES,
  AGENT_SKILL_ORIGINALS,
  AGENT_SKILLS_DIRECTORY,
  agentSkillDrift,
  hostOnlyFindings,
} from "./agent-skills.ts";

const pluginRoot = join(import.meta.dir, "..");
const connector = JSON.parse(readFileSync(join(pluginRoot, "connector.json"), "utf8"));
const plugin = JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8"));

// fos-assistant 대시보드 plugin 이 manifest 를 읽을 때 거는 규칙을 옮겨 둔다. 어기면 이 플러그인이 카탈로그에서 통째로 빠진다.
// 원본: fos-assistant hermes/plugins/dashboard-profile-api 의 connector_agent_skills.py(`_plugin_and_agent_skills`),
// connector_skills.py(`_connector_skills`, `_skill_name`), connector_schema.py(상한), common.py(`SKILL_NAME_RE`),
// sandbox.py(`SANDBOX_ALLOWED_ENV`). 그쪽 규칙이 바뀌면 여기도 고친다.
// `CAREER_BACKEND_*` 두 이름은 fos-assistant 가 허용 목록에서 뺄 때(5단계)까지 그쪽 목록에 남아 있다.
const SANDBOX_ALLOWED_ENV = new Set([
  "CAREER_BACKEND_TOKEN_FILE",
  "CLAUDE_PLUGIN_ROOT",
  "CAREER_EVIDENCE_DIR",
  "CAREER_WORKSPACE_ROOT",
  "CAREER_DART_API_KEY_FILE",
  "CAREER_BACKEND_URL",
]);
const SKILL_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SKILL_PARTS = ["references", "templates"];
const MAX_FILES = 20;
const MAX_CHARS = 100_000;
const SECRET_FRONT_MATTER = /^(required_environment_variables|required_credential_files|setup|prerequisites):/m;

function frontMatter(text: string): string {
  const end = text.indexOf("\n---\n", 4);
  if (!text.startsWith("---\n") || end < 0) throw new Error("앞머리가 없거나 닫히지 않는다");
  return text.slice(4, end);
}

function skillNameOf(directory: string): string {
  return frontMatter(readFileSync(join(directory, "SKILL.md"), "utf8")).match(/^name: (.+)$/m)?.[1] ?? directory.split("/").pop()!;
}

function skillDirectories(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "SKILL.md")))
    .map((entry) => join(root, entry.name));
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const agentSkills = connector.agent_skills as { path: string; sandbox_env?: Record<string, string[]> };
const agentRoot = resolve(pluginRoot, agentSkills.path);
const agentSkillDirs = skillDirectories(agentRoot);
const agentSkillNames = agentSkillDirs.map(skillNameOf);

test("agent_skills 는 path 와 sandbox_env 만 받고 path 는 plugin 안의 링크 없는 디렉터리다", () => {
  expect(Object.keys(agentSkills).filter((key) => key !== "path" && key !== "sandbox_env")).toEqual([]);
  expect(typeof agentSkills.path).toBe("string");
  expect(agentRoot).toBe(AGENT_SKILLS_DIRECTORY);
  expect(relative(pluginRoot, agentRoot).startsWith("..")).toBe(false);
  expect(lstatSync(agentRoot).isDirectory()).toBe(true);
  expect(realpathSync(agentRoot)).toBe(realpathSync(pluginRoot) + "/" + relative(pluginRoot, agentRoot));
});

test("에이전트용 스킬 파일은 링크가 없고, 복사되는 파일이 상한 안이며, 앞머리가 비밀값을 요청하지 않는다", () => {
  for (const directory of agentSkillDirs) {
    for (const file of walk(directory)) expect(lstatSync(file).isSymbolicLink(), file).toBe(false);
    const copied = [join(directory, "SKILL.md"), ...SKILL_PARTS.flatMap((part) => (existsSync(join(directory, part)) ? walk(join(directory, part)) : []))];
    expect(copied.length, directory).toBeLessThanOrEqual(MAX_FILES);
    for (const file of copied) expect(readFileSync(file, "utf8").length, file).toBeLessThanOrEqual(MAX_CHARS);
    expect(SECRET_FRONT_MATTER.test(frontMatter(readFileSync(join(directory, "SKILL.md"), "utf8"))), directory).toBe(false);
  }
});

test("에이전트용 스킬 이름은 경로로 쓸 수 있고 서로, 그리고 plugin.json 스킬과 겹치지 않는다", () => {
  const pluginSkillNames = (plugin.skills as string[]).flatMap((path) =>
    skillDirectories(resolve(pluginRoot, path)).map(skillNameOf),
  );
  for (const name of agentSkillNames) expect(SKILL_NAME_RE.test(name) && !name.includes(".."), name).toBe(true);
  expect(new Set(agentSkillNames).size).toBe(agentSkillNames.length);
  expect(agentSkillNames.filter((name) => pluginSkillNames.includes(name))).toEqual([]);
});

test("sandbox_env 는 있는 에이전트용 스킬만 가리키고, 값은 실행 공간 정책이 받는 env 이름의 중복 없는 목록이다", () => {
  for (const [name, names] of Object.entries(agentSkills.sandbox_env ?? {})) {
    expect(agentSkillNames, name).toContain(name);
    expect(Array.isArray(names) && names.length > 0, name).toBe(true);
    expect(new Set(names).size, name).toBe(names.length);
    for (const env of names) expect(SANDBOX_ALLOWED_ENV.has(env), `${name}: ${env}`).toBe(true);
  }
});

test("실행기를 부르는 스킬은 실행기와 작업 폴더에 필요한 env 를 sandbox_env 로 요구한다", () => {
  // 요구하지 않으면 셸 조건을 보지 않고 늘 설치돼, 셸이 없는 에이전트에서도 돌 수 없는 스킬이 보인다.
  for (const directory of agentSkillDirs) {
    if (!readFileSync(join(directory, "SKILL.md"), "utf8").includes("${CLAUDE_PLUGIN_ROOT}")) continue;
    const name = skillNameOf(directory);
    expect(agentSkills.sandbox_env?.[name] ?? [], name).toEqual(
      expect.arrayContaining(["CLAUDE_PLUGIN_ROOT", "CAREER_WORKSPACE_ROOT"]),
    );
  }
});

test("비서용 스킬과 그 sandbox_env 는 커리어 Backend 의 주소와 token 을 요구하지 않는다", () => {
  // 공고·공부 추천과 면접 연습은 작업 폴더의 SQLite 를 쓴다(ADR-146). Backend 값을 요구하면 그 값을 내린 뒤 스킬이 빠진다.
  for (const names of Object.values(agentSkills.sandbox_env ?? {})) {
    expect(names.filter((name) => name.startsWith("CAREER_BACKEND"))).toEqual([]);
  }
  for (const directory of agentSkillDirs) {
    const files = (readdirSync(directory, { recursive: true }) as string[])
      .map((name) => join(directory, name))
      .filter((file) => file.endsWith(".md"));
    for (const file of files) {
      expect({ file, hit: /CAREER_BACKEND_/.test(readFileSync(file, "utf8")) }).toEqual({ file, hit: false });
    }
  }
});

test("agent-skills 의 사본이 skills 원본에서 만든 것과 같다", () => {
  // 어긋나면 `bun run scripts/agent-skills.ts` 로 다시 만든다.
  expect(agentSkillDrift()).toEqual([]);
  expect([...agentSkillNames].sort()).toEqual([...Object.keys(AGENT_SKILL_COPIES), ...AGENT_SKILL_ORIGINALS].sort());
});

// 지운 MCP 도구다. 스킬이 이 이름을 적으면 에이전트가 없는 도구를 찾다 멈춘다.
const REMOVED_TOOLS = [
  "list_context_documents",
  "get_context_document",
  "save_context_document",
  "list_profile_documents",
  "get_profile_document",
  "save_profile_document",
  "list_usage_snapshots",
  "get_interview_questions",
  "list_personal_questions",
  "save_interview_attempt",
  "save_personal_question",
  "get_study_candidates",
  "save_study_recommendation",
  "list_study_candidates",
  "list_study_recommendations",
  "get_position_research_constraints",
  "check_position_exclusions",
];

test("비서용 스킬은 지운 MCP 도구와 지운 대화용 스킬을 가리키지 않고, 적은 MCP 도구는 선언에 있다", () => {
  for (const directory of agentSkillDirs) {
    for (const file of walk(directory)) {
      const text = readFileSync(file, "utf8");
      for (const tool of REMOVED_TOOLS) expect({ file, tool, hit: text.includes(tool) }).toEqual({ file, tool, hit: false });
      expect({ file, hit: /대화용|`study-topic-recommender`/.test(text) }).toEqual({ file, hit: false });
      const mentioned = text.match(/`((?:check|get|update)_[a-z_]+)`/g) ?? [];
      for (const name of mentioned) expect(Object.keys(connector.tools), file).toContain(name.slice(1, -1));
    }
  }
});

test("맥락 문서를 쓰는 비서용 스킬은 기억에서 읽고, 같은 제목이 둘 이상이면 멈춘다", () => {
  const titles: Record<string, string[]> = {
    "position-recommender": ["커리어: 역할 선호", "커리어: 지원 상태"],
    "study-collection": ["커리어: 학습 관심사"],
    "interview-practice": ["커리어: 현재 경력", "커리어: 지원 상태"],
    "career-connector": ["커리어: 현재 경력", "커리어: 역할 선호", "커리어: 지원 상태", "커리어: 학습 관심사"],
  };
  expect(Object.keys(titles).sort()).toEqual([...agentSkillNames].sort());
  for (const [name, expected] of Object.entries(titles)) {
    const skill = readFileSync(join(agentRoot, name, "SKILL.md"), "utf8");
    for (const title of expected) expect(skill, `${name}: ${title}`).toContain(`「${title}」`);
    expect(skill, name).toContain("memory_search");
    expect(skill, name).toContain("memory_read");
    expect(skill, name).toContain("같은 제목의 기억이 둘 이상이면");
  }
});

// 번들한 실행기에 직접 묻는다. `scripts/` 를 import 하면 plugin 의 타입 검사가 실행기 전체를 읽는다.
function runLocal(args: string[]): string {
  const result = Bun.spawnSync(["bun", "--no-env-file", join(pluginRoot, "dist", "career-local.js"), ...args], {
    env: { PATH: process.env.PATH ?? "" },
    stdout: "pipe",
    stderr: "pipe",
  });
  return new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
}

test("면접 연습과 문서 관리 스킬이 적은 실행기 명령은 실제 명령이다", () => {
  const interview = readFileSync(join(agentRoot, "interview-practice", "SKILL.md"), "utf8");
  const commands = [...interview.matchAll(/<CAREER_LOCAL> interview ((?:personal )?[a-z]+)/g)].map((match) => match[1]!);
  expect([...new Set(commands)].sort()).toEqual(["personal add", "personal disable", "personal list", "progress", "record", "select"]);
  const usage = runLocal(["interview"]);
  for (const command of commands) expect(usage, command).toContain(`interview ${command}`);
  const positionHelp = runLocal(["position", "--help"]);
  const connectorSkill = readFileSync(join(agentRoot, "career-connector", "SKILL.md"), "utf8");
  for (const match of connectorSkill.matchAll(/<CAREER_LOCAL> position ([a-z-]+)/g))
    expect(positionHelp, match[1]).toContain(match[1]!);
  expect(connectorSkill).toContain("library/profiles/");
  expect(connectorSkill).toContain("memory_remember");
  // 사용량 차트와 Tokens 배지는 README 에서 뺀다(스펙 DECISION25).
  expect(connectorSkill).toContain("Tokens 배지를 넣지 않는다");
});

test("비서용 스킬에는 Claude Code 전용 안내와 복사되지 않는 파일이 없다", () => {
  for (const directory of agentSkillDirs) {
    for (const file of walk(directory)) {
      const path = relative(directory, file);
      expect(path === "SKILL.md" || SKILL_PARTS.some((part) => path.startsWith(`${part}/`)), file).toBe(true);
      expect(hostOnlyFindings(file, readFileSync(file, "utf8")), file).toEqual([]);
    }
  }
});

test("다른 실행 환경 전용 표현 검사는 실행 환경 문장, 하위 에이전트와 그 환경의 도구 이름을 잡는다", () => {
  for (const text of [
    "이 스킬은 Claude Code 에서만 돈다.",
    "공고마다 하위 에이전트를 띄운다.",
    "WebFetch 로 회사 블로그를 읽는다.",
    "`Write` 도구로 결과 파일을 쓴다.",
    "~/.claude/skills 를 읽는다.",
    "~/.claude 아래를 본다.",
    "Read 도구로 큐를 읽는다.",
    "`Read`/`Write` 도구로 결과를 고친다.",
    "인자는 $ARGUMENTS 로 받는다.",
    "allowed-tools: Bash",
    "${CLAUDE_PLUGIN_DATA} 에 남긴다.",
    "${CLAUDE_PROJECT_DIR} 에서 연다.",
  ])
    expect(hostOnlyFindings("sample.md", text), text).not.toEqual([]);
  expect(hostOnlyFindings("sample.md", "`write_file` 로 결과 파일을 쓴다. `${CLAUDE_PLUGIN_ROOT}` 는 셸이 푼다.")).toEqual([]);
});

test("실행기를 부르는 스킬은 플러그인 폴더의 원본을 읽지 않고 이 스킬의 절차만 따르라고 적는다", () => {
  // 실측(2026-11-21): 비서 에이전트가 `skills/` 원본의 실행 환경 문장을 읽고 수집 뒤에 멈췄다.
  for (const directory of agentSkillDirs) {
    const skill = readFileSync(join(directory, "SKILL.md"), "utf8");
    if (!skill.includes("${CLAUDE_PLUGIN_ROOT}")) continue;
    expect(skill, directory).toContain("플러그인 폴더의 `skills/` 는 다른 실행 환경용 원본이니 읽지 않는다.");
  }
});

test("plugin.json 의 skills 가 agent-skills 를 가리키지 않는다", () => {
  // 가리키면 Claude Code 에서 같은 이름의 원본과 사본이 함께 보인다.
  expect(plugin.skills).toEqual([]);
});
