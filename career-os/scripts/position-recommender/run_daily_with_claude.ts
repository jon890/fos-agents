#!/usr/bin/env bun
import { existsSync, copyFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  buildStructuredRecommendationRun,
  summarizeStructuredRecommendationQuality,
  writeStructuredRecommendationRun,
  type ParsedRecommendationCandidate,
} from "./structured_recommendation_items";
import { RecommendationRun, type RecommendationRunType, type PositionItemType } from "./recommendation_schema.ts";

const DEFAULT_CONTEXT =
  [
    "매일 서버/backend 정규직 포지션 추천.",
    "data/runtime/live-position-postings.md의 direct active/open 개별 공고만 강력 추천/도전 추천에 포함.",
    "회사 홈, 탐색 링크, 상태 unknown, 닫힌 공고는 추천 티어에서 제외.",
    "Java/Spring backend를 기본으로 보고, 서버/플랫폼 전이가 분명한 AI/AX/Agent/Payments/Wallet 공고도 평가.",
    "AI Agent/RAG/MCP/LLMOps/ML Backend처럼 백엔드 강점과 AI 응용 경험을 함께 쓰는 공고는 AI 전환 후보로 별도 검토.",
    "우선 회사군: LINE, NAVER/네이버페이/네이버파이낸셜, 당근/당근페이, 카카오페이/카카오뱅크/카카오모빌리티, Coupang/Coupang Pay, 우아한형제들, 오늘의집, 무신사, 컬리, 야놀자.",
    "최근 7일 추천 반복은 감점하고, 신규 active 공고가 있으면 최소 1개 포함.",
    "강력 추천은 NHN 대비 회사 upside와 role-fit이 모두 분명한 경우만 허용.",
    "토스 계열은 2026-06-15부터 쿨다운 해제. active/open 개별 공고와 JD fit이 충분하면 다른 상위 회사군과 같은 기준으로 추천.",
    "레브잇/올웨이즈/다니엘프로젝트/리아드코퍼레이션/피닉스랩/와그는 추천 액션에서 제외.",
    "30~70줄로 압축해 오늘의 결론, 강력 추천, 도전 추천, 보류·주의, 최근 반복 점검을 작성.",
  ].join(" ");

const DEFAULT_CLAUDE_TIMEOUT_MS = 9 * 60 * 1000;
const DEFAULT_CLAUDE_NO_OUTPUT_MS = 4 * 60 * 1000;

// Discord 카드용 추천 후보. recommendation.json의 strong/stretch에서 직접 만든다.
interface Candidate {
  section: "strong" | "stretch";
  company: string;
  title: string;
  searchKeywords: string[];
  whyFit: string;
  postingUrl: string;
}

function recommendationToCandidates(run: RecommendationRunType): Candidate[] {
  const fromTier = (items: PositionItemType[], section: Candidate["section"]): Candidate[] =>
    items.map((item) => ({
      section,
      company: item.company,
      title: item.title,
      searchKeywords: item.searchKeywords,
      whyFit: item.whyFit,
      postingUrl: item.postingUrl,
    }));
  return [...fromTier(run.tiers.strong, "strong"), ...fromTier(run.tiers.stretch, "stretch")];
}

function kstDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function usage(): void {
  console.log(`usage: run_daily_with_claude.ts [context]
       run_daily_with_claude.ts --validate-existing

Runs the Claude CLI compatibility backend for /position-recommender and verifies that today's
Asia/Seoul report and runtime mirror were freshly written.

Environment:
  POSITION_RECOMMENDER_SOURCE=all|wanted|toss|coupang|coupang-careers|kakaopay|kakaopay-securities|kakaomobility|naver-careers
    Source selection for live posting collection. Default: all.
  POSITION_RECOMMENDER_NOTIFY=0  Skip Discord notification.
  POSITION_RECOMMENDER_NOTIFY_DRY_RUN=1  Print the Discord message instead of sending it.
  POSITION_RECOMMENDER_CLAUDE_TIMEOUT_MS=<n>  Kill Claude after this total runtime. Default: ${DEFAULT_CLAUDE_TIMEOUT_MS}.
  POSITION_RECOMMENDER_CLAUDE_NO_OUTPUT_MS=<n>  Kill Claude if stdout/stderr is silent this long. Default: ${DEFAULT_CLAUDE_NO_OUTPUT_MS}.
  POSITION_RECOMMENDER_CLAUDE_LOG_STREAM=1  Forward raw Claude stream-json stdout to logs.
  FOS_CAREER_ROOT=<path>  fos-career repo for DB ingest. Default: ~/services/fos-career.
  DATABASE_URL=<mysql-url>  Required by fos-career ingest.
  FOS_CAREER_DATABASE_URL=<mysql-url>  Host-side override for fos-career ingest.`);
}

function run(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runOutput(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf-8",
    env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout ?? "";
}

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

function envMs(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    die(`${name} must be a positive integer milliseconds value: ${raw}`);
  }
  return value;
}

async function runClaudeWithGuards(args: string[], cwd: string): Promise<void> {
  const timeoutMs = envMs("POSITION_RECOMMENDER_CLAUDE_TIMEOUT_MS", DEFAULT_CLAUDE_TIMEOUT_MS);
  const noOutputMs = envMs("POSITION_RECOMMENDER_CLAUDE_NO_OUTPUT_MS", DEFAULT_CLAUDE_NO_OUTPUT_MS);
  const child = spawn("claude", args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  let finished = false;
  let killReason = "";
  let lastProgressLog = 0;
  let totalTimer: ReturnType<typeof setTimeout>;
  let noOutputTimer: ReturnType<typeof setTimeout>;

  const killChild = (reason: string) => {
    if (finished) return;
    if (killReason) return;
    killReason = reason;
    console.error(`position-recommender claude guard: ${reason}`);
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    } else {
      child.kill("SIGTERM");
    }
    setTimeout(() => {
      if (finished || !child.pid) return;
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, 5_000).unref();
  };

  const resetNoOutputTimer = () => {
    clearTimeout(noOutputTimer);
    noOutputTimer = setTimeout(
      () => killChild(`no stdout/stderr for ${noOutputMs}ms`),
      noOutputMs
    );
    noOutputTimer.unref();
  };

  totalTimer = setTimeout(() => killChild(`exceeded total timeout ${timeoutMs}ms`), timeoutMs);
  totalTimer.unref();
  noOutputTimer = setTimeout(() => killChild(`no stdout/stderr for ${noOutputMs}ms`), noOutputMs);
  noOutputTimer.unref();

  const onStdout = (chunk: Buffer) => {
    resetNoOutputTimer();
    if (process.env.POSITION_RECOMMENDER_CLAUDE_LOG_STREAM === "1") {
      process.stdout.write(chunk);
      return;
    }
    const now = Date.now();
    if (now - lastProgressLog > 30_000) {
      lastProgressLog = now;
      console.error("position-recommender claude progress: stream output received");
    }
  };
  const onStderr = (chunk: Buffer) => {
    resetNoOutputTimer();
    process.stderr.write(chunk);
  };
  child.stdout.on("data", onStdout);
  child.stderr.on("data", onStderr);

  return new Promise((resolvePromise, reject) => {
    child.on("error", (error) => {
      finished = true;
      clearTimeout(totalTimer);
      clearTimeout(noOutputTimer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      finished = true;
      clearTimeout(totalTimer);
      clearTimeout(noOutputTimer);
      if (killReason) {
        reject(new Error(`claude terminated: ${killReason}`));
        return;
      }
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`claude exited with code ${code ?? "null"} signal ${signal ?? "null"}`));
    });
  });
}

function assertLivePostingSnapshot(path: string): void {
  const content = readFileSync(path, "utf-8");
  if (!content.includes("link_type: direct_posting")) {
    die(`position-recommender live-postings: no direct postings collected: ${path}`);
  }
  if (!/posting_status: (active|open)/.test(content)) {
    die(`position-recommender live-postings: no active/open postings collected: ${path}`);
  }
  if (/link_type: (career_article|search_page)|posting_status: unknown|opened_at: unknown/.test(content)) {
    die(`position-recommender live-postings: non-active or non-direct lead leaked into active-only snapshot: ${path}`);
  }
}

function loadRecommendationRun(path: string): RecommendationRunType {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  const parsed = RecommendationRun.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    die(`position-recommender recommendation.json schema 검증 실패: ${path}\n${issues}`);
  }
  return parsed.data;
}

// ===== items용: 파생 report.md를 파싱해 ParsedRecommendationCandidate 생성 =====

function trimValue(value: string): string {
  return value.trim().replace(/[\s,，]+$/, "");
}

function firstSentence(value: string): string {
  const trimmed = trimValue(value);
  const sentenceEnd = trimmed.indexOf(". ");
  return sentenceEnd > 0 ? trimmed.slice(0, sentenceEnd + 1) : trimmed;
}

function firstListItem(value: string): string {
  const trimmed = trimValue(value).replace(/^\([0-9]+\)\s*/, "");
  return trimValue(trimmed.split(/\([0-9]+\)/)[0] ?? "");
}

function parseRecommendationCandidates(content: string): ParsedRecommendationCandidate[] {
  const candidates: ParsedRecommendationCandidate[] = [];
  let section: ParsedRecommendationCandidate["section"] | "" = "";
  let current: ParsedRecommendationCandidate | null = null;

  const flush = () => {
    if (current) candidates.push(current);
    current = null;
  };

  for (const line of content.split(/\r?\n/)) {
    if (/^## 강력 추천/.test(line)) {
      flush();
      section = "strong";
      continue;
    }
    if (/^## 도전 추천/.test(line)) {
      flush();
      section = "stretch";
      continue;
    }
    if (/^## /.test(line)) {
      flush();
      section = "";
      continue;
    }
    if (section && /^(### )?[0-9]+\. /.test(line)) {
      flush();
      current = {
        section,
        title: line.replace(/^(### )?[0-9]+\. /, ""),
        postingLink: "",
        evidence: "",
        summary: "",
        check: "",
        action: "",
      };
      continue;
    }
    if (!section || !current) continue;
    const label = line.match(/^\s*- ([^:]+):\s*(.*)$/);
    if (!label) continue;
    const [, key, rawValue] = label;
    const value = rawValue ?? "";
    if (key === "공고 링크") current.postingLink = value;
    if (key === "링크 근거 수준") current.evidence = value;
    if (key === "왜 맞는가") current.summary = firstSentence(value);
    if (key === "확인해야 할 모호점") current.check = firstListItem(value);
    if (key === "준비 액션") current.action = firstSentence(value);
  }
  flush();
  return candidates;
}

function validateDirectPostingRecommendations(runtimePath: string): ParsedRecommendationCandidate[] {
  const content = readFileSync(runtimePath, "utf-8");
  const candidates = parseRecommendationCandidates(content);
  let bad = false;
  for (const candidate of candidates) {
    if (!/^https?:\/\//.test(candidate.postingLink)) {
      console.error(
        `position-recommender invalid recommendation: ${candidate.section} item lacks direct posting link: ${candidate.title}`
      );
      bad = true;
    }
    if (!/개별 공고 (active|open) 확인/.test(candidate.evidence)) {
      console.error(
        `position-recommender invalid recommendation: ${candidate.section} item lacks direct active/open evidence: ${candidate.title}`
      );
      bad = true;
    }
  }
  if (bad) process.exit(1);
  return candidates;
}

function formatDiscordCandidates(candidates: Candidate[]): string {
  const lines: string[] = [];
  const counts = { strong: 0, stretch: 0 };
  let currentSection: Candidate["section"] | "" = "";
  for (const candidate of candidates) {
    if (candidate.section === "strong" && counts.strong >= 3) continue;
    if (candidate.section === "stretch" && counts.stretch >= 2) continue;
    if (candidate.section !== currentSection) {
      if (lines.length > 0) lines.push("");
      lines.push(candidate.section === "strong" ? "강력 추천:" : "도전 추천:");
      currentSection = candidate.section;
    }
    counts[candidate.section]++;
    const itemNo = counts[candidate.section];
    const link = /^https?:\/\//.test(candidate.postingUrl) ? `<${candidate.postingUrl}>` : "-";
    const stack = candidate.searchKeywords.length > 0 ? candidate.searchKeywords.join(", ") : "-";
    lines.push(`${itemNo}. ${candidate.company} — ${candidate.title}`);
    lines.push(`   스택: ${stack}`);
    lines.push(`   한줄: ${candidate.whyFit || "-"}`);
    lines.push(`   링크: ${link}`);
  }
  if (lines.length === 0) return "강력 추천:\n\n도전 추천:";
  if (!lines.includes("강력 추천:")) lines.unshift("강력 추천:", "");
  if (!lines.includes("도전 추천:")) lines.push("", "도전 추천:");
  return lines.join("\n");
}

function notifyPositionRecommendation(args: {
  root: string;
  notifyScript: string;
  reportDate: string;
  report: string;
  htmlReport: string;
  candidates: Candidate[];
}): void {
  if (process.env.POSITION_RECOMMENDER_NOTIFY === "0") return;
  if (!existsSync(args.notifyScript)) {
    console.error(`position-recommender warn: notify script not found: ${args.notifyScript}`);
    return;
  }
  const reportDisplay = args.report.startsWith(`${args.root}/`) ? args.report.slice(args.root.length + 1) : args.report;
  const htmlDisplay = args.htmlReport.startsWith(`${args.root}/`) ? args.htmlReport.slice(args.root.length + 1) : args.htmlReport;
  const message = `오늘 포지션 추천 (${args.reportDate})

${formatDiscordCandidates(args.candidates)}

전체 리포트: \`${reportDisplay}\`
HTML 리포트: \`${htmlDisplay}\`
검증: 오늘 날짜 리포트 + 개별 active 공고 링크 확인 완료`;

  if (process.env.POSITION_RECOMMENDER_NOTIFY_DRY_RUN === "1") {
    console.log(message);
    return;
  }
  const result = spawnSync("bun", [`--env-file=${args.root}/.env`, args.notifyScript, "--media", args.htmlReport, message], {
    cwd: args.root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    console.error("position-recommender warn: discord notify failed");
  }
}

function parseDotEnv(filePath: string): NodeJS.ProcessEnv {
  if (!existsSync(filePath)) return {};
  const parsed: NodeJS.ProcessEnv = {};
  for (const line of readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const rawValue = match[2].trim();
    parsed[match[1]] = rawValue.replace(/^['"]|['"]$/g, "");
  }
  return parsed;
}

function buildFosCareerIngestEnv(fosCareerRoot: string): NodeJS.ProcessEnv {
  const env = { ...parseDotEnv(`${fosCareerRoot}/.env`), ...process.env };
  if (env.FOS_CAREER_DATABASE_URL) {
    env.DATABASE_URL = env.FOS_CAREER_DATABASE_URL;
  }
  if (env.DATABASE_URL && env.POSITION_RECOMMENDER_DB_HOST_OVERRIDE !== "0") {
    try {
      const url = new URL(env.DATABASE_URL);
      if (url.hostname === "bifos-db") {
        url.hostname = env.POSITION_RECOMMENDER_DB_HOST ?? "127.0.0.1";
        url.port = env.POSITION_RECOMMENDER_DB_PORT ?? "13306";
        env.DATABASE_URL = url.toString();
      }
    } catch {
      // Let the fos-career ingest command report malformed DATABASE_URL.
    }
  }
  return env;
}

function runFosCareerCandidateIngest(args: { input: string }): void {
  const fosCareerRoot = resolve(process.env.FOS_CAREER_ROOT ?? `${process.env.HOME}/services/fos-career`);
  const ingestEnv = existsSync(`${fosCareerRoot}/package.json`) ? buildFosCareerIngestEnv(fosCareerRoot) : process.env;
  // DB 미설정(DATABASE_URL/FOS_CAREER_DATABASE_URL 모두 없음)이면 ingest를 건너뛴다.
  // dry-run·DB 없는 환경에서 items.json 파생까지만 검증할 수 있게 한다.
  if (!ingestEnv.DATABASE_URL && !ingestEnv.FOS_CAREER_DATABASE_URL) {
    console.error("position-recommender DB ingest: DATABASE_URL not set, skipping candidate ingest");
    return;
  }
  if (!existsSync(`${fosCareerRoot}/package.json`)) {
    die(`position-recommender DB ingest: fos-career root not found: ${fosCareerRoot}`);
  }

  console.error("position-recommender DB ingest: syncing application candidate states...");
  run(
    "pnpm",
    ["ingest:position-recommendations", "--input", args.input],
    fosCareerRoot,
    ingestEnv
  );
}

function runFosCareerCollectionImport(args: { snapshot: string; requestedSource: string }): string {
  const fosCareerRoot = resolve(process.env.FOS_CAREER_ROOT ?? `${process.env.HOME}/services/fos-career`);
  if (!existsSync(`${fosCareerRoot}/package.json`)) {
    die(`position-recommender collection import: fos-career root not found: ${fosCareerRoot}`);
  }

  console.error("position-recommender DB ingest: importing collection snapshot...");
  const stdout = runOutput(
    "pnpm",
    ["tsx", "db/import-positions.ts", "--snapshot", args.snapshot, "--requested-source", args.requestedSource],
    fosCareerRoot,
    buildFosCareerIngestEnv(fosCareerRoot)
  );
  try {
    const parsed = JSON.parse(stdout);
    if (typeof parsed.collectionRunId === "string" && parsed.collectionRunId.trim()) {
      return parsed.collectionRunId;
    }
  } catch {
    // Fall through to a hard failure below.
  }
  die("position-recommender collection import: collectionRunId missing from import output");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv[0] === "--help" || argv[0] === "-h") {
    usage();
    return;
  }

  let validateOnly = false;
  if (argv[0] === "--validate-existing") {
    validateOnly = true;
    argv.shift();
  }

  // career-os root = 이 스크립트(career-os/scripts/<skill>/)에서 2단계 위.
  // CAREER_OS_ROOT env가 있으면 우선 — 어떤 체크아웃 위치에서도 동작 (Linux 하드코딩 제거).
  const root = process.env.CAREER_OS_ROOT
    ? resolve(process.env.CAREER_OS_ROOT)
    : resolve(import.meta.dir, "..", "..");
  const reportDate = process.env.REPORT_DATE ?? kstDate();
  const reportDir = `${root}/data/reports/daily/${reportDate}/position-recommendation`;
  // ADR-094: recommendation.json이 정본. report.md/report.html은 여기서 파생한다.
  const recommendation = `${reportDir}/recommendation.json`;
  const report = `${reportDir}/report.md`;
  const reportHtml = `${reportDir}/report.html`;
  const reportItems = `${reportDir}/items.json`;
  const runtime = `${root}/data/runtime/position-recommendation.md`;
  const runtimeHtml = `${root}/data/runtime/position-recommendation.html`;
  const runtimeRecommendation = `${root}/data/runtime/position-recommendation.json`;
  const runtimeItems = `${root}/data/runtime/position-recommendation-items.json`;
  const livePostings = `${root}/data/runtime/live-position-postings.md`;
  const notifyScript = `${root}/../_shared/lib/notify_discord.ts`;
  const context = argv.length > 0 ? argv.join(" ") : DEFAULT_CONTEXT;
  const prompt = context.startsWith("/position-recommender") ? context : `/position-recommender ${context}`;
  let collectionRunId: string | null = null;

  if (!validateOnly) {
    const collectArgs = [
      `${root}/scripts/position-recommender/collect_live_postings.ts`,
      "--source",
      process.env.POSITION_RECOMMENDER_SOURCE ?? "all",
      "--max-wanted",
      process.env.POSITION_RECOMMENDER_WANTED_LIMIT ?? "80",
      "--output",
      livePostings,
    ];
    if (process.env.POSITION_RECOMMENDER_INCLUDE_TOSS_ARTICLES === "1") collectArgs.push("--include-toss-articles");
    run("bun", collectArgs, root);
    assertLivePostingSnapshot(livePostings);
    collectionRunId = runFosCareerCollectionImport({
      snapshot: livePostings,
      requestedSource: process.env.POSITION_RECOMMENDER_SOURCE ?? "all",
    });
    try {
      await runClaudeWithGuards(
        [
          "--permission-mode",
          "acceptEdits",
          "--output-format",
          "stream-json",
          "--include-partial-messages",
          "--verbose",
          "-p",
          prompt,
        ],
        root
      );
    } catch (error) {
      die(`position-recommender claude failed: ${error}`);
    }
  } else if (existsSync(livePostings)) {
    collectionRunId = runFosCareerCollectionImport({
      snapshot: livePostings,
      requestedSource: process.env.POSITION_RECOMMENDER_SOURCE ?? "all",
    });
  }

  // ADR-094: 정본은 recommendation.json. freshness는 파일 존재 + reportDate 필드가 오늘인지로 본다.
  if (!existsSync(recommendation)) {
    die(`position-recommender stale-output: expected today's recommendation.json not found: ${recommendation}`);
  }
  const recommendationRun = loadRecommendationRun(recommendation);
  if (recommendationRun.reportDate !== reportDate) {
    die(
      `position-recommender stale-output: recommendation.json reportDate (${recommendationRun.reportDate}) != today (${reportDate}): ${recommendation}`
    );
  }

  // 정본 JSON에서 report.md/report.html과 runtime 미러(md/html)를 파생한다.
  const renderRecommendation = (input: string, format: "md" | "html", output: string): void => {
    run(
      "bun",
      [
        `${root}/scripts/position-recommender/render_recommendation.ts`,
        "--input",
        input,
        "--format",
        format,
        "--output",
        output,
      ],
      root
    );
  };
  renderRecommendation(recommendation, "md", report);
  renderRecommendation(recommendation, "html", reportHtml);
  // runtime 미러: 정본 JSON 복사 + 같은 렌더러로 md/html 파생.
  copyFileSync(recommendation, runtimeRecommendation);
  renderRecommendation(recommendation, "md", runtime);
  renderRecommendation(recommendation, "html", runtimeHtml);

  // Discord 카드용 후보를 정본(recommendation.json)에서 직접 만든다.
  const candidates = recommendationToCandidates(recommendationRun);

  // items.json: 파생된 runtime md를 파싱해 buildStructuredRecommendationRun으로 생성한다(옛 흐름 유지).
  const parsedCandidates = validateDirectPostingRecommendations(runtime);
  const structuredRun = buildStructuredRecommendationRun({
    reportDate,
    sourceSnapshotPath: livePostings,
    collectionRunId,
    markdownReportPath: report,
    htmlReportPath: reportHtml,
    candidates: parsedCandidates,
  });
  const structuredQuality = summarizeStructuredRecommendationQuality(structuredRun);
  if (structuredQuality.missingRequiredCardFields.length > 0) {
    console.warn(
      `WARN structured recommendation missing card fields: ${JSON.stringify(structuredQuality.missingRequiredCardFields)}`
    );
  }
  writeStructuredRecommendationRun(structuredRun, reportItems);
  writeStructuredRecommendationRun(
    { ...structuredRun, markdownReportPath: runtime, htmlReportPath: runtimeHtml },
    runtimeItems
  );

  runFosCareerCandidateIngest({ input: reportItems });

  if (!validateOnly || process.env.POSITION_RECOMMENDER_NOTIFY_DRY_RUN === "1") {
    notifyPositionRecommendation({ root, notifyScript, reportDate, report, htmlReport: reportHtml, candidates });
  }
  console.log(`OK position-recommender fresh report: ${report}`);
}

if (import.meta.main) {
  main().catch((error) => die(`position-recommender runner failed: ${error}`));
}
