# Phase 03 — applications/ 경로 규약 확정

**Model**: sonnet
**Status**: completed

## 목표

applications/ top-level 버킷 규약 확정 (decisions.md 이동표·기준 준수).

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다. Phase 01 ADR·이동표를 벗어나면 PHASE_BLOCKED.
`data/applications/**`는 전량 **untracked**(gitignore `**/data/`)다 — worktree에 존재하지 않으므로 물리 이동(git mv) 대상이 아니다. 경로 규약 + 참조 갱신 + gitignore 경계로만 실현한다(decisions.md 스코프 절).

## 작업

- `data/applications/<co>/<role>/*.md` → `applications/<co>/<role>/`의 경로 문자열을 application-package-writer·application-reviewer·daily-application-digest SKILL과 scripts에서 갱신.
- `.gitignore`에 `applications/` 경계를 반영(지원 문서는 비공개 유지 — question-bank negation 훼손 없이).

## 성공 기준

- 대상을 읽는 SKILL·scripts·docs·.gitignore 참조가 `applications/` 새 경로로 갱신됐다(live docs·scripts·.claude/skills 기준 `data/applications` 참조 0; tasks/·frozen ADR 제외).
- 변경 .ts `bun --check` 통과 + application-agent 계열이 새 경로 파일 부재를 graceful 처리(크래시 없음).
- `applications/`가 gitignore 경계에 반영돼 비공개 지원 문서가 tracked로 새지 않는다.

## 실패 조건

- live 코드·docs·skill에 `data/applications` 옛 경로 참조가 남아 실행이 깨지면 실패.
- 지원 문서가 gitignore 밖으로 새면 실패.
