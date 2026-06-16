## ADR-028 — candidate-baseline-suggester skill 도입 (Append + 주석 마킹 + audit trail)

**Status**: Accepted
**Date**: 2026-05-15

### 맥락

career-os/config/ 사용자 hand-crafted 자산이 *최신화 안 됨*:
- `candidate-profile.md` "입증된 강점" / "약점·학습 중인 영역" 섹션 — fos-study에서 학습한 새 토픽 반영 안 됨
- `baseline-core-files.json` (현재 6 파일) — fos-study에 새 핵심 파일 추가돼도 큐레이션 set 갱신 안 됨
- `config/study-progress.json` weak_spots — 진도 평가 자동 갱신 안 됨

(과거 design은 `prd.md "약점·강점"` 섹션도 갱신 대상이었으나 책임 영역 위반 — prd.md는 제품 문서, 후보자 데이터 X. 본 ADR 적용 후 별도 사이클에서 제거됨.)

사용자가 매번 직접 갱신하면 burden + 학습 진도와 평가 간 drift 발생. fos-study 전체 commit history + study-progress + interview-prep-analyzer baseline 산출물에서 *자동 추론 가능한 부분*은 skill로 흡수하는 게 자연.

### 결정

`career-os/.claude/skills/candidate-baseline-suggester/SKILL.md` 신규 (워크스페이스 한정 — 자산 모두 career-os 소속).

**Append + 주석 마킹 하이브리드 패턴**:
- candidate-profile.md / baseline-core-files.json: *기존 본문 보존 + 새 항목 append*. fos-study path 근거 명시.
- candidate-profile.md "약점·학습 중인 영역" outdated 항목: `<!-- suggester: outdated since YYYY-MM-DD, 근거 fos-study/<path> -->` 주석 마킹. 사용자가 직접 삭제.
- config/study-progress.json weak_spots: 평가 갱신.

**audit trail 필수**: `data/runtime/profile-refresh-suggestions/YYYY-MM-DD/`에 before/ + after/ + diff.md + changes.md (변경 사유 + fos-study path 출처). 사용자가 수동 roll back 가능.

**입력**:
- fos-study 전체 commit history (git log)
- config/study-progress.json
- (선택) data/reports/baseline/<latest>/report.md (plan017 결과 — 있으면 Read)
- candidate-profile.md / baseline-core-files.json 현재 본문

거절한 대안:
- 제안만 (Edit 안 함): 매번 사용자가 수동 적용 burden — 처음 결정에서 사용자 의도 변경.
- 완전 자동 대체 (rewrite): hand-crafted 내용 손실 위험 — Append + 주석이 더 안전.
- 모노레포 전역 skill: 자산이 career-os 특화라 격리 원칙 위반.

### 결과

- 사용자 burden ↓ — fos-study 학습 진도가 candidate-profile에 자동 반영.
- audit trail로 변경 추적 + 수동 roll back 가능.
- 단점: skill 결과가 *잘못된 append* 가능성 (예: 잘못된 강점 추가). 사용자가 주기적 검토 필요.
- skill 호출 시점 (cron 친화 / 수동 호출 only) 정책 미정 — 본 ADR 범위 외.

### 적용

`tasks/plan020-candidate-baseline-suggester/`. depends_on: 없음 (plan017 선택적 의존). common-pitfalls 6-6 회피: SKILL.md draft 별도 파일 + Read draft → Write target.
