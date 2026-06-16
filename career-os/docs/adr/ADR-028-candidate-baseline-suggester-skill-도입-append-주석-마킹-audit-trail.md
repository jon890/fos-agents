## ADR-028 — candidate-baseline-suggester skill 도입 (Append + 주석 마킹 + audit trail)

**Status**: Accepted
**Date**: 2026-05-15

### 맥락

`career-os/config/` 사용자 hand-crafted 자산이 최신화 안 됨:
- `candidate-profile.md` 강점/약점 섹션 — 새 학습 토픽이 반영 안 됨
- `baseline-core-files.json` — fos-study에 새 핵심 파일이 추가돼도 큐레이션 세트 갱신 안 됨
- `config/study-progress.json` weak_spots — 진도 평가 자동 갱신 안 됨

fos-study commit history + study-progress + interview-prep-analyzer baseline에서 자동 추론 가능한 부분은 skill로 흡수하는 게 자연스럽다.

### 결정

`career-os/.claude/skills/candidate-baseline-suggester/SKILL.md`를 신규로 추가한다.

**Append + 주석 마킹 하이브리드 패턴**:
- candidate-profile.md / baseline-core-files.json: 기존 본문 보존 + 새 항목 append (fos-study path 근거 명시).
- outdated 항목은 `<!-- suggester: outdated since YYYY-MM-DD, 근거 fos-study/<path> -->` 주석 마킹. 사용자가 직접 삭제한다.

**audit trail 필수**: `data/runtime/profile-refresh-suggestions/YYYY-MM-DD/`에 before/after/diff/changes를 남겨 수동 roll back이 가능하게 한다.

거절한 대안:
- 제안만 하고 Edit 안 하기: 매번 사용자 수동 적용 부담이 남는다.
- 완전 자동 대체(rewrite): hand-crafted 내용 손실 위험이 있다. Append + 주석이 더 안전하다.
- 모노레포 전역 skill: 자산이 career-os 특화라 격리 원칙 위반.

### 결과

- 사용자 부담이 줄고 fos-study 학습 진도가 candidate-profile에 자동 반영된다.
- audit trail로 변경 추적과 수동 roll back이 가능하다.
- 단점: 잘못된 append 가능성이 있어 사용자 주기적 검토가 필요하다.
