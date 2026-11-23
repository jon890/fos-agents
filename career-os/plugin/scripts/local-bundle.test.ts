import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const bundle = join(import.meta.dir, "../dist/career-local.js");
const temporaryDirectories: string[] = [];
const FAKE_TOKEN = "fake-token-0123456789abcdefghijklmnopqrs";

function temporaryDirectory(): string {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "career-local-")));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** 저장소 밖 cwd 에서, 개발자 셸의 CAREER_* 값을 이어받지 않고 번들을 실행한다. */
async function runBundle(cwd: string, args: string[], extra: Record<string, string> = {}) {
  const proc = Bun.spawn(["bun", "--no-env-file", bundle, ...args], {
    cwd,
    env: { PATH: process.env.PATH ?? "", HOME: cwd, ...extra },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

test("help 는 0 으로 끝난다", async () => {
  const result = await runBundle(temporaryDirectory(), ["help"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("interview");
});

test("workspace paths 는 설정한 작업 폴더와 프로젝트 근거 위치만 낸다", async () => {
  const cwd = temporaryDirectory();
  const root = join(cwd, "workspace");
  const result = await runBundle(cwd, ["workspace", "paths", "--json"], { CAREER_WORKSPACE_ROOT: root });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ schemaVersion: 1, action: "paths", ok: true, root, evidenceDir: join(root, "evidence") });
});

test("workspace paths 는 CAREER_EVIDENCE_DIR 를 프로젝트 근거 위치로 낸다", async () => {
  const cwd = temporaryDirectory();
  const evidenceDir = join(cwd, "evidence-elsewhere");
  const result = await runBundle(cwd, ["workspace", "paths", "--json"], { CAREER_EVIDENCE_DIR: evidenceDir });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ evidenceDir });
});

test("position --help 는 0 으로 끝나고 하위 명령을 보여 준다", async () => {
  const result = await runBundle(temporaryDirectory(), ["position", "--help"]);
  expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(result.stdout).toContain("commit-company-tiers");
});

test("cwd 의 .env 는 작업 폴더 위치를 바꾸지 않는다", async () => {
  const cwd = temporaryDirectory();
  writeFileSync(join(cwd, ".env"), "CAREER_WORKSPACE_ROOT=/elsewhere\nCAREER_WORKSPACE_SSH_TARGET=example\n");
  const result = await runBundle(cwd, ["workspace", "paths", "--json"]);
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ root: "/workspace/career" });
});

test("interview 는 Backend 값 없이 번들에 든 공개 질문 은행과 작업 폴더의 SQLite 로 돌고, 실행을 나눠도 기록이 이어진다", async () => {
  const home = temporaryDirectory();
  const environment = { CAREER_WORKSPACE_ROOT: join(home, "workspace") };

  const selected = await runBundle(home, ["interview", "select", "tech", "--count", "3"], environment);
  expect({ exitCode: selected.exitCode, stderr: selected.stderr }).toEqual({ exitCode: 0, stderr: "" });
  const first = JSON.parse(selected.stdout) as { questions: Array<{ id: string; topic: string; question: string; sourceScope?: string }> };
  expect(first.questions).toHaveLength(3);
  for (const question of first.questions) expect([undefined, "public"]).toContain(question.sourceScope);

  // 따옴표와 줄바꿈이 든 기록을 JSON 파일로 넘긴다.
  const picked = first.questions[0]!;
  const attempt = join(home, "attempt.json");
  writeJson(attempt, { drillType: "tech", questionId: picked.id, topic: picked.topic, question: picked.question, score: "fail", feedback: '"핵심"이 빠졌다\n다시 본다' });
  const recorded = await runBundle(home, ["interview", "record", "--input", attempt], environment);
  expect({ exitCode: recorded.exitCode, stderr: recorded.stderr }).toEqual({ exitCode: 0, stderr: "" });
  const personal = join(home, "personal.json");
  writeJson(personal, {
    drillType: "tech", id: "personal-bundle-1", topic: "bundle-personal", category: "database", difficulty: "basic",
    question: "개인 질문입니다.", intent: "의도를 확인합니다.", answerSignals: ["신호"],
  });
  expect((await runBundle(home, ["interview", "personal", "add", "--file", personal], environment)).exitCode).toBe(0);

  // 새 프로세스가 앞 실행의 복습 상태와 개인 질문을 읽는다.
  const progress = JSON.parse((await runBundle(home, ["interview", "progress", "tech"], environment)).stdout) as {
    items: Array<{ topic: string; failCount: number; nextReviewDate: string | null }>;
  };
  expect(progress.items).toEqual([expect.objectContaining({ topic: picked.topic, failCount: 1 })]);
  expect(progress.items[0]!.nextReviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const listed = JSON.parse((await runBundle(home, ["interview", "personal", "list", "tech"], environment)).stdout) as { items: Array<{ id: string }> };
  expect(listed.items.map((item) => item.id)).toEqual(["personal-bundle-1"]);
});

test("interview 는 Backend 주소와 token 을 받아도 요청을 보내지 않는다", async () => {
  const requests: string[] = [];
  const server = Bun.serve({ port: 0, fetch(request) { requests.push(request.url); return new Response("{}"); } });
  try {
    const home = temporaryDirectory();
    const result = await runBundle(home, ["interview", "select", "tech", "--count", "3"], {
      CAREER_WORKSPACE_ROOT: join(home, "workspace"),
      CAREER_BACKEND_URL: server.url.origin,
      CAREER_BACKEND_TOKEN: FAKE_TOKEN,
    });
    expect({ exitCode: result.exitCode, requests }).toEqual({ exitCode: 0, requests: [] });
    expect(result.stdout).not.toContain(FAKE_TOKEN);
  } finally {
    server.stop(true);
  }
});

/** 지어낸 주장 하나를 담은 검증 완료 주장 상태 파일이다. */
function verifiedClaimsFile(claimKey: string, proposedText: string) {
  return {
    schemaVersion: 1,
    groupKey: "other/example.json",
    claims: [
      {
        claimKey,
        claim: {
          id: "claim-1",
          text: proposedText,
          location: "profile",
          type: "implementation",
          implementation: { status: "user_attested", evidence: [] },
          ownership: { status: "user_attested", evidence: [] },
          outcome: { status: "not_claimed", evidence: [] },
          verdict: "safe",
          proposedText,
        },
        evidenceSnapshots: [],
        origins: [],
      },
    ],
  };
}

function writeJson(filePath: string, value: unknown) {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value));
}

test("resume search-claims 는 --state-dir 가 없으면 작업본의 검증 완료 주장을 읽는다", async () => {
  const cwd = temporaryDirectory();
  const root = join(cwd, "workspace");
  const workspaceKey = "a".repeat(64);
  const repositoryKey = "b".repeat(64);
  writeJson(
    join(root, "state", "verified-claims", "other", "example.json"),
    verifiedClaimsFile(workspaceKey, "예시 검색 플랫폼을 작업본에서 만들었다"),
  );
  writeJson(
    join(cwd, "career-os", "state", "verified-claims", "other", "example.json"),
    verifiedClaimsFile(repositoryKey, "예시 검색 플랫폼을 저장소에서 만들었다"),
  );

  const result = await runBundle(cwd, ["resume", "search-claims", "예시 검색 플랫폼"], { CAREER_WORKSPACE_ROOT: root });
  expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({ exitCode: 0, stderr: "" });
  const keys = (JSON.parse(result.stdout) as { results: Array<{ claimKey: string }> }).results.map((item) => item.claimKey);
  expect(keys).toEqual([workspaceKey]);
});

// 지어낸 1×1 투명 PNG 다. 실제 로고 이미지를 테스트에 쓰지 않는다.
const ONE_PIXEL_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c6360000200000500017a5eab3f0000000049454e44ae426082",
  "hex",
);

test("resume export 는 --logo-dir 가 없으면 작업본의 로고를 붙인다", async () => {
  const cwd = temporaryDirectory();
  const root = join(cwd, "workspace");
  const logoDir = join(root, "library", "resume-logos");
  mkdirSync(logoDir, { recursive: true });
  writeFileSync(join(logoDir, "example.png"), ONE_PIXEL_PNG);
  writeFileSync(join(logoDir, "index.json"), JSON.stringify({ map: { 예시회사: "example.png" } }));
  const applicationDir = join(cwd, "application");
  mkdirSync(join(applicationDir, "evidence"), { recursive: true });
  writeFileSync(
    join(applicationDir, "evidence", "resume-draft.md"),
    "# 김예시\n\n## 경력\n\n### 예시회사 · 백엔드 개발\n\n- 예시 서비스를 운영했다.\n",
  );

  // Chrome 이 없으므로 PDF 단계에서 실패하지만, 그 앞에서 HTML 을 쓴다.
  const result = await runBundle(
    cwd,
    ["resume", "export", "--application-dir", applicationDir, "--chrome-bin", "/not-used"],
    { CAREER_WORKSPACE_ROOT: root },
  );
  expect(result.exitCode).toBe(1);
  const html = readFileSync(join(applicationDir, "review", "resume.html"), "utf8");
  expect(html).toContain(`data:image/png;base64,${ONE_PIXEL_PNG.toString("base64")}`);
});

test("resume export 는 Chrome 없이 HTML 만 내고, package report 가 그 사본을 reports/ 에 만든다", async () => {
  const cwd = temporaryDirectory();
  const root = join(cwd, "workspace");
  const applicationDir = join(root, "applications", "example", "backend");
  mkdirSync(join(applicationDir, "evidence"), { recursive: true });
  writeFileSync(join(applicationDir, "evidence", "resume-draft.md"), "# 김예시\n\n## 경력\n\n### 예시회사 · 백엔드 개발\n\n- 예시 서비스를 운영했다.\n");
  const environment = { CAREER_WORKSPACE_ROOT: root };

  const exported = await runBundle(cwd, ["resume", "export", "--application-dir", applicationDir, "--html-only"], environment);
  expect({ exitCode: exported.exitCode, stderr: exported.stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(exported.stdout).toContain("PDF 도구 없음");
  expect(existsSync(join(applicationDir, "resume.pdf"))).toBe(false);

  const copied = await runBundle(cwd, ["package", "report", applicationDir, join(applicationDir, "review", "resume.html")], environment);
  expect({ exitCode: copied.exitCode, stderr: copied.stderr }).toEqual({ exitCode: 0, stderr: "" });
  const copy = copied.stdout.split("\n").find((line) => line.startsWith("리포트 사본: "))!.slice("리포트 사본: ".length);
  expect(copy).toMatch(/reports\/\d{4}-\d{2}-\d{2}-resume-example-backend\.html$/);
  expect(existsSync(copy)).toBe(true);
  expect(copied.stdout).toContain("file_space_put");
});

/** 검토 화면을 그릴 수 있는 지어낸 지원 디렉터리다. */
function writeApplicationDirectory(directory: string): void {
  const evidence = join(directory, "evidence");
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, "status.md"), "# 예시 회사 지원\n\n- readiness: needs_user_input\n");
  writeFileSync(join(evidence, "fit.md"), "## 결론\n\n예시 결론 문장\n");
  writeFileSync(join(evidence, "interview-questions.json"), JSON.stringify({
    schemaVersion: 1,
    company: "예시 회사",
    role: "Backend Developer",
    sourceDocuments: ["evidence/fit.md"],
    questions: [
      {
        id: "example-position-question",
        drillType: "tech",
        topic: "position-question",
        category: "platform",
        difficulty: "advanced",
        question: "여러 팀이 함께 쓰는 예시 플랫폼의 공통 계약을 어떻게 설계하겠습니까?",
        intent: "공통 플랫폼 책임에 맞는 판단을 확인한다.",
        answerSignals: ["입출력 계약", "오류 경계"],
        positionFitHint: "지원 포지션의 핵심 책임과 연결한다.",
        origin: "posting_requirement",
        evidenceBoundary: "설계 질문이며 운영 경험으로 확대하지 않는다.",
      },
    ],
  }));
}

// 번들은 실행 파일 옆의 templates/ 를 찾지 않는다. 템플릿이 번들 문자열로 들어갔는지를 결과 HTML 로 확인한다.
test("package render 는 번들에 든 템플릿으로 검토 화면을 만든다", async () => {
  const cwd = temporaryDirectory();
  const applicationDir = join(cwd, "application");
  writeApplicationDirectory(applicationDir);

  const result = await runBundle(cwd, ["package", "render", applicationDir]);
  expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({ exitCode: 0, stderr: "" });
  const destination = join(applicationDir, "application-package.html");
  expect(result.stdout.trim()).toBe(destination);
  const html = readFileSync(destination, "utf8");
  const css = readFileSync(join(import.meta.dir, "../../scripts/application-package/templates/application-package.css"), "utf8");
  expect(html).toContain(css.trim());
  expect(html).toContain("예시 결론 문장");
  expect(html).not.toMatch(/\{\{\s*[A-Z_]+\s*\}\}/);
});

test("package check-sources 는 CAREER_EVIDENCE_DIR 가 없으면 unavailable 로 1 을 낸다", async () => {
  const result = await runBundle(temporaryDirectory(), ["package", "check-sources", "--no-fetch"]);
  expect(result.exitCode).toBe(1);
  const output = JSON.parse(result.stdout) as { passed: boolean; sources: Array<{ status: string; detail?: string }> };
  expect(output.passed).toBe(false);
  expect(output.sources[0]?.status).toBe("unavailable");
  expect(output.sources[0]?.detail).toContain("CAREER_EVIDENCE_DIR");
});

test("지운 작업본 동기화와 공통 프로필 실행기는 번들에 없다", async () => {
  const cwd = temporaryDirectory();
  for (const args of [["workspace", "begin", "resume-preparer", "--json"], ["application-profile", "get", "--out", join(cwd, "profile.md")], ["usage"]]) {
    const result = await runBundle(cwd, args, { CAREER_WORKSPACE_SSH_TARGET: "example", FOS_ASSISTANT_SERVICE_TOKEN: FAKE_TOKEN });
    expect({ args, exitCode: result.exitCode }).toEqual({ args, exitCode: 2 });
    expect(result.stdout + result.stderr).not.toContain(FAKE_TOKEN);
  }
  const source = readFileSync(bundle, "utf8");
  for (const removed of ["CAREER_WORKSPACE_SSH_TARGET", "FOS_ASSISTANT_SERVICE_TOKEN", "WORKSPACE_DIRTY"])
    expect({ removed, hit: source.includes(removed) }).toEqual({ removed, hit: false });
});

test("공고·공부 실행기는 Backend 값 없이 작업 폴더의 SQLite 를 만들어 쓴다", async () => {
  const home = temporaryDirectory();
  const workspace = join(home, "workspace");
  const environment = { CAREER_WORKSPACE_ROOT: workspace };

  const exclusions = await runBundle(home, ["position", "exclusions", "get"], environment);
  expect({ exitCode: exclusions.exitCode, stderr: exclusions.stderr }).toEqual({ exitCode: 0, stderr: "" });
  expect(JSON.parse(exclusions.stdout)).toEqual({ schemaVersion: 2, exclusions: [] });
  expect(existsSync(join(workspace, "state", "career.sqlite"))).toBe(true);

  const added = await runBundle(home, [
    "study-sources", "add", "--key", "example-feed", "--title", "예시", "--category", "techBlog",
    "--feed-url", "https://example.com/feed.xml", "--adapter", "feed", "--note", "번들 검사",
  ], environment);
  expect({ exitCode: added.exitCode, stderr: added.stderr }).toEqual({ exitCode: 0, stderr: "" });
  const listed = await runBundle(home, ["study-sources", "list"], environment);
  expect(JSON.parse(listed.stdout)).toMatchObject([{ sourceKey: "example-feed", version: 1 }]);

  // 맥락 문서가 없으면 공부 추천 점검이 어느 파일을 써야 하는지 알리고 1 로 끝난다.
  const doctor = await runBundle(home, ["study", "--doctor"], environment);
  expect(doctor.exitCode).toBe(1);
  expect(doctor.stdout).toContain("context/learning-interests.md");
});
