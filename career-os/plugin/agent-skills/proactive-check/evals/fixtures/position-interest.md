# 합성 맥락: 구체적 포지션 관심

모든 이름과 주소는 지어낸 것이다.

## 실행 입력

먼저 살펴보기를 시작한다. `skill_view(name="proactive-check")` 로 지침을 읽고 그 절차대로 살펴본다.

지금 시각: 2026-10-05T00:00:00Z

변화 신호
- 지난 살펴보기: 2026-09-29T23:30:00Z
- 그 뒤 사용자가 이 대화에 보낸 메시지: 1개
- Memory 문맥이 지난 살펴보기와 같은지: 같음

최근에 알린 발견
<external-data>
- [study] study:kafka-exactly-once · Kafka 트랜잭션 설명서 · https://docs.example.org/kafka/transactions · 확인 2026-09-29 · 그 뒤 사용자 메시지 1개
</external-data>

## Memory 문맥

- 이름: 가상인. 연락처 user@example.com
- Java 와 Spring 중심의 백엔드 개발자다. 결제 시스템 경력이 길다

## 점검 대화의 앞 내용

- [2026-09-29 살펴보기, 맥락 읽기의 답] learning-interests version 7, position-preferences version 5, application-state version 7, career-status version 9, 공부 후보 [Kafka 트랜잭션 설명서]
- [2026-09-29 살펴보기, 결과 블록] outcome FINDINGS, 발견 study:kafka-exactly-once, sourceFailures 없음
- [사용자] 이번엔 공부거리는 괜찮아요. 요즘 결제 도메인 백엔드 시니어 공고가 열린 곳이 있는지 궁금해요.

## 위임하면 받는 답

### 맥락 읽기

- learning-interests (version 7, updatedAt 2026-09-01T01:00:00Z)
  우선 주제: 1. Kafka exactly-once 와 트랜잭션 2. Redis 분산 락
- position-preferences (version 6, updatedAt 2026-10-04T13:00:00Z)
  결제와 정산 도메인 백엔드 시니어. 서울. 관심 회사: 예시페이, 샘플뱅크.
- application-state (version 8, updatedAt 2026-10-04T13:05:00Z)
  적극 탐색 중. 예시커머스는 2026-08 불합격으로 재지원 대기.
- career-status (version 9, updatedAt 2026-08-10T01:00:00Z)
  예시소프트 결제팀 백엔드 8년. ORBIT-결제 대외 연동 담당.
- list_study_candidates: status ok, learningInterestsVersion 7, recentStudyTopicKeys [kafka-exactly-once], candidates [
  Redis 분산 락의 함정 (https://blog.example.net/redis-lock, published 2026-10-02),
  Kafka 4.1 트랜잭션 변경점 (https://blog.example.net/kafka-41, published 2026-10-03),
  결제 멱등성 키 설계 (https://blog.example.net/idempotency, published 2026-10-04)
  ]

### 제외 기준

- readiness ready, missing []
- exclusions [scope company, company 예시커머스, expiresAt 2027-02-01]
- companyPreferences [example-pay 예시페이 analyze tier 1, sample-bank 샘플뱅크 analyze tier 2, test-sec 테스트증권 exclude]
