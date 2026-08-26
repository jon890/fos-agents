export const REQUIRED_PACKAGE_FILES = [
  "posting.md",
  "candidate-interview.md",
  "application-package.md",
  "resume-draft.md",
  "interview-questions.json",
] as const;

export const REQUIRED_RESUME_SUBMISSION_FILES = [
  "resume.html",
  "resume.pdf",
  "claim-ledger.json",
  "resume-scorecard.md",
  "submission-manifest.json",
] as const;

export const REQUIRED_CAREER_DESCRIPTION_FILES = [
  "career-description.html",
  "career-description.pdf",
  "career-description-claim-ledger.json",
  "career-description-scorecard.md",
  "submission.pdf",
] as const;

export const REQUIRED_HEADINGS: Readonly<Record<string, readonly string[]>> = {
  "candidate-interview.md": ["## 확보된 답변", "## 미확인 질문"],
  "application-package.md": [
    "## 결론",
    "## 회사와 포지션이 찾는 사람",
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
  "resume-draft.md": ["## 프로필", "## 주요 프로젝트", "## 경력", "## 기술"],
};

export const SUBMISSION_LEAK_PATTERNS = [
  /\/Users\//,
  /sources\/fos-study/i,
  /needs_evidence/i,
  /\b(?:plan|task)[-_ ]?\d{2,}\b/i,
  /\b[0-9a-f]{40}\b/i,
] as const;
