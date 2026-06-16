## ADR-029 — cj-foodville-coffeechat-prep → interview-coffeechat-prep native rename + 회사 추상화 + ts collector + 준비 자산 data 이동

**Status**: Accepted
**Date**: 2026-05-16

### 맥락

`cj-foodville-coffeechat-prep` skill은 CJ Foodville 전용으로 이름·URL·강의 자료가 회사명에 박혀 있었다.
회사 전환 시 skill 이름·collector·전략 노트·체크리스트 모두 재작성해야 하는 문제가 있었다.

`collect_foodville_sites.py`는 [[ADR-022]] (Bun TS 마이그) 정책과 어긋나고, shell runner도 native skill 흐름과 맞지 않았다.
`docs/prep/cj-foodville-coffeechat-*.md`는 [[ADR-015]] 위반 — docs/는 의사결정 누적이고 회사 특화 준비 hint는 `data/prep/<company-slug>/`가 자연스럽다.

### 결정

- skill을 `interview-coffeechat-prep`으로 rename하고 `mvp-target.json`의 `primary.coffeechat`을 context 단일 출처로 쓴다.
- Python collector를 TypeScript로 마이그레이션하고 회사 hard-coded URL을 제거한다. sites 배열은 config에서 읽는다.
- shell runner를 폐기하고 native skill이 ts collector를 직접 호출한다.
- 회사 준비 자산을 `docs/prep/`에서 `data/prep/<company-slug>/`로 이동한다.
- dispatcher `foodville-coffeechat` case를 폐기한다.

거절한 대안:
- skill 이름 `coffeechat-prep`: 면접 외 용도도 포함 가능 — 의도 모호.
- URL을 별도 config 파일: `mvp-target.json`과 drift 위험. 단일 출처 원칙 위반.
- Python collector 유지: [[ADR-022]] 일관성 훼손.
- 전체 config json zod 일괄 도입: 큰 plan이라 별도 분리.

### 결과

- 회사 전환 시 `mvp-target.json`의 `primary.coffeechat` 객체만 교체하면 된다.
- [[ADR-022]] ts 일관성 회복, [[ADR-015]] 정렬 — `docs/prep/` 비움, `data/prep/<company-slug>/` 신설.
- dispatcher case 2 → 1. plan023에서 command-router 일괄 폐기 가능.
