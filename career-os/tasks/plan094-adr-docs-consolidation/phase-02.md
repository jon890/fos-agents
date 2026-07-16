# Phase 02 — 죽은 ADR 23개 삭제 + 링크 정리

**Model**: sonnet
**Status**: completed

## 목표

fos-career 16 + coffeechat 3 + superseded 4 = 23개 ADR 파일 삭제, INDEX·링크 정리.

## 중요 지침

구현 phase. 삭제 전 tombstone 자족성(Phase 01 확정) 전제. dangling 링크를 같은 phase에서 정리한다.

## 작업

- `git rm` 대상 23개(decisions.md 목록): fos-career(046·049·050·053·054·060·061·064·065·068·077·078·081·082·083·084) + coffeechat(034·048·067) + superseded(045·075·011·023).
  - 077은 fos-career가 아니라 obsolete cron ADR이지만 이 phase에서 함께 rm(위치는 이 목록 유지).
- `docs/adr/INDEX.md`에서 해당 23행 제거.
- **ADR-102 Supersedes 목록 보정(필수)**: 현재 11개(046·049·050·054·061·064·068·081·082·083·084)만 등재. 삭제되는 fos-career 4개 **053·060·065·078을 추가**한다. → 최종 15개.
  - 077은 fos-career 아님 → ADR-102에 넣지 않는다.
- live 문서의 dangling 참조 정리(tombstone 리다이렉트 또는 문구 수정). 실측 대상:
  - coffeechat 삭제 → ADR-092(`[[ADR-048]]`)·code-architecture.md·data-schema.md.
  - 077 삭제 → ADR-078(함께 삭제되므로 moot), INDEX 행.
  - 삭제 대상끼리 서로 참조하는 것은 함께 사라지므로 무방.
- **ADR-058:19 stale 전방참조 정정(MINOR)**: `"coffeechat tombstone은 후속 phase에서 ... 결정한다"`는 이번에 완결된 사안을 미결처럼 남긴다. number-ref가 없어 grep에 안 걸리므로 수동으로 문구를 정정한다(결정 완료: tombstone 없이 삭제·git history 보존). ADR-058은 삭제 대상 아님(유지).

## 성공 기준

- 23개 파일 삭제 + INDEX 23행 제거.
- ADR-102 Supersedes = 15개(11+4). 053·060·065·078 포함, 077 미포함.
- 삭제 대상을 가리키는 dangling 링크 0(`grep -rn "ADR-046\|..." career-os/docs career-os/.claude`로 tombstone 외 참조 없음 확인).
- INDEX ↔ 실제 파일 수 정합.

## 실패 조건

- 삭제 후 살아있는 문서가 삭제된 ADR을 깨진 링크로 참조하면 실패.
- ADR-102 Supersedes에 053·060·065·078이 누락되면 실패(fos-career provenance 유실).
