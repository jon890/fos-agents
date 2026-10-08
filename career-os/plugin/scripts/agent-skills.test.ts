import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  type DirectCall,
  type EvalCase,
  grade,
  parseTrace,
  skillDirectory,
  skillText,
} from "./agent-skill-eval.ts";

const agentSkillsDirectory = join(import.meta.dir, "..", "agent-skills");

function filesUnder(directory: string): string[] {
  // Hidden files such as .DS_Store are never uploaded.
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    });
}

test("일반 에이전트용 스킬은 proactive-check 하나다", () => {
  expect(readdirSync(agentSkillsDirectory).filter((name) => !name.startsWith("."))).toEqual([
    "proactive-check",
  ]);
});

test("plugin.json 의 skills 가 agent-skills 를 가리키지 않는다", () => {
  // Pointing here would merge the skill into the connector agent's instructions and its 8,000-char budget.
  const plugin = JSON.parse(
    readFileSync(join(import.meta.dir, "..", ".claude-plugin", "plugin.json"), "utf8"),
  );
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
    const total = uploaded.reduce(
      (sum, file) => sum + statSync(join(skillDirectory, file)).size,
      0,
    );
    expect(total).toBeLessThanOrEqual(1024 * 1024);
    for (const file of uploaded) {
      expect(file === "SKILL.md" || file.startsWith("references/"), file).toBe(true);
      expect(readFileSync(join(skillDirectory, file), "utf8").length, file).toBeLessThanOrEqual(
        100_000,
      );
    }
  });

  test("본문이 가리키는 references 파일이 모두 있다", () => {
    const text = uploaded
      .map((file) => readFileSync(join(skillDirectory, file), "utf8"))
      .join("\n");
    const links = [...text.matchAll(/(?:`|\()references\/([A-Za-z0-9._-]+\.md)(?:`|\))/g)].map(
      (match) => match[1]!,
    );
    expect(links.length).toBeGreaterThan(0);
    for (const link of links)
      expect(existsSync(join(skillDirectory, "references", link)), link).toBe(true);
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

  test("포지션 제외 판정은 코드가 하고 식별 정보를 만들지 않으며 판정 못 한 공고를 내지 않는다", () => {
    const text = skillText();
    for (const name of [
      "check_position_exclusions",
      "mcp__career__check_position_exclusions",
      "excluded",
      "undeterminable",
      "clear",
      "identity-missing",
      "constraints-hold",
      "identityHash",
      "source",
    ])
      expect(text, name).toContain(name);
    // 읽은 규칙을 모델이 직접 견주던 옛 판정 순서가 남아 있으면 안 된다.
    expect(text).not.toContain("규칙의 `url` 이 공고 주소와 같다");
    expect(text).toMatch(/주소나 제목에서 만들거나 추측하지 않는다/);
    expect(text).toMatch(/내지 않고 그 공고 판단만 보류한다/);
    // 위임 한도(max-delegations 3)에 맞춰 위임은 세 번까지다.
    expect(text).toContain("셋까지");
    const reference = readFileSync(
      join(skillDirectory, "references", "connector-queries.md"),
      "utf8",
    );
    for (const basis of ["identity-missing", "invalid-url", "rule-unreadable", "constraints-hold"])
      expect(reference, basis).toContain(basis);
  });

  test("결과 계약의 칸 이름과 값을 모두 적는다", () => {
    const text = skill;
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
      "problemCandidates",
      "problemKey",
      "problem",
      "relatedGoal",
      "evidence",
      "proposedAction",
      "confidence",
      "expectedBenefit",
      "sideEffect",
      "risk",
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
    const blocks = [...text.matchAll(/<fos-check-result>([\s\S]*?)<\/fos-check-result>/g)].map(
      (match) => JSON.parse(match[1]!),
    );
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      expect(block.version).toBe(3);
      expect(Array.isArray(block.problemCandidates)).toBe(true);
      expect(block.problemCandidates.length).toBeLessThanOrEqual(3);
      if (block.outcome === "NOTHING_NEW") expect(block.problemCandidates).toEqual([]);
      const topics = new Set(
        block.findings.map((finding: { topicKey: string }) => finding.topicKey),
      );
      for (const candidate of block.problemCandidates) {
        expect(candidate.relatedGoal.length).toBeGreaterThan(0);
        expect(candidate.evidence.length).toBeGreaterThan(0);
        for (const topic of candidate.evidence) expect(topics.has(topic)).toBe(true);
      }
      expect(["FINDINGS", "NOTHING_NEW"]).toContain(block.outcome);
      for (const finding of block.findings) {
        expect(finding.topicKey).toMatch(
          /^(study|position|trend):(?=.{1,80}$)[a-z0-9]+(?:-[a-z0-9]+)*$/,
        );
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
  const cases: EvalCase[] = JSON.parse(
    readFileSync(join(skillDirectory, "evals", "evals.json"), "utf8"),
  ).evals;

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
      '설명\n<eval-trace>{"earlyNothingNew": true, "delegations": [], "areas": [], "searchQueries": [], "result": {"version": 3, "outcome": "NOTHING_NEW", "findings": [], "problemCandidates": []}}</eval-trace>',
    );
    expect(grade(trace, noChange).every((check) => check.pass)).toBe(true);
  });

  test("일반 침묵은 v3 빈 발견과 빈 후보를 요구한다", () => {
    const trace = (result: unknown) =>
      parseTrace(
        `<eval-trace>${JSON.stringify({
          earlyNothingNew: true,
          delegations: [],
          directCalls: [],
          areas: [],
          searchQueries: [],
          result,
        })}</eval-trace>`,
      );
    for (const result of [
      { version: 1, outcome: "NOTHING_NEW", findings: [], problemCandidates: [] },
      { version: 2, outcome: "NOTHING_NEW", findings: [], problemCandidates: [] },
      { version: 3, outcome: "NOTHING_NEW", findings: [], problemCandidates: undefined },
      { version: 3, outcome: "NOTHING_NEW", findings: [], problemCandidates: {} },
      { version: 3, outcome: "NOTHING_NEW", findings: [], problemCandidates: [{}] },
      { version: 3, outcome: "NOTHING_NEW", problemCandidates: [] },
      { version: 3, outcome: "NOTHING_NEW", findings: {}, problemCandidates: [] },
    ])
      expect(grade(trace(result), noChange).every((check) => check.pass)).toBe(false);
  });

  test("결과 없는 조사 계획은 유지하고 결과를 요구하면 v3 후보 배열을 검사한다", () => {
    const plan = directTrace([]);
    plan.areas = [];
    plan.searchQueries = [];
    expect(
      grade(plan, {
        earlyNothingNew: false,
        areas: [],
        delegations: { include: [], exclude: [] },
        searchQueries: { max: 0, forbidden: [] },
      }).every((check) => check.pass),
    ).toBe(true);

    const required = {
      earlyNothingNew: false,
      areas: [],
      delegations: { include: [], exclude: [] },
      searchQueries: { max: 0, forbidden: [] },
      outcome: "FINDINGS",
    } satisfies Parameters<typeof grade>[1];
    for (const result of [
      { version: 1, outcome: "FINDINGS", findings: [], problemCandidates: [] },
      { version: 3, outcome: "FINDINGS", findings: [] },
    ])
      expect(
        grade(
          parseTrace(
            `<eval-trace>${JSON.stringify({
              earlyNothingNew: false,
              delegations: [],
              directCalls: [],
              areas: [],
              searchQueries: [],
              result,
            })}</eval-trace>`,
          ),
          required,
        ).every((check) => check.pass),
      ).toBe(false);

    const actualResult = (result: unknown) =>
      parseTrace(
        `<eval-trace>${JSON.stringify({
          earlyNothingNew: false,
          delegations: [],
          directCalls: [],
          areas: [],
          searchQueries: [],
          result,
        })}</eval-trace>`,
      );
    const optionalResult = {
      earlyNothingNew: false,
      areas: [],
      delegations: { include: [], exclude: [] },
      searchQueries: { max: 0, forbidden: [] },
    } satisfies Parameters<typeof grade>[1];
    for (const result of [
      { version: 1, outcome: "FINDINGS", findings: [], problemCandidates: [] },
      { version: 3, outcome: "FINDINGS", findings: [] },
    ])
      expect(grade(actualResult(result), optionalResult).every((check) => check.pass)).toBe(false);
    expect(
      grade(
        actualResult({ version: 3, outcome: "FINDINGS", findings: [], problemCandidates: [] }),
        optionalResult,
      ).every((check) => check.pass),
    ).toBe(true);
  });

  test("조사 계획은 명시한 null 결과만 결과 없음으로 인정한다", () => {
    const base = {
      earlyNothingNew: false,
      delegations: [],
      directCalls: [],
      areas: [],
      searchQueries: [],
    };
    const invalid = [
      { ...base, result: "FINDINGS" },
      { ...base, result: true },
      { ...base, result: 3 },
      { ...base, result: [] },
      base,
    ];
    for (const value of invalid)
      expect(
        grade(parseTrace(`<eval-trace>${JSON.stringify(value)}</eval-trace>`), {
          earlyNothingNew: false,
          areas: [],
          delegations: { include: [], exclude: [] },
          searchQueries: { max: 0, forbidden: [] },
        }),
      ).toEqual([{ check: "trace", pass: false, detail: "<eval-trace> JSON 을 읽지 못했다" }]);
  });

  test("채점은 위임하거나 검색한 trace 를 떨어뜨린다", () => {
    const trace = parseTrace(
      '<eval-trace>{"earlyNothingNew": false, "delegations": ["context"], "areas": [{"area": "study", "reason": "x"}], "searchQueries": ["kafka"], "result": null}</eval-trace>',
    );
    const failed = grade(trace, noChange)
      .filter((check) => !check.pass)
      .map((check) => check.check);
    expect(failed).toEqual([
      "earlyNothingNew",
      "areas",
      "delegations",
      "searchQueries.count",
      "result.version",
      "candidates.count",
      "outcome",
    ]);
  });

  test("채점은 검색어에 든 개인 표시를 잡는다", () => {
    const grading = cases.find((evalCase) => evalCase.name === "study-needed")!.grading;
    const trace = parseTrace(
      '<eval-trace>{"earlyNothingNew": false, "delegations": ["context"], "areas": [{"area": "study", "reason": "x"}], "searchQueries": ["orbit-정산 kafka 트랜잭션"], "result": null}</eval-trace>',
    );
    const failed = grade(trace, grading)
      .filter((check) => !check.pass)
      .map((check) => check.check);
    expect(failed).toEqual(["searchQueries.forbidden"]);
  });

  test("채점은 trace 가 없으면 떨어뜨린다", () => {
    expect(grade(parseTrace("답만 있다"), noChange)).toEqual([
      { check: "trace", pass: false, detail: "<eval-trace> JSON 을 읽지 못했다" },
    ]);
  });

  const contextCalls: DirectCall[] = [
    ...["learning-interests", "position-preferences", "application-state", "career-status"].map(
      (documentKey) => ({
        tool: "mcp__career__get_context_document",
        arguments: { documentKey },
      }),
    ),
    { tool: "mcp__career__list_study_candidates", arguments: { limit: 20 } },
  ];
  const constraintsCall: DirectCall = {
    tool: "mcp__career__get_position_research_constraints",
    arguments: {},
  };

  function directTrace(calls: DirectCall[] = contextCalls) {
    return parseTrace(
      `<eval-trace>${JSON.stringify({
        earlyNothingNew: false,
        delegations: [],
        directCalls: calls,
        areas: [{ area: "study", reason: "관심사가 바뀌었다" }],
        searchQueries: ["kafka transactions"],
        result: null,
      })}</eval-trace>`,
    )!;
  }

  test("직접 호출 평가는 맥락 도구 다섯 번과 정확한 입력을 통과시킨다", () => {
    const grading = cases.find((evalCase) => evalCase.name === "study-needed-direct")!.grading;
    expect(grade(directTrace(), grading).every((check) => check.pass)).toBe(true);
  });

  test("직접 호출 평가는 위임 대체, 문서 누락, 후보 추가 조회, 쓰기 호출을 떨어뜨린다", () => {
    const grading = cases.find((evalCase) => evalCase.name === "study-needed-direct")!.grading;
    const delegated = directTrace([]);
    delegated.delegations = ["context"];
    expect(
      grade(delegated, grading)
        .filter((check) => !check.pass)
        .map((check) => check.check),
    ).toEqual(["delegations", "directCalls"]);

    const invalidCalls = [
      contextCalls.slice(1),
      [...contextCalls, contextCalls.at(-1)!],
      [
        ...contextCalls.slice(0, -1),
        { tool: "mcp__career__list_study_candidates", arguments: { limit: 100 } },
      ],
      [...contextCalls, { tool: "mcp__career__save_context_document", arguments: {} }],
      [...contextCalls, constraintsCall],
    ];
    for (const calls of invalidCalls) {
      expect(
        grade(directTrace(calls), grading).find((check) => check.check === "directCalls")?.pass,
      ).toBe(false);
    }
  });

  test("포지션 직접 호출 평가는 제외 기준 조회를 요구한다", () => {
    const grading = cases.find((evalCase) => evalCase.name === "position-interest-direct")!.grading;
    const trace = directTrace([...contextCalls, constraintsCall]);
    trace.areas = [{ area: "position", reason: "사용자가 공고를 물었다" }];
    expect(grade(trace, grading).every((check) => check.pass)).toBe(true);
    trace.directCalls = contextCalls;
    expect(grade(trace, grading).find((check) => check.check === "directCalls")?.pass).toBe(false);
  });

  test("바로 침묵한 직접 호출 실행도 도구를 부르면 떨어뜨린다", () => {
    const grading = cases.find((evalCase) => evalCase.name === "no-change-direct")!.grading;
    const trace = directTrace();
    trace.earlyNothingNew = true;
    trace.areas = [];
    trace.searchQueries = [];
    trace.result = { version: 3, outcome: "NOTHING_NEW", findings: [], problemCandidates: [] };
    expect(grade(trace, grading).find((check) => check.check === "directCalls")?.pass).toBe(false);
    trace.directCalls = [];
    expect(grade(trace, grading).every((check) => check.pass)).toBe(true);
  });

  test("직접 호출 실패를 새 소식 없음으로 숨기면 떨어뜨린다", () => {
    const grading = cases.find((evalCase) => evalCase.name === "context-failure-direct")!.grading;
    const trace = directTrace([contextCalls[0]!]);
    trace.areas = [];
    trace.searchQueries = [];
    trace.result = { version: 3, outcome: "NOTHING_NEW", findings: [], problemCandidates: [] };
    expect(
      grade(trace, grading)
        .filter((check) => !check.pass)
        .map((check) => check.check),
    ).toEqual(["outcome", "sourceFailures"]);
    trace.result = {
      version: 3,
      outcome: "FINDINGS",
      findings: [],
      sourceFailures: ["CAREER_UNAUTHORIZED"],
      problemCandidates: [],
    };
    expect(grade(trace, grading).every((check) => check.pass)).toBe(true);
  });

  test("인증 실패로 첫 호출 뒤 멈춰도 통과하며 중복·입력 오류·쓰기 호출은 실패한다", () => {
    const grading = cases.find((evalCase) => evalCase.name === "context-failure-direct")!.grading;
    const trace = directTrace([contextCalls[0]!]);
    trace.areas = [];
    trace.searchQueries = [];
    trace.result = {
      version: 3,
      outcome: "FINDINGS",
      findings: [],
      sourceFailures: ["CAREER_UNAUTHORIZED"],
      problemCandidates: [],
    };
    expect(grade(trace, grading).every((check) => check.pass)).toBe(true);

    const invalidCalls: DirectCall[][] = [
      [],
      contextCalls,
      [contextCalls[0]!, contextCalls[1]!],
      [contextCalls[0]!, contextCalls[0]!],
      [{ tool: "mcp__career__get_context_document", arguments: { documentKey: "identity" } }],
      [{ tool: "mcp__career__list_study_candidates", arguments: { limit: 100 } }],
      [contextCalls[0]!, { tool: "mcp__career__save_context_document", arguments: {} }],
      [contextCalls[0]!, constraintsCall],
    ];
    for (const calls of invalidCalls) {
      trace.directCalls = calls;
      expect(grade(trace, grading).find((check) => check.check === "directCalls")?.pass).toBe(
        false,
      );
    }
  });

  test("실패·보류 평가는 가짜 발견과 findings 누락을 떨어뜨린다", () => {
    for (const name of ["context-failure-direct", "constraints-hold-direct"]) {
      const grading = cases.find((evalCase) => evalCase.name === name)!.grading;
      const calls = grading.directCalls!.constraints
        ? [...contextCalls, constraintsCall]
        : [contextCalls[0]!];
      const trace = directTrace(calls);
      trace.areas = grading.areas.map((area) => ({ area, reason: "합성 맥락" }));
      trace.searchQueries = [];
      trace.result = {
        version: 3,
        outcome: "FINDINGS",
        findings: [{ area: "position", title: "fabricated" }],
        sourceFailures: [grading.sourceFailure!],
        problemCandidates: [],
      };
      expect(
        grade(trace, grading)
          .filter((check) => !check.pass)
          .map((check) => check.check),
      ).toEqual(["findings.count"]);
      delete trace.result.findings;
      expect(grade(trace, grading).find((check) => check.check === "findings.count")?.pass).toBe(
        false,
      );
      trace.result.findings = [];
      expect(grade(trace, grading).every((check) => check.pass)).toBe(true);
    }
  });

  test("sourceFailures 형식이 잘못돼도 실행 오류 없이 해당 채점에서 실패한다", () => {
    const grading = cases.find((evalCase) => evalCase.name === "context-failure-direct")!.grading;
    for (const failures of [
      [{ code: "CAREER_UNAUTHORIZED" }],
      [null],
      { code: "CAREER_UNAUTHORIZED" },
    ]) {
      const trace = parseTrace(
        `<eval-trace>${JSON.stringify({
          earlyNothingNew: false,
          delegations: [],
          directCalls: [contextCalls[0]!],
          areas: [],
          searchQueries: [],
          result: {
            version: 3,
            outcome: "FINDINGS",
            findings: [],
            sourceFailures: failures,
            problemCandidates: [],
          },
        })}</eval-trace>`,
      );
      expect(
        grade(trace, grading)
          .filter((check) => !check.pass)
          .map((check) => check.check),
      ).toEqual(["sourceFailures"]);
    }
  });
});

describe("v3 문제 후보 평가", () => {
  const cases: EvalCase[] = JSON.parse(
    readFileSync(join(skillDirectory, "evals", "evals.json"), "utf8"),
  ).evals;
  const example = JSON.parse(
    [
      ...readFileSync(join(skillDirectory, "references", "result-block.md"), "utf8").matchAll(
        /<fos-check-result>([\s\S]*?)<\/fos-check-result>/g,
      ),
    ][1]![1]!,
  );
  const grading = {
    earlyNothingNew: false,
    areas: [],
    delegations: { include: [], exclude: [] },
    searchQueries: { max: 0, forbidden: [] },
    candidates: { count: 1, evidenceTopics: ["study:kafka-exactly-once"] },
  } satisfies Parameters<typeof grade>[1];
  const trace = (result: unknown) =>
    parseTrace(
      `<eval-trace>${JSON.stringify({ earlyNothingNew: false, delegations: [], directCalls: [], areas: [], searchQueries: [], result })}</eval-trace>`,
    )!;
  const fails = (result: unknown, check: string) =>
    expect(grade(trace(result), grading).find((entry) => entry.check === check)?.pass).toBe(false);

  test("근거가 있는 v3 예와 후보가 없는 정상 침묵을 통과시킨다", () => {
    expect(grade(trace(example), grading).every((entry) => entry.pass)).toBe(true);
    const quiet = cases.find((entry) => entry.name === "candidate-watch-quiet")!.grading;
    expect(
      grade(
        trace({ version: 3, outcome: "NOTHING_NEW", findings: [], problemCandidates: [] }),
        quiet,
      ).every((entry) => entry.pass),
    ).toBe(true);
  });

  test("새 발견과 빈 후보 예는 FINDINGS 이고 후보 0개 채점을 통과한다", () => {
    const blocks = [
      ...readFileSync(join(skillDirectory, "references", "result-block.md"), "utf8").matchAll(
        /<fos-check-result>([\s\S]*?)<\/fos-check-result>/g,
      ),
    ].map((match) => JSON.parse(match[1]!));
    const observation = blocks.find(
      (block) => block.outcome === "FINDINGS" && block.problemCandidates.length === 0,
    );
    expect(observation).toBeDefined();
    expect(
      grade(trace(observation), {
        ...grading,
        candidates: { count: 0, evidenceTopics: [] },
      }).every((entry) => entry.pass),
    ).toBe(true);
  });

  test("v1·v2, 후보 누락과 상한 초과를 실패시킨다", () => {
    for (const version of [1, 2]) fails({ ...example, version }, "result.version");
    fails({ ...example, problemCandidates: undefined }, "candidates.count");
    fails(
      { ...example, problemCandidates: Array(4).fill(example.problemCandidates[0]) },
      "candidates.count",
    );
  });

  test("목표·필수 칸·열거값·상한·중복 키와 변경 근거를 검사한다", () => {
    for (const patch of [
      { relatedGoal: "" },
      { problem: "" },
      { proposedAction: { type: "SAVE", text: "저장" } },
      { confidence: "CERTAIN" },
      { sideEffect: "APPROVED" },
      { expectedBenefit: "x".repeat(301) },
    ]) {
      fails(
        { ...example, problemCandidates: [{ ...example.problemCandidates[0], ...patch }] },
        "candidates.fields",
      );
    }
    const duplicated = {
      ...example,
      problemCandidates: [
        example.problemCandidates[0],
        {
          ...example.problemCandidates[0],
          problemKey: ` ${example.problemCandidates[0].problemKey.toUpperCase()} `,
        },
      ],
    };
    fails(duplicated, "candidates.fields");
    expect(
      grade(trace(example), {
        ...grading,
        candidates: { ...grading.candidates, changed: true },
      }).find((entry) => entry.check === "candidates.fields")?.pass,
    ).toBe(false);
  });

  test("다른 블록의 키·URL·빈 근거와 무효 발견을 실패시킨다", () => {
    for (const evidence of [[], ["study:other"], [example.findings[0].sourceUrl]])
      fails(
        { ...example, problemCandidates: [{ ...example.problemCandidates[0], evidence }] },
        "candidates.evidence",
      );
    for (const patch of [
      { freshness: "CLOSED" },
      { freshness: "STALE" },
      { freshness: "UNKNOWN" },
      { sourceUrl: "" },
      { checkedAt: "invalid" },
      { facts: [] },
      { next: null },
    ])
      fails(
        { ...example, findings: [{ ...example.findings[0], ...patch }] },
        "candidates.evidence",
      );
    fails({ ...example, findings: [] }, "candidates.evidence");
  });

  test("급한 문제·준비 부족·중복·침묵과 보류 시나리오를 평가한다", () => {
    const byName = Object.fromEntries(cases.map((entry) => [entry.name, entry]));
    for (const name of ["candidate-deadline", "candidate-future-preparation", "candidate-changed"])
      expect(byName[name]?.grading.candidates?.count).toBe(1);
    for (const name of [
      "candidate-observation-only",
      "candidate-duplicate",
      "candidate-existing-follow-up",
      "candidate-position-held",
      "candidate-watch-quiet",
      "candidate-no-evidence",
    ])
      expect(byName[name]?.grading.candidates?.count).toBe(0);
    expect(byName["candidate-changed"]?.grading.candidates?.changed).toBe(true);
  });
});
