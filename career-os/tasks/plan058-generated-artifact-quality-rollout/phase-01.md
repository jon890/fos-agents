# Phase 01 — 품질 계약 docs 정리

**Model**: sonnet
**Status**: pending

---

## 목표

생성 문서 품질 계약을 docs와 ADR에 반영해 이후 native skill 수정의 기준을 만든다.

**범위 외**:

- skill prompt 수정.
- 기존 generated output rewrite.
- public fos-study publish.
- commit/push.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `tasks/plan055-resume-package-flow/index.json`
- `tasks/plan055-resume-package-flow/phase-01.md`
- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/adr.md`

---

## 작업 항목 (5)

1. plan055의 generated document quality 결정을 전역 품질 계약으로 확장한다.
2. 한국어 우선 section title과 자연스러운 한국어 문장을 docs에 적는다.
3. 첫 10줄 안에 decision/conclusion/recommended action이 있어야 한다는 기준을 적는다.
4. internal analysis와 submission/public-facing text 분리 원칙을 적는다.
5. `needs_evidence`를 `보강 필요 / 선택지 / 권장 행동`으로 바꾸는 규칙을 docs와 ADR에 남긴다.

---

## Intended File Scope

- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/adr.md`

---

## 검증

```bash
rg -n "첫 10줄|한국어 우선|내부 분석|제출용|공개용|보강 필요 / 선택지 / 권장 행동|needs_evidence" docs/prd.md docs/flow.md docs/code-architecture.md docs/adr.md
git diff --name-only
```

성공 기준:

- 품질 계약이 docs와 ADR에 나타난다.
- `needs_evidence` 변환 문구가 정확히 남는다.
- skill이나 data 파일은 수정되지 않는다.

---

## Blocked / Failed 조건

- 기존 docs에 상충하는 품질 계약이 있으면 `echo "PHASE_BLOCKED: generated artifact contract conflict" && exit 2`.
- public/private 경계가 불명확하면 `echo "PHASE_BLOCKED: public artifact boundary unclear" && exit 2`.
- intended scope 밖 파일이 변경되면 `echo "PHASE_FAILED: unexpected file scope" && exit 1`.

---

## Self-check

- 공개 산출물과 private 산출물의 요구를 섞지 않는다.
- plan055 구현 phase를 반복하지 않는다.
- docs에는 계약을 쓰고 sample rewrite는 후속 phase로 둔다.
- 승인 없는 fos-study publish는 하지 않는다.
