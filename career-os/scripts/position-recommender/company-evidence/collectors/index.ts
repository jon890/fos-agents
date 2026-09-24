import { githubCollector } from "./github.ts";
import { jobPostingCollector } from "./job-posting.ts";
import { techBlogCollector } from "./tech-blog.ts";

export { collectCompanyEvidence } from "./registry.ts";
export type { CollectorInput, CollectorResult, CompanyEvidenceCollector } from "./types.ts";

export const companyEvidenceCollectors = [techBlogCollector, githubCollector, jobPostingCollector];
