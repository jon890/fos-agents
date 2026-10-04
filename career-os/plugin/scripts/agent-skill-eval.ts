// Runs the proactive-check evals against a real model through the Claude Code CLI and grades the trace.
// The fixtures stand in for tool results, so the model stops before opening sources (step 5).
// What is graded is the plan the model reports in <eval-trace>, not recorded tool calls.
// Usage: bun run scripts/agent-skill-eval.ts [--model sonnet] [--runs 3] [--only no-change] [--out /tmp/result.json]
// --out holds the full model output; keep it outside the repository.
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const skillDirectory = join(import.meta.dir, "..", "agent-skills", "proactive-check");

export type Delegation = "context" | "constraints";
export type Trace = {
  earlyNothingNew: boolean;
  delegations: Delegation[];
  areas: { area: string; reason: string }[];
  searchQueries: string[];
  result: { outcome?: string; findings?: unknown[] } | null;
};
export type Grading = {
  earlyNothingNew: boolean;
  areas: string[];
  delegations: { include: Delegation[]; exclude: Delegation[] };
  searchQueries: { min?: number; max?: number; forbidden: string[] };
  outcome?: "NOTHING_NEW" | "FINDINGS";
};
export type EvalCase = { id: number; name: string; files: string[]; grading: Grading };
export type Check = { check: string; pass: boolean; detail: string };

export function skillText(directory = skillDirectory): string {
  const references = join(directory, "references");
  const parts = [`# skill_view(name="proactive-check")\n\n${readFileSync(join(directory, "SKILL.md"), "utf8")}`];
  for (const file of readdirSync(references).sort())
    parts.push(`# references/${file}\n\n${readFileSync(join(references, file), "utf8")}`);
  return parts.join("\n\n");
}

export function systemPrompt(skill: string): string {
  return [
    "너는 fos-assistant 의 일반 커리어 에이전트다. 지금은 Control Plane 이 연 먼저 살펴보기 turn 이다.",
    "아래는 skill_view 가 돌려준 지침과 그 references 다. 이 지침을 따른다.",
    "",
    skill,
    "",
    "# 평가 실행",
    "이 실행은 평가라 도구를 실제로 부를 수 없다.",
    "사용자 메시지의 「실행 입력」, 「Memory 문맥」, 「점검 대화의 앞 내용」 이 실제 실행에서 받는 것이다.",
    "「위임하면 받는 답」 은 커넥터에 맡겼을 때 돌아올 답이고, 아직 받지 않은 답이다. 지침에 따라 맡기기로 한 질의의 답만 읽고, 맡기지 않은 질의의 답은 없는 것으로 본다.",
    "지침의 단계를 따르되 원문을 여는 일은 하지 않는다. 원문을 찾기 전에 하는 위임과 검색어 계획까지만 한다.",
    "delegations 에는 지침에 따라 실제로 맡기기로 한 질의를 빠짐없이 적는다. 답을 읽어 판단에 쓴 질의는 맡긴 것이다. 답이 주어졌다는 이유만으로 적지는 않는다.",
    "답 끝에 아래 모양의 JSON 하나를 <eval-trace> 와 </eval-trace> 로 감싸 낸다.",
    '{"earlyNothingNew": 2단계에서 바로 침묵했으면 true, "delegations": 맡긴 질의 목록. 맥락 읽기는 "context", 제외 기준은 "constraints", "areas": [{"area": "study 나 position 이나 trend", "reason": "맥락의 사실 한 줄"}], "searchQueries": web_search 에 넣을 검색어 목록, "result": 고른 영역이 없으면 <fos-check-result> 안에 넣을 JSON, 영역을 골랐으면 null}',
  ].join("\n");
}

export function parseTrace(output: string): Trace | null {
  const matches = [...output.matchAll(/<eval-trace>([\s\S]*?)<\/eval-trace>/g)];
  const last = matches.at(-1)?.[1];
  if (!last) return null;
  try {
    const parsed = JSON.parse(last.trim());
    return {
      earlyNothingNew: parsed.earlyNothingNew === true,
      delegations: Array.isArray(parsed.delegations) ? parsed.delegations : [],
      areas: Array.isArray(parsed.areas) ? parsed.areas : [],
      searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries.map(String) : [],
      result: parsed.result && typeof parsed.result === "object" ? parsed.result : null,
    };
  } catch {
    return null;
  }
}

export function grade(trace: Trace | null, grading: Grading): Check[] {
  if (!trace) return [{ check: "trace", pass: false, detail: "<eval-trace> JSON 을 읽지 못했다" }];
  const checks: Check[] = [];
  const add = (check: string, pass: boolean, detail: string) => checks.push({ check, pass, detail });

  add("earlyNothingNew", trace.earlyNothingNew === grading.earlyNothingNew, `${trace.earlyNothingNew}`);

  const areas = [...new Set(trace.areas.map((entry) => entry.area))].sort();
  add("areas", JSON.stringify(areas) === JSON.stringify([...grading.areas].sort()), JSON.stringify(areas));

  const delegations = new Set(trace.delegations);
  const missing = grading.delegations.include.filter((name) => !delegations.has(name));
  const extra = grading.delegations.exclude.filter((name) => delegations.has(name));
  add("delegations", missing.length === 0 && extra.length === 0, JSON.stringify([...delegations]));

  const count = trace.searchQueries.length;
  const { min = 0, max = Number.POSITIVE_INFINITY, forbidden } = grading.searchQueries;
  add("searchQueries.count", count >= min && count <= max, `${count}`);
  const leaked = trace.searchQueries.filter((query) =>
    forbidden.some((word) => query.toLowerCase().includes(word.toLowerCase())),
  );
  add("searchQueries.forbidden", leaked.length === 0, JSON.stringify(leaked));

  if (grading.outcome) {
    const outcome = trace.result?.outcome;
    const findings = trace.result?.findings ?? [];
    const pass = outcome === grading.outcome && (outcome !== "NOTHING_NEW" || findings.length === 0);
    add("outcome", pass, `${outcome}`);
  }
  return checks;
}

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

const RUN_TIMEOUT_MS = 180_000;
const CONCURRENCY = 4;

async function runOnce(model: string, system: string, user: string, cwd: string): Promise<string> {
  // No tools, no MCP servers, no user or project settings, and an empty working directory,
  // so the model sees the skill and the fixture rather than this repository.
  const child = Bun.spawn(
    ["claude", "-p", "--model", model, "--tools", "", "--strict-mcp-config", "--setting-sources", "", "--no-session-persistence", "--system-prompt", system, user],
    { cwd, stdout: "pipe", stderr: "pipe", signal: AbortSignal.timeout(RUN_TIMEOUT_MS) },
  );
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (code !== 0) throw new Error(`claude 종료 코드 ${code}: ${stderr.slice(0, 500)}`);
  return stdout;
}

if (import.meta.main) {
  const model = argument("model", "sonnet");
  const runs = Number(argument("runs", "1"));
  if (!Number.isInteger(runs) || runs < 1) throw new Error(`--runs 는 1 이상의 정수다: ${argument("runs", "1")}`);
  const only = argument("only", "");
  const out = argument("out", "");
  const cases: EvalCase[] = JSON.parse(readFileSync(join(skillDirectory, "evals", "evals.json"), "utf8")).evals;
  const system = systemPrompt(skillText());

  const jobs = cases
    .filter((evalCase) => !only || evalCase.name === only)
    .flatMap((evalCase) => Array.from({ length: runs }, (_, run) => ({ evalCase, run })));
  if (jobs.length === 0) throw new Error(`돌릴 평가가 없다: --only ${only}`);
  const cwd = mkdtempSync(join(tmpdir(), "proactive-check-eval-"));

  type Result = { name: string; run: number; trace: Trace | null; checks: Check[]; output: string };
  const results: Result[] = [];
  const evaluate = async (evalCase: EvalCase, run: number): Promise<Result> => {
    const user = evalCase.files.map((file) => readFileSync(join(skillDirectory, file), "utf8")).join("\n\n");
    try {
      const output = await runOnce(model, system, user, cwd);
      const trace = parseTrace(output);
      return { name: evalCase.name, run, trace, checks: grade(trace, evalCase.grading), output };
    } catch (error) {
      return { name: evalCase.name, run, trace: null, checks: [{ check: "run", pass: false, detail: String(error) }], output: "" };
    }
  };
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { evalCase, run } = jobs[next++]!;
      results.push(await evaluate(evalCase, run));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  results.sort((a, b) => a.name.localeCompare(b.name) || a.run - b.run);

  for (const result of results) {
    const failed = result.checks.filter((check) => !check.pass);
    const areas = result.trace ? result.trace.areas.map((entry) => entry.area).join(",") || "-" : "?";
    console.log(`${failed.length === 0 ? "PASS" : "FAIL"} ${result.name}#${result.run} areas=${areas} delegations=${result.trace?.delegations.join(",") || "-"} queries=${result.trace?.searchQueries.length ?? "?"}`);
    for (const check of failed) console.log(`  - ${check.check}: ${check.detail}`);
  }
  if (out) writeFileSync(out, JSON.stringify({ model, runs, results }, null, 2));
  process.exit(results.every((result) => result.checks.every((check) => check.pass)) ? 0 : 1);
}
