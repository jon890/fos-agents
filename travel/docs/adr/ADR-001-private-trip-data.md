## ADR-001 — trip 데이터를 private 경계로 옮긴다

- Status: Accepted
- Date: 2026-08-12

### 맥락

`jon890/fos-agents`는 공개 저장소다.
trip 문서에는 실제 날짜, 시각, 만남 장소, 이동 동선, 예약 정보가 들어간다.
초기 구조는 이 데이터를 `travel/trips/`에 두고 Git에 커밋했고, `docs/index.md`에도 개인 날짜와 목적지를 표로 남겼다.
health-care는 이미 민감 기록을 `private/`에 두고 공개 기준만 `config/`와 `docs/`에 두는 경계를 쓰고 있었다.

### 결정

- 실제 trip 데이터는 `travel/private/trips/<trip-id>/`에 둔다.
- 루트 `.gitignore`의 `**/private/` 규칙으로 Git이 무시한다.
- 개인 trip 목록의 단일 출처는 `private/trips/index.md`다.
- 공개 `docs/index.md`에는 비식별화하고 사용자가 명시적으로 승인한 trip만 올린다.
- 기존에 tracked 상태였던 trip 4건은 `git rm --cached`로 untrack한다.

### 거절한 대안

- `trips/`를 공개 유지하고 문서로만 주의를 남기는 방식은 이미 개인 일정이 push된 상태를 해결하지 못한다.
- 저장소를 private으로 전환하는 방식은 다른 워크스페이스의 공개 문서 목적과 충돌한다.
- trip별로 공개 여부를 판단하는 방식은 기본값이 공개라서 실수 비용이 크다.

### 결과

현재 HEAD 이후로는 개인 여행 일정이 공개 저장소에 올라가지 않는다.
다만 untrack 이전 커밋 히스토리에는 기존 내용이 남아 있으므로, 완전한 제거가 필요하면 히스토리 정리를 별도 작업으로 다룬다.
