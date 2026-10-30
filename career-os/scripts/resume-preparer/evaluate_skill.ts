/**
 * resume-preparer의 합성 사례 15~19를 도구 없는 새 Claude 대화에서 실행한다.
 * 사용법: bun run career-os/scripts/resume-preparer/evaluate_skill.ts --out /tmp/평가경로
 * 특정 사례만 재실행하려면 --only 17처럼 사례 ID를 지정한다.
 * 결과와 기대 행동은 함께 저장하지만 기대 행동을 생성 모델에 제공하지 않는다.
 * 통과 여부는 응답을 읽어 별도로 판정한다. 종료 코드 0은 실행 성공만 뜻한다.
 */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const skillDirectory = resolve(import.meta.dir, "../../plugin/skills/resume-preparer");
const outputArgument = process.argv.indexOf("--out");
const outputDirectory = outputArgument >= 0 ? process.argv[outputArgument + 1] : undefined;
if (!outputDirectory || !isAbsolute(outputDirectory))
  throw new Error("--out에 절대 경로를 지정하세요.");

type EvalCase = { id: number; prompt: string; expected_output: string; expectations: string[] };
const cases = (
  JSON.parse(readFileSync(join(skillDirectory, "evals/evals.json"), "utf8")).evals as EvalCase[]
).filter(({ id }) => id >= 15 && id <= 19);
if (cases.length !== 5 || new Set(cases.map(({ id }) => id)).size !== 5)
  throw new Error("평가 사례 15~19를 모두 확인할 수 없습니다.");
const onlyArgument = process.argv.indexOf("--only");
const selectedCases =
  onlyArgument < 0
    ? cases
    : cases.filter(({ id }) => id === Number(process.argv[onlyArgument + 1]));
if (!selectedCases.length) throw new Error("--only에 사례 ID 15~19를 지정하세요.");

const files = [
  "SKILL.md",
  ...readdirSync(join(skillDirectory, "references"))
    .sort()
    .filter((name) => name.endsWith(".md"))
    .map((name) => `references/${name}`),
];
const sources = files.map((file) => ({
  file,
  text: readFileSync(join(skillDirectory, file), "utf8"),
}));
const system = [
  "도구를 사용할 수 없는 독립 합성 평가입니다. 아래 스킬 지침을 적용해 사용자 요청에 한국어로 답하세요. 실제 파일·사이트·외부 서비스는 변경하지 않습니다.",
  ...sources.map(({ file, text }) => `# ${file}\n\n${text}`),
].join("\n\n");

mkdirSync(outputDirectory, { recursive: true });
const cwd = mkdtempSync(join(tmpdir(), "resume-skill-eval-isolated-"));
const results: Record<string, unknown>[] = [];
const environment = { ...process.env };
delete environment.CLAUDECODE;
const cliVersion = Bun.spawnSync(["claude", "--version"]).stdout.toString().trim();
let next = 0;
const runCase = async (evalCase: EvalCase) => {
  const startedAt = new Date().toISOString();
  console.log(`START case-${evalCase.id}`);
  try {
    const child = Bun.spawn(
      [
        "claude",
        "-p",
        "--safe-mode",
        "--tools",
        "",
        "--strict-mcp-config",
        "--setting-sources",
        "",
        "--disable-slash-commands",
        "--no-session-persistence",
        "--output-format",
        "json",
        "--system-prompt",
        system,
        evalCase.prompt,
      ],
      {
        cwd,
        env: environment,
        stdout: "pipe",
        stderr: "pipe",
        signal: AbortSignal.timeout(240_000),
      },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    writeFileSync(join(outputDirectory, `case-${evalCase.id}.json`), stdout);
    if (exitCode !== 0) throw new Error(`Claude 종료 코드 ${exitCode}: ${stderr.slice(0, 800)}`);
    const response = JSON.parse(stdout);
    if (response.is_error || typeof response.result !== "string" || !response.result.trim())
      throw new Error(`정상 응답이 아닙니다: ${stdout.slice(0, 400)}`);
    writeFileSync(join(outputDirectory, `case-${evalCase.id}.txt`), response.result);
    results.push({
      ...evalCase,
      startedAt,
      completedAt: new Date().toISOString(),
      execution: "succeeded",
      output: response.result,
      models: Object.keys(response.modelUsage ?? {}),
      review: "pending",
    });
    console.log(`DONE case-${evalCase.id}`);
  } catch (error) {
    results.push({
      ...evalCase,
      startedAt,
      completedAt: new Date().toISOString(),
      execution: "failed",
      error: String(error),
      review: "pending",
    });
    console.log(`FAILED case-${evalCase.id}: ${String(error)}`);
  }
};

try {
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (next < selectedCases.length) await runCase(selectedCases[next++]!);
    }),
  );
} finally {
  rmSync(cwd, { recursive: true, force: true });
}

results.sort((a, b) => Number(a.id) - Number(b.id));
writeFileSync(
  join(outputDirectory, "results.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      cliVersion,
      isolation:
        "new conversation per case; tools, MCP, settings and customizations disabled; empty temporary cwd",
      expectationsGivenToModel: false,
      sources: sources.map(({ file, text }) => ({
        file,
        sha256: createHash("sha256").update(text).digest("hex"),
      })),
      results,
    },
    null,
    2,
  ),
);
console.log(`결과: ${join(outputDirectory, "results.json")}`);
process.exitCode = results.every(({ execution }) => execution === "succeeded") ? 0 : 1;
