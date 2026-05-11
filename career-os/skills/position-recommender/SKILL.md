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

- Use `config/candidate-profile.md` as the source of truth.
- Use `config/position-decision-criteria.md` as the evolving decision rubric for ranking, exclusions, and user feedback.
- Use selected local fos-study resume/task docs when helpful.
- Do not invent experience or metrics not supported by the profile/docs.
- Recommend positions in tiers:
  - **강력 추천**: apply soon, high evidence fit.
  - **도전 추천**: plausible stretch with visible prep gaps.
  - **보류/주의**: attractive but currently weak fit or risky framing.
- For each role, include:
  - role title / search keywords
  - why it fits
  - evidence from candidate experience
  - likely JD keywords
  - gaps to prepare
  - first action: study-pack / question-bank / resume rewrite / company research.
- Output is a private career recommendation report under `data/runtime/position-recommendation.md` and stdout. Do not publish to fos-study unless explicitly requested.
