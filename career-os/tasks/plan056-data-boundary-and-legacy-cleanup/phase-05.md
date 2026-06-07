# Phase 05 — metadata 정합성 검증

**Model**: haiku
**Status**: pending

---

## 목표

plan056 결과 문서와 관련 plan041 metadata/body 정합성을 검증하고, 후속 실행 전 열린 결정을 정리한다.

**범위 외**:

- data cleanup 실행.
- tombstone 삭제.
- docs 추가 수정.
- commit/push.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `tasks/plan056-data-boundary-and-legacy-cleanup/index.json`
- `tasks/plan056-data-boundary-and-legacy-cleanup/inventory.md`
- `tasks/plan056-data-boundary-and-legacy-cleanup/runtime-cleanup.md`
- `tasks/plan056-data-boundary-and-legacy-cleanup/coffeechat-tombstone.md`
- `tasks/plan041-interview-coffeechat-deprecation/index.json`
- `tasks/plan041-interview-coffeechat-deprecation/phase-*.md`

---

## 작업 항목 (4)

1. 모든 plan056 산출물이 존재하는지 확인한다.
2. plan041 index phase status와 phase body status를 비교한다.
3. 후속 작업에 필요한 user decision을 `tasks/plan056-data-boundary-and-legacy-cleanup/validation.md`에 정리한다.
4. plan056 index의 open_decisions가 validation 결과와 충돌하지 않는지 확인한다.

---

## Intended File Scope

- `tasks/plan056-data-boundary-and-legacy-cleanup/validation.md`

---

## 검증

```bash
python3 -m json.tool tasks/plan056-data-boundary-and-legacy-cleanup/index.json > /dev/null
find tasks/plan056-data-boundary-and-legacy-cleanup -maxdepth 1 -type f -name 'phase-*.md' | sort
rg -n "data/private|coffeechat|plan041|metadata|open decision" tasks/plan056-data-boundary-and-legacy-cleanup
git status --short tasks/plan056-data-boundary-and-legacy-cleanup
```

성공 기준:

- plan056 phase 파일이 5개다.
- validation 문서가 열린 결정을 요약한다.
- plan041 mismatch가 있으면 숨기지 않고 기록한다.

---

## Blocked / Failed 조건

- plan056 필수 산출물이 누락되면 `echo "PHASE_FAILED: plan056 evidence missing" && exit 1`.
- plan041 mismatch가 있는데 처리 방향을 적지 않았으면 `echo "PHASE_FAILED: plan041 mismatch unreported" && exit 1`.
- 검증 중 새 scope 밖 파일이 변경되면 `echo "PHASE_FAILED: unexpected file scope" && exit 1`.

---

## Self-check

- 실행을 완료 처리하지 않는다.
- index status는 pending으로 둔다.
- open decision은 사용자 결정이 필요한 항목으로 남긴다.
- 정리 실행 phase를 암묵적으로 시작하지 않는다.
