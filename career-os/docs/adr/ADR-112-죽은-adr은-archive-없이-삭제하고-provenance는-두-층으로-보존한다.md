## ADR-112 — 죽은 ADR은 archive 없이 삭제하고 provenance는 두 층으로 보존한다

Status: Accepted
Date: 2026-07-09

## Context

career-os ADR은 개별 파일로 관리한다(ADR-089).
누적되면서 이미 죽은 결정(fos-career 웹 대시보드 폐기, coffeechat 자동화 폐기 등)이 파일과 INDEX에 잔재로 남았다.

죽은 ADR을 어디에 둘지 두 가지 선택지가 있었다.

- 별도 `archive/` 디렉터리로 옮긴다.
- 파일을 삭제하고 git history로만 보존한다.

`archive/` 방식은 "지금 사는 결정"과 "죽은 결정"을 한 저장소에 계속 병존시킨다.
살아있지도 삭제되지도 않은 중간 상태가 쌓이면 어느 것이 현행인지 판단 비용이 커진다.
docs-check 감사에서 죽은 ADR 잔재가 stale 참조와 dangling 링크의 주 원인으로 확인됐다.

## Decision

죽은 ADR은 별도 `archive/` 디렉터리를 만들지 않고 삭제한다.
저장 상태는 keep(현행 유지) 또는 delete(삭제) 두 가지만 둔다.

삭제된 ADR의 결정 이유(provenance)는 두 층으로 나눠 보존한다.

- **live tombstone ADR이 있는 클러스터**는 그 tombstone ADR로 보존한다.
  - 예: fos-career 웹 대시보드 사망 클러스터는 ADR-102가 tombstone이다.
  - 이때 tombstone의 `Supersedes` 목록이 삭제 대상 전체를 담아야 한다.
    삭제하려는 ADR이 아직 tombstone의 `Supersedes`에 없으면, 삭제와 함께 추가한다.
- **live tombstone이 없고 사용자가 완전 제거를 택한 클러스터**는 별도 tombstone을 만들지 않고 git history로만 보존한다.
  - 예: coffeechat 자동화 클러스터(ADR-034·048·067), ADR-077(position-daily-runner cron 운영 결정).
  - 폐기 잔재가 오히려 혼란을 유발한다는 사용자 판단(2026-07-09)에 따른다.

## Consequences

- 죽은 결정을 담는 중간 상태 디렉터리(`archive/`)가 생기지 않는다.
  현행 ADR 목록은 항상 지금 사는 결정만 담는다.
- 삭제는 단일 동작이 아니라 한 묶음이다.
  - 파일 삭제
  - INDEX 행 제거
  - dangling `[[ADR-NNN]]` 링크 정리
  - provenance 층 확정(tombstone `Supersedes` 보정 포함)
  - grep 잔여 참조 0 검증
- tombstone 없이 삭제한 클러스터의 이유는 Git 이력으로만 추적한다.
- ADR 결번(예: 004·007·024·029·076)은 정상이며 broken link가 아니다.
