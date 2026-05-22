# Phase 02 — application 데이터 모델 + ledger 스키마 설계

**Status**: completed

---

## 목표

`data/applications/`의 영속 데이터 모델을 확정하고, 이후 skill들이 같은 상태 모델을 읽고 쓸 수 있게 한다.

## 작업 항목

1. `docs/data-schema.md`의 plan029 draft를 구체화한다.
2. `ledger.jsonl` record schema를 확정한다.
3. application 상태 enum과 전이 규칙을 확정한다.
4. `data/applications/.gitkeep` 또는 `.gitignore` 정책을 결정한다.
5. 필요하면 `scripts/application-agent/` 아래 schema validator 초안을 작성한다.

## 검증 기준

- 상태 enum이 `phase-01.md`의 D1-D5 결정과 충돌하지 않는다.
- 실제 제출 자동화 상태는 있어도 자동 제출 행위 지시는 없다.
- `data/applications/`는 비공개 자료 저장소로 명시된다.
- ledger record에는 source URL, status, riskFlags, nextActions, applicationDir이 포함된다.

## 산출물

- `docs/data-schema.md` 갱신
- `scripts/application-agent/ledger_schema.ts`

## 완료 기록

- `ledger.jsonl` record schema를 `scripts/application-agent/ledger_schema.ts`에 zod schema로 추가.
- application status enum과 허용 전이를 `AllowedStatusTransitions`로 고정.
- `parseLedgerLine`, `parseLedgerFile`, `canTransition` helper 추가.
- `data/applications/`는 루트 `.gitignore`의 `**/data/` 규칙에 따라 private data로 유지하기로 결정. `.gitkeep`은 만들지 않음.
- `docs/data-schema.md`에 필수/선택 필드, userDecision enum, status 전이, git 추적 정책을 반영.

## 의도적으로 안 하는 것

- TossPlace 공고 원문 저장은 Phase 03에서 수행한다.
- Claude skill 구현은 Phase 04 이후에서 수행한다.
