# 원격 검증

migration 적용과 image 배포는 홈서버 인프라 저장소가 소유한다. 이 목록은 배포된 뒤 확인할 것만 적는다.
주소와 token 은 `career-os/.env` 의 `CAREER_BACKEND_URL` 과 `CAREER_BACKEND_TOKEN` 에서 읽는다. 값을 이 파일에 적지 않는다.

| 선행 조건 | 실행 위치 | 명령 | 기대값 |
|---|---|---|---|
| 머지한 뒤 새 image 를 배포하고 container 의 `migrate` 가 끝난 뒤 | 노트북의 `career-os/services/career-backend` | `CAREER_BACKEND_URL=<배포한 주소> CAREER_BACKEND_TOKEN=<운영 token> npm run test:deployed` | 종료 코드 0. `GET /health/ready` 가 `200` 이다. 새 migration 둘이 적용되지 않았으면 준비 확인이 실패한다 |
| 위와 같다 | 노트북의 저장소 루트 | `bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts documents list` | 종료 코드 0 이고 JSON 배열이 나온다. 원고를 옮기기 전이면 `[]` 다 |
| 위와 같다 | 노트북의 저장소 루트 | `bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts usage list` | 종료 코드 0 이고 JSON 배열이 나온다. 기록을 옮기기 전이면 `[]` 다 |
