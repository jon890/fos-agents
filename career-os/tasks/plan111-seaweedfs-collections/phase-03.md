# Phase 03 파일 release 이전과 연결 검증

**Execution profile**: deep

---

## 목표

기존 홈서버 파일 release를 삭제하지 않고 `career-os` bucket으로 이전한다.
저장소 밖 홈서버 서비스로 SeaweedFS를 설치하고 실제 연결과 전환까지 검증한다.

**범위 외**: SeaweedFS compose와 실제 경로를 이 저장소에 포함하는 작업, Cloudflare tunnel 변경, 기존 파일 release 삭제와 외부 백업 대상 선택은 수행하지 않는다.

---

## 작업 항목 (6)

### 1. 파일 release 읽기 경계 재사용

기존 파일 저장 구현에서 current symlink, release manifest, archive와 파일 hash를 읽는 코드를 migration 모듈이 호출할 수 있게 분리한다.
기존 `career-storage.py`와 local transport의 안전 경계를 낮추지 않으며 원본 경로에는 쓰기와 삭제를 수행하지 않는다.

### 2. 일회성 migration 명령

`migrate-career-storage.ts --source <filesystem-root>`는 S3 pointer가 없는 빈 `career-os` bucket에서만 실행한다.
원본 current revision과 release를 검증하고 같은 revision, `createdAt`, `contentDigest`를 유지한 archive와 manifest를 업로드한다.
archive와 manifest의 hash를 담은 불변 `releases/<revision>/release.json`도 생성한다.
업로드 뒤 release descriptor와 S3 `export`를 다시 읽어 원본과 revision, manifest, archive와 파일 SHA-256이 모두 같을 때만 current pointer를 만든다.

migration 성공 결과는 `schemaVersion: 1`, `action: "migrate"`, `ok: true`, `revision`, `contentDigest`, `fileCount`, `sourceArchiveSha256`, `destinationArchiveSha256`, `noChange`, `pointerWritten`을 가진다.
`contracts.ts`의 원격 오류 action에는 `migrate`를 추가하고 실패는 기존 오류 코드 중 원인에 맞는 값을 사용한다.

### 3. 재실행과 실패 복구

같은 revision의 archive, manifest, release descriptor와 hash가 모두 같으면 migration 재실행을 무변경 성공으로 처리한다.
같은 key의 byte가 다르거나 다른 current pointer가 있으면 `REVISION_CONFLICT`로 중단한다.
부분 업로드 객체와 기존 파일 release는 자동 삭제하지 않고 객체 key와 판정 코드만 결과에 기록한다.

### 4. 홈서버 SeaweedFS 설치

team-lead는 저장소 밖 임시 파일에 SSH 접속 방식, 서비스 root, 데이터 root, credential 파일, 기존 파일 release root, Hermes 환경 파일과 compose override 경로를 기록한다.
이 비공개 ops handoff의 절대경로는 구현자에게 직접 전달하고 커밋, 로그와 결과 JSON에는 포함하지 않는다.

홈서버에서는 `chrislusf/seaweedfs:4.45` 이미지를 Docker Compose로 실행하고 `weed mini`에 데이터 root, `career-os` bucket과 정적 S3 설정 파일을 전달한다.
S3 API `8333`과 Admin UI `23646`만 loopback 주소에 연결하고 master, filer, volume과 WebDAV 포트는 외부에 게시하지 않는다.
서비스 설정과 데이터는 저장소 밖의 서비스 전용 경로에 두고 정적 S3 설정은 mode `600`으로 제한한다.
access key와 secret key는 `openssl rand`로 생성하고 `Read:career-os`, `Write:career-os`, `List:career-os`, `Tagging:career-os`만 허용한다.
`career-os` bucket은 `weed mini -bucket=career-os`로 만들고 익명 요청과 다른 bucket 접근을 허용하지 않는다.
기존 파일 release와 관련 설정은 변경 전 상태를 기록하고 자동 삭제하지 않는다.

### 5. 실제 S3 연결 검증과 전환

`career-storage-s3.integration.test.ts`는 `CAREER_STORAGE_S3_*`가 모두 있을 때만 실행하는 opt-in 검증으로 작성한다.
전용 시험 prefix에서 업로드, 조회, byte hash 비교와 삭제를 확인하고 익명 접근과 다른 bucket 접근은 거부돼야 한다.
검증 결과는 endpoint, bucket, access key와 secret key를 출력하지 않는다.

설치된 홈서버에서는 기존 파일 release를 migration한 뒤 S3 `status`와 `export` 결과를 원본과 대조한다.
검증이 모두 통과한 뒤에만 SSH client와 Hermes가 같은 홈서버 `career-storage` 명령을 사용하도록 전환한다.
전환 뒤 읽기와 무변경 publish를 확인하고 기존 파일 release는 복구용으로 보존한다.

설치 health는 컨테이너 상태와 내부 master status로 확인한다.
S3 인증은 `curl`의 익명 요청과 Bun S3 통합 검증으로 확인하고 bucket 생성에는 별도 AWS CLI나 s3cmd를 설치하지 않는다.
전환 실패 시 Hermes 환경 파일에서 command transport를 제거하고 기존 local transport root를 복원한 뒤 해당 컨테이너만 다시 만든다.
SSH wrapper는 보존한 이전 실행 파일이나 파일 storage 명령으로 되돌리고 SeaweedFS와 기존 release는 조사할 수 있게 그대로 둔다.

### 6. 운영 문서와 plan 완료

`docs/home-server-object-storage.md`와 Career OS README에 build, 환경 변수, migration, 전환, 상태 확인과 원본 보존 순서를 구현과 맞게 갱신한다.
실제 홈서버 값은 공개 문서에 기록하지 않고 일반화한 설치, migration과 복구 순서만 남긴다.
모든 검증이 통과하면 `career-os/tasks/plan111-seaweedfs-collections/index.json`의 `status`를 `completed`, `current_phases`를 `3`으로 바꾼다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/career-workspace/file-release.ts` | 기존 파일 release 읽기와 검증 |
| `career-os/scripts/career-workspace/migrate-career-storage.ts` | 파일 release에서 S3로 이전 |
| `career-os/scripts/career-workspace/migrate-career-storage.test.ts` | 무변경, 충돌과 원본 보존 회귀 테스트 |
| `career-os/scripts/career-workspace/career-storage-s3.integration.test.ts` | 실제 S3 opt-in 연결 검증 |
| `docs/home-server-object-storage.md` | 외부 서비스 연결과 전환 절차 |
| `career-os/README.md` | Career OS 연결과 상태 확인 |
| `career-os/tasks/plan111-seaweedfs-collections/index.json` | plan 완료 상태 |

홈서버의 compose, credential과 데이터 디렉터리는 저장소 밖 외부 서비스 자산으로 관리한다.
실제 값은 실행 중 만든 비공개 ops handoff에서만 읽는다.

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/career-workspace
bunx tsc --noEmit --pretty false
git diff --check
~/.claude/scripts/korean-style-check.sh README.md docs/code-architecture.md docs/home-server-object-storage.md docs/adr/INDEX.md docs/adr/ADR-022-home-storage-s3-collections.md career-os/README.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/INDEX.md career-os/docs/adr/ADR-107-비공개-커리어-산출물은-홈서버-파일-release로-동기화한다.md career-os/docs/adr/ADR-108-비공개-작업-release는-범용-s3-collection에-보관한다.md career-os/tasks/plan111-seaweedfs-collections/phase-01.md career-os/tasks/plan111-seaweedfs-collections/phase-02.md career-os/tasks/plan111-seaweedfs-collections/phase-03.md
python3 ~/.claude/scripts/check-readability.py README.md docs/code-architecture.md docs/home-server-object-storage.md docs/adr/INDEX.md docs/adr/ADR-022-home-storage-s3-collections.md career-os/README.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/INDEX.md career-os/docs/adr/ADR-107-비공개-커리어-산출물은-홈서버-파일-release로-동기화한다.md career-os/docs/adr/ADR-108-비공개-작업-release는-범용-s3-collection에-보관한다.md career-os/tasks/plan111-seaweedfs-collections/phase-01.md career-os/tasks/plan111-seaweedfs-collections/phase-02.md career-os/tasks/plan111-seaweedfs-collections/phase-03.md
```

실제 SeaweedFS가 준비된 환경에서는 다음 opt-in 검증도 통과해야 한다.

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/career-workspace/career-storage-s3.integration.test.ts
```

migration 테스트는 원본 디렉터리의 모든 파일 hash와 current symlink가 실행 전후에 같은지 확인해야 한다.
실제 홈서버에서는 SeaweedFS health, 인증 경계, migration 결과와 전환 뒤 `career-storage status`를 확인해야 plan을 완료할 수 있다.

## 의도 메모

- 저장소 코드와 외부 서비스 배포를 분리하면 이 PR은 Career OS의 연결 계약만 검토할 수 있다.
- 이전 원본을 남기면 단일 노드 장애와 전환 오류가 확인돼도 파일 구현으로 돌아갈 수 있다.
- 실제 credential과 endpoint가 없는 개발 환경에서도 단위 테스트와 타입 검사를 수행할 수 있다.
- 실제 홈서버 변경은 사용자 승인 뒤 실행하되 호스트, 경로와 credential은 공개 저장소에 남기지 않는다.

## Blocked 조건

- 원본 current release가 손상됐으면 `PHASE_BLOCKED: 기존 release 무결성 실패`로 끝낸다.
- S3 bucket에 다른 current pointer가 있으면 `PHASE_BLOCKED: 대상 collection 사용 중`으로 끝낸다.
- 익명 요청이나 다른 bucket 접근이 허용되면 `PHASE_BLOCKED: S3 인증 경계 미충족`으로 끝낸다.
- migration 결과가 기존 release와 다르면 전환하지 않고 `PHASE_BLOCKED: migration 무결성 실패`로 끝낸다.
