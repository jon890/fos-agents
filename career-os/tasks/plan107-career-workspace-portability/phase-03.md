# Phase 03 실패 보존과 다중 client 회귀 검증

**Execution profile**: deep

---

## 목표

독립된 실행 환경이 같은 release를 재현하고, 전송 실패나 동시 발행에서도 현재 원격과 로컬 결과를 잃지 않는다는 근거를 만든다.

**범위 외**: 운영 홈서버 배포, 기존 비공개 파일 이관과 skill 실행 흐름 변경은 수행하지 않는다.

---

## 작업 항목 (5)

### 1. 가짜 원격 저장소 fixture

실제 서버 계약과 같은 `status`, `export`, `publish`를 제공하는 임시 filesystem fixture를 만든다.
fixture도 immutable release와 상대 `current` 링크를 사용하며, 테스트가 실제 홈서버 경로나 비밀값을 요구하지 않게 한다.

### 2. 독립 client 재현

서로 다른 두 임시 작업 root에서 같은 current release를 prepare하고 revision, manifest와 전체 파일 hash가 일치하는지 확인한다.
application HTML·PDF fixture도 일반 파일과 같은 방식으로 재현되는지 검사한다.

### 3. 충돌과 실패 보존

첫 client가 publish한 뒤 오래된 parent revision을 가진 두 번째 client의 publish가 거절되는지 검증한다.
중간에 끊긴 export, 잘린 tar, publish 오류에서도 remote current와 두 번째 client의 로컬 변경이 그대로 남아야 한다.
`started`, `staged`, `backed_up`, `applied`, `restoring`, `completed` journal 상태마다 재실행 복구 결과를 검증한다.

### 4. 문서와 출력 경계 검증

CLI 도움말과 JSON 오류에서 호스트, 계정, key 경로와 관리 파일 본문이 노출되지 않는지 검사한다.
README·PRD·flow·아키텍처·스키마·ADR의 명칭과 명령 계약을 코드와 대조한다.
`WORKSPACE_DIRTY`, `REMOTE_UNINITIALIZED`, `REVISION_CONFLICT`, `INVALID_MANIFEST`, `TRANSFER_FAILED`, `TRANSPORT_UNAVAILABLE`, `RESTORE_REQUIRED`가 계약된 상황에서만 반환되는지 확인한다.

### 5. 완료 상태 갱신

전체 테스트와 정적 검사가 통과하면 `career-os/tasks/plan107-career-workspace-portability/index.json`의 `status`를 `completed`, `current_phases`를 `3`으로 갱신한다.
운영 server 구현과 skill 활성화가 각각 후속 plan임을 완료 기록에 남긴다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/career-workspace/fixtures/` | 가짜 원격 저장소 |
| `career-os/scripts/career-workspace/*.test.ts` | 다중 client·충돌·실패 회귀 검증 |
| `career-os/tasks/plan107-career-workspace-portability/index.json` | 완료 상태 갱신 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/career-workspace
bunx tsc --noEmit --pretty false
git check-ignore -v career-os/.career-sync/sync-state.json career-os/.career-sync/prepare-journal.json career-os/.career-sync/staging/file career-os/.career-sync/backup/file
git diff --check
```

## Blocked 조건

- 실패 주입 뒤 remote current 또는 로컬 변경 보존을 증명하지 못하면 `PHASE_BLOCKED: 실패 시 원본 보존 미검증`으로 끝낸다.
- 코드와 관리 문서의 release·revision·충돌 계약이 다르면 완료 처리하지 않는다.
