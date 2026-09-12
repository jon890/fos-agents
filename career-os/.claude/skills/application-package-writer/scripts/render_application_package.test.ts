import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { TAB_KEYS } from "./render_application_package.ts";
import {
  fillTemplate,
  renderApplicationPackage,
  renderApplicationPackageHtml,
  renderFitScore,
  renderMarkdown,
} from "./render_application_package.ts";

const FIT_TABLE_HEADING = "## 공고 항목별 적합도";
const FIT_TABLE = `| 공고 항목 | 공고 구분 | 근거 | 점수 |
| --- | --- | --- | --- |
| 공통 기반 표준화 | 주요 업무 | 공통 모듈 분리 경험 | 90 |
| 자체 호스팅 모델 운영 | 우대 경험 | 직접 근거 없음 | 0 |`;

const FULL_FIT_TABLE = `| 공고 항목 | 공고 구분 | 근거 | 점수 |
| --- | --- | --- | --- |
| 공통 기반 표준화 | 주요 업무 | 공통 모듈 분리 경험 | 100 |
| AI 플랫폼 운영 | 기대 경험 | LLM 서비스 운영 경험 | 75 |
| 자체 호스팅 모델 운영 | 우대 경험 | 직접 근거 없음 | 0 |`;

/** 점수만 담은 표. 소계와 총점은 이 표와 가중치로 화면이 계산한다. */
function fitTableOf(rows: [string, number][], weights: [string, number][] = []): string {
  const table = ["| 공고 항목 | 공고 구분 | 근거 | 점수 |", "| --- | --- | --- | --- |"]
    .concat(rows.map(([category, score], order) => `| 항목 ${order + 1} | ${category} | 근거 | ${score} |`))
    .join("\n");
  if (weights.length === 0) return table;
  const weightTable = ["| 공고 구분 | 가중치 |", "| --- | --- |"]
    .concat(weights.map(([category, weight]) => `| ${category} | ${weight} |`))
    .join("\n");
  return `${table}\n\n${weightTable}`;
}

/**
 * 화면이 받을 문서의 본보기다. 계약이 아니라 이 검사의 표본이므로 여기서 소유한다.
 * 절을 늘리거나 줄여도 화면이 그려지는지는 아래 검사가 따로 확인한다.
 */
const SAMPLE_HEADINGS: Record<string, readonly string[]> = {
  "evidence/candidate-interview.md": ["## 확보된 답변", "## 미확인 질문"],
  "evidence/fit.md": ["## 결론", "## 공고 항목별 적합도", "## 공개 자료로 확인한 팀과 인접 사례"],
  "evidence/strategy.md": [
    "## 이 포지션에서의 승부처",
    "## 지원동기",
    "## 입사 후 기여 시나리오",
    "## 보완할 공백",
    "## 회사 문화와의 연결",
    "## 면접에서 검증받을 내용",
  ],
  "evidence/status.md": ["## 제출 준비 상태", "## 사용자 확인 필요", "## 다음 행동"],
  "evidence/resume-draft.md": ["## 프로필", "## 주요 프로젝트", "## 경력", "## 기술"],
};

const SAMPLE_FILES = [
  "evidence/posting.md",
  "evidence/candidate-interview.md",
  "evidence/fit.md",
  "evidence/strategy.md",
  "evidence/status.md",
  "evidence/resume-draft.md",
  "evidence/interview-questions.json",
] as const;

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/** 화면은 세 파일을 이어 붙인 것을 받는다. 절 순서는 상태, 적합도, 전략이다. */
const ALL_PACKAGE_HEADINGS = [
  ...SAMPLE_HEADINGS["evidence/status.md"],
  ...SAMPLE_HEADINGS["evidence/fit.md"],
  ...SAMPLE_HEADINGS["evidence/strategy.md"],
];

function packageBody(): string {
  return ALL_PACKAGE_HEADINGS
    .map((heading) => (heading === FIT_TABLE_HEADING ? `${heading}\n\n${FIT_TABLE}` : `${heading}\n\n내용`))
    .join("\n\n");
}

function packageBodyWithFitTable(table: string): string {
  return ALL_PACKAGE_HEADINGS
    .map((heading) => (heading === FIT_TABLE_HEADING ? `${heading}\n\n${table}` : `${heading}\n\n내용`))
    .join("\n\n");
}

function write(directory: string, relativePath: string, content: string): void {
  const path = join(directory, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "application-package-render-"));
  directories.push(directory);
  for (const file of SAMPLE_FILES) {
    if (file === "evidence/interview-questions.json") continue;
    const headings = (SAMPLE_HEADINGS[file] ?? []).join("\n\n내용\n\n");
    write(directory, file, `# ${file}\n\n${headings}\n`);
  }
  write(
    directory,
    "evidence/status.md",
    `# 지원 준비 상태\n\n- readiness: needs_user_input\n- evidence: safe\n- human-confirmation: needs_input\n\n${SAMPLE_HEADINGS["evidence/status.md"].join("\n\n내용\n\n")}\n\n내용`,
  );
  write(
    directory,
    "evidence/fit.md",
    `# 적합도\n\n- 공식 공고: https://example.com/job\n- 근거: sources/fos-study/task/example.md\n\n${SAMPLE_HEADINGS["evidence/fit.md"].map((h) => (h === FIT_TABLE_HEADING ? `${h}\n\n${FIT_TABLE}` : `${h}\n\n내용`)).join("\n\n")}`,
  );
  write(
    directory,
    "evidence/interview-questions.json",
    JSON.stringify({
      schemaVersion: 1,
      company: "예시 회사",
      role: "Backend Developer",
      sourceDocuments: ["evidence/fit.md"],
      questions: [
        {
          id: "example-position-question",
          drillType: "tech",
          topic: "position-question",
          category: "ai-platform",
          difficulty: "advanced",
          question: "여러 팀이 함께 사용하는 AI Platform의 공통 계약을 어떻게 설계하겠습니까?",
          intent: "포지션의 공통 플랫폼 책임에 맞는 판단을 확인한다.",
          answerSignals: ["입출력 계약", "권한과 오류 경계"],
          positionFitHint: "현재 지원 포지션의 핵심 책임과 연결한다.",
          origin: "posting_requirement",
          evidenceBoundary: "설계 질문이며 직접 운영 경험으로 확대하지 않는다."
        }
      ]
    }),
  );
  write(directory, "evidence/application-form.json", JSON.stringify({
    schemaVersion: 1,
    formUrl: "https://example.com/job/apply",
    verifiedAt: "2026-09-03",
    status: "fields_verified",
    profileSource: "private-brain:career-application-profile",
    sections: [
      {
        title: "기본 정보",
        fields: [
          { id: "name", label: "이름", value: "김병태", source: "profile", required: true },
        ],
      },
    ],
    attachments: [{ label: "이력서", file: "resume.pdf", required: true }],
    questions: [{ id: "motivation", prompt: "지원동기", answer: "실제 사용자에게 닿는 AI를 만들고 싶습니다.", limit: 500 }],
    submission: { autofill: "ready_for_preview", finalSubmit: "requires_user_approval" },
    notes: ["최종 제출 전 내용을 다시 확인한다."],
  }));
  return directory;
}

function panelStart(html: string, key: string): number {
  return html.indexOf(`id="panel-${key}"`);
}

function panelText(html: string, key: string): string {
  const start = panelStart(html, key);
  const next = html.indexOf('<section class="tab-panel"', start);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}

describe("renderApplicationPackage", () => {
  test("네 탭 버튼과 네 패널이 나오고 첫 탭이 선택돼 있다", () => {
    const html = readFileSync(renderApplicationPackage(fixture()), "utf8");

    expect(html.match(/type="radio" name="tab"/g)).toHaveLength(4);
    expect(html.match(/<section class="tab-panel"/g)).toHaveLength(4);
    expect(html).toContain('<input type="radio" name="tab" class="tab-input" id="tab-posting" checked>');
    expect(html).not.toContain('id="tab-fit" checked');
    for (const label of ["공고 원문", "공고 적합도", "지원 전략", "상세 자료"]) {
      expect(html).toContain(`>${label}</label>`);
    }
    expect(html.indexOf(">공고 원문</label>")).toBeLessThan(html.indexOf(">공고 적합도</label>"));
    expect(html).not.toContain("{{");
  });

  test("공고 항목별 적합도 표가 공고 적합도 패널 안에 있다", () => {
    const html = readFileSync(renderApplicationPackage(fixture()), "utf8");

    expect(panelText(html, "fit")).toContain("<th>공고 항목</th>");
    expect(panelText(html, "strategy")).not.toContain("<th>공고 항목</th>");
  });

  test("결론과 상태 배지는 어느 패널에도 속하지 않고 상단에 있다", () => {
    const html = readFileSync(renderApplicationPackage(fixture()), "utf8");
    const firstPanel = html.indexOf('<section class="tab-panel"');

    expect(firstPanel).toBeGreaterThan(-1);
    expect(html.indexOf('class="hero-copy"')).toBeLessThan(firstPanel);
    expect(html.indexOf('class="status readiness-')).toBeLessThan(firstPanel);
    expect(html.indexOf('id="제출-준비-상태"')).toBeLessThan(firstPanel);
  });

  test("공고 원문이 없으면 그 탭과 버튼을 만들지 않고 나머지 세 탭은 남긴다", () => {
    const html = renderApplicationPackageHtml(
      `# 지원 준비\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n\n${packageBody()}`,
      "# 인터뷰",
      "# 이력서",
    );

    expect(html.match(/type="radio" name="tab"/g)).toHaveLength(3);
    expect(html.match(/<section class="tab-panel"/g)).toHaveLength(3);
    expect(html).not.toContain('id="panel-posting"');
    expect(html).not.toContain(">공고 원문</label>");
    expect(html).toContain('id="tab-fit" checked');
    expect(html).not.toContain('id="tab-posting"');
  });

  test("표에 없는 섹션은 지원 전략 패널 끝에 붙는다", () => {
    const directory = fixture();
    const path = join(directory, "evidence", "strategy.md");
    write(directory, "evidence/strategy.md", `${readFileSync(path, "utf8")}\n\n## 임시 메모\n\n남겨둘 내용\n`);

    const html = readFileSync(renderApplicationPackage(directory), "utf8");
    const strategy = panelText(html, "strategy");

    expect(strategy).toContain("임시 메모");
    expect(strategy.indexOf("임시 메모")).toBeGreaterThan(strategy.indexOf("다음 행동"));
  });

  test("선택 절은 입사 후 기여 시나리오와 보완할 공백 사이에 온다", () => {
    const growth = ["## 이 자리에서 얻을 경험과 성장", "### 서비스가 커질 여지\n\n내용"].join("\n\n");
    const html = renderApplicationPackageHtml(
      `# 지원 준비\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n\n${packageBody().replace("## 보완할 공백", `${growth}\n\n## 보완할 공백`)}`,
      "# 인터뷰",
      "# 이력서",
    );
    const strategy = panelText(html, "strategy");

    expect(strategy).toContain("이 자리에서 얻을 경험과 성장");
    expect(strategy.indexOf("이 자리에서 얻을 경험과 성장")).toBeGreaterThan(strategy.indexOf("입사 후 기여 시나리오"));
    expect(strategy.indexOf("이 자리에서 얻을 경험과 성장")).toBeLessThan(strategy.indexOf("보완할 공백"));
    expect(panelText(html, "fit")).not.toContain("이 자리에서 얻을 경험과 성장");
  });

  test("선택 절이 없으면 나머지 지원 전략 절의 순서를 그대로 둔다", () => {
    const html = renderApplicationPackageHtml(
      `# 지원 준비\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n\n${packageBody()}`,
      "# 인터뷰",
      "# 이력서",
    );
    const strategy = panelText(html, "strategy");

    expect(strategy).not.toContain("이 자리에서 얻을 경험과 성장");
    expect(strategy.indexOf("입사 후 기여 시나리오")).toBeLessThan(strategy.indexOf("보완할 공백"));
  });

  test("치환 값의 달러 기호를 치환 패턴으로 해석하지 않는다", () => {
    expect(fillTemplate("<p>{{TITLE}}</p>", { TITLE: "가$&나" })).toBe("<p>가$&나</p>");
    expect(fillTemplate("<p>{{TITLE}}</p>끝", { TITLE: "가$'나" })).toBe("<p>가$'나</p>끝");
    expect(fillTemplate("<p>{{TITLE}}</p>", { TITLE: "월 $$5000" })).toBe("<p>월 $$5000</p>");
  });

  test("탭 키마다 선택된 패널을 보이게 하는 CSS 규칙이 있다", () => {
    const css = readFileSync(
      join(import.meta.dir, "..", "templates", "application-package.css"),
      "utf8",
    );

    for (const key of TAB_KEYS) {
      expect(css).toContain(`#tab-${key}:checked ~ .tab-panels > #panel-${key}`);
      expect(css).toContain(`#tab-${key}:checked ~ .tab-buttons label[for="tab-${key}"]`);
    }
  });

  test("채우지 못한 치환 이름이 남으면 그 이름을 담은 오류를 낸다", () => {
    expect(() => fillTemplate("<p>{{TITLE}}</p><p>{{TAB_PANELS}}</p>", { TITLE: "제목" })).toThrow(
      "템플릿에 채우지 못한 치환 이름이 남았습니다: TAB_PANELS",
    );
  });

  test("제출 자료와 지원서 입력값을 상단에 보여준다", () => {
    const html = readFileSync(renderApplicationPackage(fixture()), "utf8");

    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain("내 답변 필요");
    expect(html).toContain("내 경험 확인 필요");
    expect(html).toContain("제출 준비 중");
    expect(html).toContain("지금 할 일");
    expect(html).toContain("제출 자료");
    expect(html).toContain("지원서 입력값");
    expect(html).toContain("필드 1개, 서술형 문항 1개");
    expect(html).toContain("실제 사용자에게 닿는 AI를 만들고 싶습니다.");
    expect(html.match(/<details class="form-drawer"/g)).toHaveLength(1);
  });

  test("적합도 총점 원 하나와 구분별 소계 원 셋을 상단에 보여준다", () => {
    const html = renderApplicationPackageHtml(
      `# 지원 준비\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n\n${packageBodyWithFitTable(FULL_FIT_TABLE)}`,
      "# 인터뷰",
      "# 이력서",
    );

    expect(html.match(/class="fit-circle\s/g)).toHaveLength(4);
    expect(html).toContain("적합도 총점");
    for (const label of ["주요 업무", "기대 경험", "우대 경험"]) {
      expect(html).toContain(`>${label}</strong>`);
    }
    expect(html.match(/class="fit-circle[^"]*" aria-label="/g)).toHaveLength(4);
    expect(html).toContain("적합도 총점 58.3점, 색 노랑");
    expect(html).toContain("주요 업무 100점, 색 진한 초록");
    expect(html).toContain("기대 경험 75점, 색 초록");
    expect(html).toContain("우대 경험 0점, 색 빨강");
  });

  test("점수 구간에 맞는 CSS 변수 이름을 원에 적용한다", () => {
    const html = renderFitScore(
      fitTableOf([["주요 업무", 100], ["주요 업무", 80], ["기대 경험", 25], ["우대 경험", 24.9]]),
    );

    expect(html).toContain("fit-circle fit-excellent");
    expect(html).toContain("fit-circle fit-fair");
    expect(html).toContain("주요 업무 90점, 색 진한 초록");
  });

  test("총점 원 옆에 합격 확률이 아니라는 경계 문구가 있다", () => {
    const html = renderFitScore(fitTableOf([["주요 업무", 90]]));

    expect(html).toContain("합격 확률이 아닙니다");
    expect(html).toContain("공고 요구와 현재 확보한 근거");
  });

  test("모델이 적은 소계 이름을 그대로 원으로 만든다", () => {
    const html = renderFitScore(fitTableOf([["주요 업무", 100], ["조직 적합", 80]]));

    expect(html).toContain(">주요 업무</strong>");
    expect(html).toContain(">조직 적합</strong>");
    expect(html.match(/class="fit-circle\s/g)).toHaveLength(3);
  });

  test("총점이 없으면 판정 대기 문구를 보여준다", () => {
    const html = renderFitScore("- 적합도 총점 없음");

    expect(html).toContain("판정 대기");
    expect(html).toContain("적합도 총점 판정이 아직 없습니다");
    // 빈 원을 낮은 점수로 듣지 않도록 색은 읽어 주지 않는다.
    expect(html).not.toContain("색 빨강");
  });


  test("적합도 절이 없는 문서도 HTML로 렌더링하고 치환 이름을 남기지 않는다", () => {
    const html = renderApplicationPackageHtml(
      "# 지원 준비\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n\n## 결론\n\n내용",
      "# 인터뷰",
      "# 이력서",
    );

    expect(html).not.toContain('<section class="fit-score"');
    expect(html).not.toContain("{{");
  });


  test("상세 자료 탭에 이력서 원문, 면접 질문과 인터뷰 기록을 담는다", () => {
    const detail = panelText(readFileSync(renderApplicationPackage(fixture()), "utf8"), "detail");

    expect(detail).toContain("이력서 원문");
    expect(detail).toContain("후보자 인터뷰 기록");
    expect(detail).toContain("포지션별 면접 질문");
    expect(detail).toContain("여러 팀이 함께 사용하는 AI Platform");
    expect(detail).not.toContain('href="evidence/resume-draft.md"');
  });

  test("저장소 안의 상대 경로를 검토 화면의 링크로 렌더링한다", () => {
    const html = renderMarkdown(
      "- 학습 자료: [장기 기억 설계](../../../sources/fos-study/AI/agent/memory.md)",
    );

    expect(html).toContain('href="../../../sources/fos-study/AI/agent/memory.md"');
  });

  test("존재하는 경력기술서와 통합 PDF 링크를 같은 화면에 표시한다", () => {
    const directory = fixture();
    write(directory, "review/career-description.html", "<main>경력기술서</main>");
    write(directory, "career-description.pdf", "pdf");
    write(directory, "submission.pdf", "pdf");

    const html = readFileSync(renderApplicationPackage(directory), "utf8");
    expect(html).toContain("제출 후보");
    expect(html).toContain("제출용 통합 PDF");
    expect(html).toContain('href="career-description.pdf"');
    expect(html).toContain('href="submission.pdf"');
    expect(html).not.toContain('href="review/career-description.html"');
    expect(html.match(/class="file-card/g)).toHaveLength(2);
  });

  test("표 셀의 <br> 는 줄바꿈으로 살아나고 다른 태그는 이스케이프된다", () => {
    const table = [
      "| 공고 항목 | 공고 구분 | 근거 | 판정 |",
      "| --- | --- | --- | --- |",
      "| Model Router 표준화 | 주요 업무 | 직접 근거가 없다.<br>「보완할 공백」과 같다. | 공백 |",
      "| <script>alert(1)</script> | 기대 경험 | 태그는 이스케이프된다 | 공백 |",
    ].join("\n");
    const body = ALL_PACKAGE_HEADINGS
      .map((heading) => (heading === FIT_TABLE_HEADING ? `${heading}\n\n${table}` : `${heading}\n\n내용`))
      .join("\n\n");

    const html = renderApplicationPackageHtml(
      `# 지원 준비\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n\n${body}`,
      "# 인터뷰",
      "# 이력서",
    );

    expect(html).toContain("직접 근거가 없다.<br>「보완할 공백」과 같다.");
    expect(html).not.toContain("&lt;br&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("맨 주소는 링크가 되고 이미 링크나 코드인 것은 그대로 둔다", () => {
    const links = [
      "- 공식 공고: https://example.com/career/job-detail?job_id=1234",
      "- 이미 링크: [채용 페이지](https://example.com/career)",
      "- 코드 안: `https://example.com/not-a-link`",
      "- 문장 끝: https://example.com/company 를 확인한다.",
    ].join("\n");
    const body = ALL_PACKAGE_HEADINGS
      .map((heading) => {
        if (heading === "## 결론") return `${heading}\n\n${links}`;
        if (heading === FIT_TABLE_HEADING) return `${heading}\n\n${FIT_TABLE}`;
        return `${heading}\n\n내용`;
      })
      .join("\n\n");

    const html = renderApplicationPackageHtml(
      `# 지원 준비\n\n- readiness: ready\n- evidence: safe\n- human-confirmation: complete\n\n${body}`,
      "# 인터뷰",
      "# 이력서",
    );

    expect(html).toContain('<a href="https://example.com/career/job-detail?job_id=1234">');
    expect(html).toContain('<a href="https://example.com/career">채용 페이지</a>');
    expect(html).not.toContain("<code><a href=");
    expect(html).toContain("<code>https://example.com/not-a-link</code>");
    expect(html).toContain('<a href="https://example.com/company">https://example.com/company</a> 를');
  });

  test("공고 원문 탭은 evidence/posting.md 내용을 담는다", () => {
    const directory = fixture();
    write(directory, "evidence/posting.md", "# 공고\n\n전에 없던 Proactive한 매장 관리 경험\n");

    const html = readFileSync(renderApplicationPackage(directory), "utf8");
    expect(panelText(html, "posting")).toContain("전에 없던 Proactive한 매장 관리 경험");
  });
});

describe("적합도 표의 화면 처리", () => {
  test("표에 없는 열을 화면이 만들지 않는다", () => {
    const html = renderMarkdown(FULL_FIT_TABLE);

    expect(html).toContain("<th>점수</th>");
    expect(html).not.toContain("<th>판정</th>");
  });

  test("근거가 여럿인 칸은 목록으로 그린다", () => {
    const html = renderMarkdown(
      "| 항목 | 근거 |\n| --- | --- |\n| 데이터 정제 | - 색인 파이프라인을 설계<br>- Document Parser 로 변환 |",
    );

    expect(html).toContain("<ul class=\"cell-list\">");
    expect(html).toContain("<li>색인 파이프라인을 설계</li>");
    expect(html).toContain("<li>Document Parser 로 변환</li>");
  });
});
