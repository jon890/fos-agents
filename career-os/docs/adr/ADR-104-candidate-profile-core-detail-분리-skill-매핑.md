## ADR-104 — candidate-profile core/detail 분리 + skill 매핑

- Status: Accepted
- Date: 2026-07-07

### 맥락

`config/candidate-profile.md`는 여러 skill이 공유하는 프롬프트 주입 입력이다.

- 추천·fit 판단 skill(position-recommender, job-fit-analyzer)은 사실·라벨만 필요하다.
- 면접 서사 skill(interview-asset-writer, interview-stage-prep)은 프로젝트 서사·의사결정 패턴까지 필요하다.
- 두 성격이 한 파일에 있어, 추천 skill도 면접용 심화 서사를 통째로 프롬프트에 주입한다.

프로필 본문에는 추천 판단과 면접 서사가 함께 있어 모든 skill이 불필요한 문맥까지 읽었다.

### 결정

profile을 성격별로 core와 detail로 나눈다.

core는 추천·fit 판단용 사실·라벨이며, 경로 `config/candidate-profile.md`를 유지한다.
기존 참조 파손을 막기 위해 core가 원래 경로를 그대로 쓴다.

- 지원 대상
- 핵심 무기
- 커리어 타임라인
- 보유 기술 스택(라벨 중심, 증거 축약)
- 입증된 강점
- 약점·학습 중인 영역
- 제약·스코프

detail은 면접 서사·심화이며, 신규 파일 `config/candidate-profile-detail.md`로 분리한다.

- 주요 프로젝트 요약
- 개인 프로젝트
- 기술 의사결정 패턴
- 협업·리더십·코드 리뷰 스타일
- 면접 준비 우선순위

근거 경로는 해당 사실과 함께 core 또는 detail에 둔다.
별도 provenance 파일은 사실과 어긋나기 쉬운 중복 정본이므로 두지 않는다.

"보유 기술 스택" 증거 축약 기준을 함께 고정한다.

- core의 "보유 기술 스택"에는 기술명, 라벨(실전 운영·설계 경험·사용 경험), 최대 한 줄 요약만 남긴다.
- 각 항목의 여러 줄 서술과 `task/**` 증거 경로는 core에서 뺀다.
- 증거가 붙은 전체 서술은 detail의 "보유 기술 스택(증거 상세)"로 옮긴다.
- 추천·fit skill은 라벨만으로 판단하고, 면접 서사 skill은 detail에서 증거 상세를 읽는다.

### 결과

- 추천·fit skill은 사실·라벨만 주입받아 프롬프트가 가벼워진다.
- 면접 서사 skill은 core와 detail을 함께 읽어 심화 서사를 유지한다.
- core 경로가 그대로라 기존 참조가 깨지지 않는다.
- 각 skill의 주입 범위가 아래 표로 고정돼 Phase 03 구현의 계약이 된다.

### skill ↔ 파일 읽기 매핑 (Phase 03 계약)

| Skill | 주입 범위 | 근거 |
|---|---|---|
| position-recommender | core | 공고 fit·추천 판단만 한다. 면접 서사가 불필요하다. |
| job-fit-analyzer | core | 역할 fit·강점/약점·커리어 패스를 판단한다. strengths·weaknesses·constraints·timeline이 모두 core다. |
| tech-interview-drill | core | 질문 풀·weak_spots로 동작한다. profile 참조는 "수정 금지" 안내 목적이다. |
| behavioral-interview-drill | core | 위와 동일하다. profile 참조는 "수정 금지" 안내 목적이다. |
| application-package-writer | core + detail | 맞춤 지원 패키지·positioning에 프로젝트 서사·의사결정 패턴이 필요하다. |
| application-reviewer | core + detail | drift·evidence 검토가 프로젝트 주장·서사까지 대조한다. |
| interview-asset-writer | core + detail | 프로젝트·경험 기반 개인 질문을 생성한다. 주요 프로젝트·개인 프로젝트·의사결정 패턴·협업이 필요하다. |
| interview-stage-prep | core + detail | 실전 면접 준비에 이력 인용·의사결정 패턴·면접 준비 우선순위가 필요하다. |

- core 전용: position-recommender, job-fit-analyzer, tech-interview-drill, behavioral-interview-drill.
- core + detail: application-package-writer, application-reviewer, interview-asset-writer, interview-stage-prep.
- 근거 파일이 필요한 skill은 core와 detail에 직접 인용된 경로를 읽는다.

### 적용

- detail 5개 섹션을 `config/candidate-profile.md`에서 `config/candidate-profile-detail.md`로 이동한다.
- core의 "보유 기술 스택"을 라벨 중심으로 축약하고, 증거 상세는 detail로 옮긴다.
- 관련 skill의 SKILL.md Inputs를 위 매핑대로 갱신한다.
- `data-schema.md`·`code-architecture.md`의 candidate-profile 설명에 core/detail 분리를 반영한다.
