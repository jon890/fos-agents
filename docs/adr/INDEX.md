# ADR — ai-nodes 모노레포

ai-nodes 모노레포 레벨에서 모든 워크스페이스에 영향을 주는 결정을 기록한다.
워크스페이스 한정 결정은 각 워크스페이스의 ADR 문서를 따른다.

새 모노레포 결정은 새 `ADR-NNN-slug.md` 파일로 만들고 이 INDEX에 한 줄을 추가한다.
ADR은 결정의 이유와 대안 기각만 담고, 현행 구조 설명은 `docs/code-architecture.md`를 따른다.

## Quick Index

| ADR | 제목 | Status | 파일 |
|---|---|---|---|
| ADR-001 | 공용 헬퍼 위치 분리: `_shared/lib` vs `<workspace>/scripts/_lib` | Accepted | [ADR-001-shared-helper-boundary.md](ADR-001-shared-helper-boundary.md) |
| ADR-002 | Claude Code native skill 패턴 채택 + `.claude/skills/` 단일 위치 | Accepted | [ADR-002-agent-skill-pattern.md](ADR-002-agent-skill-pattern.md) |
| ADR-003 | docs-check skill 도입 + adr.md Quick Index + drift Status 컨벤션 | Accepted | [ADR-003-docs-check-quick-index.md](ADR-003-docs-check-quick-index.md) |
| ADR-004 | 워크스페이스 표준 구조 정식화 | Partially superseded by ADR-006 (2026-05-19) | [ADR-004-workspace-standard-structure.md](ADR-004-workspace-standard-structure.md) |
| ADR-005 | docs / ADR 작성 형식 6 패턴 + 한자어 회피 | Accepted | [ADR-005-docs-adr-style.md](ADR-005-docs-adr-style.md) |
| ADR-006 | 워크스페이스 표준 패턴 변경: 통합 → 분리 (.claude/skills 본체화) | Accepted | [ADR-006-split-skill-structure.md](ADR-006-split-skill-structure.md) |
| ADR-007 | SKILL.md 한국어화 표준 + skill-creator 검토 정책 | Accepted | [ADR-007-korean-skill-standard.md](ADR-007-korean-skill-standard.md) |
| ADR-008 | planning은 대화형 합의, Claude 비대화형은 구현 전용 | Accepted | [ADR-008-interactive-planning.md](ADR-008-interactive-planning.md) |
| ADR-009 | fos-brain 외부 연동: thin caller + 외부 배치 + 워크스페이스 공유 의존성 | Accepted | [ADR-009-fos-brain-thin-caller.md](ADR-009-fos-brain-thin-caller.md) |
| ADR-010 | brain 쓰기 안전·프라이버시: 산출물 종류별 네임스페이스 라우팅 + cron 읽기전용 | Accepted | [ADR-010-brain-write-safety.md](ADR-010-brain-write-safety.md) |
| ADR-011 | track_task·extract_claude_result·update_artifacts 폐기 (native 전환 완료) | Accepted | [ADR-011-native-transition-cleanup.md](ADR-011-native-transition-cleanup.md) |
| ADR-012 | OpenClaw HUD 정책은 .openclaw, 공통 helper는 _shared | Archived (2026-06-29, OpenClaw 전환 문서 정리) | 삭제됨 |
| ADR-013 | agent skill 정본과 Codex 노출 경로를 분리한다 | Partially superseded by ADR-014 (2026-06-16) — repo 전역 정본 경로 부분만 | [ADR-013-agent-skill-codex-exposure.md](ADR-013-agent-skill-codex-exposure.md) |
| ADR-014 | repo 전역 skill 정본을 .claude/skills로 통일 | Accepted | [ADR-014-repo-global-skills-claude.md](ADR-014-repo-global-skills-claude.md) |
| ADR-015 | career-os ADR을 개별 파일로 관리하는 파일럿 예외 | Accepted | [ADR-015-career-os-adr-files-pilot.md](ADR-015-career-os-adr-files-pilot.md) |
| ADR-016 | root docs 구조를 ADR 디렉터리와 code-architecture로 재편 | Accepted | [ADR-016-root-docs-structure.md](ADR-016-root-docs-structure.md) |
| ADR-017 | common-pitfalls file-per-pattern 구조 | Accepted | [ADR-017-common-pitfalls-file-per-pattern.md](ADR-017-common-pitfalls-file-per-pattern.md) |
| ADR-018 | build-with-teams 하네스 도입 (Agent Teams 가시 협업, plan-and-build 병존) | Accepted | [ADR-018-build-with-teams-harness.md](ADR-018-build-with-teams-harness.md) |
