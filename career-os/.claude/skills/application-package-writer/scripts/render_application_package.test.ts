import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { TAB_KEYS } from "./render_application_package.ts";
import {
  FIT_TABLE_HEADING,
  GROWTH_HEADING,
  GROWTH_SUBHEADINGS,
  REQUIRED_HEADINGS,
  REQUIRED_PACKAGE_FILES,
} from "./package_contract.ts";
import {
  fillTemplate,
  renderApplicationPackage,
  renderApplicationPackageHtml,
  renderFitScore,
  renderMarkdown,
} from "./render_application_package.ts";

const FIT_TABLE = `| 공고 항목 | 공고 구분 | 근거 | 판정 |
| --- | --- | --- | --- |
| 공통 기반 표준화 | 주요 업무 | 공통 모듈 분리 경험 | 확인됨 |
| 자체 호스팅 모델 운영 | 우대 경험 | 직접 근거 없음 | 공백 |`;

const FULL_FIT_TABLE = `| 공고 항목 | 공고 구분 | 근거 | 판정 |
| --- | --- | --- | --- |
| 공통 기반 표준화 | 주요 업무 | 공통 모듈 분리 경험 | 확인됨 |
| AI 플랫폼 운영 | 기대 경험 | LLM 서비스 운영 경험 | 강한 인접 |
| 자체 호스팅 모델 운영 | 우대 경험 | 직접 근거 없음 | 공백 |`;

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function packageBody(): string {
  return REQUIRED_HEADINGS["evidence/application-package.md"]
    .map((heading) => (heading === FIT_TABLE_HEADING ? `${heading}\n\n${FIT_TABLE}` : `${heading}\n\n내용`))
    .join("\n\n");
}

function packageBodyWithFitTable(table: string): string {
  return REQUIRED_HEADINGS["evidence/application-package.md"]
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
  for (const file of REQUIRED_PACKAGE_FILES) {
    if (file === "evidence/interview-questions.json") continue;
    const headings = (REQUIRED_HEADINGS[file] ?? []).join("\n\n내용\n\n");
    write(directory, file, `# ${file}\n\n${headings}\n`);
  }
  write(
    directory,
    "evidence/application-package.md",
    `# 토스플레이스 AI Platform 지원 준비\n\n- readiness: needs_user_input\n- evidence: safe\n- human-confirmation: needs_input\n- 공식 공고: https://example.com/job\n- 근거: sources/fos-study/task/example.md\n\n${packageBody()}`,
  );
  write(
    directory,
    "evidence/interview-questions.json",
    JSON.stringify({
      schemaVersion: 1,
      company: "토스플레이스",
      role: "AI Platform Server Developer",
      sourceDocuments: ["evidence/application-package.md"],
      questions: [
        {
          id: "tossplace-position-question",
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
    const path = join(directory, "evidence", "application-package.md");
    write(directory, "evidence/application-package.md", `${readFileSync(path, "utf8")}\n\n## 임시 메모\n\n남겨둘 내용\n`);

    const html = readFileSync(renderApplicationPackage(directory), "utf8");
    const strategy = panelText(html, "strategy");

    expect(strategy).toContain("임시 메모");
    expect(strategy.indexOf("임시 메모")).toBeGreaterThan(strategy.indexOf("다음 행동"));
  });

  test("선택 절은 입사 후 기여 시나리오와 보완할 공백 사이에 온다", () => {
    const growth = [GROWTH_HEADING, ...GROWTH_SUBHEADINGS.map((subheading) => `${subheading}\n\n내용`)].join("\n\n");
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
    expect(html).toContain("적합도 총점 75점, 색 초록");
    expect(html).toContain("주요 업무 100점, 색 진한 초록");
    expect(html).toContain("기대 경험 75점, 색 초록");
    expect(html).toContain("우대 경험 0점, 색 빨강");
  });

  test("점수 구간에 맞는 CSS 변수 이름을 원에 적용한다", () => {
    const html = renderFitScore({
      total: 90,
      sectionScores: { "주요 업무": 60, "기대 경험": 25, "우대 경험": 24.9 },
      judgmentCounts: { 확인됨: 0, "강한 인접": 0, "인접 경험": 0, 공백: 0, "사용자 확인": 0 },
      excludedCount: 0,
    });

    expect(html).toContain("fit-circle fit-excellent");
    expect(html).toContain("fit-circle fit-fair");
    expect(html).toContain("주요 업무 60점, 색 노랑");
  });

  test("총점 원 옆에 합격 확률이 아니라는 경계 문구가 있다", () => {
    const html = renderFitScore({
      total: 90,
      sectionScores: { "주요 업무": 90, "기대 경험": 90, "우대 경험": 90 },
      judgmentCounts: { 확인됨: 3, "강한 인접": 0, "인접 경험": 0, 공백: 0, "사용자 확인": 0 },
      excludedCount: 0,
    });

    expect(html).toContain("합격 확률이 아닙니다");
    expect(html).toContain("공고 요구와 현재 확보한 근거");
  });

  test("구분 소계가 null이면 해당 없음 원을 보여준다", () => {
    const html = renderFitScore({
      total: 100,
      sectionScores: { "주요 업무": 100, "기대 경험": null, "우대 경험": 100 },
      judgmentCounts: { 확인됨: 2, "강한 인접": 0, "인접 경험": 0, 공백: 0, "사용자 확인": 1 },
      excludedCount: 1,
    });

    expect(html).toContain("해당 없음");
    expect(html).toContain("기대 경험 해당 없음, 색 빨강");
    expect(html).toContain("fit-circle fit-none is-empty");
  });

  test("총점이 null이면 판정 대기 문구를 보여주고 구분 소계 null은 해당 없음으로 둔다", () => {
    const html = renderFitScore({
      total: null,
      sectionScores: { "주요 업무": null, "기대 경험": null, "우대 경험": null },
      judgmentCounts: { 확인됨: 0, "강한 인접": 0, "인접 경험": 0, 공백: 0, "사용자 확인": 3 },
      excludedCount: 3,
    });

    expect(html).toContain("판정 대기");
    expect(html).toContain("적합도 총점 판정이 아직 없습니다, 색 빨강");
    expect(html).toContain("주요 업무 해당 없음, 색 빨강");
    expect(html).toContain("기대 경험 해당 없음, 색 빨강");
    expect(html).toContain("우대 경험 해당 없음, 색 빨강");
    expect(html.match(/해당 없음/g)).toHaveLength(6);
  });

  test("모든 적합도 행이 사용자 확인이어도 HTML로 렌더링하고 치환 이름을 남기지 않는다", () => {
    const userConfirmationTable = `| 공고 항목 | 공고 구분 | 근거 | 판정 |
| --- | --- | --- | --- |
| 본인 역할 확인 | 주요 업무 | | 사용자 확인 |
| LLM 운영 범위 확인 | 기대 경험 | | 사용자 확인 |
| 자체 호스팅 경험 확인 | 우대 경험 | | 사용자 확인 |`;
    const html = renderApplicationPackageHtml(
      `# 지원 준비\n\n- readiness: needs_user_input\n- evidence: safe\n- human-confirmation: needs_input\n\n${packageBodyWithFitTable(userConfirmationTable)}`,
      "# 인터뷰",
      "# 이력서",
    );

    expect(html).toContain("판정 대기");
    expect(html).toContain("적합도 총점 판정이 아직 없습니다, 색 빨강");
    expect(html.match(/class="fit-circle\s/g)).toHaveLength(4);
    expect(html).not.toContain("{{");
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

  test("renderApplicationPackage는 적합도 절이 없는 패키지의 파일 생성을 거부한다", () => {
    const directory = fixture();
    write(
      directory,
      "evidence/application-package.md",
      `# 토스플레이스 AI Platform 지원 준비\n\n- readiness: needs_user_input\n- evidence: safe\n- human-confirmation: needs_input\n- 공식 공고: https://example.com/job\n- 근거: sources/fos-study/task/example.md\n\n${packageBodyWithFitTable("내용")}`,
    );

    expect(() => renderApplicationPackage(directory)).toThrow("섹션에는 머리행, 구분행과 데이터 행을 가진 표가 필요합니다");
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
    const body = REQUIRED_HEADINGS["evidence/application-package.md"]
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
      "- 공식 공고: https://toss.im/career/job-detail?job_id=7733044003",
      "- 이미 링크: [토스 채용](https://toss.im/career)",
      "- 코드 안: `https://example.com/not-a-link`",
      "- 문장 끝: https://toss.im/company 를 확인한다.",
    ].join("\n");
    const body = REQUIRED_HEADINGS["evidence/application-package.md"]
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

    expect(html).toContain('<a href="https://toss.im/career/job-detail?job_id=7733044003">');
    expect(html).toContain('<a href="https://toss.im/career">토스 채용</a>');
    expect(html).not.toContain("<code><a href=");
    expect(html).toContain("<code>https://example.com/not-a-link</code>");
    expect(html).toContain('<a href="https://toss.im/company">https://toss.im/company</a> 를');
  });

  test("공고 원문 탭은 evidence/posting.md 내용을 담는다", () => {
    const directory = fixture();
    write(directory, "evidence/posting.md", "# 공고\n\n전에 없던 Proactive한 매장 관리 경험\n");

    const html = readFileSync(renderApplicationPackage(directory), "utf8");
    expect(panelText(html, "posting")).toContain("전에 없던 Proactive한 매장 관리 경험");
  });
});
