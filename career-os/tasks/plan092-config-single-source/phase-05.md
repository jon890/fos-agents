# Phase 05 — 고아 config 삭제 + 잔여 중복 정리

**Model**: sonnet
**Status**: completed

## 목표

findings 높음 2번 + 중간 4·5·6. 고아 config를 삭제하고 참조 doc을 정리하며, 남은 중복(techBlog URL·제외 규칙·history/cooldown)을 단일 출처로 모은다.

## 중요 지침

구현 phase다. 단, 고아 config 삭제는 참조 doc을 함께 정리해야 하므로 Phase 01 ADR에서 doc 정리 범위를 이미 고정한 전제로 진행한다.
삭제 전 참조처를 `grep`로 재확인한다.

## 관련 파일

- `config/topic-file-map.json` (고아, 삭제 대상)
- 참조 doc: `docs/data-schema.md`, `docs/code-architecture.md`, `docs/adr/ADR-016-*`, `docs/adr/ADR-001-*`, `tasks/plan017-*`
- `config/verified-company-research-targets.json` `techBlogs` ↔ `config/external-reading-sources.json` `techBlog.items`
- `.claude/skills/position-recommender/SKILL.md` ↔ `references/position-decision-criteria.md` (Tech Lead/Toss 제외 규칙)
- `config/mvp-target.json` `history` ↔ `verified-company-research-targets.json` `cooldown.active` (`failedAt`)

## 작업

- `topic-file-map.json` 삭제 + 참조 doc의 언급 정리(Phase 01 ADR 범위 내).
- techBlog URL 정본을 `external-reading-sources.json`으로, verified는 key 참조만.
- Tech Lead/Toss 범용공고 제외 규칙을 `position-decision-criteria.md` 단일 출처로, SKILL.md는 역참조.
- 탈락 시점 정본을 cooldown으로, mvp-target.history는 날짜 중복 제거 또는 참조.

## 성공 기준

- 고아 config 0 (`topic-file-map` 삭제 후 참조 `grep` 결과 stale 링크 없음).
- techBlog URL·제외 규칙·탈락 시점이 각각 한 곳에만 존재.
- 전체 config↔skill 끊긴 링크 0.

## 보류 조건

- topic-file-map을 삭제 대신 소비자 연결로 결정했으면 Phase 01로 되돌려 재확정.

## 실패 조건

- 삭제 후 참조 doc이 깨진 링크로 남으면 실패.
