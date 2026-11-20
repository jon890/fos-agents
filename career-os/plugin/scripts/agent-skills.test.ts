import { expect, test } from "bun:test";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { AGENT_SKILL_COPIES, AGENT_SKILLS_DIRECTORY, agentSkillDrift, hostOnlyFindings } from "./agent-skills.ts";

const pluginRoot = join(import.meta.dir, "..");
const connector = JSON.parse(readFileSync(join(pluginRoot, "connector.json"), "utf8"));
const plugin = JSON.parse(readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8"));

// fos-assistant 대시보드 plugin 이 manifest 를 읽을 때 거는 규칙을 옮겨 둔다. 어기면 이 플러그인이 카탈로그에서 통째로 빠진다.
// 원본: fos-assistant hermes/plugins/dashboard-profile-api 의 connector_agent_skills.py(`_plugin_and_agent_skills`),
// connector_skills.py(`_connector_skills`, `_skill_name`), connector_schema.py(상한), common.py(`SKILL_NAME_RE`),
// sandbox.py(`SANDBOX_ALLOWED_ENV`). 그쪽 규칙이 바뀌면 여기도 고친다.
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
  const pluginSkillNames = skillDirectories(resolve(pluginRoot, plugin.skills)).map(skillNameOf);
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

test("실행기를 부르는 사본은 실행기와 Backend 연결에 필요한 env 를 sandbox_env 로 요구한다", () => {
  // 요구하지 않으면 셸 조건을 보지 않고 늘 설치돼, 셸이 없는 에이전트에서도 돌 수 없는 스킬이 보인다.
  for (const directory of agentSkillDirs) {
    if (!readFileSync(join(directory, "SKILL.md"), "utf8").includes("${CLAUDE_PLUGIN_ROOT}")) continue;
    const name = skillNameOf(directory);
    expect(agentSkills.sandbox_env?.[name] ?? [], name).toEqual(
      expect.arrayContaining(["CLAUDE_PLUGIN_ROOT", "CAREER_BACKEND_URL", "CAREER_BACKEND_TOKEN_FILE"]),
    );
  }
});

test("agent-skills 의 사본이 skills 원본에서 만든 것과 같다", () => {
  // 어긋나면 `bun run scripts/agent-skills.ts` 로 다시 만든다.
  expect(agentSkillDrift()).toEqual([]);
  expect([...agentSkillNames].sort()).toEqual(Object.keys(AGENT_SKILL_COPIES).sort());
});

test("사본에는 Claude Code 전용 안내와 복사되지 않는 파일이 없다", () => {
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
  ])
    expect(hostOnlyFindings("sample.md", text), text).not.toEqual([]);
  expect(hostOnlyFindings("sample.md", "`write_file` 로 결과 파일을 쓴다. `${CLAUDE_PLUGIN_ROOT}` 는 셸이 푼다.")).toEqual([]);
});

test("실행기를 부르는 사본은 플러그인 폴더의 원본을 읽지 않고 이 사본의 절차만 따르라고 적는다", () => {
  // 실측(2026-11-21): 비서 에이전트가 `skills/` 원본의 실행 환경 문장을 읽고 수집 뒤에 멈췄다.
  for (const directory of agentSkillDirs) {
    const skill = readFileSync(join(directory, "SKILL.md"), "utf8");
    if (!skill.includes("${CLAUDE_PLUGIN_ROOT}")) continue;
    expect(skill, directory).toContain("플러그인 폴더의 `skills/` 는 다른 실행 환경용 원본이니 읽지 않는다.");
  }
});

test("plugin.json 의 skills 가 agent-skills 를 가리키지 않는다", () => {
  // 가리키면 Claude Code 에서 같은 이름의 원본과 사본이 함께 보인다.
  expect(plugin.skills).toBe("./connector-skills");
});
