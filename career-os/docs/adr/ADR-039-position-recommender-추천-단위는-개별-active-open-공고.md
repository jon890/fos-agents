## ADR-039 position-recommender는 현재 열린 개별 공고를 추천한다

- Status: Accepted
- Date: 2026-06-04

### 맥락

회사 이름, 채용 홈, 기술 블로그, 뉴스는 지원할 수 있는 공고가 아니다.
이런 lead를 추천과 섞으면 사용자가 고르는 후속 지원 후보의 품질이 떨어진다.

### 결정

- 추천 단위는 회사가 아니라 현재 열린 개별 채용공고다.
- 추천 항목에는 개별 공고 URL과 active/open 근거가 있어야 한다.
- 수집 결과는 backend/server 역할과 고용 형태를 검증한다.
- 회사 채용 홈과 기술 자료는 추가 수집 lead로만 둔다.
- active/open 검증은 `collect_live_postings.ts`가 담당하고 LLM은 fit과 우선순위를 판단한다.

### 결과

추천 결과를 바로 지원 후보 등록과 패키지 작성에 사용할 수 있다.
