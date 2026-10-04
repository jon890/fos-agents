# 원격 검증

| 선행 조건 | 실행 위치 | 명령 | 기대값 |
|---|---|---|---|
| fos-assistant 에 신원 문서를 들이기 전 | 주인의 기기와 fos-assistant 웹 화면 | 들이기 결정 파일에서 지원서 공통 프로필 항목의 `document_key` 를 `career-application-profile`, collection 을 `identity`, 민감 문서로 둔다 | 「문서」 화면에 `identity` 의 민감 문서 `career-application-profile` 이 보인다 |
| fos-assistant 의 신원 들이기 배포와 들이기가 끝난 뒤 | fos-assistant 웹 화면 | `identity` collection 과 그 민감 읽기를 받는 서비스 토큰을 발급해 `career-os/.env` 의 `FOS_ASSISTANT_URL`, `FOS_ASSISTANT_SERVICE_TOKEN` 에 둔다 | 토큰 목록에 만료 시각이 보인다 |
| 위 둘이 끝난 뒤 | 주인의 기기, 저장소 루트 | `bun --env-file=career-os/.env career-os/scripts/application-profile/read_application_profile.ts get --out "${TMPDIR:-/tmp}/career-application-profile.md"` 뒤 그 파일을 지운다 | 종료 코드 0. 표준 출력의 `documentKey` 가 `career-application-profile`, `revision` 이 1 이상, `tokenExpiresAt` 이 null 이 아니다. 표준 출력에 본문이 없다 |
| 실제 이전을 확인한 뒤 | 사람 | PR 을 merge commit 으로 머지한다 | `main` 에 이 변경이 들어간다 |
