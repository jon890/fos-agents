---
name: position-recommender
description: Recommend suitable job positions and positioning strategy from the candidate profile, resume/task docs, and optional job-market context. Use for career-os requests like "내가 갈만한 포지션 추천", "지원 포지션 후보 뽑아줘", or periodic role-fit recommendations.
---

# position-recommender

후보자에게 현실적인 타깃 포지션을 추천하는 skill.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh recommend-positions
```

추가 컨텍스트 주입:

```bash
POSITION_CONTEXT="AI 서비스 백엔드 위주" career-os/scripts/command-router/run_now.sh recommend-positions
```

실행 파일: `career-os/scripts/position-recommender/`(ADR-019).

## 입력

- `config/candidate-profile.md` — 후보자 프로필 (단일 진실 출처)
- `skills/position-recommender/references/position-context-index.md` — 추천 컨텍스트 인덱스
- `skills/position-recommender/references/position-decision-criteria.md` — 랭킹·제외 기준
- `skills/position-recommender/references/company-upside-reference.md` — 회사 브랜드·규모 upside
- `skills/position-recommender/references/verified-company-research-targets.json` — 검증된 회사 탐색 대상
- `config/sources.json` (key: `techBlog`) — 엔지니어링 블로그 신호 판단
- `POSITION_CONTEXT` env — 선택적 추가 컨텍스트

## 산출물

- `data/runtime/position-recommendation.md` — 비공개 포지션 추천 리포트

티어: **강력 추천** · **도전 추천** · **보류/주의**. 각 포지션에 role title, 포스팅 링크, 지원 근거, gap 준비사항, first action 포함. fos-study에는 게시하지 않는다.

## 관련 ADR

ADR-019: scripts/<skill>/ 분리 컨벤션.
