# Phase 04 — application-package-writer native skill 설계 + 구현

너는 `/home/bifos/ai-nodes` repo에서 실행되는 plan-and-build phase worker다. 이 phase는 Claude native skill 하나를 추가하고, TossPlace fixture로 dry-run 검증하는 구현 phase다.

## 작업 디렉터리

반드시 repo root에서 작업한다.

```bash
cd /home/bifos/ai-nodes
```

## 목표

공고 1개와 후보자 프로필을 입력으로 받아 공고별 지원 패키지를 생성하는 Claude native skill을 만든다.

## 새 skill

`career-os/.claude/skills/application-package-writer/SKILL.md`

기존 native skill 문체와 구조를 따른다.

참조할 기존 skill:

- `career-os/.claude/skills/position-recommender/SKILL.md`
- `career-os/.claude/skills/candidate-baseline-suggester/SKILL.md`
- `career-os/.claude/skills/interview-prep-analyzer/SKILL.md`

## 입력

- `data/applications/<company>/<role>/posting.md`
- `config/candidate-profile.md`
- 필요 시 candidate-profile이 참조하는 resume/task 근거 파일
- 선택: `data/applications/ledger.jsonl`

## 출력

- `data/applications/<company>/<role>/fit-analysis.md`
- `data/applications/<company>/<role>/application-package.md`

이 phase에서는 TossPlace fixture를 기준으로 dry-run 산출물을 실제 생성해도 된다. 단, `data/applications/`는 gitignored private data이므로 commit하지 않는다.

## 필수 내용

`fit-analysis.md`:

- 공고 요약
- role-fit 요약
- 강점 근거
- gap
- 지원 우선순위
- risk flags

`application-package.md`:

- 맞춤 이력서 bullet 초안
- 지원동기/자기소개 초안
- 직무별 강조 포인트
- 면접 대비 포인트
- 근거 파일 참조

## Skill workflow 필수 요건

`application-package-writer` skill은 다음 흐름을 문서화해야 한다.

1. 입력 posting path를 자연어에서 추출한다.
   - 예: `/application-package-writer data/applications/tossplace/applied-ai-engineer/posting.md`
   - path가 없으면 `data/applications/ledger.jsonl`에서 `needsUserReview=true` 또는 `status=discovered|analyzing|preparing_application`인 첫 항목을 후보로 삼는다.
2. posting, candidate-profile, 관련 근거 파일을 Read한다.
3. 공고 요구사항과 후보자 근거를 분리해 분석한다.
   - 확인된 근거가 있으면 파일 경로를 붙인다.
   - 근거가 없거나 약한 주장은 반드시 `needs_evidence`로 표시한다.
4. `fit-analysis.md`와 `application-package.md`를 작성한다.
5. self-check를 최대 3회 반복한다.
   - 각 출력 30줄 이상
   - 회사명/지원 전략이 `sources/fos-study/` 아래 생성되지 않음
   - `needs_evidence`가 필요한 주장에 붙어 있음
   - final submission, login, external form submit 관련 문구는 실행 지시가 아니라 사용자 승인 필요 항목으로만 존재
6. ledger는 이 phase에서 직접 변경하지 않아도 된다. 대신 `application-package.md` 마지막에 다음 상태 제안 블록을 남긴다.

```markdown
## Ledger Update Suggestion

- current_status: discovered
- suggested_next_status: ready_for_user_review
- userDecision: pending
- needsUserReview: true
- nextActions:
  - review_application_package
  - run_application_reviewer
```

## TossPlace dry-run fixture

Phase 03에서 생성된 fixture를 사용한다.

- posting: `career-os/data/applications/tossplace/applied-ai-engineer/posting.md`
- ledger: `career-os/data/applications/ledger.jsonl`

dry-run 후 private 산출물이 생겨야 한다.

- `career-os/data/applications/tossplace/applied-ai-engineer/fit-analysis.md`
- `career-os/data/applications/tossplace/applied-ai-engineer/application-package.md`

이 private 산출물은 commit하지 않는다.

tracked audit summary는 아래 경로에 작성하고 commit한다.

- `career-os/tasks/plan029-application-agent-mvp/audit/phase-04-application-package-writer-summary.md`

audit summary에는 다음만 포함한다.

- 생성/수정한 tracked 파일 목록
- dry-run private output 경로
- line count
- `needs_evidence` 존재 여부
- `sources/fos-study/` 미변경 확인
- 제출/로그인/외부 계정 작업 미수행 확인

## 검증 기준

- 근거 없는 주장은 `needs_evidence`로 표시한다.
- 회사명/지원 전략이 들어간 파일을 `sources/fos-study/`에 쓰지 않는다.
- 출력 파일 2개가 존재하고 30줄 이상이다.
- ledger 상태를 `preparing_application` 또는 `ready_for_user_review`로 갱신할 수 있는 next action을 남긴다.
- 아래 명령이 성공해야 한다.

```bash
test -f career-os/.claude/skills/application-package-writer/SKILL.md
test -f career-os/data/applications/tossplace/applied-ai-engineer/fit-analysis.md
test -f career-os/data/applications/tossplace/applied-ai-engineer/application-package.md
test "$(wc -l < career-os/data/applications/tossplace/applied-ai-engineer/fit-analysis.md)" -ge 30
test "$(wc -l < career-os/data/applications/tossplace/applied-ai-engineer/application-package.md)" -ge 30
grep -q "needs_evidence" career-os/data/applications/tossplace/applied-ai-engineer/application-package.md
git -C career-os status --short -- sources/fos-study
bunx tsc --noEmit
```

`git -C career-os status --short -- sources/fos-study`는 출력이 없어야 한다.

## 의도적으로 안 하는 것

- review pass/fail 최종 판단은 Phase 05의 `application-reviewer`가 담당한다.
- 실제 지원서 제출, 로그인, 채용 사이트 입력 자동화는 하지 않는다.
- `sources/fos-study/`에는 아무것도 쓰지 않는다.
- private output 파일(`career-os/data/applications/...`)은 commit하지 않는다.

## Commit

검증 성공 후 tracked 파일만 commit한다.

예상 tracked 파일:

- `career-os/.claude/skills/application-package-writer/SKILL.md`
- `career-os/tasks/plan029-application-agent-mvp/audit/phase-04-application-package-writer-summary.md`

commit message:

```text
feat(career-os): add application package writer skill
```
