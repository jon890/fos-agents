# Phase 01 기존 파일 조사와 이관 계획 생성

**Execution profile**: deep

---

## 목표

여러 위치에 남은 비공개 커리어 파일을 내용 기준으로 분류하고, 자동 덮어쓰기 없이 최초 release 입력을 확정한다.

**선행 조건**: 대상 브랜치의 base에 `plan107-career-workspace-portability`가 포함되고 client 계약 테스트가 통과해야 한다. 홈서버의 `plan2-career-file-storage`가 배포되어 `career-storage status` 계약을 제공해야 한다.

**범위 외**: 홈서버 파일 변경, 원본 삭제, skill 수정과 외부 제출은 수행하지 않는다.

---

## 작업 항목 (5)

### 1. 선행 계약 확인

현재 checkout에 plan107의 manifest·CLI가 있고 전체 테스트가 통과하는지 확인한다.
설정된 transport로 홈서버 `career-storage status`를 읽어 schema version과 빈 저장소 또는 현재 revision을 확인한다.

### 2. 후보 root 수집

기본 후보는 실제 사용 중인 로컬 작업본의 `career-os/applications`, `career-os/library`, `career-os/state`와 과거 `career-os/data/applications`다.
이전 `career-os/private`는 경로가 실제로 남아 있을 때만 legacy 후보로 분류한다.
cache, 공개 임시 리포트와 다른 workspace는 탐색 범위에 넣지 않는다.

### 3. 내용 기반 이관 계획

`career-os/scripts/career-workspace/migration.ts`에 `buildMigrationPlan(input)`을 구현하고 SHA-256과 상대 경로를 비교한다.
동일 파일은 한 번만 포함하고, legacy에만 있는 파일은 출처 label을 유지한 archive 경로로 분류한다.
같은 상대 경로의 내용이 다르면 어느 쪽도 자동 선택하지 않고 양쪽 hash와 source label을 `conflicts[]`에 기록한다.

### 4. 제외·비밀 후보 검사

`.env`, key, token, webhook, 절대 환경 경로, `.omc`, log, cache와 임시 파일 후보는 `blockedFiles[]`에 상대 경로만 기록한다.
최종 지원서 HTML·PDF와 제출 파일은 생성 중간물과 구분해 관리 대상으로 남긴다.

### 5. 계획 명령과 회귀 테스트

`career-workspace migrate plan --json`으로 전체 파일 수, digest, 출처별 분류, 충돌과 차단 항목을 출력한다.
동일 파일, legacy 전용, 내용 충돌, 비밀 후보, 최종 PDF와 source root 중첩을 임시 디렉터리에서 검증한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/career-workspace/migration.ts` | 이관 분류와 계획 생성 |
| `career-os/scripts/career-workspace/migration.test.ts` | 충돌·비밀·중복 회귀 테스트 |
| `career-os/scripts/career-workspace/cli.ts` | `migrate plan` 연결 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/career-workspace
bunx tsc --noEmit --pretty false
bun career-os/scripts/career-workspace/cli.ts migrate plan --json
git diff --check
```

## Blocked 조건

- plan107이 대상 브랜치의 base에 없거나 홈서버 저장 계약이 준비되지 않았으면 `PHASE_BLOCKED: 선행 release 계약 미충족`으로 끝낸다.
- 충돌 또는 비밀 후보가 하나라도 남으면 계획 파일만 보존하고 다음 phase로 진행하지 않는다.
