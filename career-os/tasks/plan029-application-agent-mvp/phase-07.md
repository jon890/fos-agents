# Phase 07 — 기존 skill 연결 검증 + TossPlace 샘플 end-to-end 리허설

너는 `/home/bifos/ai-nodes` repo에서 실행되는 plan-and-build phase worker다. 이 phase는 새 application agent MVP의 e2e rehearsal 검증 phase다. 새 기능을 크게 추가하지 말고, 기존 산출물과 skill 연결이 실제로 끊기지 않는지 점검하고 audit summary를 남긴다.

## 작업 디렉터리

반드시 repo root에서 작업한다.

```bash
cd /home/bifos/ai-nodes
```

## 목표

TossPlace fixture를 이용해 application agent MVP 흐름이 끊기지 않는지 검증한다.

## 리허설 범위

1. `posting.md` fixture 확인
2. `application-package-writer` 실행
3. `application-reviewer` 실행
4. revise 필요 시 한 번 이상 수정 루프 확인
5. `daily-application-digest` 실행
6. study/interview 후속 액션이 기존 skill로 자연스럽게 연결되는지 확인

주의:

- 실제 Claude skill을 외부 제출/발행 형태로 호출하지 않는다.
- `/study-pack-writer`는 공개 블로그 발행/commit/push 흐름이 있을 수 있으므로 이 phase에서 실행하지 말고 연결 가능성만 문서로 검증한다.
- `/interview-asset-writer`도 실제 공개/비공개 산출 범위가 애매하면 실행하지 않는다.
- 실제 Discord 전송, 채용 사이트 로그인, 지원서 제출은 금지한다.

## 기존 skill 연결 검증

- `/position-recommender`: 후보 큐 source로 사용 가능
- `/study-topic-recommender`: gap 기반 study 후보 추천 가능
- `/study-pack-writer`: 공개 가능한 기술 학습 자료만 발행 가능
- `/interview-asset-writer`: 공고 기반 면접 질문/답변 asset 생성 가능
- `/interview-prep-analyzer`: 제출 후 daily drill로 연결 가능
- `/candidate-baseline-suggester`: 누적 결과에서 candidate-profile 개선 후보 제안 가능

## 리허설 산출물

private rehearsal report를 작성한다.

- `career-os/data/applications/tossplace/applied-ai-engineer/e2e-rehearsal.md`

tracked audit summary를 작성하고 commit한다.

- `career-os/tasks/plan029-application-agent-mvp/audit/phase-07-e2e-rehearsal-summary.md`

## e2e-rehearsal.md 필수 구조

```markdown
# TossPlace Applied AI Engineer — Application Agent MVP Rehearsal

## Artifact Inventory

## Flow Result

## Ledger Transition Check

## Revision Loop Check

## Daily Digest Check

## Existing Skill Connection Map

## Remaining Work

## Safety Boundary Check
```

규칙:

- `Flow Result`에는 Phase 03→04→05→06 결과를 한 문단으로 요약한다.
- `Ledger Transition Check`에는 현재 ledger status와 가능한 next status를 적는다.
  - TossPlace fixture는 `mvp_fixture_only`와 `toss_group_cooldown` 때문에 `blocked` 제안이 자연스럽다.
  - 실제 ledger 변경은 사용자 승인 전에는 하지 않는다.
- `Revision Loop Check`에는 reviewer verdict가 `blocked`라서 draft 수정 루프보다 blocker 해소가 우선임을 적는다.
- `Existing Skill Connection Map`에는 각 기존 skill이 어떤 입력을 받고 어떤 후속 산출물을 낼지 경로 중심으로 적는다.
- `Remaining Work`에는 submission assistant, cron 등록, multi-source expansion, ledger transition runner, OpenClaw wrapper 추가를 분리한다.

## audit summary 필수 내용

- 생성/수정한 tracked 파일 목록
- private rehearsal report 경로
- artifact inventory 결과
- ledger transition check 결과
- 기존 skill 연결 맵 요약
- 외부 전송/제출/로그인/공개 발행 미수행 확인
- `sources/fos-study/` 미변경 확인

## 검증 기준

- TossPlace sample application directory에 `posting.md`, `fit-analysis.md`, `application-package.md`, `review.md`가 모두 있다.
- ledger 상태가 end-to-end 흐름에 맞게 전이된다.
- 실제 제출 자동화가 수행되지 않는다.
- `sources/fos-study/`에는 회사/지원 전략이 포함된 문서가 생성되지 않는다.
- daily digest가 사용자 승인 필요 항목과 다음 액션을 분리한다.
- 아래 명령이 성공해야 한다.

```bash
test -f career-os/data/applications/tossplace/applied-ai-engineer/posting.md
test -f career-os/data/applications/tossplace/applied-ai-engineer/fit-analysis.md
test -f career-os/data/applications/tossplace/applied-ai-engineer/application-package.md
test -f career-os/data/applications/tossplace/applied-ai-engineer/review.md
test -f career-os/data/reports/daily/2026-05-22/application-digest/report.md
test -f career-os/data/applications/tossplace/applied-ai-engineer/e2e-rehearsal.md
test "$(wc -l < career-os/data/applications/tossplace/applied-ai-engineer/e2e-rehearsal.md)" -ge 40
grep -q "Existing Skill Connection Map" career-os/data/applications/tossplace/applied-ai-engineer/e2e-rehearsal.md
grep -q "Safety Boundary Check" career-os/data/applications/tossplace/applied-ai-engineer/e2e-rehearsal.md
grep -q "Needs User Approval" career-os/data/reports/daily/2026-05-22/application-digest/report.md
grep -q "Agent-Only Next Work" career-os/data/reports/daily/2026-05-22/application-digest/report.md
bun career-os/scripts/application-agent/ledger_schema.ts career-os/data/applications/ledger.jsonl
bunx tsc --noEmit
git -C career-os status --short -- sources/fos-study
```

`git -C career-os status --short -- sources/fos-study`는 출력이 없어야 한다.

## 완료 기준

- plan029 MVP가 TossPlace fixture에서 동작한다.
- 남은 확장 작업은 submission assistant, cron 등록, multi-source expansion으로 분리되어 있다.
- 실제 제출/로그인/외부 전송/공개 발행이 수행되지 않았다.

## Commit

검증 성공 후 tracked 파일만 commit한다.

예상 tracked 파일:

- `career-os/tasks/plan029-application-agent-mvp/audit/phase-07-e2e-rehearsal-summary.md`
- 필요 시 `career-os/tasks/plan029-application-agent-mvp/index.json`

commit message:

```text
test(career-os): rehearse application agent mvp flow
```
