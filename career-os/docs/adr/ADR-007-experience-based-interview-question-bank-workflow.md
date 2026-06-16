## ADR-007 — Experience-based interview question bank workflow

- Status: Superseded by [[ADR-027]] (plan015, 2026-05-15) — Q&A workflow가 interview-asset-writer로 통합. 별도 experience-question-bank-writer 스킬 폐기.
- Date: 2026-04-16

### 맥락
기존 `study-pack-writer`는 기술 article 스타일 출력에 최적화. 경험 기반 인터뷰 준비는 입력(이력서 + 선택된 task 이력 + 타깃 JD)과 출력(질문 뱅크 + 답변 준비 시트) 모두 다르고, validation도 article 섹션이 아닌 질문 구조여야 한다.

### 결정
- `experience-question-bank-writer` 별도 스킬·프롬프트.
- 전체 task 트리가 아닌 선택된 입력 파일만 사용.
- `config/experience-question-bank-topics.json`에 별도 topic 설정.
- 출력은 `interview/experience-based/` 아래.
- 5 main questions + 5 follow-up per main + answer points + 1분 답변 구조 + 압박 질문 방어 검증.

### 결과
- prompt·입력·validation·출력 정렬 개선.
- 입력 범위 과대화로 인한 생성 불안정 감소.
- study-pack 인프라와 일부 중복은 감수.
