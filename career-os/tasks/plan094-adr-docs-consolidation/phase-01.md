# Phase 01 — 정책 ADR 고정 + 삭제·merge 목록 확정

**Model**: opus
**Status**: completed

## 목표

ADR 정리 정책을 신규 ADR로 고정하고, decisions.md의 삭제 23개·merge·docs 목록을 실행 전 최종 확정한다.

## 중요 지침

이 phase만 docs/ADR을 새로 쓴다(정책 ADR). Phase 02~05는 그 결정을 실행한다.

## 작업

- 신규 ADR 작성: "죽은 ADR은 archive 폴더 없이 삭제한다" 정책. provenance를 두 층으로 명시한다.
  - live tombstone ADR이 있는 클러스터(fos-career→ADR-102): tombstone의 Supersedes 목록이 삭제 전체를 담아야 한다.
  - live tombstone이 없고 사용자가 완전 제거를 택한 클러스터(coffeechat·ADR-077): tombstone 없이 git history로만 보존.
  - keep/delete binary 원칙을 명시한다.
- decisions.md 삭제 목록(23개) 각 파일 실재 재확인 + provenance 층 확정.
  - fos-career 15개 → ADR-102. **053·060·065·078은 ADR-102 Supersedes에 아직 없으므로 Phase 02에서 추가**함을 명시.
  - coffeechat 3개(034·048·067)·ADR-077 → tombstone 없이 삭제(git history). ADR-077은 fos-career 아님(오분류 정정).
- merge 매핑 확정(094→101, adapter 043/047/051 병합본 설계). ADR-094 live 참조 17건(SKILL.md 포함) 리다이렉트 계획을 Phase 03에 넘긴다.
- docs 정리 대상 라인 확정(code-architecture:44-45·131-132·147-148, data-schema:357-373·중복·177-187·225·1032-1033).

## 성공 기준

- 정책 ADR 생성 + INDEX 등록. 정책 ADR이 두 provenance 층을 모두 담는다.
- 삭제 23개 각각에 provenance 층·링크영향 매핑 완료(누락 0). decisions.md에 durable 기록됨.
- Phase 02~04가 바로 실행할 수 있는 확정 목록 존재.

## 실패 조건

- fos-career 삭제 대상이 ADR-102 Supersedes에 추가되도록 Phase 02에 명시되지 않은 채 진입하면 실패.
