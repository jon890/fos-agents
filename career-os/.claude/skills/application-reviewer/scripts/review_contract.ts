export const REQUIRED_APPLICATION_FILES = [
  "posting.md",
  "fit-analysis.md",
  "application-package.md",
  "resume-draft.md",
  "cover-letter.md",
  "submission-checklist.md",
] as const;

export const REQUIRED_REVIEW_HEADINGS = [
  "## 결론",
  "## Verdict",
  "## 공고 적합성",
  "## 패키지 정합성",
  "## 제출 문구 안전성",
  "## 개인정보와 공개 범위",
  "## 중복 지원과 진행 제한",
  "## 사용자 승인 항목",
  "## 수정 요청",
  "## 상태 변경 제안",
] as const;

export const INTERNAL_LEAK_PATTERNS = [
  /\/Users\//,
  /needs_evidence/i,
  /\b(?:plan|task)[-_ ]?\d{2,}\b/i,
  /\b[0-9a-f]{40}\b/i,
] as const;
