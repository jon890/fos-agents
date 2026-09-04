# 홈서버 객체 저장소 연결 계약

홈서버에서 실행하는 SeaweedFS는 여러 워크스페이스가 함께 사용하는 외부 S3 호환 서비스다.
이 저장소는 SeaweedFS 자체를 배포하지 않고 각 워크스페이스가 연결할 때 지켜야 할 경계만 관리한다.

## 서비스 경계

- collection 하나를 S3 bucket 하나로 만든다.
- bucket은 기본적으로 비공개이며 익명 요청을 허용하지 않는다.
- 워크스페이스마다 별도 credential을 발급하고 자기 bucket에 필요한 동작만 허용한다.
- S3 API와 Admin UI는 홈서버의 loopback 주소에서만 요청을 받는다.
- 외부에서 Admin UI를 열 때는 인증된 private tunnel을 사용한다.
- 실제 데이터와 서비스 설정은 저장소 밖의 서비스 전용 디렉터리에 둔다.

Admin UI는 bucket과 객체를 확인하는 운영 화면이다.
공부 이력이나 지원 상태처럼 객체의 의미를 해석하는 화면은 각 워크스페이스가 필요할 때 별도로 제공한다.

## collection 등록

현재 등록된 collection은 둘이다.

| collection key | bucket | 무엇을 담나 | 워크스페이스 문서 |
| --- | --- | --- | --- |
| `career-os` | `career-os` | 비공개 작업 release | `career-os/docs/` |
| `ji-yoon-blog` | `ji-yoon-blog` | 블로그 글에 쓸 사진 원본 | `ji-yoon-blog/docs/data-schema.md` |
새 워크스페이스가 객체 저장소를 사용하려면 다음 정보를 해당 워크스페이스 문서와 환경 설정에 추가한다.

| 항목 | 조건 |
| --- | --- |
| collection key | 워크스페이스 안에서 바뀌지 않는 식별자 |
| bucket | 다른 collection과 겹치지 않는 S3 bucket 이름 |
| endpoint | 홈서버 내부에서 접근할 S3 API 주소 |
| credential | 해당 bucket에 필요한 권한만 가진 access key와 secret key |
| object schema | 객체 key, 불변 조건, 현재 상태와 삭제 규칙 |

credential과 실제 endpoint는 `.env`에만 두고 공개 문서와 결과 JSON에는 기록하지 않는다.

### 권한 표기가 실제로 막는 범위

`Write`는 PUT과 DELETE를 함께 포함한다.
SeaweedFS에서 쓰기와 삭제를 갈라 줄 수 없고, 삭제 요청은 HTTP 204로 성공한다.
실측으로 확인했다.

삭제를 막아야 하면 권한 표기가 아니라 그 워크스페이스 코드에 삭제 경로를 두지 않는 것으로 처리한다.

## Admin UI 접근 범위

Admin UI에는 자체 로그인이 없다.
`/files` 화면이 인증 없이 열리고 별도 로그인 경로가 없다.

외부에서 여는 경로의 보호막은 Cloudflare Access 하나뿐이다.
Access를 지난 요청은 모든 bucket의 파일을 보고 지울 수 있다.
bucket별 격리는 S3 credential에만 적용되며 Admin UI에는 적용되지 않는다.

Access 정책을 넓힐 때는 이 점을 함께 판단한다.

## 워크스페이스별 준비

각 워크스페이스가 자기 절차를 소유한다.
공통으로 필요한 것은 bucket 생성, credential 발급, mode 600 환경 파일, 권한 경계 확인이다.

새 collection을 더할 때는 다음을 확인한다.

1. bucket을 만든다.
2. 그 bucket 권한만 가진 credential을 발급하고 정적 S3 설정에 더한다.
3. 설정을 반영한다. 정적 설정 파일은 읽기 전용으로 마운트되므로 컨테이너를 다시 시작해야 한다.
4. 자기 bucket 읽기와 쓰기, 다른 bucket 거부, 익명 요청 거부를 확인한다.
5. 기존 collection이 영향받지 않았는지 함께 확인한다.

정적 설정을 고칠 때는 먼저 백업한다.
그 파일이 모든 collection의 credential을 함께 담고 있어, 잘못 쓰면 다른 워크스페이스가 함께 멈춘다.

## Career OS 서비스 준비

SeaweedFS는 `chrislusf/seaweedfs:4.45` 이미지의 `weed mini -bucket=career-os`로 실행한다.
S3 API `8333`과 Admin UI `23646`만 loopback 주소에 연결한다.
master, filer, volume과 WebDAV 포트는 외부에 게시하지 않는다.
정적 S3 설정 파일은 mode `600`으로 제한한다.
`career-os` credential에는 `Read`, `Write`, `List`, `Tagging`의 `career-os` bucket 권한만 준다.

저장소 루트에서 다음 명령으로 S3 실행 파일을 만든다.

```bash
bun build --compile \
  ./career-os/scripts/career-workspace/career-storage-s3.ts \
  --outfile "${CAREER_STORAGE_BUILD_OUTPUT}"
```

빌드한 실행 파일과 `career-os/scripts/career-workspace/career-storage` wrapper를 저장소 밖 서비스 명령 경로에 설치한다.
wrapper는 모든 publish를 같은 `flock` 잠금으로 직렬화하고 나머지 명령을 S3 실행 파일에 전달한다.
서비스 환경에는 다음 값이 필요하다.

- `CAREER_STORAGE_S3_EXECUTABLE`: 빌드한 S3 실행 파일의 절대경로
- `CAREER_STORAGE_LOCK_FILE`: 모든 publish가 공유하는 잠금 파일의 절대경로
- `CAREER_STORAGE_S3_ENDPOINT`
- `CAREER_STORAGE_S3_BUCKET`: `career-os` 고정
- `CAREER_STORAGE_S3_ACCESS_KEY`
- `CAREER_STORAGE_S3_SECRET_KEY`
- `CAREER_STORAGE_MAX_ARCHIVE_BYTES`: 생략하면 2 GiB

실제 경로, endpoint와 credential은 공개 저장소 밖의 mode `600` 환경 파일에 둔다.
이 값은 홈서버 `career-storage` 명령만 읽는다.
외부 client와 Hermes 작업 디렉터리에는 S3 credential을 전달하지 않는다.

## 연결과 권한 확인

컨테이너가 실행 중인지 확인하고 컨테이너 내부에서 master status가 정상인지 확인한다.
그다음 저장소 루트에서 S3 환경을 불러와 opt-in 검증을 실행한다.

```bash
bun test ./career-os/scripts/career-workspace/tests/career-storage-s3.integration.test.ts
```

이 검증은 네 `CAREER_STORAGE_S3_*` 값이 모두 있을 때만 실행된다.
전용 시험 prefix에서 다음 조건을 확인하고 시험 객체를 삭제한다.

1. 인증한 요청으로 객체를 올리고 다시 받은 byte의 SHA-256이 같다.
2. 익명 요청이 거부된다.
3. 같은 credential로 다른 bucket에 쓸 수 없다.
4. 시험 객체를 삭제한 뒤 더는 존재하지 않는다.

Admin UI에서도 시험 객체가 보였다가 삭제 뒤 사라졌는지 확인한다.
출력과 운영 기록에는 endpoint, bucket, 객체 key와 credential을 남기지 않는다.

## 상태 확인

설치한 명령의 `status`와 `export --revision` 결과가 현재 revision, manifest와 파일 hash에 맞는지 확인한다.

```bash
"${CAREER_STORAGE_COMMAND}" status
"${CAREER_STORAGE_COMMAND}" export --revision "${CURRENT_REVISION}" > "${EXPORT_CHECK_FILE}"
```

외부 client는 SSH transport로 같은 `career-storage` 명령을 호출한다.
홈서버 Hermes는 `CAREER_WORKSPACE_COMMAND`에 그 명령의 절대경로를 지정해 command transport를 사용한다.
client와 Hermes에서 읽기, 상태 확인과 무변경 publish를 각각 확인한다.
단일 노드 SeaweedFS는 백업이 아니므로 별도 백업과 복구 절차가 필요하다.

## 운영 복구

상태 확인이나 export가 실패하면 새 publish를 중단하고 다음 순서로 확인한다.

1. SeaweedFS 서비스와 S3 endpoint 접근 상태를 확인한다.
2. `pointers/current.json`이 가리키는 descriptor와 release 객체의 존재 여부를 확인한다.
3. archive, manifest와 descriptor의 SHA-256을 검증한다.
4. 검증한 백업이 있을 때만 별도 복구 절차로 객체를 복원한다.

복구 중에는 S3의 부분 객체를 자동 삭제하거나 current pointer를 임의로 변경하지 않는다.
