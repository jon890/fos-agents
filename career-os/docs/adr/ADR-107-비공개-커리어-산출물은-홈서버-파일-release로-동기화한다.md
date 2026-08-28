## ADR-107 비공개 커리어 산출물은 홈서버 파일 release로 동기화한다

- Status: Accepted
- Date: 2026-08-27

## 맥락

지원 문서와 면접 준비 상태는 Git에서 제외되어 Hermes, 업무용 Codex CLI와 개인 노트북이 서로 다른 파일을 사용했다.
결과를 별도 Git 저장소나 객체 저장소로 옮기면 작은 개인 파일을 위해 저장소와 서비스를 하나 더 운영해야 한다.
원격 filesystem을 직접 편집하면 연결이 끊기거나 두 환경이 동시에 쓸 때 부분 반영과 덮어쓰기를 피하기 어렵다.

## 결정

비공개 작업 파일은 홈서버의 일반 디렉터리에 immutable release로 보관한다.
각 환경은 현재 release를 로컬 작업 경로에 준비하고, 실행 시작 revision이 유지됐을 때만 새 release를 원자적으로 반영한다.
공통 client와 파일 보존 계약을 먼저 구현하고, 운영 server와 기존 career skill 연결은 후속 작업으로 나눈다.
연결을 마치면 사용자는 새 동기화 skill을 고르지 않고 기존 career skill을 계속 호출한다.
첫 운영 계약의 관리 root는 `applications`, `library`, `state`로 고정한다.
이 결정 전에는 운영 release와 로컬 sync state가 없었으므로 초기 `schemaVersion: 1`에 바로 반영한다.

## 기각한 대안

- 별도 private Git 저장소는 변경 이력에 강하지만 개인 산출물마다 저장소가 늘고 생성 HTML과 PDF 관리가 부자연스럽다.
- MinIO 같은 객체 저장소는 versioning과 UI를 제공하지만 현재 파일 크기와 단일 사용자 흐름에는 운영 계층이 과하다.
- NFS, SMB와 SSHFS 직접 편집은 연결 상태가 작업 안정성에 영향을 주고 로컬 도구의 일반 파일 경로를 보장하기 어렵다.

## 결과

공통 client는 기존 파일 경로를 유지하면서 같은 revision을 준비하고 발행할 수 있다.
운영 server와 skill 연결을 마치면 세 실행 환경이 이 계약을 함께 사용한다.
동시 publish와 전송 실패가 현재 release를 바꾸지 않도록 운영 server도 같은 충돌 계약을 구현해야 한다.
cache와 임시 공개 리포트는 환경마다 다시 만들고 동기화하지 않는다.
관리 root 안의 `.env`, 숨김 파일과 `.omc`는 동기화 대상에서 제외하되, `prepare` 중 삭제하지 않도록 로컬 변경으로 판정해 중단한다.
`.DS_Store`와 `Thumbs.db`는 운영체제가 다시 만드는 메타데이터이므로 작업 변경으로 보지 않는다.
