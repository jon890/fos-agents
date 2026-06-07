# Phase 04 — 샘플 감사와 리라이트

**Model**: sonnet
**Status**: pending

---

## 목표

기존 generated output 1-2개를 골라 품질 계약을 audit하고, private 내용을 공개하지 않는 방식으로 rewrite 샘플을 남긴다.

**범위 외**:

- 실제 제출 문서 교체.
- 공개 fos-study publish.
- private content 공개.
- 자동 대량 rewrite.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `tasks/plan058-generated-artifact-quality-rollout/index.json`
- `docs/prd.md`
- `docs/data-schema.md`
- `docs/adr.md`
- `data/applications` 아래 최근 generated output은 제목과 구조만 최소 확인
- 공개 가능한 study/interview output 후보가 있으면 해당 파일

---

## 작업 항목 (5)

1. private 노출 위험이 낮은 generated output 후보 1-2개를 고른다.
2. 첫 10줄 결론, 한국어 제목, 내부 분석 분리, `보강 필요 / 선택지 / 권장 행동` 기준으로 audit한다.
3. 원문 private 내용을 길게 인용하지 않고 issue category 중심으로 기록한다.
4. `tasks/plan058-generated-artifact-quality-rollout/sample-audit.md`에 before/after outline을 작성한다.
5. 실제 산출물 파일을 고치지 않고 rewrite sample은 task-local note로만 둔다.

---

## Intended File Scope

- `tasks/plan058-generated-artifact-quality-rollout/sample-audit.md`

---

## 검증

```bash
test -f tasks/plan058-generated-artifact-quality-rollout/sample-audit.md
rg -n "첫 10줄|한국어|내부 분석|보강 필요 / 선택지 / 권장 행동|before|after|private" tasks/plan058-generated-artifact-quality-rollout/sample-audit.md
git status --short tasks/plan058-generated-artifact-quality-rollout data/applications sources/fos-study
```

성공 기준:

- sample audit이 1-2개 산출물의 구조 문제와 rewrite outline을 담는다.
- private 원문이 노출되지 않는다.
- 실제 generated output 파일은 수정되지 않는다.

---

## Blocked / Failed 조건

- 공개해도 안전한 audit 후보를 고를 수 없으면 `echo "PHASE_BLOCKED: safe sample candidate unavailable" && exit 2`.
- rewrite에 private content가 포함될 위험이 있으면 `echo "PHASE_BLOCKED: sample rewrite privacy risk" && exit 2`.
- data/applications 또는 sources/fos-study 파일이 변경되면 `echo "PHASE_FAILED: generated output changed unexpectedly" && exit 1`.

---

## Self-check

- task-local sample만 만든다.
- 원문을 길게 인용하지 않는다.
- 회사명, 지원 세부사항, 비공개 평가를 공개하지 않는다.
- audit은 품질 계약 검증 목적에 한정한다.
