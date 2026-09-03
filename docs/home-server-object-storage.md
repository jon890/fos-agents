# 홈서버 객체 저장소 연결 계약

홈서버에서 실행하는 SeaweedFS는 여러 워크스페이스가 함께 사용하는 외부 S3 호환 서비스다.
이 저장소는 SeaweedFS 자체를 배포하지 않고 각 워크스페이스가 연결할 때 지켜야 할 경계만 관리한다.

## 서비스 경계

- collection 하나를 S3 bucket 하나로 만든다.
- bucket은 기본적으로 비공개이며 익명 요청을 허용하지 않는다.
- 워크스페이스마다 별도 credential을 발급하고 자기 bucket에 필요한 동작만 허용한다.
- S3 API와 Admin UI는 홈서버의 loopback 주소에서만 요청을 받는다.
- 외부에서 Admin UI를 열 때는 인증된 private tunnel을 사용한다.
- 실제 데이터는 홈서버의 `~/storage/seaweedfs` 같은 서비스 전용 경로에 두며 소비자에게 volume으로 제공하지 않는다.

Admin UI는 bucket과 객체를 확인하는 운영 화면이다.
공부 이력이나 지원 상태처럼 객체의 의미를 해석하는 화면은 각 워크스페이스가 필요할 때 별도로 제공한다.

## collection 등록

첫 collection은 `career-os` bucket이다.
새 워크스페이스가 객체 저장소를 사용하려면 다음 정보를 해당 워크스페이스 문서와 환경 설정에 추가한다.

| 항목 | 조건 |
| --- | --- |
| collection key | 워크스페이스 안에서 바뀌지 않는 식별자 |
| bucket | 다른 collection과 겹치지 않는 S3 bucket 이름 |
| endpoint | 홈서버 내부에서 접근할 S3 API 주소 |
| credential | 해당 bucket에 필요한 권한만 가진 access key와 secret key |
| object schema | 객체 key, 불변 조건, 현재 상태와 삭제 규칙 |

credential과 실제 endpoint는 `.env`에만 두고 공개 문서와 결과 JSON에는 기록하지 않는다.

## Career OS 연결

외부 Codex CLI와 Claude Code는 기존 SSH transport로 홈서버의 `career-storage` 명령을 호출한다.
홈서버의 Hermes는 command transport로 같은 명령을 실행한다.
S3 credential은 이 홈서버 명령만 읽으며 client와 Hermes 작업 디렉터리에는 전달하지 않는다.

홈서버 명령은 다음 환경 변수를 사용한다.

- `CAREER_STORAGE_S3_ENDPOINT`
- `CAREER_STORAGE_S3_BUCKET`
- `CAREER_STORAGE_S3_ACCESS_KEY`
- `CAREER_STORAGE_S3_SECRET_KEY`
- `CAREER_STORAGE_LOCK_FILE`
- `CAREER_STORAGE_MAX_ARCHIVE_BYTES`

`CAREER_STORAGE_S3_BUCKET`은 `career-os`로 고정한다.
`CAREER_STORAGE_LOCK_FILE`은 SeaweedFS 데이터 경로 밖의 홈서버 로컬 파일을 가리키며 모든 publish가 같은 잠금을 사용해야 한다.

## 연결 확인

운영 전에는 다음 조건을 순서대로 확인한다.

1. 익명 S3 요청이 거부된다.
2. `career-os` credential은 `career-os` bucket을 읽고 쓸 수 있다.
3. 같은 credential로 다른 bucket을 읽거나 쓸 수 없다.
4. 시험 객체를 올리고 다시 받은 byte의 SHA-256이 같다.
5. Admin UI에서 시험 객체를 확인할 수 있다.
6. 시험 객체를 삭제한 뒤 목록에서 사라진다.

단일 노드 SeaweedFS는 백업이 아니다.
기존 파일 저장소나 별도 복구본을 보존한 상태에서 migration을 검증하고, 원본 삭제는 별도 결정으로 다룬다.
