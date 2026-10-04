import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { type EvalCase, grade, parseTrace, skillDirectory, skillText } from "./agent-skill-eval.ts";

const agentSkillsDirectory = join(import.meta.dir, "..", "agent-skills");

function filesUnder(directory: string): string[] {
  // Hidden files such as .DS_Store are never uploaded.
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => !entry.name.startsWith(".")).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

test("일반 에이전트용 스킬은 proactive-check 하나다", () => {
  expect(readdirSync(agentSkillsDirectory).filter((name) => !name.startsWith("."))).toEqual(["proactive-check"]);
});

test("plugin.json 의 skills 가 agent-skills 를 가리키지 않는다", () => {
  // Pointing here would merge the skill into the connector agent's instructions and its 8,000-char budget.
  const plugin = JSON.parse(readFileSync(join(import.meta.dir, "..", ".claude-plugin", "plugin.json"), "utf8"));
  expect(plugin.skills).toBe("./connector-skills");
});

test("connector-skills 와 skills 에 같은 이름의 스킬이 없다", () => {
  for (const other of ["connector-skills", "skills"])
    expect(readdirSync(join(import.meta.dir, "..", other))).not.toContain("proactive-check");
});

describe("proactive-check", () => {
  const skill = readFileSync(join(skillDirectory, "SKILL.md"), "utf8");
  const front = skill.slice(4, skill.indexOf("\n---\n", 4));
  const uploaded = filesUnder(skillDirectory)
    .map((file) => relative(skillDirectory, file))
    .filter((file) => !file.startsWith("evals/"));

  // Upload limits are fos-assistant's: docs/backend/skill.md in that repository.
  test("앞머리 name 이 디렉터리 이름이고 description 이 60자 이하다", () => {
    expect(front.match(/^name: (.+)$/m)?.[1]).toBe("proactive-check");
    const description = front.match(/^description: (.+)$/m)?.[1]?.trim() ?? "";
    expect(description.length).toBeGreaterThan(0);
    expect([...description].length).toBeLessThanOrEqual(60);
  });

  test("올리는 파일은 SKILL.md 와 references 아래뿐이고 20개, 각 10만 자, 합계 1 MiB 이하다", () => {
    expect(uploaded.length).toBeLessThanOrEqual(20);
    const total = uploaded.reduce((sum, file) => sum + statSync(join(skillDirectory, file)).size, 0);
    expect(total).toBeLessThanOrEqual(1024 * 1024);
    for (const file of uploaded) {
      expect(file === "SKILL.md" || file.startsWith("references/"), file).toBe(true);
      expect(readFileSync(join(skillDirectory, file), "utf8").length, file).toBeLessThanOrEqual(100_000);
    }
  });

  test("본문이 가리키는 references 파일이 모두 있다", () => {
    const text = uploaded.map((file) => readFileSync(join(skillDirectory, file), "utf8")).join("\n");
    const links = [...text.matchAll(/`references\/([A-Za-z0-9._-]+\.md)`/g)].map((match) => match[1]!);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(existsSync(join(skillDirectory, "references", link)), link).toBe(true);
  });

  test("커리어 커넥터의 읽기 도구 셋과 네 문서 키를 적고 쓰기 도구 이름을 적지 않는다", () => {
    const text = skillText();
    for (const name of [
      "get_context_document",
      "list_study_candidates",
      "get_position_research_constraints",
      "learning-interests",
      "position-preferences",
      "application-state",
      "career-status",
    ])
      expect(text, name).toContain(name);
    expect(text).not.toMatch(/\b(save|update)_[a-z_]+/);
  });

  test("결과 계약의 칸 이름과 값을 모두 적는다", () => {
    const text = readFileSync(join(skillDirectory, "references", "result-block.md"), "utf8");
    for (const name of [
      "<fos-check-result>",
      "version",
      "outcome",
      "NOTHING_NEW",
      "FINDINGS",
      "summary",
      "findings",
      "questions",
      "followUpCandidates",
      "sourceFailures",
      "area",
      "topicKey",
      "title",
      "sourceUrl",
      "checkedAt",
      "publishedAt",
      "freshness",
      "CURRENT",
      "CLOSED",
      "STALE",
      "UNKNOWN",
      "whyItMatters",
      "facts",
      "inferences",
      "unknowns",
      "next",
      "ACTION",
      "QUESTION",
      "changeSinceLast",
    ])
      expect(text, name).toContain(name);
  });

  test("결과 블록 예가 JSON 이고 계약의 모양을 지킨다", () => {
    const text = readFileSync(join(skillDirectory, "references", "result-block.md"), "utf8");
    const blocks = [...text.matchAll(/<fos-check-result>([\s\S]*?)<\/fos-check-result>/g)].map((match) => JSON.parse(match[1]!));
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      expect(block.version).toBe(1);
      expect(["FINDINGS", "NOTHING_NEW"]).toContain(block.outcome);
      for (const finding of block.findings) {
        expect(finding.topicKey).toMatch(/^(study|position|trend):(?=.{1,80}$)[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(finding.sourceUrl).toMatch(/^https:\/\//);
        expect(finding.checkedAt).toMatch(/[+-]\d{2}:\d{2}$|Z$/);
        expect(finding.facts.length).toBeGreaterThan(0);
      }
    }
  });

  test("Claude Code 전용 표현과 저장소 경로가 없다", () => {
    for (const file of uploaded) {
      const text = readFileSync(join(skillDirectory, file), "utf8");
      for (const banned of ["${CLAUDE_PLUGIN_ROOT}", "<CAREER_LOCAL>", "career-os/", "bun "])
        expect(text.includes(banned), `${file} 에 ${banned}`).toBe(false);
    }
  });
});

describe("지침 평가", () => {
  const cases: EvalCase[] = JSON.parse(readFileSync(join(skillDirectory, "evals", "evals.json"), "utf8")).evals;

  test("#165 의 세 맥락(학습 필요, 포지션 관심, 변화 없음)이 서로 다른 기대 판정을 갖는다", () => {
    const byName = Object.fromEntries(cases.map((evalCase) => [evalCase.name, evalCase.grading]));
    expect(byName["study-needed"]?.areas).toEqual(["study"]);
    expect(byName["position-interest"]?.areas).toEqual(["position"]);
    expect(byName["no-change"]?.outcome).toBe("NOTHING_NEW");
  });

  test("fixture 파일이 모두 있고 합성 표시를 단다", () => {
    for (const evalCase of cases)
      for (const file of evalCase.files) {
        const path = join(skillDirectory, file);
        expect(statSync(path).isFile(), file).toBe(true);
        expect(readFileSync(path, "utf8"), file).toContain("지어낸 것이다");
      }
  });

  const noChange = cases.find((evalCase) => evalCase.name === "no-change")!.grading;

  test("채점은 바로 침묵한 trace 를 통과시킨다", () => {
    const trace = parseTrace(
      '설명\n<eval-trace>{"earlyNothingNew": true, "delegations": [], "areas": [], "searchQueries": [], "result": {"version": 1, "outcome": "NOTHING_NEW", "findings": []}}</eval-trace>',
    );
    expect(grade(trace, noChange).every((check) => check.pass)).toBe(true);
  });

  test("채점은 위임하거나 검색한 trace 를 떨어뜨린다", () => {
    const trace = parseTrace(
      '<eval-trace>{"earlyNothingNew": false, "delegations": ["context"], "areas": [{"area": "study", "reason": "x"}], "searchQueries": ["kafka"], "result": null}</eval-trace>',
    );
    const failed = grade(trace, noChange).filter((check) => !check.pass).map((check) => check.check);
    expect(failed).toEqual(["earlyNothingNew", "areas", "delegations", "searchQueries.count", "outcome"]);
  });

  test("채점은 검색어에 든 개인 표시를 잡는다", () => {
    const grading = cases.find((evalCase) => evalCase.name === "study-needed")!.grading;
    const trace = parseTrace(
      '<eval-trace>{"earlyNothingNew": false, "delegations": ["context"], "areas": [{"area": "study", "reason": "x"}], "searchQueries": ["orbit-정산 kafka 트랜잭션"], "result": null}</eval-trace>',
    );
    const failed = grade(trace, grading).filter((check) => !check.pass).map((check) => check.check);
    expect(failed).toEqual(["searchQueries.forbidden"]);
  });

  test("채점은 trace 가 없으면 떨어뜨린다", () => {
    expect(grade(parseTrace("답만 있다"), noChange)).toEqual([{ check: "trace", pass: false, detail: "<eval-trace> JSON 을 읽지 못했다" }]);
  });
});
