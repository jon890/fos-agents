# Phase 02 — docs/ADR 경계 결정

**Model**: sonnet
**Status**: completed

---

## 목표

Phase 01 inventory를 바탕으로 data 경계와 보관 정책을 docs/ADR에 반영한다.

**범위 외**:

- 실제 data 파일 이동 또는 삭제.
- coffeechat tombstone 삭제.
- plan055 구현 phase 반복.
- 공개 fos-study 변경.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `tasks/plan056-data-boundary-and-legacy-cleanup/inventory.md`
- `docs/data-schema.md`
- `docs/code-architecture.md`
- `docs/flow.md`
- `docs/adr.md`
- `AGENTS.md`

---

## 작업 항목 (5)

1. `docs/data-schema.md`에 `data/applications`, `data/reports`, `data/runtime`, `data/source`, `data/private` 책임을 정리한다.
2. `data/private`를 intentional private/archive home으로 설명한다.
3. `data/source`는 외부 source text라도 지원/면접과 연결되면 private by default라는 규칙을 적는다.
4. `data/reports` retention/archive 기본값을 문서화한다.
5. `docs/adr.md` 맨 아래에 data boundary cleanup 결정을 누적한다.

---

## Intended File Scope

- `docs/data-schema.md`
- `docs/code-architecture.md`
- `docs/flow.md`
- `docs/adr.md`

---

## 검증

```bash
rg -n "data/private|data/source|data/reports|data/runtime|data/applications" docs/data-schema.md docs/code-architecture.md docs/flow.md docs/adr.md
rg -n "private by default|archive|retention" docs/data-schema.md docs/adr.md
git diff --name-only
```

성공 기준:

- 다섯 data 경계가 docs에 반영된다.
- ADR에 결정 이유와 기본값이 남는다.
- 변경 파일이 intended scope를 벗어나지 않는다.

---

## Blocked / Failed 조건

- docs에서 기존 경계와 충돌하는 ADR을 발견하면 `echo "PHASE_BLOCKED: data boundary conflicts with existing ADR" && exit 2`.
- retention 기본값을 정할 근거가 없으면 `echo "PHASE_BLOCKED: report retention policy needs user decision" && exit 2`.
- docs diff가 task 파일이나 data 파일을 의도치 않게 건드리면 `echo "PHASE_FAILED: unexpected file scope" && exit 1`.

---

## Self-check

- plan055의 resume package 산출물 계약을 다시 구현하지 않는다.
- private 원문이나 지원 내용을 docs에 복사하지 않는다.
- docs에는 정책과 경계만 남긴다.
- 새 ADR은 기존 `docs/adr.md` 누적 형식을 따른다.
