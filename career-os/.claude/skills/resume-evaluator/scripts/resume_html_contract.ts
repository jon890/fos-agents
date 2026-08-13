export const RESUME_HTML_CONTRACT = {
  pageCount: 2,
  requiredSectionIds: ["profile", "selected-work", "career", "motivation", "skills"],
  internalLeakPatterns: [
    /\/Users\//,
    /fos-study/i,
    /(?:^|["'\s>])task\//i,
    /needs_evidence/i,
    /\bplan\d{2,}\b/i,
    /검토 중|초안입니다/,
  ],
} as const;
