# Phase 02 최초 home release 생성과 복구 검증

**Execution profile**: deep

---

## 목표

검증된 이관 계획으로 홈서버 최초 release를 만들고, 별도 client가 같은 파일을 복구할 수 있음을 증명한다.

**범위 외**: 기존 원본 삭제, career skill 수정, UI 변경과 외부 제출은 수행하지 않는다.

---

## 작업 항목 (5)

### 1. 운영 상태와 복구 기준 확보

홈서버 현재 revision, storage root 권한과 여유 공간을 읽기 전용으로 확인한다.
현재 release가 있다면 이관 계획과 비교하고, 다른 파일이 있으면 자동 병합하지 않는다.
원래 로컬 source가 최초 release의 복구 기준으로 계속 보존될 경로와 hash를 기록한다.

### 2. 이관 staging 작성

phase 1에서 승인 가능한 파일만 임시 로컬 workspace에 복사한다.
원본 상대 경로를 유지하고 legacy 전용 파일은 계획된 archive 경로에 둔다.
기존 source는 이동하거나 삭제하지 않는다.

### 3. 최초 release 발행

현재 remote revision을 `parentRevision`으로 사용해 `career-workspace publish`를 실행한다.
서버가 반환한 revision, manifest, content digest와 파일 수가 로컬 draft와 모두 같을 때만 발행 성공으로 판정한다.

### 4. 독립 복구 검증

빈 임시 workspace에서 새 current release를 prepare하고 전체 파일의 경로, 크기와 SHA-256을 이관 계획과 비교한다.
지원서 HTML·PDF와 개인 면접 자료도 열 수 있는 일반 파일로 복구되는지 확인한다.
`state/drill-progress.json`이 이관 계획에 있으면 같은 파일 hash로 복구되는지 확인한다.

### 5. 이관 기록과 원본 보존

비밀값 없이 source label, 새 revision, 파일 수, digest와 검증 결과를 완료 응답과 커밋에서 확인한다.
원래 로컬 파일은 plan 전체가 완료될 때까지 그대로 유지하고 자동 삭제 작업을 추가하지 않는다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/.career-sync/` | 로컬 이관 계획과 prepare 기준 상태 |
| 홈서버 `career-storage/releases/<revision>/` | 최초 immutable release |

## 검증

```bash
# cwd: fos-agents root
bun career-os/scripts/career-workspace/cli.ts check --json
bun career-os/scripts/career-workspace/cli.ts publish --json
bun test ./career-os/scripts/career-workspace
git diff --check
```

별도 임시 workspace의 prepare 결과와 phase 1 이관 manifest를 파일별 SHA-256으로 비교한다.

## Blocked 조건

- 원래 source의 경로·hash, storage 권한 또는 공간을 확인할 수 없으면 `PHASE_BLOCKED: 홈서버 복구 기준 미확보`로 끝낸다.
- 기존 remote 파일, 이관 계획 충돌 또는 publish revision 충돌이 발견되면 양쪽 원본을 유지하고 자동 병합하지 않는다.
