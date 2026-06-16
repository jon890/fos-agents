## ADR-028 — candidate-baseline-suggester skill 도입 (Append + 주석 마킹 + audit trail)

**Status**: Accepted
**Date**: 2026-05-15

### 맥락

`career-os/config/`의 `candidate-profile.md`·`baseline-core-files.json`·`study-progress.json` weak_spots가 fos-study 학습 진도나 새 핵심 파일을 자동으로 반영하지 않는 문제가 있었다.

fos-study commit history + study-progress + interview-prep-analyzer baseline에서 자동 추론 가능한 부분은 skill로 흡수하는 게 자연스럽다.

### 결정

`career-os/.claude/skills/candidate-baseline-suggester/SKILL.md`를 신규로 추가한다.

**Append + 주석 마킹 패턴**: 기존 본문을 보존하고 새 항목을 append(fos-study path 근거 명시)하며, outdated 항목은 HTML 주석으로 마킹하고 사용자가 직접 삭제한다.

**audit trail 필수**: 날짜별 디렉터리에 before/after/diff 기록을 남겨 수동 roll back이 가능하게 한다.

거절한 대안:
- 제안만 하고 Edit 안 하기: 매번 사용자 수동 적용 부담이 남는다.
- 완전 자동 대체(rewrite): hand-crafted 내용 손실 위험이 있다. Append + 주석이 더 안전하다.
- 모노레포 전역 skill: 자산이 career-os 특화라 격리 원칙 위반.

### 결과

- 사용자 부담이 줄고 fos-study 학습 진도가 candidate-profile에 자동 반영된다.
- audit trail로 변경 추적과 수동 roll back이 가능하다.
- 단점: 잘못된 append 가능성이 있어 사용자 주기적 검토가 필요하다.
