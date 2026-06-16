## ADR-015 — docs/ 피드백 루프 + data/ 위치 정책

- Status: Accepted
- Date: 2026-05-13

### 맥락
5문서 컨벤션 도입 후 docs/ 역할이 명문화되지 않으면 시간이 지나며 흩어진다. plan-and-build 포팅 과정에서 사용자 directive: docs/는 의사결정·기술 학습을 누적하는 피드백 루프여야 하고, 데이터 파일은 반드시 data/에만.

### 결정
- docs/는 피드백 루프: 새 결정 → adr.md, 명세 변경 → 해당 5문서 즉시 갱신, 회고 → learn/, 인수인계 → hand-off/, 이벤트 준비 → prep/.
- data/는 모든 영속 데이터의 단일 위치. 상세 분류는 data-schema.md.
- config/는 사람이 큐레이션하는 입력만. 자동 생성 데이터를 config/에 두지 않는다.
- docs/ 또는 다른 디렉터리에 데이터 파일을 두는 것은 본 ADR 위반.

### 결과
- docs/가 결정·학습 누적의 단일 출처로 새 에이전트가 즉시 인식 가능.
- 데이터와 의사결정이 디렉터리 레벨에서 분리 → grep·audit 비용 감소.
- plan-and-build common-pitfalls 3번 카테고리에서 위반 즉시 검출 가능.

### 적용
- skills/plan-and-build/references/common-pitfalls.md 3번 카테고리.
- career-os/AGENTS.md 5문서 라우팅 섹션.
