# 후보자 프로필

이 문서는 포지션 추천, 지원 전략과 면접 준비가 공통으로 읽는 후보자 기준입니다.
공개 가능한 최신 경력 서술은 `sources/fos-study/resume/2607_김병태_경력기술서_backend-ai.md`에 둡니다.
프로젝트 근거는 경력기술서에서 연결한 `sources/fos-study/task/` 문서를 직접 확인합니다.
이 문서는 이력서가 아니며 경력기술서의 프로젝트 설명을 복제하지 않습니다.

## 목표 역할

백엔드 안정성과 운영 경험을 바탕으로 AI 제품과 개발 생산성을 함께 개선하는 역할을 우선합니다.

- Java와 Spring Boot 기반 제품 백엔드
- RAG 색인, 문서 파싱과 AI 제품을 다루는 백엔드·플랫폼
- 개발 도구와 AI 에이전트 실행 환경을 만드는 개발 생산성
- 브랜드, 엔지니어링 조직 규모와 대규모 서비스 운영 경험을 기대할 수 있는 회사

현재 준비 중인 지원 대상은 private brain에서 확인합니다.
공고별 지원 문서와 면접 질문은 대응하는 `applications/<company>/<role>/`에서 확인합니다.

## 한 줄 소개

백엔드의 정합성, 동시성, 배치와 운영 문제를 해결해 왔으며 AI를 제품과 개발 도구에 연결해 온 개발자입니다.

## 경력

| 기간 | 소속과 역할 | 확인된 주요 경험 |
| --- | --- | --- |
| 2025.12–현재 | NHN AI 서비스 개발 | Spring Batch·OpenSearch 벡터 색인, Python·FastAPI 문서 파싱 운영, OCR API·배포 안정화, Next.js AI 제품 |
| 2024.06–2025.11 | NHN 슬롯 백엔드 개발 | Java 17·Spring Boot 3, 신규 슬롯 5종, 점진 리팩터링, 캐시 동시성, 성능 개선, AI 개발 방식 도입 |
| 2023.01–2024.03 | NHN 스포츠 플랫폼 개발 | Java 중심 백엔드, 캐시·정산, 상태 기반 보상, 다국어 시스템 |
| 2022.02–2022.11 | 더퓨쳐컴퍼니 백엔드 개발 | TypeScript·NestJS, Redis 기반 거래 체결, 블록체인 입출금 |
| 2018.08–2020.12 정규직<br>2021.08–2022.01 프리랜서 | 엠씨에스텍 SI 개발 | Java·Spring 공공기관 시스템, 배치와 레거시 현대화 |

총 개발 경력은 약 7년입니다.
세부 기간과 프로젝트는 최신 경력기술서를 따릅니다.

## 대표 강점

### 점진적인 백엔드 구조 개선

- 여러 슬롯을 구현한 뒤 반복이 확인된 경계에서 서비스와 계산 규칙을 분리했습니다.
- 테스트하기 어려운 정적 호출과 중복 흐름을 작은 변경으로 줄였습니다.
- 캐시 갱신 중 읽기를 잠금으로 보호하고 성능 문제를 알고리즘과 측정으로 해결했습니다.

근거는 다음 문서에서 확인합니다.

- `sources/fos-study/task/nsc-slot/slot-architecture-evolution.md`
- `sources/fos-study/task/nsc-slot/slot-engine-abstraction.md`
- `sources/fos-study/task/nsc-slot/slot-spin-performance.md`
- `sources/fos-study/task/nsc-slot/slot-simulator-oom.md`

### AI 서비스의 데이터·운영 계층

- Java 21과 Spring Batch로 문서 수집, 변환, 임베딩, 색인과 삭제 동기화를 단계별로 분리했습니다.
- Python 문서 파싱 서비스에서 품질 회귀, 워커 병렬화, 메모리, 관측성과 배포 문제를 다뤘습니다.
- OCR 호출 경로와 오토스케일 전환에서 기동, 종료, 연결 풀과 재시도 경계를 함께 개선했습니다.

검색 API와 검색 품질 최적화는 담당 범위로 넓혀 말하지 않습니다.
RAG 경험은 수집, 정규화, 임베딩과 벡터 색인 계층으로 한정합니다.

근거는 다음 문서에서 확인합니다.

- `sources/fos-study/task/ai-service-team/rag-vector-search-batch.md`
- `sources/fos-study/task/ai-service-team/playground-document-parser.md`
- `sources/fos-study/task/ai-service-team/docparser-quality-regression.md`
- `sources/fos-study/task/ai-service-team/docparser-performance.md`
- `sources/fos-study/task/ai-service-team/docparser-memory-stability.md`
- `sources/fos-study/task/ai-service-team/ocr-api-gateway-removal.md`
- `sources/fos-study/task/ai-service-team/ocr-scale-connection-resilience.md`

### AI 제품과 개발 생산성

- Next.js와 TypeScript로 AI 웹툰 제작 도구를 제품 흐름 전체에 걸쳐 개발했습니다.
- 전반 12일의 MVP 이후 후반 12일 동안 구조, 관측성, 실패 처리와 테스트를 보강했습니다.
- 도메인 규칙, 계획, 구현과 검증을 분리한 AI 에이전트 개발 방식을 운영했습니다.
- `dooray-cli`와 `nhncloud-cli`를 공개해 협업·클라우드 작업을 구조화된 명령으로 제공했습니다.
- 사내 사용자들이 `dooray-cli`로 AI를 통한 업무 작성과 수정을 수행하며, 비개발자도 접근할 수 있도록 사내 게시판에 사용법을 공유했습니다.
- 직접 작성한 과거 Dooray 업무와 댓글에서 문체를 추출해 AI 작성 규칙으로 재사용하는 `dooray-persona`를 만들었습니다.
- `@bifos/dooray-cli`는 2026년 8월 확인 기준 최근 30일간 npm에서 943회 다운로드됐습니다.

근거는 다음 문서와 공개 저장소에서 확인합니다.

- `sources/fos-study/task/ai-service-team/webtoon-maker-ai-pipeline.md`
- `sources/fos-study/task/nsc-slot/ai-tool-adoption.md`
- https://github.com/jon890/dooray-cli
- https://github.com/jon890/nhncloud-cli

## 기술 범위

| 범위 | 기술 |
| --- | --- |
| 주력 | Java 11·17·21, Spring Boot 2.6·3.x, Spring Batch, JPA, QueryDSL |
| 데이터 | MySQL, PostgreSQL, Redis, OpenSearch, Ehcache |
| AI 서비스 | RAG 색인, 문서 파싱, OCR 연동, Gemini API, Python·FastAPI 운영 개선 |
| 웹 제품 | TypeScript, Node.js, NestJS, Next.js, React, Svelte |
| 운영 | Kubernetes, Helm, ArgoCD, Docker, Prometheus, Grafana |
| 검증 | JUnit 5, Testcontainers, JaCoCo, SonarQube, golden set, NED, 표 셀 F1 |

Spring WebFlux 경험은 OCR API의 `WebClient`와 Reactor Netty 연결 관리 범위로 설명합니다.
Apache Kafka는 사용 경험이 있지만 파티셔닝, 재조정과 지연 운영을 핵심 강점으로 내세우지 않습니다.
Kotlin 어드민 코드베이스의 기능 개발 이력은 있지만 Kotlin 고유의 운영·트러블슈팅 노하우는 확인되지 않았습니다.
Kotlin을 주력 언어나 깊이 있는 애플리케이션 경험으로 소개하지 않습니다.

## 보완 영역

- JPA 조회 최적화, 벌크 연산과 복잡한 트랜잭션 면접 질문
- Kafka 파티셔닝, Consumer Group 재조정과 지연 관측
- Redis의 분산 락, Hot Key와 대규모 캐시 운영 패턴
- Kubernetes HPA, PDB와 세밀한 스케줄링
- RAG 검색 품질 측정, 혼합 검색과 재정렬
- 대규모 데이터 플랫폼과 에이전트 플랫폼 운영

위 영역의 실무 경험을 추정으로 채우지 않습니다.
학습 중인 내용과 운영 경험을 구분해 답합니다.

## 사실 표현 경계

- 처리량, 팀 규모, 개선율과 비용은 측정 근거가 없으면 쓰지 않습니다.
- 팀 결과와 개인 구현 범위를 구분합니다.
- `단독`, `처음부터`, `해결` 같은 표현은 Git, 코드, 테스트 또는 운영 기록이 뒷받침할 때만 씁니다.
- AI 에이전트가 구현한 작업은 요구사항, 설계, 검토와 실제 코드 작성의 책임을 구분합니다.
- 문서 파싱 저장소는 Git 기여 이력상 주 기여자임이 확인됐습니다.
- 벡터 색인 배치는 여러 기여자가 함께 개발했으므로 전체 파이프라인의 단독 소유로 표현하지 않습니다.
- 최신 이력서에 없는 기술을 공고 키워드에 맞춰 추가하지 않습니다.

## 경력 자료

- 최신 경력기술서: `sources/fos-study/resume/2607_김병태_경력기술서_backend-ai.md`
- 최신 포트폴리오: `sources/fos-study/resume/2607_김병태_포트폴리오_backend-ai.md`
- 업무 기록 목록: `sources/fos-study/task/ai-service-team/README.md`
- 슬롯 업무 기록 목록: `sources/fos-study/task/nsc-slot/README.md`
- 스포츠 플랫폼 업무 기록 목록: `sources/fos-study/task/sb-dev-team/README.md`
- 이전 회사 업무 기록 목록: `sources/fos-study/task/the-future-company/README.md`

지원 문서는 이 파일과 최신 경력 자료를 읽은 뒤 공고에 필요한 근거만 골라 만듭니다.
프로필을 갱신할 때는 먼저 최신 경력 자료와 실제 작업 폴더를 대조합니다.
