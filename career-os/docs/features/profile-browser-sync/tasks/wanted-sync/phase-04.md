# Phase 04. ADR 과 구조 문서

**Execution profile**: standard

## 목표

MCP 서버가 「내 브라우저」 를 조작하게 된 구조 변경을 ADR 과 구조 문서에 남긴다.

**범위 외**: 도구 코드, 지침, 버전(phase 3). 노트북 `sync-profile` 스킬 본문(바꾸지 않는다).

## 컨텍스트

**요구사항**: REQ10

**근거 문서**: `career-os/docs/features/profile-browser-sync/design.md` 의 「결정 기록 연결」, `career-os/docs/adr/ADR-137-스킬과-mcp를-plugin-하나로-묶고-세-단계로-옮긴다.md`

- ADR-137 은 「MCP 서버는 데이터 접근만」, 「브라우저 조작은 Claude Code 에서만」 이라고 정했다. 이 PR 이 「내 브라우저」 중계를 받는 도구에 한해 그 조항을 개정한다. 근거는 사용자가 비서 웹 반영을 고른 스펙 DECISION1 이다.
- 저장소 ADR 은 `career-os/docs/adr/` 에 있고 색인은 `INDEX.md` 표다. 다음 번호는 145 다(마지막이 ADR-144).

## 의도 메모

- ADR-137 의 결정 본문은 고치지 않는다. 「plugin 은 세 층이다」 항목 아래에 대체된 조항과 ADR-145 링크를 한 줄 단다.
- 연결용 지침 분량 검사(REQ10)는 phase 3 이 맞춘다. 이 phase 는 지침을 건드리지 않고 최종 검사만 다시 돌린다.

## 작업 항목

### 1. `career-os/docs/adr/ADR-145-비서-웹의-프로필-사이트-반영은-mcp-서버가-내-브라우저-중계로-한다.md` 신규

저장소 ADR 양식(같은 폴더 ADR-144 를 본뜬다). 결정: 비서 웹의 원티드 반영은 fos-career MCP 서버가 「내 브라우저」 중계로 CDP 를 직접 부르고, 노트북 `sync-profile` 스크립트와 따로 둔다. 맥락: ADR-137 의 세 층, 비서 웹의 연결용 에이전트에는 셸이 없음, 사용자 선택(2026-11-20). 대안 기각: 노트북 스크립트 재사용(비서 웹에서 셸 없음), fos-assistant 범용 브라우저 도구(원티드 화면 지식이 fos-assistant 로 감), 분리 작업 프로세스(칸 몇 개라 60초 안). 결과: 원티드 화면 지식이 두 곳에 생김, 승인한 실행 중 넘기기 카드 없음. `현재 규칙의 원본` 은 `career-os/docs/features/profile-browser-sync/design.md`.

### 2. `career-os/docs/adr/ADR-137-…md`, `career-os/docs/adr/INDEX.md`

ADR-137 에 「대체된 부분」 줄을 달고, INDEX 표에 ADR-145 한 줄과 ADR-137 행의 상태 칸에 「브라우저 조작 조항은 ADR-145 가 개정」 을 더한다.

### 3. `career-os/docs/code-architecture.md` 의 「fos-career 커넥터」

트리 `src/` 아래 `browser/`, `wanted/` 를 더하고, 경로 표에 `plugin/src/browser/cdp.ts`(중계로 붙는 CDP client)와 `plugin/src/wanted/`(원티드 읽기·쓰기 도구, 칸 모델, 탭 안 스크립트) 두 줄을 더한다. 세 층 설명 문단 끝에 ADR-145 를 덧붙이고, `connector-skills/career-connector/SKILL.md` 행에 「원티드 반영 순서」 를 더한다.

## 검증

```bash
cd career-os/plugin && bun run typecheck
cd career-os/plugin && bun test scripts/connector-config.test.ts
cd career-os/plugin && bun test
node /Users/kbt/personal/fos-skills/skills/plan/scripts/adr-docs.ts check --changed-since origin/main --adr-dir career-os/docs/adr --adr-dir docs/adr
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/docs/adr/ADR-145-비서-웹의-프로필-사이트-반영은-mcp-서버가-내-브라우저-중계로-한다.md` | 신규 |
| `career-os/docs/adr/ADR-137-스킬과-mcp를-plugin-하나로-묶고-세-단계로-옮긴다.md` | 수정 (개정 표시) |
| `career-os/docs/adr/INDEX.md` | 수정 |
| `career-os/docs/code-architecture.md` | 수정 |
