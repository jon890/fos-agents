# Phase 02 — 죽은 ADR 23개 삭제 + 링크 정리

**Model**: sonnet
**Status**: pending

## 목표

fos-career 16 + coffeechat 3 + superseded 4 = 23개 ADR 파일 삭제, INDEX·링크 정리.

## 중요 지침

구현 phase. 삭제 전 tombstone 자족성(Phase 01 확정) 전제. dangling 링크를 같은 phase에서 정리한다.

## 작업

- `git rm` 대상 23개(decisions.md 목록): fos-career(046·049·050·053·054·060·061·064·065·068·077·078·081·082·083·084) + coffeechat(034·048·067) + superseded(045·075·011·023).
- `docs/adr/INDEX.md`에서 해당 23행 제거.
- 다른 ADR·docs 본문의 `[[ADR-NNN]]`·`ADR-NNN` 참조 중 삭제 대상 가리키는 것 정리(tombstone으로 리다이렉트 또는 문구 수정). 특히 ADR-102의 supersede 목록.
- 필요 시 ADR-102에 fos-career 폐기 WHY 핵심 흡수(Phase 01에서 부족 판정 시).

## 성공 기준

- 23개 파일 삭제 + INDEX 23행 제거.
- 삭제 대상을 가리키는 dangling 링크 0(`grep -rn "ADR-046\|..." career-os/docs`로 tombstone 외 참조 없음 확인).
- INDEX ↔ 실제 파일 수 정합.

## 실패 조건

- 삭제 후 살아있는 문서가 삭제된 ADR을 깨진 링크로 참조하면 실패.
