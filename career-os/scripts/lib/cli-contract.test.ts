import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildPostingCandidatePool } from "../position-recommender/live-postings/candidate_pool.ts";
import { validateRecommendationFiles } from "../position-recommender/validate_recommendation.ts";
import { writeCandidatePreview } from "../position-recommender/render_candidate_preview.ts";
import { writeRecommendation } from "../position-recommender/render_recommendation.ts";
import { runInterviewQuestionSources } from "../interview-question-sources/cli.ts";
import { buildReadingSourceTemplate, listReadingSources } from "../study-topic-recommender/manage_reading_sources.ts";
import { validateMorningReadingOutputs } from "../study-topic-recommender/validate_outputs.ts";
import { firstOptionValue } from "./cli.ts";

const scripts = resolve(import.meta.dir, "..");
let directory: string;
let input: string;
let candidates: string;
let output: string;

function invoke(script: string, args: string[] = [], imported = false) {
  const path = resolve(scripts, script);
  const command = imported ? ["-e", `await import(${JSON.stringify(path)})`, ...args] : [path, ...args];
  const result = Bun.spawnSync([process.execPath, ...command], {
    cwd: directory,
    env: { ...process.env, CAREER_OS_ROOT: "", TMPDIR: tmpdir() },
    stdout: "pipe", stderr: "pipe",
  });
  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
}

beforeAll(() => {
  directory = mkdtempSync("/tmp/career-cli-contract.");
  input = join(directory, "recommendation.json");
  candidates = join(directory, "pool.json");
  output = join(directory, "report.html");
  const { pool } = buildPostingCandidatePool([{
    source: "wanted", company: "예시", title: "백엔드 개발자", url: "https://example.com/jobs/1",
    linkType: "direct_posting", postingStatus: "active", activeEvidence: "상세 API 상태 확인",
    openedAt: "", closesAt: "", daysUntilClose: "", closeUrgency: "no_deadline", category: "개발",
    summary: "", tags: [], skills: ["Java"], dueTime: "", mainTasks: "서버 개발", requirements: "Java", preferred: "",
  }], {
    collectionRunId: "test-run", collectedAt: "2026-08-13T00:00:00.000Z", requestedSource: "all",
    configuredSources: ["wanted"], wantedLimit: 120, includeTossArticles: false, sourceDiagnostics: [], errors: [],
  });
  writeFileSync(candidates, JSON.stringify(pool));
  writeFileSync(input, JSON.stringify({
    schemaVersion: 5, reportDate: "2026-08-13", generatedAt: "2026-08-13T09:00:00+09:00",
    conclusion: ["결론"], background: ["배경"], tiers: { strong: [], stretch: [], hold: [] },
    candidateRanking: [{ candidateId: pool.candidates[0].id, rank: 1, upsideDirection: "확인 필요", oneLineReason: "추가 확인이 필요하다." }],
    additionalTargets: [], recentCheck: ["확인"], weeklyActions: { apply: "지원", resume: "수정", study: "학습" },
    sourceSnapshot: { collectionRunId: pool.collectionRunId, candidatePoolPath: "pool.json" },
  }));
  writeFileSync(join(directory, "invalid.json"), "{}");
});

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("CLI 밖에서 호출하는 핵심 함수", () => {
  test("추천 파일 검사 결과에 검증된 추천과 후보풀을 반환한다", () => {
    const result = validateRecommendationFiles(input, candidates);
    expect(result.passed).toBe(true);
    if (!result.passed) throw new Error("fixture 검증 실패");
    expect(result.run.sourceSnapshot.collectionRunId).toBe(result.pool.collectionRunId);
    const invalid = validateRecommendationFiles(join(directory, "invalid.json"), "missing-pool");
    expect(invalid.passed).toBe(false);
    if (invalid.passed) throw new Error("잘못된 입력을 허용함");
    expect(invalid.errors[0]).toStartWith("schemaVersion:");
  });

  test("생성 함수는 경로를 반환하고 실패하면 기존 출력 파일을 보존한다", () => {
    const target = join(directory, "core-output.html");
    expect(writeCandidatePreview(input, candidates, target)).toEqual({ passed: true, outputPath: target });
    expect(writeRecommendation(input, target, "md")).toEqual({ status: "written", outputPath: target });
    const content = readFileSync(target, "utf8");
    expect(writeRecommendation(input, target, "pdf")).toEqual({ status: "unsupported-format" });
    expect(writeCandidatePreview(join(directory, "invalid.json"), candidates, target).passed).toBe(false);
    expect(readFileSync(target, "utf8")).toBe(content);
  });

  test("질문 소스 함수는 stdout 대신 데이터를 반환한다", async () => {
    expect(await runInterviewQuestionSources("validate", [])).toMatchObject({ status: "ok" });
    expect(Array.isArray(await runInterviewQuestionSources("list", []))).toBe(true);
    await expect(runInterviewQuestionSources("collect", [])).rejects.toThrow("collect에는 --output과 --cache-dir가 필요하다.");
  });

  test("읽을거리 목록과 템플릿은 명시한 입력으로 생성한다", () => {
    const sources = listReadingSources("techBlog", true);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source, index) => source.category === "techBlog" && source.registrationOrder === index + 1)).toBe(true);
    const template = buildReadingSourceTemplate(["--key", "core-example", "--category", "techBlog", "--title", "예시", "--feed-url", "https://example.com/feed.xml"]);
    expect(template).toEqual({ key: "core-example", category: "techBlog", title: "예시", enabled: true, feedUrl: "https://example.com/feed.xml" });
  });

  test("산출물 검사 실패는 호출자에게 예외로 전달한다", () => {
    expect(() => validateMorningReadingOutputs(directory)).toThrow("산출물이 없거나 비어 있다");
  });

  test("첫 옵션값 조회는 원본 argv를 변경하지 않는다", () => {
    const args = ["--input", "--next", "--input", "last", "--empty"];
    expect(firstOptionValue(args, "--input")).toBe("--next");
    expect(firstOptionValue(args, "--empty")).toBeUndefined();
    expect(firstOptionValue(args, "--absent")).toBeUndefined();
    expect(args).toEqual(["--input", "--next", "--input", "last", "--empty"]);
  });
});

describe("추천 CLI 호환 계약", () => {
  const validator = "position-recommender/validate_recommendation.ts";
  const preview = "position-recommender/render_candidate_preview.ts";
  const renderer = "position-recommender/render_recommendation.ts";

  test("사용법과 help는 기존 stderr 및 종료 코드 2를 유지한다", () => {
    for (const script of [validator, preview, renderer]) {
      const missing = invoke(script);
      expect(missing.code).toBe(2);
      expect(missing.out).toBe("");
      expect(missing.err).toContain(script.split("/")[1]);
      expect(invoke(script, ["--help"])).toEqual(missing);
    }
  });

  test("검증기는 첫 중복 옵션을 선택하고 모르는 옵션과 위치 인자를 무시한다", () => {
    expect(invoke(validator, ["ignored", "--input", input, "--input", "missing", "--candidates", candidates, "--unknown"]))
      .toEqual({ code: 0, out: "추천 결과와 공고 후보풀이 일치합니다.\n", err: "" });
  });

  test("검증 실패 문구와 출력 채널을 렌더러도 보존한다", () => {
    const invalid = join(directory, "invalid.json");
    const validation = invoke(validator, ["--input", invalid, "--candidates", "missing"]);
    expect(validation.code).toBe(1);
    expect(validation.out).toBe("");
    expect(validation.err).toContain("schemaVersion:");
    expect(invoke(preview, ["--input", invalid, "--candidates", "missing", "--output", output])).toEqual(validation);
  });

  test("후보풀 불일치는 HTML을 만들기 전에 실패한다", () => {
    const bad = join(directory, "mismatch.json");
    const run = JSON.parse(readFileSync(input, "utf8"));
    run.sourceSnapshot.collectionRunId = "another-run";
    writeFileSync(bad, JSON.stringify(run));
    expect(invoke(preview, ["--input", bad, "--candidates", candidates, "--output", output]))
      .toEqual({ code: 1, out: "", err: "추천 결과의 수집 실행 ID가 후보풀과 다르다.\n" });
  });

  test("미리보기 기본값과 all, 숫자 limit은 HTML과 텍스트 성공 출력을 유지한다", () => {
    for (const limit of [[], ["--limit", "all"], ["--limit", "1"], ["--limit", "0"]]) {
      const result = invoke(preview, ["--input", input, "--candidates", candidates, "--output", output, ...limit]);
      expect(result).toEqual({ code: 0, out: `포지션 추천 HTML: ${output}\n`, err: "" });
      expect(readFileSync(output, "utf8")).toContain("<!doctype html>");
    }
  });

  test("md/html 렌더러는 마지막 중복 옵션과 기존 format 검증 순서를 유지한다", () => {
    for (const format of ["md", "html"]) {
      expect(invoke(renderer, ["--input", "missing", "--input", input, "--output", output, "--format", format]))
        .toEqual({ code: 0, out: `recommendation ${format}: ${output}\n`, err: "" });
      expect(readFileSync(output, "utf8").length).toBeGreaterThan(100);
    }
    const invalid = invoke(renderer, ["--input", input, "--output", output, "--format", "pdf"]);
    expect(invalid).toEqual(invoke(renderer));
    const schemaFirst = invoke(renderer, ["--input", join(directory, "invalid.json"), "--output", output, "--format", "pdf"]);
    expect(schemaFirst.code).toBe(1);
    expect(schemaFirst.err).toStartWith("recommendation.json schema 검증 실패:\n");
  });

  test("파일 읽기 실패는 기존 uncaught 오류와 코드 1을 유지한다", () => {
    const result = invoke(validator, ["--input", "missing.json", "--candidates", candidates]);
    expect(result.code).toBe(1);
    expect(result.out).toBe("");
    expect(result.err).toContain("ENOENT");
  });

  test("옵션 모양의 토큰도 기존처럼 첫 옵션의 값으로 읽는다", () => {
    const result = invoke(validator, ["--input", "--candidates", candidates]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("ENOENT");
    expect(result.err).toContain("--candidates");
  });

  test("import는 실행하거나 출력하지 않는다", () => {
    for (const script of [validator, preview, renderer, "interview-drill/application_question_schema.ts", "interview-drill/drill-engine.ts", "study-topic-recommender/morning_reading_cli.ts"]) {
      expect(invoke(script, [], true)).toEqual({ code: 0, out: "", err: "" });
    }
  });
});

describe("기존 명령 및 공용 runCli", () => {
  test("질문 소스의 기본 validate, list, 사용법 오류를 보존하고 import는 실행하지 않는다", () => {
    const script = "interview-question-sources/cli.ts";
    const result = invoke(script);
    expect(result.code).toBe(0);
    expect(result.err).toBe("");
    expect(JSON.parse(result.out)).toMatchObject({ status: "ok" });
    expect(invoke(script, [], true)).toEqual({ code: 0, out: "", err: "" });
    expect(Array.isArray(JSON.parse(invoke(script, ["list"]).out))).toBe(true);
    expect(invoke(script, ["collect"])).toEqual({ code: 1, out: "", err: "collect에는 --output과 --cache-dir가 필요하다.\n" });
  });

  test("읽을거리 관리의 help, JSON 템플릿과 첫 옵션값을 보존한다", () => {
    const script = "study-topic-recommender/manage_reading_sources.ts";
    const help = invoke(script);
    expect(help.code).toBe(0);
    expect(help.err).toBe("");
    expect(invoke(script, ["--help"])).toEqual(help);
    expect(invoke(script, [], true)).toEqual({ code: 0, out: "", err: "" });
    expect(invoke(script, ["template"])).toEqual({ code: 1, out: "", err: "--key 값이 필요하다.\n" });
    const list = invoke(script, ["list", "--category", "techBlog", "--category", "video", "--include-disabled"]);
    expect(list.code).toBe(0);
    expect(JSON.parse(list.out).every((item: { category: string }) => item.category === "techBlog")).toBe(true);
    const template = invoke(script, ["template", "--key", "example-test-feed", "--category", "techBlog", "--title", "예시", "--feed-url", "https://example.com/feed.xml", "--adapter", "feed"]);
    expect(template.code).toBe(0);
    expect(template.err).toBe("");
    expect(JSON.parse(template.out)).toEqual({ key: "example-test-feed", category: "techBlog", title: "예시", enabled: true, feedUrl: "https://example.com/feed.xml", adapter: "feed" });
  });

  test("아침 읽을거리의 경로 검증이 네트워크 실행보다 먼저 실패한다", () => {
    for (const script of ["study-topic-recommender/morning_reading_cli.ts", "study-topic-recommender/build_morning_reading.ts"]) {
      expect(invoke(script, ["--library", "--collect-only"]))
        .toEqual({ code: 2, out: "", err: "CAREER_OS_ROOT 또는 --run-dir에 시스템 임시 실행 경로를 지정해야 한다.\n" });
    }
  });

  test("산출물 검증기의 경로 실패 코드 2를 보존하고 import는 실행하지 않는다", () => {
    const script = "study-topic-recommender/validate_outputs.ts";
    const result = invoke(script);
    expect(result).toEqual({ code: 2, out: "", err: "CAREER_OS_ROOT 또는 --run-dir에 시스템 임시 실행 경로를 지정해야 한다.\n" });
    expect(invoke(script, [], true)).toEqual({ code: 0, out: "", err: "" });
  });

  test("기존 runCli의 JSON, help와 사용법 오류 계약을 보존한다", () => {
    const fixture = join(directory, "run-cli.ts");
    writeFileSync(fixture, `import { runCli, UsageError } from ${JSON.stringify(join(scripts, "lib/cli.ts"))};\nawait runCli({name: 'fixture', summary: 'test', positional: [{name:'input', description:'input'}]}, ({positional}) => {if(positional[0] === 'usage') throw new UsageError('bad input'); if(positional[0] === 'error') throw new Error('failed'); return {passed: positional[0] === 'ok', value: positional[0]};});`);
    expect(invoke(fixture, ["ok"])).toEqual({ code: 0, out: '{\n  "passed": true,\n  "value": "ok"\n}\n', err: "" });
    expect(invoke(fixture, ["no"]).code).toBe(1);
    expect(invoke(fixture, ["error"])).toEqual({ code: 1, out: "", err: '{\n  "passed": false,\n  "error": "failed"\n}\n' });
    expect(invoke(fixture, ["--help"]).code).toBe(0);
    expect(invoke(fixture, ["usage"]).code).toBe(2);
    expect(invoke(fixture).code).toBe(2);
  });
});
