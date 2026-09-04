# Career workspace 동기화 코드

이 디렉터리는 `applications`, `library`와 `state`를 홈서버의 SeaweedFS와 동기화한다.
정상 동기화 흐름을 이해하는 데 모든 파일을 읽을 필요는 없다.

## 정상 실행 경로

```text
skill
  └─ cli.ts
       └─ command-transport.ts 또는 ssh-transport.ts
            └─ career-storage
                 └─ career-storage-s3.ts
                      └─ s3-storage.ts
                           └─ s3-object-store.ts
```

외부 개발 환경은 `ssh-transport.ts`로 홈서버 명령을 호출한다.
홈서버의 Hermes는 `command-transport.ts`로 같은 명령을 직접 호출한다.
`career-storage`는 동시에 여러 publish가 실행되지 않게 잠근다.
`s3-storage.ts`는 release를 검증하고 마지막에 current pointer를 변경한다.
`s3-object-store.ts`는 Bun `S3Client`만 감싸며 S3 요청을 직접 구현하지 않는다.

## 공통 검증 코드

| 파일 | 책임 |
| --- | --- |
| `contracts.ts` | 원격 명령과 release JSON 형식 |
| `manifest.ts` | 동기화할 파일과 SHA-256 목록 생성 |
| `local-state.ts` | 마지막 동기화 상태와 prepare journal 검증 |
| `tar-utils.ts` | archive 생성, 압축 해제와 경로 검사 |
| `transport.ts` | transport 공통 인터페이스와 오류 변환 |
| `s3-storage-contracts.ts` | S3 설정, descriptor와 pointer 형식 |

## 테스트 코드

| 경로 | 읽는 경우 |
| --- | --- |
| `tests/` | 동기화 안전 조건과 회귀 사례를 확인할 때 |

`tests/fixtures/`의 파일 저장소 구현은 SSH나 S3 없이 client 동작을 검증하기 위한 대역이다.
운영 코드에서는 이 구현을 불러오지 않는다.
일상적인 지원 준비에서는 테스트 코드를 읽지 않아도 된다.

## 환경 설정

외부 개발 환경에는 SSH transport 설정만 둔다.
S3 endpoint와 credential은 홈서버의 `career-storage` 환경에만 둔다.
필요한 변수는 [`.env.example`](../../.env.example)과 [홈서버 객체 저장소 연결 계약](../../../docs/home-server-object-storage.md)에서 확인한다.

## 검증

저장소 루트에서 다음 명령을 실행한다.

```bash
bun test ./career-os/scripts/career-workspace
bunx tsc --noEmit
```
