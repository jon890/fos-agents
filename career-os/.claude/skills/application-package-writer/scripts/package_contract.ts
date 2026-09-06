import { FIT_JUDGMENT_SCORES, type FitJudgment } from "./fit_score.ts";
export { FIT_TABLE_HEADING, FIT_TABLE_HEADERS } from "./fit_score.ts";

export const REQUIRED_PACKAGE_FILES = [
  "evidence/posting.md",
  "evidence/candidate-interview.md",
  "evidence/application-package.md",
  "evidence/resume-draft.md",
  "evidence/interview-questions.json",
] as const;

export const REQUIRED_HEADINGS: Readonly<Record<string, readonly string[]>> = {
  "evidence/candidate-interview.md": ["## 확보된 답변", "## 미확인 질문"],
  "evidence/application-package.md": [
    "## 결론",
    "## 공고 항목별 적합도",
    "## 공개 자료로 확인한 팀과 인접 사례",
    "## 요구사항과 근거",
    "## 이 포지션에서의 승부처",
    "## 지원동기",
    "## 입사 후 기여 시나리오",
    "## 보완할 공백",
    "## 회사 문화와의 연결",
    "## 면접에서 검증받을 내용",
    "## 제출 준비 상태",
    "## 사용자 확인 필요",
    "## 다음 행동",
  ],
  "evidence/resume-draft.md": ["## 프로필", "## 주요 프로젝트", "## 경력", "## 기술"],
};

export const FIT_TABLE_VERDICTS: readonly FitJudgment[] = Object.keys(FIT_JUDGMENT_SCORES) as FitJudgment[];

export const SUBMISSION_LEAK_PATTERNS = [
  /\/Users\//,
  /sources\/fos-study/i,
  /needs_evidence/i,
  /\b(?:plan|task)[-_ ]?\d{2,}\b/i,
  /\b[0-9a-f]{40}\b/i,
] as const;

export const REDUNDANT_PACKAGE_FILES = [
  "evidence-audit.md",
  "career-description-evidence-audit.md",
  "career-description-design.md",
] as const;

/** 디렉터리 최상위에 두는 파일. 사용자가 직접 연다. */
export const TOP_LEVEL_FILES = [
  "application-package.html",
  "resume.pdf",
  "career-description.pdf",
  "submission.pdf",
] as const;

/** `evidence/`에 두는 파일. 기준 원본 Markdown과 구조화 입력이다. */
export const EVIDENCE_FILES = [
  "posting.md",
  "candidate-interview.md",
  "application-package.md",
  "resume-draft.md",
  "interview-questions.json",
  "career-description-draft.md",
  "application-form.json",
] as const;

/** `review/`에 두는 파일. 검증기가 읽고 쓴다. */
export const REVIEW_FILES = [
  "resume.html",
  "career-description.html",
  "claim-ledger.json",
  "career-description-claim-ledger.json",
  "resume-scorecard.md",
  "career-description-scorecard.md",
  "submission-manifest.json",
] as const;

export const EVIDENCE_DIRECTORY = "evidence";
export const REVIEW_DIRECTORY = "review";

export const ALLOWED_PACKAGE_FILES = [
  ...TOP_LEVEL_FILES,
  ...EVIDENCE_FILES.map((file) => `${EVIDENCE_DIRECTORY}/${file}`),
  ...REVIEW_FILES.map((file) => `${REVIEW_DIRECTORY}/${file}`),
] as const;
