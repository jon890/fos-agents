---
name: position-recommender
description: Recommend suitable job positions and positioning strategy from the candidate profile, resume/task docs, and optional job-market context. Use for career-os requests like "내가 갈만한 포지션 추천", "지원 포지션 후보 뽑아줘", or periodic role-fit recommendations.
---

# position-recommender

Recommend realistic target positions for the candidate.

## Entrypoint

```bash
/home/bifos/ai-nodes/career-os/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh recommend-positions
```

Optional freeform context:

```bash
POSITION_CONTEXT="AI 서비스 백엔드 위주" run_now.sh recommend-positions
```

## Behavior

- Use `config/position-context-index.md` as the index for durable recommendation context files.
- Use `config/candidate-profile.md` as the source of truth.
- Use `config/position-decision-criteria.md` as the evolving decision rubric for ranking, exclusions, and user feedback.
- Use `config/company-upside-reference.md` for company/scale upside, brand leverage, and business risk.
- Use `config/verified-company-research-targets.json` for broad verified-company discovery targets.
- Use `config/sources.json` (key: `techBlog`) to judge whether a company has strong engineering-blog signals.
- For verified-company scans, read `references/verified-company-discovery.md`.
- Use selected local fos-study resume/task docs when helpful.
- Do not invent experience or metrics not supported by the profile/docs.
- Recommend positions in tiers:
  - **강력 추천**: apply soon, high evidence fit.
  - **도전 추천**: plausible stretch with visible prep gaps.
  - **보류/주의**: attractive but currently weak fit or risky framing.
- For each role, include:
  - role title / search keywords
  - posting link: exact individual posting URL when available
  - discovery link: official career/search page only when exact posting URL is not available
  - link evidence level: exact active posting / official career needs search / external signal only. For Wanted, exact active requires API `status=active`; web_fetch/page 200 is not enough.
  - why it fits
  - evidence from candidate experience
  - likely JD keywords
  - company/scale upside
  - engineering-blog / tech-culture signal when available
  - business or seniority risk
  - gaps to prepare
  - first action: study-pack / question-bank / resume rewrite / company research.
- Output is a private career recommendation report under `data/runtime/position-recommendation.md` and stdout. Do not publish to fos-study unless explicitly requested.
