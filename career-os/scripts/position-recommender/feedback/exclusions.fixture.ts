import type { PositionExclusion as BackendPositionExclusion } from "../../../services/career-backend/src/positions/schema.ts";
import type { PositionExclusions } from "./exclusions.ts";
import type { Posting } from "../live-postings/types.ts";

// 실제 개인 규칙과 지원 이력은 공개 테스트 fixture에 복제하지 않는다.
export const posting: Posting = {
  source: "toss-careers",
  company: "테스트 회사",
  title: "Server Developer (AI Platform)",
  url: "https://toss.im/career/job-detail?job_id=fixture-old",
  identityHash: "toss-careers:fixture-old",
  linkType: "direct_posting",
  postingStatus: "active",
  activeEvidence: "공식 API active",
  openedAt: "",
  closesAt: "no_deadline",
  daysUntilClose: "no_deadline",
  closeUrgency: "no_deadline",
  category: "개발",
  summary: "",
  tags: [],
  skills: [],
  dueTime: "",
  mainTasks: "서비스 개발",
  requirements: "백엔드 경험",
  preferred: "",
};
export const backendPostingRule = {
  scope: "posting",
  source: posting.source,
  identityHash: posting.identityHash,
  url: posting.url,
  decisionKind: "manual",
  reason: "검증용 제외 규칙",
  evidenceUrls: [posting.url],
  decidedAt: "2026-09-10",
} satisfies BackendPositionExclusion;
export const config: PositionExclusions = [backendPostingRule];

/**
 * 같은 규칙에 걸리는 공고와 걸리지 않는 공고의 변형이다. 앞의 넷은 제외돼야 한다.
 * 수집기 시험과 plugin 판정 시험이 같은 합성 데이터를 쓰도록 한곳에 둔다.
 */
export const variantPostings = [
  posting,
  { ...posting, url: "https://example.com/changed" },
  { ...posting, identityHash: undefined, url: `${posting.url}&utm_source=mail#apply` },
  {
    ...posting,
    identityHash: undefined,
    url: "https://toss.im/career/job-detail/?utm_medium=email&job_id=fixture-old",
  },
  {
    ...posting,
    title: "Server Developer (Payments)",
    identityHash: "toss-careers:other",
    url: "https://toss.im/career/job-detail?job_id=other",
  },
  {
    ...posting,
    identityHash: "toss-careers:new",
    url: "https://toss.im/career/job-detail?job_id=new",
  },
  { ...posting, source: "wanted" as const },
];
