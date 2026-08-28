# Phase 01 manifest와 로컬 변경 판정 계약 구현

**Execution profile**: deep

---

## 목표

`applications`, `private`, `state`를 하나의 검증 가능한 작업 revision으로 표현하고, prepare 전에 로컬 변경을 잃지 않도록 판정한다.

**범위 외**: 홈서버 파일 변경, SSH 연결, 기존 파일 이관과 career skill 수정은 수행하지 않는다.

---

## 작업 항목 (5)

### 1. draft와 release manifest 스키마

`career-os/scripts/career-workspace/contracts.ts`에 `CareerWorkspaceDraftManifestSchema`와 `CareerWorkspaceReleaseManifestSchema`를 구현한다.
draft는 `schemaVersion: 1`, `workspace: "career-os"`, `parentRevision`, `producer`, `contentDigest`, `files`를 가진다.
release manifest는 draft 필드에 서버가 부여한 `revision`과 `createdAt`을 더한다.
`files` 항목은 상대 `path`, 바이트 `size`, SHA-256 `sha256`만 기록한다.

### 2. 관리 경로와 제외 규칙

관리 root는 `applications`, `private`, `state`로 고정한다.
심볼릭 링크, `.env`, `.omc`, log, cache, 임시 파일은 draft 생성 전에 거부하거나 제외하며 결과에 상대 경로와 판정 코드만 남긴다.
`prepare`는 제외 대상 중 `.env`, 숨김 파일과 `.omc`를 발견하면 `WORKSPACE_DIRTY`로 중단해 로컬 파일을 잃지 않게 한다.
지원서 원본 Markdown·JSON과 최종 HTML·PDF·제출 파일은 관리 대상에 포함한다.

### 3. 결정적 digest 생성

`buildWorkspaceDraft(root, producer)`는 파일 경로를 정렬하고 각 파일 hash와 크기를 계산해 같은 입력에서 같은 `contentDigest`를 만든다.
파일을 읽는 동안 크기나 수정 시각이 달라지면 변경 중인 원본으로 판정하고 draft를 만들지 않는다.

### 4. 로컬 기준 상태와 변경 판정

`career-os/scripts/career-workspace/local-state.ts`에 `career-os/.career-sync/sync-state.json`, `career-os/.career-sync/prepare-journal.json` 스키마와 `inspectLocalWorkspace(root, syncState)`를 구현한다.
마지막 prepare revision과 현재 digest를 비교해 `clean`, `dirty`, `uninitialized`, `invalid`를 구분하며 로컬 파일을 수정하지 않는다.
root `.gitignore`는 `career-os/.career-sync/` 전체를 제외해 기준 상태, staging과 backup이 Git 후보가 되지 않게 한다.

### 5. 계약 회귀 테스트

정상 manifest, 정렬 순서, 동일 digest, symlink 거부, 제외 규칙, 읽는 중 변경, 손상된 로컬 기준 상태·journal과 dirty 판정을 임시 디렉터리에서 검증한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/career-workspace/contracts.ts` | draft·release·로컬 상태 스키마 |
| `career-os/scripts/career-workspace/manifest.ts` | 파일 수집과 결정적 digest |
| `career-os/scripts/career-workspace/local-state.ts` | prepare 기준과 dirty 판정 |
| `career-os/scripts/career-workspace/*.test.ts` | 계약 회귀 테스트 |
| `.gitignore` | `career-os/.career-sync/` 제외 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/career-workspace/manifest.test.ts ./career-os/scripts/career-workspace/local-state.test.ts
bunx tsc --noEmit --pretty false
git check-ignore -v career-os/.career-sync/sync-state.json career-os/.career-sync/prepare-journal.json career-os/.career-sync/staging/file career-os/.career-sync/backup/file
git diff --check
```

## Blocked 조건

- 저장소의 현재 TypeScript 실행 환경에서 스키마와 hash 계약을 구현할 수 없으면 `PHASE_BLOCKED: workspace manifest 실행 환경 불일치`로 끝낸다.
- 관리 경로 안의 파일을 비밀값 없이 분류할 수 없으면 제외 대상을 넓히거나 추측하지 않고 `PHASE_BLOCKED: 관리 파일 분류 불명확`으로 끝낸다.
