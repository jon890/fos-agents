# Phase 01 — data 경계 inventory

**Model**: sonnet
**Status**: pending

---

## 목표

`data/` 아래 실제 파일을 분류해 private, runtime, source, report 경계 정리의 근거를 만든다.

**범위 외**:

- 파일 이동 또는 삭제.
- docs, scripts, skills 수정.
- plan055 이력서 패키지 구현.
- commit/push.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `AGENTS.md`
- `docs/data-schema.md`
- `docs/code-architecture.md`
- `docs/adr.md`
- `tasks/plan055-resume-package-flow/index.json`

---

## 작업 항목 (5)

1. `find data -maxdepth 3 -type f`로 `data/applications`, `data/reports`, `data/runtime`, `data/source`, `data/private` 파일을 inventory한다.
2. `tasks/plan056-data-boundary-and-legacy-cleanup/inventory.md`를 작성한다.
3. `data/applications`는 private 지원 준비 자료로 분류하고 plan055 산출물과 겹치는 부분을 표시한다.
4. `data/reports`는 daily/baseline report 중심으로 retention 또는 archive 후보를 표시한다.
5. `data/runtime/live-position-postings.plan048-final.md`와 `data/runtime/live-position-postings.plan048-smoke.md`를 tracked exception으로 별도 표시한다.

---

## Intended File Scope

- `tasks/plan056-data-boundary-and-legacy-cleanup/inventory.md`

---

## 검증

```bash
python3 -m json.tool tasks/plan056-data-boundary-and-legacy-cleanup/index.json > /dev/null
test -f tasks/plan056-data-boundary-and-legacy-cleanup/inventory.md
rg -n "data/private|data/applications|data/reports|data/runtime|data/source|plan048-final|plan048-smoke" tasks/plan056-data-boundary-and-legacy-cleanup/inventory.md
git status --short tasks/plan056-data-boundary-and-legacy-cleanup
```

성공 기준:

- inventory가 다섯 data 경계를 모두 언급한다.
- plan048 runtime exception 두 파일이 빠지지 않는다.
- 새 파일은 plan056 task 디렉터리 안에만 생긴다.

---

## Blocked / Failed 조건

- `data/`가 없거나 읽을 수 없으면 `echo "PHASE_BLOCKED: data directory unavailable" && exit 2`.
- plan048 exception 파일의 tracked 여부를 판단할 수 없으면 `echo "PHASE_BLOCKED: plan048 runtime exception status unclear" && exit 2`.
- inventory가 비어 있으면 `echo "PHASE_FAILED: inventory is empty" && exit 1`.

---

## Self-check

- private 내용을 본문에 길게 복사하지 않는다.
- 파일 경로와 분류 근거만 남긴다.
- 사용자가 보기 전 지원서/면접 세부 내용은 공개 요약하지 않는다.
- 삭제 후보는 candidate로만 표시한다.
