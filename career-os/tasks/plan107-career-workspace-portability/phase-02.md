# Phase 02 전송 계층과 workspace CLI 구현

**Execution profile**: deep

---

## 목표

로컬 작업 경로를 유지하면서 홈서버의 현재 release를 준비하고 새 release를 발행할 수 있는 내부 CLI를 구현한다.

**범위 외**: 홈서버의 `career-storage` 구현, 운영 자료 이관, UI와 career skill 수정은 수행하지 않는다.

---

## 작업 항목 (5)

### 1. transport 경계

`career-os/scripts/career-workspace/transport.ts`에 `status`, `export`, `publish` 계약을 정의한다.
SSH transport는 shell 문자열을 조합하지 않고 인자 배열로 원격 `career-storage` 명령만 호출한다.
Hermes 검증과 회귀 테스트를 위한 local transport도 같은 응답 스키마를 사용한다.
wire 계약의 단일 출처는 `contracts.ts`의 Zod schema와 `career-os/docs/data-schema.md`다.
`status` JSON, `export --revision` tar, `publish` tar와 성공·오류 JSON의 필드·위치를 두 파일에서 같은 이름으로 유지한다.

### 2. `check`와 `prepare`

`career-workspace check --json`은 local·remote revision, 로컬 변경 상태와 transport 상태를 구조화한다.
`prepare`는 로컬이 dirty면 중단하고, 원격 tar를 `career-os/.career-sync/`의 staging에 받은 뒤 manifest·경로·hash를 검증한다.
검증 뒤 기존 세 관리 root를 backup으로 옮기는 순서와 새 root 반영 상태를 `prepare-journal.json`에 root별로 기록한다.
journal 상태는 `started`, `staged`, `backed_up`, `applied`, `restoring`, `restored`, `completed`로 제한하고 root별 `hadOriginal`, `backupDone`, `applyDone`을 둔다.
기존 root가 없는 항목은 `hadOriginal: false`로 기록한다.
교체가 실패하거나 다음 실행에서 미완 journal을 발견하면 상태와 실제 경로를 함께 확인해 새 root를 제거하고 backup을 복구한다.
`completed` 뒤 새 root와 sync state의 hash가 일치할 때만 staging·backup·journal을 정리하며, 모순은 `RESTORE_REQUIRED`로 중단한다.

### 3. `diff`와 `publish`

`diff`는 마지막 prepare와 현재 파일의 추가·수정·삭제를 상대 경로로 요약한다.
`publish`는 phase 1의 draft를 보내며, 서버가 다른 현재 revision을 반환하면 로컬 결과를 보존하고 충돌 코드로 끝낸다.
성공 응답의 revision과 manifest를 다시 검사한 뒤 로컬 기준 상태를 갱신한다.

### 4. 환경 설정 표면

`career-os/.env.example`에는 값이 비어 있는 SSH target, 원격 command와 local transport root 설정만 추가한다.
호스트명, 계정명, port, key 경로와 운영 directory는 추적 파일에 기본값으로 쓰지 않는다.
사용자가 직접 동기화 명령을 고르지 않도록 CLI는 기존 skill이 호출하는 내부 helper로 문서화한다.

### 5. CLI와 transport 테스트

주입 가능한 transport fixture로 빈 저장소, 정상 prepare, dirty 차단, 손상 tar, hash 불일치, publish 충돌과 성공 상태 갱신을 검증한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/career-workspace/transport.ts` | 서버 명령 계약 |
| `career-os/scripts/career-workspace/ssh-transport.ts` | 외부 환경용 SSH transport |
| `career-os/scripts/career-workspace/local-transport.ts` | Hermes·테스트용 local transport |
| `career-os/scripts/career-workspace/cli.ts` | `check`, `prepare`, `diff`, `publish` |
| `career-os/.env.example` | 값 없는 환경 설정 표면 |
| `career-os/docs/data-schema.md` | wire schema와 journal 상태 계약 |
| `career-os/docs/flow.md` | 중단 복구와 오류 흐름 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/career-workspace
bunx tsc --noEmit --pretty false
git diff --check
```

## Blocked 조건

- 원격 명령의 입력·출력 계약이 `career-os/docs/data-schema.md`와 다르면 구현을 추측하지 않고 `PHASE_BLOCKED: 원격 저장 계약 불일치`로 끝낸다.
- prepare 실패 뒤 기존 파일 보존을 자동 테스트로 증명하지 못하면 다음 phase로 진행하지 않는다.
