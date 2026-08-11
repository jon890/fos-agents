# ADR — ai-nodes 모노레포

ai-nodes 모노레포 레벨에서 모든 워크스페이스에 영향을 주는 결정을 기록한다.
워크스페이스 한정 결정은 각 워크스페이스의 ADR 문서를 따른다.

새 모노레포 결정은 새 `ADR-NNN-slug.md` 파일로 만들고 이 INDEX에 한 줄을 추가한다.
ADR은 결정의 이유와 대안 기각만 담고, 현행 구조 설명은 `docs/code-architecture.md`를 따른다.

## Quick Index

| ADR | 제목 | Status | 파일 |
|---|---|---|---|
| ADR-002 | Claude Code native skill 패턴 채택 + `.claude/skills/` 단일 위치 | Accepted | [ADR-002-agent-skill-pattern.md](ADR-002-agent-skill-pattern.md) |
| ADR-004 | 워크스페이스 표준 구조 정식화 | Partially superseded by ADR-006 (2026-05-19) | [ADR-004-workspace-standard-structure.md](ADR-004-workspace-standard-structure.md) |
| ADR-006 | 워크스페이스 표준 패턴 변경: 통합 → 분리 (.claude/skills 본체화) | Accepted | [ADR-006-split-skill-structure.md](ADR-006-split-skill-structure.md) |
| ADR-008 | planning은 대화형 합의, Claude 비대화형은 구현 전용 | Accepted | [ADR-008-interactive-planning.md](ADR-008-interactive-planning.md) |
| ADR-010 | brain 쓰기 안전·프라이버시: 산출물 종류별 네임스페이스 라우팅 + cron 읽기전용 | Accepted | [ADR-010-brain-write-safety.md](ADR-010-brain-write-safety.md) |
| ADR-013 | agent skill 정본과 실행 도구별 노출 경로를 분리한다 | Accepted | [ADR-013-agent-skill-codex-exposure.md](ADR-013-agent-skill-codex-exposure.md) |
| ADR-015 | career-os ADR을 개별 파일로 관리하는 파일럿 예외 | Accepted | [ADR-015-career-os-adr-files-pilot.md](ADR-015-career-os-adr-files-pilot.md) |
| ADR-016 | root docs 구조를 ADR 디렉터리와 code-architecture로 재편 | Accepted | [ADR-016-root-docs-structure.md](ADR-016-root-docs-structure.md) |
| ADR-017 | common-pitfalls file-per-pattern 구조 | Accepted | [ADR-017-common-pitfalls-file-per-pattern.md](ADR-017-common-pitfalls-file-per-pattern.md) |
| ADR-019 | 외부 agent runtime 종속성을 제거한다 | Accepted | [ADR-019-runtime-framework-independence.md](ADR-019-runtime-framework-independence.md) |
| ADR-020 | 공개 HTML 리포트는 Cloudflare Pages 직접 업로드로 게시한다 | Accepted | [ADR-020-cloudflare-pages-report-publishing.md](ADR-020-cloudflare-pages-report-publishing.md) |
