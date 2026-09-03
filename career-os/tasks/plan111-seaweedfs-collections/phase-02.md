# Phase 02 홈서버 명령과 공통 publish 잠금

**Execution profile**: deep

---

## 목표

외부 SSH client와 홈서버 Hermes가 같은 `career-storage` 명령을 호출하고 모든 S3 publish가 하나의 홈서버 잠금을 사용하게 한다.

**범위 외**: SeaweedFS 배포와 bucket 생성, 기존 파일 release 이전, Cloudflare tunnel과 홈서버의 실제 명령 교체는 수행하지 않는다.

---

## 작업 항목 (5)

### 1. S3 원격 명령 진입점

`career-storage-s3.ts`는 `status`, `export --revision <revision>`와 `publish`만 허용한다.
Phase 01의 S3 transport를 호출하고 성공 JSON은 stdout, 실패 JSON은 stderr와 nonzero 종료 코드로 반환한다.
publish 입력은 `CAREER_STORAGE_MAX_ARCHIVE_BYTES`를 넘으면 전체 byte를 객체 저장소에 전달하지 않고 `TRANSFER_FAILED`로 중단한다.

### 2. 홈서버 publish 잠금 wrapper

`career-storage` shell wrapper는 `status`와 `export`를 S3 실행 파일에 바로 전달한다.
`publish`는 `CAREER_STORAGE_LOCK_FILE`에 `flock --nonblock`을 얻은 뒤에만 실행한다.
잠금을 얻지 못하면 기존 `RemoteErrorResult` 형식의 `REVISION_CONFLICT`를 stderr에 쓰고 종료 코드 1로 끝낸다.
실행 파일과 lock 경로는 환경 변수에서 받고 shell 문자열을 조합하거나 `eval`하지 않는다.

### 3. command transport

`command-transport.ts`에 shell을 거치지 않고 인자 배열로 로컬 명령을 실행하는 `CommandCareerWorkspaceTransport`를 추가한다.
명령은 절대 경로의 일반 파일만 허용하고 개행, 제어 문자와 추가 shell 인자를 거부한다.
stdout, stderr와 오류 변환은 SSH transport와 같은 parser를 재사용한다.

### 4. 환경별 transport 선택

`cli.ts`의 기본 context는 `CAREER_WORKSPACE_COMMAND`가 있으면 command transport, 없고 `CAREER_WORKSPACE_LOCAL_TRANSPORT_ROOT`가 있으면 검증용 local transport, 나머지는 SSH transport를 사용한다.
S3 endpoint와 credential은 `career-storage-s3` 프로세스만 읽고 Career OS client context에는 넣지 않는다.
`.env.example`에 새 환경 변수 이름과 각 실행 환경의 선택 조건을 추가한다.

### 5. 실행 파일 빌드와 회귀 테스트

`build-career-storage.ts`는 `bun build --compile`을 인자 배열로 실행해 홈서버용 단일 실행 파일을 지정한 출력 경로에 만든다.
테스트는 command transport의 byte 전달, 구조화 오류, shell 입력 거부, wrapper의 잠금 충돌과 실행 파일 누락을 검증한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/career-workspace/career-storage-s3.ts` | S3 원격 명령 진입점 |
| `career-os/scripts/career-workspace/career-storage` | publish 잠금 wrapper |
| `career-os/scripts/career-workspace/command-transport.ts` | Hermes 로컬 명령 transport |
| `career-os/scripts/career-workspace/cli.ts` | transport 선택 순서 |
| `career-os/scripts/career-workspace/build-career-storage.ts` | 단일 실행 파일 빌드 |
| `career-os/.env.example` | command와 S3 환경 변수 이름 |
| `career-os/scripts/career-workspace/*.test.ts` | 명령, 잠금과 오류 회귀 테스트 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/career-workspace
bunx tsc --noEmit --pretty false
bun ./career-os/scripts/career-workspace/build-career-storage.ts --output /tmp/career-storage-s3
test -x /tmp/career-storage-s3
git diff --check
```

테스트가 끝나면 `/tmp/career-storage-s3`만 삭제한다.
wrapper와 transport 테스트는 명령 문자열이 shell에서 해석되지 않으며 S3 credential이 client 환경에 없어도 동작하는지 확인해야 한다.

## 의도 메모

- 모든 writer가 홈서버 명령 하나를 지나야 로컬 `flock`으로 동시 publish를 직렬화할 수 있다.
- Hermes가 SeaweedFS 데이터 volume을 직접 읽지 않으면 저장 서비스의 내부 형식이 Career OS 계약이 되지 않는다.
- 기존 SSH client 표면을 유지하면 사용자가 새 동기화 명령을 선택할 필요가 없다.

## Blocked 조건

- 홈서버 Linux에서 `flock`을 사용할 수 없으면 `PHASE_BLOCKED: 홈서버 publish 잠금 도구 없음`으로 끝낸다.
