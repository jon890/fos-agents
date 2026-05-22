# Phase 06 — daily-application-digest native skill 설계 + 구현

너는 `/home/bifos/ai-nodes` repo에서 실행되는 plan-and-build phase worker다. 이 phase는 application agent의 일일 상태 보고 skill을 추가하고, TossPlace fixture로 dry-run report를 생성하는 구현 phase다.

## 작업 디렉터리

반드시 repo root에서 작업한다.

```bash
cd /home/bifos/ai-nodes
```

## 목표

매일 application 상태와 새 산출물을 요약하고, 부족 역량/면접 대비 액션을 제안하는 digest skill을 만든다.

## 새 skill

`career-os/.claude/skills/daily-application-digest/SKILL.md`

기존 native skill 문체와 구조를 따른다.

참조할 기존/신규 skill:

- `career-os/.claude/skills/application-package-writer/SKILL.md`
- `career-os/.claude/skills/application-reviewer/SKILL.md`
- `career-os/.claude/skills/position-recommender/SKILL.md`
- `career-os/.claude/skills/study-topic-recommender/SKILL.md`
- `career-os/.claude/skills/study-pack-writer/SKILL.md`
- `career-os/.claude/skills/interview-asset-writer/SKILL.md`
- `career-os/.claude/skills/interview-prep-analyzer/SKILL.md`

## 입력

- `data/applications/ledger.jsonl`
- 오늘 변경된 `data/applications/**`
- `data/runtime/position-recommendation.md`
- 필요 시 `data/runtime/morning-topic-recommendation.md`
- 필요 시 interview-prep report

## 출력

- `data/reports/daily/YYYY-MM-DD/application-digest/report.md`
- Discord 요약

이 phase에서는 dry-run report를 실제 생성해도 된다. `data/reports/daily/...`는 private runtime data이므로 commit하지 않는다.

## 보고 항목

- 오늘 새로 발견한 공고
- 진행 중인 지원 상태 변화
- 오늘 생성/수정된 지원 패키지
- 사용자 승인 필요 항목
- agent가 자동 수정 중인 항목
- 해당 공고 기준 부족 역량 3개
- 오늘 공부/면접 대비 액션 1~3개

## Skill workflow 필수 요건

`daily-application-digest` skill은 다음 흐름을 문서화해야 한다.

1. 오늘 날짜 `YYYY-MM-DD`를 정한다.
2. `career-os/data/applications/ledger.jsonl`을 Read한다.
3. ledger의 각 applicationDir에 대해 존재하는 파일을 확인한다.
   - `posting.md`
   - `fit-analysis.md`
   - `application-package.md`
   - `review.md`
4. 오늘 수정된 파일과 현재 status/risk/userDecision을 요약한다.
5. 사용자 승인 필요 항목과 agent-only 작업을 분리한다.
6. 공개 가능한 학습자료 후보와 비공개 지원 전략을 분리한다.
7. 직무별 부족 역량 3개와 오늘의 공부/면접 대비 액션 1~3개를 제안한다.
8. report.md를 작성하고, Discord용 짧은 요약 블록을 report 안에 포함한다.
9. 실제 Discord 전송은 skill 기본 동작에서는 하지 않는다.
   - cron/runner에서 별도 전송하도록 설계한다.
   - phase dry-run에서도 외부 전송 금지.

## report.md 필수 구조

```markdown
# <YYYY-MM-DD> Application Digest

## Executive Summary

## Application Status

## New / Updated Artifacts

## Needs User Approval

## Agent-Only Next Work

## Gap Focus

## Study / Interview Actions

## Public-Safe Study Candidates

## Private Strategy Notes

## Discord Summary Draft
```

규칙:

- `Needs User Approval`에는 외부 제출, 로그인, 채용 계정 작업, 쿨다운 판단, 실제 지원 여부 결정을 둔다.
- `Agent-Only Next Work`에는 리뷰 재실행, evidence 수집, skill 연결, draft revise처럼 내부 작업만 둔다.
- `Public-Safe Study Candidates`는 기술 학습 주제만 둔다. 회사별 맞춤 지원 전략/이력서 문구는 넣지 않는다.
- `Private Strategy Notes`에는 공개 금지 문구를 짧게 요약하되 Discord 요약에는 길게 노출하지 않는다.
- `Discord Summary Draft`는 6줄 내외의 짧은 요약만 작성한다.

## TossPlace dry-run fixture

Phase 03/04/05 산출물을 사용한다.

- ledger: `career-os/data/applications/ledger.jsonl`
- dir: `career-os/data/applications/tossplace/applied-ai-engineer`
- posting: `career-os/data/applications/tossplace/applied-ai-engineer/posting.md`
- fit-analysis: `career-os/data/applications/tossplace/applied-ai-engineer/fit-analysis.md`
- application-package: `career-os/data/applications/tossplace/applied-ai-engineer/application-package.md`
- review: `career-os/data/applications/tossplace/applied-ai-engineer/review.md`

dry-run 후 private report가 생겨야 한다.

- `career-os/data/reports/daily/2026-05-22/application-digest/report.md`

이 private report는 commit하지 않는다.

tracked audit summary는 아래 경로에 작성하고 commit한다.

- `career-os/tasks/plan029-application-agent-mvp/audit/phase-06-daily-application-digest-summary.md`

audit summary에는 다음만 포함한다.

- 생성/수정한 tracked 파일 목록
- dry-run private report 경로
- line count
- 사용자 승인 항목/agent-only 항목 분리 확인
- public-safe/private 전략 분리 확인
- Discord 외부 전송 미수행 확인
- `sources/fos-study/` 미변경 확인

## 검증 기준

- report가 20줄 이상이다.
- 승인 필요 항목과 agent-only 작업이 분리되어 있다.
- 공개 가능한 학습 자료 후보와 비공개 지원 전략이 분리되어 있다.
- Discord 요약에는 민감한 맞춤 이력서 문구를 길게 노출하지 않는다.
- 아래 명령이 성공해야 한다.

```bash
test -f career-os/.claude/skills/daily-application-digest/SKILL.md
test -f career-os/data/reports/daily/2026-05-22/application-digest/report.md
test "$(wc -l < career-os/data/reports/daily/2026-05-22/application-digest/report.md)" -ge 20
grep -q "Needs User Approval" career-os/data/reports/daily/2026-05-22/application-digest/report.md
grep -q "Agent-Only Next Work" career-os/data/reports/daily/2026-05-22/application-digest/report.md
grep -q "Public-Safe Study Candidates" career-os/data/reports/daily/2026-05-22/application-digest/report.md
grep -q "Private Strategy Notes" career-os/data/reports/daily/2026-05-22/application-digest/report.md
grep -q "Discord Summary Draft" career-os/data/reports/daily/2026-05-22/application-digest/report.md
git -C career-os status --short -- sources/fos-study
bunx tsc --noEmit
```

`git -C career-os status --short -- sources/fos-study`는 출력이 없어야 한다.

## 의도적으로 안 하는 것

- 실제 Discord 전송은 하지 않는다.
- 실제 지원서 제출, 로그인, 채용 사이트 입력 자동화는 하지 않는다.
- `sources/fos-study/`에는 아무것도 쓰지 않는다.
- private report(`career-os/data/reports/daily/...`)는 commit하지 않는다.

## Commit

검증 성공 후 tracked 파일만 commit한다.

예상 tracked 파일:

- `career-os/.claude/skills/daily-application-digest/SKILL.md`
- `career-os/tasks/plan029-application-agent-mvp/audit/phase-06-daily-application-digest-summary.md`

commit message:

```text
feat(career-os): add daily application digest skill
```
