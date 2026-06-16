## ADR-035 — ts 헬퍼 모듈 분해 컨벤션 (source / transform / render / cli 4 레이어)

- Status: Accepted
- Date: 2026-05-19

### 맥락

`career-os/scripts/<skill>/` 아래 ts 헬퍼들이 외부 API fetch, 필터·정규화, markdown 렌더링, CLI 파싱, 파일 IO를 한 파일에 모두 응집한 god-script 구조였다.
새 source 추가 시 한 파일 전체를 수정해야 하고, 순수 함수가 IO와 섞여 단위 테스트 진입점이 없는 문제가 있었다.

### 결정

ts 헬퍼를 4 레이어로 분리한다.
**god-script 신규 추가를 금지**하고 기존도 점진 분해한다.

4 레이어 책임:

- **source/** — 외부 API fetch만. source 추가 시 여기에만 새 파일을 추가한다.
- **transform/** — 필터, 정규화, dedupe, 스코어링 같은 순수 함수. 단위 테스트 진입점이 된다.
- **render/** — markdown 직렬화. 출력 포맷 변경 시 여기만 수정한다.
- **cli.ts** — 인자 파싱 + 위 3 레이어 조립 + 파일 IO. 진입점.

`cli.ts` 위치는 기존 god-script 진입점과 동일 path를 유지해 SKILL.md와 호출부 수정 부담을 최소화한다.

거절한 대안:
- 한 파일 안에서 함수 그룹화(분리 없음): 확장 시 같은 파일이 계속 비대해지고 오차(drift) 위험이 영구화된다.
- 5 파일 한 plan에서 일괄 분해: 한 사이클에 너무 많은 코드 변경이 몰려 검증 오류 누적 위험이 크다.
- `_shared/lib` 승격: ai-nodes ADR-001 자격(워크스페이스 무관 헬퍼) 미충족. 워크스페이스 한정 도메인 로직이므로 부적절하다.

### 결과

- 새 source 추가 비용 감소: `source/`에 새 파일 1개만 추가하면 된다.
- transform 단위 테스트 가능: 순수 함수를 IO에서 격리할 수 있다.
- SKILL.md와 호출부 변경 없음: `cli.ts`가 기존 진입점 path를 유지하기 때문이다.
- 단점: 파일 수가 증가하고, 기존 god-script를 분해하는 plan 시리즈 진행 비용이 발생한다.
