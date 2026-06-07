# Phase 05 — 적용 검증

**Model**: haiku
**Status**: pending

---

## 목표

plan058 rollout 범위와 grep 검증을 마무리하고 후속 post-validation 도입 여부를 정리한다.

**범위 외**:

- post-validation script 구현.
- public publish.
- generated output 대량 수정.
- commit/push.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `tasks/plan058-generated-artifact-quality-rollout/index.json`
- `tasks/plan058-generated-artifact-quality-rollout/sample-audit.md`
- `docs/adr.md`
- `.claude/skills/position-recommender/SKILL.md`
- `.claude/skills/study-pack-writer/SKILL.md`
- `.claude/skills/interview-asset-writer/SKILL.md`
- `.claude/skills/interview-prep-analyzer/SKILL.md`

---

## 작업 항목 (4)

1. docs와 skill contract에 같은 품질 문구가 있는지 grep으로 확인한다.
2. `needs_evidence`가 사용자-facing 문구로 남아 있는지 확인한다.
3. post-validation script가 필요한 반복 위험을 정리한다.
4. `tasks/plan058-generated-artifact-quality-rollout/validation.md`에 결과와 열린 결정을 작성한다.

---

## Intended File Scope

- `tasks/plan058-generated-artifact-quality-rollout/validation.md`

---

## 검증

```bash
python3 -m json.tool tasks/plan058-generated-artifact-quality-rollout/index.json > /dev/null
find tasks/plan058-generated-artifact-quality-rollout -maxdepth 1 -type f -name 'phase-*.md' | sort
rg -n "보강 필요 / 선택지 / 권장 행동|첫 10줄|한국어 우선|사용자 승인" tasks/plan058-generated-artifact-quality-rollout docs .claude/skills
rg -n "needs_evidence" .claude/skills docs || true
git status --short tasks/plan058-generated-artifact-quality-rollout
```

성공 기준:

- plan058 phase 파일이 5개다.
- 핵심 품질 문구가 docs, skills, task validation에 연결된다.
- 공개 publish가 승인 없이 일어나지 않았음을 확인한다.

---

## Blocked / Failed 조건

- `needs_evidence`가 사용자-facing 지시로 남아 있으면 `echo "PHASE_FAILED: needs_evidence still user-facing" && exit 1`.
- skill contract와 docs가 서로 다른 기준을 말하면 `echo "PHASE_FAILED: quality contract mismatch" && exit 1`.
- public publish나 generated output rewrite가 발생했으면 `echo "PHASE_FAILED: rollout changed artifacts unexpectedly" && exit 1`.

---

## Self-check

- rollout validation은 검사와 정리만 한다.
- index status는 pending으로 유지한다.
- post-validation 구현은 별도 결정 후 진행한다.
- 사용자 승인 없는 fos-study publish는 금지한다.
