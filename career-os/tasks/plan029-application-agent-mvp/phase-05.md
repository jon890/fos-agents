# Phase 05 — application-reviewer native skill 설계 + 구현

너는 `/home/bifos/ai-nodes` repo에서 실행되는 plan-and-build phase worker다. 이 phase는 Phase 04에서 만든 지원 패키지를 검토하는 Claude native reviewer skill을 추가하고, TossPlace fixture로 dry-run 검증하는 구현 phase다.

## 작업 디렉터리

반드시 repo root에서 작업한다.

```bash
cd /home/bifos/ai-nodes
```

## 목표

공고별 지원 패키지가 실제 경험과 어긋나지 않는지 검토하는 reviewer skill을 만든다.

## 새 skill

`career-os/.claude/skills/application-reviewer/SKILL.md`

기존 native skill 문체와 구조를 따른다.

참조할 기존/신규 skill:

- `career-os/.claude/skills/application-package-writer/SKILL.md`
- `career-os/.claude/skills/position-recommender/SKILL.md`
- `career-os/.claude/skills/candidate-baseline-suggester/SKILL.md`
- `career-os/.claude/skills/interview-prep-analyzer/SKILL.md`

## 입력

- `posting.md`
- `fit-analysis.md`
- `application-package.md`
- `config/candidate-profile.md`
- 관련 resume/task 근거 파일
- 선택: `data/applications/ledger.jsonl`

## 출력

- `data/applications/<company>/<role>/review.md`

이 phase에서는 TossPlace fixture를 기준으로 dry-run 산출물을 실제 생성해도 된다. 단, `data/applications/`는 gitignored private data이므로 commit하지 않는다.

## 검토 축

- evidence guard: 근거 없는 주장 여부
- drift review: 공고에 맞추다 실제 경력과 멀어진 표현
- exaggeration check: 과장/허위 가능성
- privacy/publication boundary: 공개 금지 정보 포함 여부
- cooldown/duplication: 회사별 쿨다운, 중복 지원 리스크
- user approval gate: 사용자 승인 필요 항목

## 판정

- `pass`: 사용자에게 보여줄 수 있음
- `revise`: agent가 수정 루프로 되돌려야 함
- `blocked`: 공고 만료, 쿨다운, 근거 부족 등으로 진행 중단

## Skill workflow 필수 요건

`application-reviewer` skill은 다음 흐름을 문서화해야 한다.

1. 입력 application directory 또는 file path를 자연어에서 추출한다.
   - 예: `/application-reviewer data/applications/tossplace/applied-ai-engineer`
   - path가 없으면 `data/applications/ledger.jsonl`에서 `status=ready_for_user_review|preparing_application|needs_revision` 또는 `needsUserReview=true`인 첫 항목을 후보로 삼는다.
2. posting, fit-analysis, application-package, candidate-profile, 관련 근거 파일을 Read한다.
3. 검토 축별로 판정한다.
   - evidence guard
   - drift review
   - exaggeration check
   - privacy/publication boundary
   - cooldown/duplication
   - user approval gate
4. 최종 판정을 `pass|revise|blocked` 중 하나로 정한다.
5. `review.md`를 작성한다.
6. self-check를 최대 3회 반복한다.

## review.md 필수 구조

```markdown
# <Company> <Role> — Application Review

## Verdict

- result: pass|revise|blocked
- confidence: low|medium|high
- needsUserReview: true

## Evidence Guard

## Drift Review

## Exaggeration Check

## Privacy / Publication Boundary

## Cooldown / Duplication Risk

## User Approval Gate

## Revision Requests

## Ledger Update Suggestion
```

규칙:

- `revise`일 경우 `Revision Requests`에 agent가 수정할 수 있는 구체 항목을 3개 이상 남긴다.
- `blocked`일 경우 source path 또는 posting/risk flag 근거를 함께 적는다.
- `pass`일 경우에도 사용자 승인 필요 항목은 남긴다.
- TossPlace fixture에는 `toss_group_cooldown` risk flag가 있으므로 실제 제출 가능 판정처럼 쓰지 않는다. MVP fixture라면 `blocked` 또는 `revise`가 자연스럽다.
- 근거 없는 주장, 과장 가능 표현, 실제 제출/로그인/외부 계정 작업은 사용자 승인 필요 항목으로만 다룬다.

## TossPlace dry-run fixture

Phase 03/04 산출물을 사용한다.

- dir: `career-os/data/applications/tossplace/applied-ai-engineer`
- posting: `career-os/data/applications/tossplace/applied-ai-engineer/posting.md`
- fit-analysis: `career-os/data/applications/tossplace/applied-ai-engineer/fit-analysis.md`
- application-package: `career-os/data/applications/tossplace/applied-ai-engineer/application-package.md`
- ledger: `career-os/data/applications/ledger.jsonl`

dry-run 후 private 산출물이 생겨야 한다.

- `career-os/data/applications/tossplace/applied-ai-engineer/review.md`

이 private 산출물은 commit하지 않는다.

tracked audit summary는 아래 경로에 작성하고 commit한다.

- `career-os/tasks/plan029-application-agent-mvp/audit/phase-05-application-reviewer-summary.md`

audit summary에는 다음만 포함한다.

- 생성/수정한 tracked 파일 목록
- dry-run private output 경로
- verdict
- line count
- revision/blocker 요약
- `sources/fos-study/` 미변경 확인
- 제출/로그인/외부 계정 작업 미수행 확인

## 검증 기준

- `review.md`에 pass/revise/blocked 중 하나가 명시된다.
- `revise`일 경우 수정 요청이 구체적이어야 한다.
- `blocked`일 경우 차단 근거가 source와 함께 있어야 한다.
- 최대 3회 수정 루프를 넘기면 사용자에게 blocker로 보고한다.
- 아래 명령이 성공해야 한다.

```bash
test -f career-os/.claude/skills/application-reviewer/SKILL.md
test -f career-os/data/applications/tossplace/applied-ai-engineer/review.md
test "$(wc -l < career-os/data/applications/tossplace/applied-ai-engineer/review.md)" -ge 30
grep -Eq "result: (pass|revise|blocked)" career-os/data/applications/tossplace/applied-ai-engineer/review.md
grep -q "User Approval Gate" career-os/data/applications/tossplace/applied-ai-engineer/review.md
git -C career-os status --short -- sources/fos-study
bunx tsc --noEmit
```

`git -C career-os status --short -- sources/fos-study`는 출력이 없어야 한다.

## 의도적으로 안 하는 것

- 실제 지원서 제출, 로그인, 채용 사이트 입력 자동화는 하지 않는다.
- `sources/fos-study/`에는 아무것도 쓰지 않는다.
- private output 파일(`career-os/data/applications/...`)은 commit하지 않는다.
- Phase 04 산출물을 자동으로 수정하지 않는다. 수정 루프 실행은 Phase 07 e2e 리허설에서 다룬다.

## Commit

검증 성공 후 tracked 파일만 commit한다.

예상 tracked 파일:

- `career-os/.claude/skills/application-reviewer/SKILL.md`
- `career-os/tasks/plan029-application-agent-mvp/audit/phase-05-application-reviewer-summary.md`

commit message:

```text
feat(career-os): add application reviewer skill
```
