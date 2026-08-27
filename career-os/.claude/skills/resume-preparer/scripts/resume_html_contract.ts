export type SubmissionDocumentKind = "resume" | "career-description";

const sharedContract = {
  pageCount: 2,
  internalLeakPatterns: [
    /\/Users\//,
    /fos-study/i,
    /(?:^|["'\s>])task\//i,
    /needs_evidence/i,
    /\bplan\d{2,}\b/i,
    /검토 중|초안입니다/,
  ],
} as const;

export const SUBMISSION_HTML_CONTRACTS = {
  resume: {
    ...sharedContract,
    label: "이력서",
    requiredSectionIds: ["profile", "selected-work", "career", "skills"],
  },
  "career-description": {
    ...sharedContract,
    label: "경력기술서",
    requiredSectionIds: ["career", "skills"],
  },
} as const;

export const RESUME_HTML_CONTRACT = SUBMISSION_HTML_CONTRACTS.resume;
