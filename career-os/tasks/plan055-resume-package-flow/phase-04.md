# Phase 04 — 생성 및 리뷰 루프

**Model**: sonnet
**Status**: completed

---

## 목표

지원 패키지 생성과 reviewer loop가 Resume Package Contract를 따르게 한다.
`needs_evidence`는 제출용 문서에 방치하지 않고 해결 루프로 바꾼다.

**범위 외**: request status DB 구현, post-validation gate, dashboard UI, PDF/DOCX export.

---

## 관련 docs

실행 전 반드시 읽는다.

- `docs/data-schema.md` — 생성 문서 품질 계약
- `docs/flow.md` — needs_evidence resolution loop
- `docs/code-architecture.md` — skill contract 책임
- `docs/adr.md` — ADR-040, ADR-042, ADR-056
- `.claude/skills/application-package-writer/SKILL.md`
- `.claude/skills/application-reviewer/SKILL.md`

---

## 작업 항목 (5)

### 1. writer output contract 갱신

수정 대상:

- `.claude/skills/application-package-writer/SKILL.md`
- 관련 references가 있으면 해당 파일

writer는 다음 파일을 생성하거나 갱신해야 한다.

- `application-package.md`
- `resume-draft.md`
- `cover-letter.md`
- `submission-checklist.md`

단, 내부 분석과 제출용 문구를 분리한다.

### 2. reviewer contract 갱신

수정 대상:

- `.claude/skills/application-reviewer/SKILL.md`
- 관련 references가 있으면 해당 파일

reviewer는 필수 산출물 4개와 `review.md`를 함께 검토한다.
verdict는 `pass`, `revise`, `blocked`를 유지한다.

### 3. 생성 문서 품질 계약 반영

writer/reviewer 문서에 품질 기준을 명시한다.

- 첫 10줄 안 결론
- 한국어 우선 제목
- 자연스러운 한국어 문장
- 내부 분석과 제출용 문구 분리
- 긴 문단 회피
- 영어-heavy label 회피

### 4. `needs_evidence` resolution loop 반영

`needs_evidence`를 발견하면 다음 구조로 바꾼다.

- `보강 필요`
- `선택지`
- `권장 행동`

근거가 확인되기 전에는 제출용 문서에 강한 주장으로 쓰지 않는다.

### 5. sample 또는 fixture smoke

비민감 fixture로 writer/reviewer contract를 검증한다.
실제 private 지원서 본문을 public docs나 git tracked fixture에 넣지 않는다.

---

## 성공 기준

- writer contract가 `resume-draft.md`, `cover-letter.md`, `submission-checklist.md`를 요구한다.
- reviewer contract가 새 산출물을 검토한다.
- `needs_evidence`가 제출용 문서에 unresolved token으로 남지 않게 지시한다.
- 한국어 우선 생성 품질 기준이 skill contract에 반영된다.
- 사용자 승인 gate가 유지된다.

---

## 검증

보고 직전 반드시 실행한다.

```bash
rg "resume-draft.md|cover-letter.md|submission-checklist.md" .claude/skills/application-package-writer .claude/skills/application-reviewer scripts/application-agent
rg "보강 필요|선택지|권장 행동|첫 10줄|한국어" .claude/skills/application-package-writer .claude/skills/application-reviewer
git diff --stat
```

---

## Blocked / Failed 조건

- 해당 skill 파일이 없으면 `PHASE_BLOCKED: application package/reviewer skill unavailable`를 출력하고 exit 2.
- private 지원 문서 내용을 fixture로 추적해야만 검증 가능하다면 `PHASE_BLOCKED: private fixture policy decision required`를 출력하고 exit 2.
- grep 검증이 실패하면 `PHASE_FAILED: resume generation contract missing`를 출력하고 exit 1.

---

## Intended File Scope

- `.claude/skills/application-package-writer/**`
- `.claude/skills/application-reviewer/**`
- 필요 시 `scripts/application-agent/skill_contracts.ts`
- 필요 시 `docs/data-schema.md`, `docs/flow.md`

---

## Self-check

- `config/candidate-profile.md`를 수정하지 않는다.
- public fos-study 파일을 수정하지 않는다.
- 사용자 승인 없는 제출 자동화를 추가하지 않는다.
