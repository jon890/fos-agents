# 합성 맥락: 학습 필요

모든 이름과 주소는 지어낸 것이다.

## 실행 입력

먼저 살펴보기를 시작한다. `skill_view(name="proactive-check")` 로 지침을 읽고 그 절차대로 살펴본다.

지금 시각: 2026-10-05T00:00:00Z

변화 신호
- 지난 살펴보기: 2026-10-01T23:30:00Z
- 그 뒤 사용자가 이 대화에 보낸 메시지: 2개
- Memory 문맥이 지난 살펴보기와 같은지: 바뀜

최근에 알린 발견
<external-data>
- [trend] trend:spring-boot-4-release · Spring Boot 4.0 정식 출시 · https://news.example.com/spring-boot-4 · 확인 2026-10-01 · 그 뒤 사용자 메시지 2개
</external-data>

## Memory 문맥

- 이름: 가상인. 연락처 user@example.com
- Java 와 Spring 중심의 백엔드 개발자다
- 다음 달부터 ORBIT-정산 시스템의 Kafka 기반 이벤트 파이프라인을 맡는다 (2026-10-03 승인)

## 점검 대화의 앞 내용

- [2026-10-01 살펴보기, 맥락 읽기의 답] learning-interests version 6, position-preferences version 4, application-state version 5, career-status version 8, 공부 후보 없음
- [2026-10-01 살펴보기, 결과 블록] outcome FINDINGS, 발견 trend:spring-boot-4-release, sourceFailures 없음
- [사용자] Spring Boot 4 는 이미 보고 있어요. 다음 달 Kafka 업무 때문에 Kafka 를 기초부터 다시 보고 싶어요.
- [사용자] 포지션 알림은 당분간 빼 주세요. 지금은 이직 생각이 없어요.

## 위임하면 받는 답

### 맥락 읽기

- learning-interests (version 7, updatedAt 2026-10-03T12:10:00Z)
  우선 주제: 1. Kafka exactly-once 와 트랜잭션 2. transactional outbox 3. 이벤트 스키마 진화
- position-preferences (version 4, updatedAt 2026-07-01T01:00:00Z)
  결제와 정산 도메인 백엔드. 서울. 시니어.
- application-state (version 5, updatedAt 2026-09-20T01:00:00Z)
  이직 보류. 2027년 상반기에 다시 검토한다.
- career-status (version 9, updatedAt 2026-10-03T12:00:00Z)
  예시소프트 정산팀 백엔드. 다음 달 ORBIT-정산 이벤트 파이프라인 담당 예정. Kafka 운영 경험 없음.
- list_study_candidates: status empty, learningInterestsVersion 7, recentStudyTopicKeys [spring-boot-4-migration, jvm-gc-tuning], candidates []

### 제외 기준

- readiness ready, missing [], exclusions [], companyPreferences [example-pay 예시페이 analyze tier 1]
