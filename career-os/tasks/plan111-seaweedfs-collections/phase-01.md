# Phase 01 S3 release 객체와 current pointer

**Execution profile**: deep

---

## 목표

기존 `CareerWorkspaceTransport` 응답과 오류 계약을 유지하면서 비공개 작업 release를 외부 S3 호환 서비스의 `career-os` bucket에 저장한다.

**범위 외**: SeaweedFS 설치와 compose 관리, client transport 선택, 기존 파일 release 이전과 홈서버 환경 변경은 수행하지 않는다.

---

## 작업 항목 (5)

### 1. S3 객체 저장 경계

`career-os/scripts/career-workspace/s3-object-store.ts`에 `read(key)`, `write(key, body, contentType)`와 `exists(key)`를 가진 `S3ObjectStore` 인터페이스를 추가한다.
Bun 내장 `S3Client` 구현은 `endpoint`, `bucket`, `accessKeyId`, `secretAccessKey`를 생성자에서 받고 path-style S3 endpoint를 사용한다.
환경 변수 읽기와 값 검증은 별도 factory에 두며 오류와 로그에 credential을 포함하지 않는다.

### 2. release descriptor와 current pointer 계약

`s3-storage-contracts.ts`에 `CareerStorageReleaseDescriptorSchema`와 `CareerStoragePointerSchema`를 추가한다.
release descriptor는 `schemaVersion: 1`, `workspace: "career-os"`, `revision`, `contentDigest`, `createdAt`, `fileCount`, `archiveKey`, `archiveSha256`, `manifestKey`, `manifestSha256`를 가진다.
`archiveKey`와 `manifestKey`는 같은 `revision`의 `releases/<revision>/` 아래 정해진 파일명만 허용한다.
descriptor는 `releases/<revision>/release.json`에 저장하고 생성 뒤 수정하지 않는다.
pointer는 같은 식별·요약 필드와 `descriptorKey`, `descriptorSha256`을 가지며 `descriptorKey`는 같은 revision의 `release.json`만 허용한다.

### 3. S3 publish

`S3CareerWorkspaceTransport.publish(archive)`는 기존 tar 안전 검사와 manifest 생성을 재사용한다.
부모 revision과 current pointer가 다르면 `REVISION_CONFLICT`, 같은 `contentDigest`면 `noChange: true`를 반환한다.
새 release는 `workspace.tar`, `workspace-manifest.json`과 `release.json`을 순서대로 쓴다.
세 객체를 다시 읽어 descriptor와 실제 SHA-256이 일치하는지 검증한 뒤 마지막에 `pointers/current.json`을 쓴다.
pointer 쓰기 전에 실패하면 기존 pointer를 바꾸지 않고 이미 올라간 불변 객체는 삭제하지 않는다.

### 4. S3 status와 export

`status()`는 pointer가 없으면 `current: null`을 반환한다.
pointer, release descriptor와 manifest가 맞지 않으면 `INVALID_MANIFEST`로 실패한다.
`export(revision)`은 `releases/<revision>/release.json`에서 기대 hash를 읽고 pointer와 무관하게 지정한 불변 archive를 검증한다.
archive SHA-256, release manifest와 내부 파일 hash가 모두 맞을 때만 byte를 반환한다.
S3 연결과 credential 실패는 `TRANSPORT_UNAVAILABLE`, 객체 byte 전송 실패는 `TRANSFER_FAILED`로 변환한다.

### 5. 메모리 객체 저장소 회귀 테스트

`s3-storage.test.ts`는 빈 bucket, 최초 publish, 무변경 publish, 부모 revision 충돌, 손상된 pointer, 손상된 archive, 객체 업로드 뒤 pointer 실패와 export를 검증한다.
테스트용 `MemoryS3ObjectStore`는 production 파일과 분리하고 쓰기 실패 위치를 주입할 수 있어야 한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/career-workspace/s3-object-store.ts` | S3 객체 저장 인터페이스와 Bun 구현 |
| `career-os/scripts/career-workspace/s3-storage-contracts.ts` | release descriptor, pointer와 S3 환경 계약 |
| `career-os/scripts/career-workspace/s3-storage.ts` | `CareerWorkspaceTransport` S3 구현 |
| `career-os/scripts/career-workspace/tar-utils.ts` | 최종 release archive 검증 재사용 경계 |
| `career-os/scripts/career-workspace/s3-storage.test.ts` | S3 release와 장애 회귀 테스트 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/career-workspace/s3-storage.test.ts
bun test ./career-os/scripts/career-workspace
bunx tsc --noEmit --pretty false
git diff --check
```

테스트는 pointer보다 release 객체가 먼저 저장되고 pointer 쓰기 실패 뒤 이전 status가 유지되는지 확인해야 한다.
오류 출력에 access key와 secret key가 포함되지 않아야 한다.

## 의도 메모

- 객체 저장소는 byte 보관을 맡고 revision 충돌과 archive 검증은 Career OS가 계속 맡는다.
- SeaweedFS의 조건부 쓰기와 bucket versioning을 publish 동시성 계약으로 사용하지 않는다.
- 불변 객체를 먼저 쓰면 실패 시 사용 중인 release가 손상되지 않는다.

## Blocked 조건

- Bun 내장 `S3Client`가 테스트한 SeaweedFS endpoint에서 읽기와 쓰기를 지원하지 않으면 `PHASE_BLOCKED: Bun S3 호환성 미충족`으로 끝낸다.
