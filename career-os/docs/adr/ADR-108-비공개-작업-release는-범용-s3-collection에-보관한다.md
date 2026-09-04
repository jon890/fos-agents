# ADR-108 비공개 작업 release는 범용 S3 collection에 보관한다

- Status: Accepted
- Date: 2026-09-03
- Updated: 2026-09-04

## 맥락

[ADR-107](ADR-107-비공개-커리어-산출물은-홈서버-파일-release로-동기화한다.md)은 단일 사용자와 작은 파일만 고려해 홈서버 일반 디렉터리를 저장 매체로 선택했다.
이후 사용자가 Career OS 이외의 데이터도 같은 홈서버에서 collection별로 분리하고 웹에서 확인하기를 원해 저장 서비스의 범위가 넓어졌다.
기존 revision, manifest와 충돌 거부 계약은 유효하므로 저장 매체만 바꾸는 편이 안전하다.

## 결정

비공개 작업 release를 홈서버 범용 객체 저장소의 `career-os` S3 bucket에 보관한다.
release archive와 manifest는 불변 객체로 저장하고 검증을 통과한 뒤 `pointers/current.json`을 갱신한다.
모든 publish는 같은 홈서버 `career-storage` 명령과 잠금을 지나며 S3 bucket versioning이나 조건부 쓰기에 동시성 제어를 맡기지 않는다.
Hermes도 SeaweedFS 데이터 볼륨을 직접 읽지 않고 같은 명령을 호출한다.

## 기각한 대안

- 각 client가 S3에 직접 쓰면 client마다 credential이 필요하고 하나의 publish 잠금을 공유하기 어렵다.
- SeaweedFS 내부 파일을 Hermes에 연결하면 storage 내부 형식과 Career OS 파일 계약이 결합된다.
- 기존 일반 디렉터리와 S3를 동시에 쓰면 어느 쪽이 현재 revision인지 모호해진다.

## 결과

기존 `CareerWorkspaceTransport`의 `status`, `export`, `publish`와 오류 계약은 바뀌지 않는다.
저장소 장애나 credential 오류는 작업 쓰기를 중단하며 이전 current pointer를 유지한다.
기존 파일 release 데이터는 별도 백업으로 보존할 수 있지만 현재 실행 코드는 파일 release를 읽지 않는다.
