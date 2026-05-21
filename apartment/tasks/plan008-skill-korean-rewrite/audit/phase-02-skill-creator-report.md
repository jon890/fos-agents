# skill-creator 4축 평가 — apartment-interior-reference-digest (phase-02)

평가 대상: `apartment/.claude/skills/apartment-interior-reference-digest/SKILL.md` (4번 진단 보강 후 영문/혼합 버전)
평가 기준: skill-creator 4축 (trigger keyword 적정성 / workflow 명확도 / boundary 누락 / 비대 압축 후보)

## 1. Trigger keyword 적정성

### 현황

- `description`이 영문 주도 ("Find and summarize", "Use when the user asks") — 한국어 자연어 트리거 매칭 약함
- "오늘의집", "네이버 블로그" 등 한국어 키워드가 혼재하여 일관성 부족
- "morning cron interior recommendations" — 구현 세부 사항, trigger 가치 없음
- 슬래시 명령 `/apartment-interior-reference-digest` 미포함
- 따옴표 trigger phrase 형식 없음

### 개선안

- `description` 전면 한국어화 + trigger phrase 추가:
  - "오늘 인테리어 추천해줘"
  - "구리 럭키아파트 인테리어 찾아줘"
  - "샷시/확장/욕실/주방 레퍼런스 보여줘"
  - "인테리어 의사결정 도와줘"
- 슬래시 명령 `/apartment-interior-reference-digest` 명시
- "morning cron" 제거 — 구현 세부 사항

### 적용 결과

description 전면 한국어화 + trigger phrase 4개 + 슬래시 명령 추가.

## 2. Workflow 명확도

### 현황

- 9단계 단순 나열 — 검색/수집/평가 흐름이 step 3/4/5로 분산되어 경계 불명확
- step 1(결정 노트 읽기) + step 2(config 읽기) 분리 — 단일 "파악" 단계로 통합 가능
- step 3의 "Prefer" 목록 4개 — 하단 "Search guidance" 섹션과 직접 중복
- step 4 "Do not rely on thumbnails alone" — boundary 항목이 workflow에 혼재
- step 9 사용자 확인 규칙 — boundary 항목이 workflow에 혼재
- "Daily recommendation output" 섹션이 workflow 흐름과 별도 분리 — 문서 순서 분절
- Decision queue 갱신 조건("다른 docs 가 신규 미결정/완료 항목을 보이면") 명확도 약함

### 개선안

- 파악 → 검색 → 수집/평가 → 저장 → 갱신 → Discord → 제안 처리 7단계로 재편
- step 1+2 통합: "의사결정 문서 + 설정 파악"
- step 3+4+5 → 검색(2단계), 수집/평가(3단계)로 분리 명확화
- thumbnail 금지 규칙 → boundary로 이동
- 사용자 확인 규칙 → boundary로 이동
- "Search guidance" 섹션 → workflow step 2에 통합 압축

### 적용 결과

7단계 구조로 재편. 중복 제거. boundary 항목 분리.

## 3. Boundary 누락 항목

### 현황

`Boundaries` 섹션 4개 항목 존재:

- 업체 연락/견적 요청 금지 (사용자 승인 없이)
- 블로그 가격 신뢰 금지 (최종 비용으로 취급)
- 확정 결정과 아이디어 구분
- 발코니 확장 등 법적/구조적 주제 전문가 확인 권고

누락된 경계 규칙:

- 썸네일만으로 레퍼런스 채택 금지 (step 4에 묻혀 있음)
- 사용자 확인 없이 D-00X 추가 금지 (step 9에 묻혀 있음)
- 최근 7일 동일 주제 질문 반복 금지 (Daily recommendation output에 묻혀 있음)
- 결정 완료 항목 재질문 금지 (Daily recommendation output에 묻혀 있음)

### 개선안

"해야 할 것 / 하지 말아야 할 것" 2개 그룹으로 재편. 누락 항목 4개 추가.

### 적용 결과

경계 섹션 구조 정비 + 4개 누락 항목 추가.

## 4. 비대 압축 후보

### 현황 (원본 약 77줄)

- `Search guidance` 섹션 7개 쿼리 — `config.searchQueries`와 직접 중복
- step 3 "Prefer" 목록 4개 — `config.sourcePriority`와 직접 중복
- step 1+2 각 1줄짜리 단계 분리 — 통합 가능

### 압축안

- `Search guidance` 섹션 삭제 → workflow step 2에서 "config.searchQueries 순서대로" 참조 + sourcePriority 요약으로 대체
- step 3 "Prefer" 목록 → "config의 sourcePriority 참조" + 우선순위 1~4 요약으로 압축

### 적용 결과

원본 약 77줄 → 약 70줄. config 단일 출처 원칙 강화.

## 최종 적용 항목 요약

| 축 | 발견 항목 | 적용 여부 | 비고 |
|---|---|---|---|
| Trigger | description 영문 → 한국어 + trigger phrase 4개 | 적용 | 슬래시 명령 추가 |
| Trigger | "morning cron" 제거 | 적용 | 구현 세부 → 불필요 |
| Workflow | 9단계 → 7단계 재편 (step 1+2 통합) | 적용 | |
| Workflow | 검색/수집/평가 흐름 명확화 | 적용 | |
| Workflow | thumbnail 금지 → boundary 이동 | 적용 | 경계 분리 |
| Workflow | 사용자 확인 규칙 → boundary 이동 | 적용 | 경계 분리 |
| Workflow | Search guidance 섹션 → step 2 통합 | 적용 | 중복 제거 |
| Boundary | 썸네일만 채택 금지 명시 | 추가 | 누락 항목 |
| Boundary | D-00X 사용자 확인 없이 추가 금지 명시 | 추가 | 누락 항목 |
| Boundary | 최근 7일 동일 주제 질문 반복 금지 명시 | 추가 | 누락 항목 |
| Boundary | 결정 완료 항목 재질문 금지 명시 | 추가 | 누락 항목 |
| 압축 | Search guidance 섹션 삭제 → step 내 참조 | 적용 | |
| 압축 | step 3 Prefer 목록 → sourcePriority 요약 | 적용 | |
