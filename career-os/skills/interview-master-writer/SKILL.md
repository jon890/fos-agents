---
name: interview-master-writer
description: Generate and publish a common senior-backend interview master playbook markdown document into the local fos-study repository, combining the candidate's latest resume and selected task documents. Use when the output should be a reusable cross-team playbook (self-introduction, career narrative, technical decision style, reverse questions, final checklist) — not a team-specific question bank or a topic-specific study pack.
---

# Interview Master Writer

Create a reusable senior-backend interview master playbook based on the candidate's real resume and project history, and publish it directly into the local `fos-study` repository.

## Purpose

This skill is for resume/task-driven documents that should help the user walk into *any* senior-backend interview with a consistent story, not a company-specific or topic-specific answer sheet.

Unlike `experience-question-bank-writer` (team/track-specific Q&A) and `study-pack-writer` (single technical topic), this output is a **cross-track master playbook**.

## Output policy

- Always write directly into `sources/fos-study`.
- Always mark the title with `[초안]`.
- Always create a git commit for the changed file.
- Always push the commit after creation/update.
- Keep execution logs and intermediate artifacts under `data/reports/`.

## Expected document shape

Each generated document should usually contain:

1. 1분 자기소개
2. 90초 자기소개 (압축 버전)
3. 핵심 커리어 요약 (타임라인 중심)
4. 강점 / 약점
5. 기술 의사결정 스타일 (어떻게 trade-off 하는가)
6. 소프트웨어 엔지니어링 / 협업 / 리더십 강점
7. 주요 경험별 프로젝트 요약 (AI 서비스 팀 / Slot 팀 등)
8. 이직 동기 / 지원 회사 동기 / 역할 핏
9. 시니어 백엔드 공통 질문 답변 프레이밍
10. 역질문 리스트 (면접관에게 던질 질문)
11. 면접 당일 최종 체크리스트

## Input strategy

Use selected inputs only.

Default pattern:
- latest resume: 1 file
- selected task docs: 2-4 files
- target company/role JD context: 1 file (optional, for framing)

Avoid feeding the entire task tree in one run. Avoid overlapping with existing question-bank content — this document is a *narrative* layer on top of those.

## Files

- Generic prompt: `references/master-prompt.md`
- Runner: `scripts/run_master.sh`
- Topic resolver: `scripts/resolve_master_topic.py`
- Topic config: `config/topics.json (master namespace)`
- Output validator: reuses `skills/study-pack-writer/scripts/extract_and_validate_study_pack.py`

## Invocation

```bash
skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh master <topic>
```

Where `<topic>` is a key in `config/topics.json (master namespace)`
(default: `senior-backend-master-playbook`).

## Publishing rules

Use commit messages like:
- `docs(interview): add draft senior-backend master playbook`
- `docs(interview): update draft senior-backend master playbook`

If push fails, surface that clearly instead of silently stopping.
