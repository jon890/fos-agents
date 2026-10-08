# Phase 01. 커밋된 커리어 번들을 원본과 맞춘다

**Execution profile**: standard

## 목표

main에서도 실패하는 배포 번들 일치 검사 두 개를 원본 재빌드로 통과시킨다.

**범위 외**: 스킬·채점기 변경, 원본 TypeScript와 빌드 스크립트 수정, 의존성 버전, 운영 배포, 다른 워크스페이스.

## 컨텍스트

`career-os/plugin/scripts/build.test.ts`의 기존 회귀 테스트 두 개가 커밋된 dist와 임시 원본 빌드의 완전 일치를 검사한다.
main의 별도 작업 공간에서도 두 검사가 실패했다. 코디네이터가 main 기준 별도 PR로 dist 두 파일만 다시 만들도록 요청했다.
`career-os/plugin/scripts/build.ts`가 `buildBundle`과 `buildLocalBundle`을 실행하고 공백 줄을 정규화한다.
공개 API나 저장 형식, 원본의 설계는 변경하지 않는다.

**근거 문서**: `career-os/docs/code-architecture.md`의 「fos-career 커넥터」 번들 책임, `career-os/docs/adr/ADR-138-plugin-로컬-실행기는-scripts-원본을-번들해-부르고-작업본-위치는-설정으로-받는다.md`.

## 의도 메모

- 제품 요구, 호출 흐름, 저장 모델, 모듈 책임과 ADR 결정은 그대로다. 책임 문서 갱신이 필요하지 않다.
- 생성 파일을 손으로 고치지 않고 기존 빌드만 실행한다.
- 기존 build.test.ts가 원본과 다르면 실패하므로 테스트를 추가하거나 기대값을 완화하지 않는다.
- 계획 검사기는 생성된 JavaScript도 새 코드로 세고 테스트 파일 변경을 요구한다. 이번 작업은 코디네이터가 dist만 갱신하라고 정했으므로 기존 회귀 테스트 실행으로 검증하고 이 검사 한계를 보고한다.

## 작업 항목

### 1. 원본 빌드

저장소 루트와 plugin의 잠금 파일에 맞춰 의존성이 설치된 상태에서 `bun run career-os/plugin/scripts/build.ts`를 실행한다.
`career-os/plugin/dist/career-mcp.js`, `career-os/plugin/dist/career-local.js` 두 파일만 갱신한다.
생성 파일 밖의 변경이 생기면 직접 수정하지 않고 리더에게 보고한다.

### 2. 기존 회귀 테스트

`career-os/plugin/scripts/build.test.ts`의 두 테스트를 그대로 실행해 생성 파일과 원본의 일치를 확인한다.
plugin 전체 테스트로 로컬 실행기와 MCP 서버의 기존 정상·실패 경로가 유지되는지 확인한다.

## 검증

```bash
bun test ./career-os/plugin/scripts/build.test.ts
bun test ./career-os/plugin
git diff --check
```

번들 일치 테스트 둘과 plugin 전체 테스트가 통과하고 공백 오류가 없다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/dist/career-mcp.js` | 수정 |
| `career-os/plugin/dist/career-local.js` | 수정 |
