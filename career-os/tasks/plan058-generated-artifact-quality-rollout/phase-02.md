# Phase 02 — 지원 산출물 skill contract

**Model**: sonnet
**Status**: completed

---

## 목표

position recommender, application package, reviewer 계열 skill contract에 생성 문서 품질 기준을 반영한다.

**범위 외**:

- plan055 processor 구현.
- 실제 지원서 생성 실행.
- candidate-profile mutation.
- 외부 제출.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/adr.md`
- `.claude/skills/position-recommender/SKILL.md`
- application package 또는 reviewer 관련 skill/prompt가 있으면 해당 파일
- `tasks/plan055-resume-package-flow/index.json`

---

## 작업 항목 (5)

1. `position-recommender` 산출물 계약에 한국어 우선 제목과 첫 10줄 결론 기준을 반영한다.
2. application package 산출물 계약에 내부 분석과 제출용 문구 분리를 반영한다.
3. reviewer 산출물 계약에 `보강 필요 / 선택지 / 권장 행동` 루프를 반영한다.
4. approval gate를 명시해 외부 제출과 profile mutation을 막는다.
5. 변경한 skill contract가 docs 품질 계약과 같은 용어를 쓰는지 확인한다.

---

## Intended File Scope

- `.claude/skills/position-recommender/SKILL.md`
- application package 또는 reviewer 관련 `.claude/skills/*/SKILL.md`
- 필요한 경우 각 skill의 `references/` 안 contract 파일

---

## 검증

```bash
rg -n "첫 10줄|한국어 우선|내부 분석|제출용|보강 필요 / 선택지 / 권장 행동|사용자 승인" .claude/skills/position-recommender .claude/skills
rg -n "needs_evidence" .claude/skills/position-recommender .claude/skills || true
git diff --name-only
```

성공 기준:

- application 관련 skill contract에 품질 기준이 들어간다.
- `needs_evidence`가 사용자에게 그대로 노출되지 않도록 지시한다.
- plan055 phase 구현 파일은 수정하지 않는다.

---

## Blocked / Failed 조건

- application package/reviewer skill 위치를 찾을 수 없으면 `echo "PHASE_BLOCKED: application artifact skill path unclear" && exit 2`.
- skill contract 변경이 기존 approval gate와 충돌하면 `echo "PHASE_BLOCKED: approval gate conflict" && exit 2`.
- 실제 지원 산출물이 새로 생성되면 `echo "PHASE_FAILED: generated application artifact unexpectedly created" && exit 1`.

---

## Self-check

- skill contract만 수정한다.
- private 지원 내용을 샘플로 복사하지 않는다.
- 외부 제출, 로그인, 공개 발행을 금지하는 문구를 유지한다.
- plan055와 중복되는 processor 구현은 하지 않는다.
