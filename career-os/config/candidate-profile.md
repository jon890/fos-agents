# Candidate Profile

> 이 문서는 career-os 파이프라인(study-pack / question-bank / interview-master)에서 Claude 프롬프트의 candidate context로 주입되는 단일 출처입니다.
> 사실관계는 `sources/fos-study/resume/2603_김병태_이력서_v4.md` 및 `sources/fos-study/task/**`에 근거합니다.
> 출처가 없는 수치·성과는 기재하지 않습니다.

---

## 지원 대상

- **현재 타깃**: CJ Foodville Digital Channel Backend (Java Backend). 회사·팀·면접 일자는 `career-os/config/mvp-target.json`이 단일 출처.
- **지원 포지션 핵심**: F&B/e-Commerce 운영형 자사 백엔드 — Spring Boot 3 + JPA/Hibernate + Kafka + Redis + MySQL 기반 신규 서비스 개발·운영 안정화, 레거시(JSP/jQuery)와 신규 SPA 공존 환경, 주문/픽업/딜리버리 상태머신·쿠폰·멤버십 도메인, 클라우드 운영 안정성.
- **지원 가능 범위 (재사용 가능 포지셔닝)**: 운영형 자사 서비스 백엔드 — Spring Boot 3 · Java 17·21 · JPA · Kafka · Redis · OpenSearch + 분산 캐시 정합성·Transactional Outbox·운영 장애 RCA 실전 경험. AI 서비스 백엔드 경험도 보조 자산.
- **포지셔닝 한 줄**: "운영 안정성·트랜잭션/이벤트 경계·캐시 정합성을 자사 서비스 백엔드 관점으로 설계해 본 시니어 Java 백엔드 개발자."

---

## 커리어 타임라인

| 기간 | 회사 · 팀 | 역할 · 대표 기술 결정 |
|------|-----------|----------------------|
| 2022.02 ~ 2022.11 | 더퓨쳐컴퍼니 | Node.js 백엔드. 게임 아이템 거래소 **체결 엔진·호가창**을 Redis Streams/RediSearch 기반으로 구현, 블록체인 입출금 데몬 설계. (`task/the-future-company/`) |
| 2023.01 ~ 2024.03 | SB 개발팀 (스포츠 베팅 플랫폼) | Java 11 / Spring Boot 2.6 백엔드. **Ehcache + 인메모리 Map** 이중 캐시와 **MQ Fanout 기반 다중 서버 캐시 정합성**(RabbitMQ / Azure Service Bus 이중화), KYC·Azure Blob 저장·추천 프로그램·wemix 지갑 연동. (`task/sb-dev-team/`) |
| 2024.06 ~ 2025.11 | NHN NSC 슬롯개발팀 | Spring Boot 3.x / Java 17 / MySQL / Redis. 신규 슬롯 8종 개발, **슬롯 엔진 추상화**(`SlotTemplate`, `BaseSlotService`), **RCC(RTP Cache Control)** 백그라운드 캐시 시스템, **StampedLock** 기반 정적 데이터 동시성 해결, **AliasMethod O(1)** 스핀 최적화, **Cursor Rules 20종 이상** 구축 및 AI 에이전트 단독 3종 구현. (`task/nsc-slot/`) |
| 2025.12 ~ 현재 | NHN AI 서비스 개발팀 | Spring Boot 3 / Java 21 / Spring Batch / OpenSearch. 사내 RAG용 **Confluence 벡터 색인 배치 파이프라인(11 Step)** 설계·구현, **AsyncItemProcessor**로 I/O 병렬화, 전략 패턴 기반 메타데이터 Provider, Next.js 기반 사내 AI 웹툰 제작 MVP 풀스택. (`task/ai-service-team/`) |

- 총 개발 경력은 **약 7년차**로 본다. 별도 SI 개발 경험 약 3년이 있으며, 현재 이력/프로젝트 문서에 상세히 정리된 최근 경력은 위 표 기준이다.
- NHN 재직 자체는 4년차이지만, 경력기술서 기준 **"시니어 Java 백엔드 실무"는 2023.01부터 약 3년+** 축적.
- 포지션 추천 시 5년+ 공고는 현실권으로 보고, 7년+ 공고도 정규직이면 도전 가능 후보로 평가한다. 단, 계약직/임시직/프리랜서는 제외한다.
- 출처: `sources/fos-study/resume/2603_김병태_이력서_v4.md` 문항1, 각 팀 `README.md`, 사용자 직접 정정(2026-05-08: SI 개발 경험 약 3년 포함 총 7년차).

---

## 보유 기술 스택 (증거 기반)

라벨: **실전 운영**(운영 환경 트래픽을 받음) / **설계 경험**(새로 설계·도입) / **사용 경험**(기능 단위로 사용).

### 언어 / 런타임
- **Java 17 · Java 21** (실전 운영, 4년+) — `task/nsc-slot/slot-engine-abstraction.md`, `task/ai-service-team/rag-vector-search-batch.md`
- **Kotlin** — 출처 문서에 직접 운영 기재 없음. 공고 요건상 필요 시 학습 가능 수준. (※ 현 MVP에서는 Kotlin 제외 유지)
- **TypeScript / Node.js (NestJS)** (실전 운영, 2022~2024 일부) — `task/the-future-company/`, `task/sb-dev-team/kyc-system.md`
- **Python** (사용 경험, 제한적) — gRPC OCR 서버 graceful shutdown 수정. 케어챗 포지션 대비 FastAPI/async/background task/LLM gateway 패턴을 단기 보강 우선순위로 둔다. `task/ai-service-team/graceful-shutdown-503-fix.md`

### 프레임워크
- **Spring Boot 3.x** (실전 운영, 2024~) — `task/nsc-slot/README.md`, `task/ai-service-team/README.md`
- **Spring Boot 2.6** (실전 운영, 2023~2024) — `task/sb-dev-team/README.md`
- **Spring Batch** (설계 경험, 2026.01~) — 11 Step 파이프라인, `AsyncItemProcessor`, `@JobScope`, `CompositeItemProcessor`. `task/ai-service-team/rag-vector-search-batch.md`
- **JPA / Hibernate** (실전 운영) — `PostCommitUpdateEventListener` 활용, `@TransactionalEventListener(AFTER_COMMIT)`, `Propagation.REQUIRES_NEW`. `resume/2603_김병태_이력서_v4.md` 문항1
- **QueryDSL** (실전 운영) — `task/nsc-slot/`, `task/sb-dev-team/`
- **Project Reactor** (사용 경험) — `task/nsc-slot/simulator-template.md` (ReactiveSimulator)

### 메시징 / 이벤트
- **Apache Kafka** (실전 운영 + 설계) — **Transactional Outbox Pattern** 설계·운영. `@TransactionalEventListener(AFTER_COMMIT)` + `REQUIRES_NEW` 실패 메시지 저장 + 스케줄러 재전송 + traceId 추적. 출처: `resume/2603_김병태_이력서_v4.md` 문항1 "Kafka 비동기 처리" 단락.
- **RabbitMQ Fanout Exchange** (실전 운영) — 다중 서버 인메모리 캐시 정합성. `task/sb-dev-team/cache-architecture.md`, NSC 슬롯팀 정적 데이터 갱신.
- **Azure Service Bus** (실전 운영) — RabbitMQ 이중화. `task/sb-dev-team/cache-architecture.md`

### 데이터 / 스토리지
- **MySQL 8.x** (실전 운영) — 복합 인덱스 추가로 캐시 충족 판정 쿼리 개선. `task/nsc-slot/rcc-rtp-cache-control.md`
- **Redis** (실전 운영 + 설계) — 거래소 호가창, 체결 엔진(Redis Streams / RediSearch / Redis JSON). `task/the-future-company/trading-engine.md`
- **OpenSearch** (실전 운영 + 설계) — 벡터 색인, 벌크 색인, 삭제 동기화, `_refresh` Step 설계. `task/ai-service-team/rag-vector-search-batch.md`
- **Ehcache (JSR-107)** (실전 운영) — `@Cacheable` + MQ Fanout 기반 전역 무효화. `task/sb-dev-team/cache-architecture.md`
- **Prisma / PostgreSQL** (사용 경험) — KYC 서버. `task/sb-dev-team/kyc-system.md`
- **Azure Blob Storage** (사용 경험) — 신분증 업로드 · 6개월 자동 삭제 배치. `task/sb-dev-team/kyc-system.md`

### 동시성 / 성능
- **StampedLock** (실전 운영) — 정적 데이터 갱신 중 읽기 차단 + `tryReadLock` 타임아웃 2.5s. `task/nsc-slot/slot-engine-abstraction.md`
- **ReentrantReadWriteLock** (실전 운영) — `task/sb-dev-team/cache-architecture.md`
- **AliasMethod (O(1) 가중치 랜덤)** (설계 경험) — 누적합 방식 대체. `task/nsc-slot/slot-spin-performance.md`
- **ThreadLocalRandom vs SecureRandom** (JMH 기반 결정) — `task/nsc-slot/slot-spin-performance.md`
- **AtomicReference / Welford's Online Algorithm** — ThreadLocal 공유 상태 버그 해결, 시뮬레이터 OOM 제거. `task/nsc-slot/slot-simulator-jackpot-pool.md`, `task/nsc-slot/slot-simulator-oom.md`

### 인프라 / 운영
- **NHN Cloud / Azure** (실전 운영) — `task/sb-dev-team/README.md`
- **NHN Cloud Container Service** (실전 운영, 제약 경험) — `terminationGracePeriodSeconds` 30s 고정 제약 하 예산 설계. `task/ai-service-team/graceful-shutdown-503-fix.md`
- **Envoy / gRPC / supervisord** (트러블슈팅) — preStop + SIGTERM 핸들러 + stopwaitsecs 조합 설계. `task/ai-service-team/graceful-shutdown-503-fix.md`
- **Docker** (사용 경험) — 실제 운영 배포 파이프라인에서 사용. Kubernetes 직접 운영 기재는 출처 문서에 명시 없음.
- **Jenkins** (사용 경험) — `Jenkinsfile_deploy_real` 수정. `task/ai-service-team/graceful-shutdown-503-fix.md`
- **Testcontainers / JUnit 5 / MockRestServiceServer / spring-batch-test** (실전 운영) — `task/ai-service-team/rag-vector-search-batch.md`

### 테스트
- 제네릭 기반 추상 테스트 클래스 설계, **447개 테스트 파일** 운영(이력서 기재). `resume/2603_김병태_이력서_v4.md` 문항1. AOP / Kafka 이벤트 발행 / Redis 통합 테스트 커버.

---

## 주요 프로젝트 요약

4줄 포맷: **문제 / 접근 / 결과(출처 기재 범위) / 기술적 핵심**.

### 1. Confluence 벡터 색인 배치 파이프라인 (AI 서비스팀, 2026.01~2026.03)
- **문제**: 사내 RAG용 지식 베이스를 OpenSearch에 벡터 색인해야 함. I/O 바운드(임베딩 API + 문서 파싱)가 심해 동기 처리 시 청크 하나에 수 분 소요, 중간 실패 시 처음부터 재시작해야 하는 리스크.
- **접근**: Spring Batch 11 Step 분리(수집→변환→임베딩→색인→삭제 동기화) + `AsyncItemProcessor`로 청크 내 병렬 + `CompositeItemProcessor`로 4단계 체이닝 + `ChangeFilter`로 변경 없는 문서 스킵 + `@JobScope` 빈으로 Step 간 데이터 공유.
- **결과 (출처 명시 범위)**: 사내 AI 서비스 RAG 기능의 색인 파이프라인을 처음부터 설계·구현. 구체적 TPS/감축율은 출처 문서에 기재 없음.
- **기술적 핵심**: Step 단위 실패 격리 / `ItemStream` 구현으로 커서 기반 재시작 / Confluence ADF → Markdown 변환 / 전략 패턴(`ConfluenceDocumentMetadataProvider`)으로 스페이스별 메타데이터 분기 제거.
- 출처: `task/ai-service-team/rag-vector-search-batch.md`

### 2. 다중 서버 인메모리 캐시 정합성 설계 (NSC 슬롯팀)
- **문제**: 정적 설정 데이터를 DB 부하 절감용으로 메모리 캐싱했지만, 어드민에서 변경 시 다중 서버 인스턴스 간 정합성이 깨지고 갱신 중 조회 요청에서 일시적 NPE 발생.
- **접근**: Hibernate `PostCommitUpdateEventListener` → RabbitMQ Fanout Exchange 발행 → 각 서버가 자기 큐에서 수신 후 해당 데이터만 선택 갱신. 갱신 구간은 `StampedLock` writeLock으로 보호, 조회는 `tryReadLock(2.5s)` 타임아웃.
- **결과 (출처 명시 범위)**: 일시적 정합성 오류(NPE) 해소. `StaticDataManager` 인터페이스로 init/refresh/clear 책임 분리해 신규 캐시 타입 추가 시 기존 코드 미수정.
- **기술적 핵심**: JPA 커밋 이벤트 리스너 / Fanout Exchange / Java 동시성 기본기(StampedLock) / OCP 준수.
- 출처: `resume/2603_김병태_이력서_v4.md` 문항1, `task/nsc-slot/slot-engine-abstraction.md`, `task/sb-dev-team/cache-architecture.md`

### 3. Kafka Transactional Outbox Pattern 설계 (NSC 슬롯팀)
- **문제**: 핵심 API에서 금액·레벨 처리(동기) + 미션·통계·알림(비동기)를 분리하면서도 메시지 유실과 DB-브로커 원자성 깨짐을 방지해야 함.
- **접근**: `@TransactionalEventListener(AFTER_COMMIT)`으로 커밋 이후 발행 보장. 전송 실패 시 `Propagation.REQUIRES_NEW` 별도 트랜잭션으로 실패 메시지 DB 저장 + 스케줄러 재전송. traceId 함께 저장해 실패 원인 추적.
- **결과 (출처 명시 범위)**: 메시지 유실 없는 비동기 후처리 구조 운영. 정량 지표는 출처 문서에 기재 없음.
- **기술적 핵심**: Outbox Pattern / Spring 트랜잭션 전파 정확한 사용 / 관측 가능성(traceId) 내재화.
- 출처: `resume/2603_김병태_이력서_v4.md` 문항1

### 4. RCC (RTP Cache Control) — 백그라운드 사전 캐시 시스템 (NSC 슬롯팀, 2025.07~2025.10)
- **문제**: 단기 RTP 편차로 유저 경험 저하. "좋은 결과"를 사전에 DB에 캐시해 필요 시점에 제공해야 함.
- **접근**: `RccHandler`에서 일반 스핀 여부 판정 후 캐시 히트 시 반환 + 비동기로 다음 캐시 생성 트리거. 슬롯마다 캐시 조건이 다른 점은 `RccSpinResultAnalyzer` 인터페이스로 슬롯별 구현체 주입. 잭팟 포함 케이스는 `NoOpJackpotService`로 모드별 분기.
- **결과 (출처 명시 범위)**: 슬롯 6종에 적용, 복합 인덱스 튜닝으로 캐시 충족 판정 쿼리 최적화. 정량 RTP 개선치는 출처 문서에 기재 없음.
- **기술적 핵심**: `@Async` + 스레드풀 / DB 유니크 키 기반 동시성 / 인터페이스 기반 슬롯별 전략 / 로그 테이블 컬럼 확장으로 관측성 확보.
- 출처: `task/nsc-slot/rcc-rtp-cache-control.md`

### 5. 슬롯 스핀 성능 최적화 (NSC 슬롯팀, 2025.01~2025.02)
- **문제**: 100만 스핀 시뮬레이터가 10분+ 소요. 가중치 랜덤이 O(n) 누적합, 랜덤 생성기가 `SecureRandom`으로 과도한 락 경합.
- **접근**: **AliasMethod** 사전 테이블로 O(1) 선택 전환, `ThreadLocalRandom`으로 교체, 필드 보관 금지 규칙 정립.
- **결과 (출처 명시 범위)**: JMH 기준 `ThreadLocalRandom` 70.241 ops/s vs `SecureRandom` 1.197 ops/s (약 58배). 시뮬레이션 실제 경과 시간 단축 기재는 정성적.
- **기술적 핵심**: 알고리즘 치환(Alias Method) / JMH 기반 결정 / ThreadLocal 의미 이해.
- 출처: `task/nsc-slot/slot-spin-performance.md`

### 6. Spring Boot 캐시 아키텍처 이중화 (SB 개발팀, 2023.03~2024.02)
- **문제**: Ehcache(`@Cacheable`)와 인메모리 Map 캐시(`AbstractStaticReloadable`) 공존, 다중 서버 환경에서 어드민 변경 시 전 서버 동시 무효화 필요. 클라우드가 NHN Cloud / Azure 이원화.
- **접근**: MQ Fanout으로 전 서버 동시 수신 + `ReentrantReadWriteLock`으로 갱신 구간 보호 + 환경별로 RabbitMQ / Azure Service Bus를 추상화하여 주입.
- **결과 (출처 명시 범위)**: 두 클라우드 환경에서 동일 캐시 갱신 추상화 운영. 서버 기동 시 자동 로드.
- **기술적 핵심**: 멀티 클라우드 대응 / 캐시 무효화 전략 / 동시성 기본기.
- 출처: `task/sb-dev-team/cache-architecture.md`

### 7. AI 에이전트 기반 슬롯 개발 (NSC 슬롯팀, 2025.04~2025.11)
- **문제**: 복잡한 슬롯 도메인에서 에이전트가 엉뚱한 클래스 import / 존재하지 않는 메서드 호출 빈발.
- **접근**: **Cursor Rules 20종 이상** 구축 — 공통 도메인 객체/패키지 경로, 슬롯별 전용 규칙, RCC 패키지 구조. 팀 내 전파.
- **결과 (출처 명시 범위)**: Slot 41 / 44 / 47 **에이전트 단독 구현**. `by agent` 커밋 태깅으로 추적. 팀 사이클 단축(정성적).
- **기술적 핵심**: 도메인 지식 문서화 / 에이전트 컨텍스트 관리 / 검토-first 워크플로.
- 출처: `task/nsc-slot/ai-tool-adoption.md`, `resume/2603_김병태_이력서_v4.md` 문항2·4

### 8. AI 웹툰 제작 도구 MVP — 12일 단독 풀스택 (AI 서비스팀 TF, 2026.04.06~2026.04.18)
- **문제**: 웹소설 원작으로 운영자가 작가 없이 웹툰 컷 이미지까지 뽑는 MVP를, **프론트/백/DB/AI 파이프라인 전부 혼자서 12일**에. 소설 분석 → 세계관 → 캐릭터 시트 → 각색 → 글콘티 → 60컷 이미지까지 6단계 풀 파이프라인 범위.
- **접근**: Next.js 16 (App Router · Server Actions · SSE) + TypeScript strict + PostgreSQL + Prisma 7 + Zod 4 단일 코드베이스. AI는 `@google/genai` 단일 SDK (Gemini 3 LLM + gemini-3-pro-image-preview). **Gemini 모델 전략을 "퀄리티 우선 + fallback"으로 뒤집어** `pro → flash → lite` 순 fallback (ADR-072), 429 시 같은 모델 대기 금지 → 바로 다음 모델. **전역 Rate Limit Tracker** (`Map<model, expireAt>`)로 요청 간 429 정보 공유 (ADR-069). Gemini **Context Caching**으로 동일 소설 반복 분석 입력 토큰 절감 (ADR-045). **통합 분석**(API 경계 ≠ 논리 경계) 설계로 토큰 비용 절감, **Promise.allSettled** 기반 60컷 일괄 생성 부분 성공 처리, **Grounding 재주입 + Project Cache**로 프롬프트 환각 차단, **이미지 레퍼런스**로 캐릭터 외형 고정(텍스트 프롬프트 한계 우회), **Zod 단일 소스 + 레이어별 분리 타입 시스템**, **Container/Presenter 패턴**으로 디자이너와 충돌 해소. 앞 단계 수정 시 이후 단계 확정 연쇄 해제 (FR30). Claude Code 하네스 기반 **에이전트 팀**(main Opus 논의 → plan 파일 → Sonnet executor 실행 → critic APPROVE/REVISE → docs-verifier 문서 정합성) 조율, 하네스 자체가 **vibe 코딩에서 spec 기반 코딩으로 진화**.
- **결과 (출처 명시 범위)**: 12일간 **199 plan / 760 커밋**. 본인은 대부분 논의·계획·검토를 담당, 실제 타이핑은 에이전트가 수행. MVP 범위(Phase 1 1~5단계) 완성, 동영상/음악(Phase 2)은 제외. 정량 성과 지표(사용자 수·생성 수 등)는 출처 문서에 기재 없음.
- **기술적 핵심**: **에이전트 파이프라인 설계자** 레벨의 AI 협업 (툴 사용자 수준을 넘어섬) / 풀스택 단일 타입 안전성(Zod 단일 소스) / 재시도·폴백 전략 설계 / 운영 관측성(`GET /api/model-status`) / 비용 의사결정 ("싸 보이는 모델이 재생성 반복으로 더 비싸지는" trade-off 역전) / docs-first 원칙 / Server Action ≠ AI 계층 ≠ DB 계층 레이어 분리.
- 출처: `task/ai-service-team/webtoon-maker-ai-pipeline.md`

---

## 입증된 강점 (with evidence)

> 추상어 금지. 실제 에피소드 기반. 각 항목 뒤에 증거 파일 경로.

1. **분산 캐시 정합성 설계 실제 경험** — JPA 이벤트 리스너 → MQ Fanout → StampedLock 까지 단일 스택으로 직접 설계/해결. `task/sb-dev-team/cache-architecture.md`, `task/nsc-slot/slot-engine-abstraction.md`
2. **트랜잭션 경계와 이벤트 발행의 상호작용 이해** — `@TransactionalEventListener(AFTER_COMMIT)` + `REQUIRES_NEW` + Outbox 재전송 설계 운영. `resume/2603_김병태_이력서_v4.md` 문항1
3. **대용량 배치 파이프라인을 처음부터 설계** — Step 분리·재시작·I/O 병렬화 의사결정을 문서 수준으로 정리. `task/ai-service-team/rag-vector-search-batch.md`
4. **"추상화는 반복을 본 뒤에"를 실제로 실천** — SlotTemplate / BaseSlotService / EmbeddingMetadataProvider 모두 if-else가 자라는 걸 먼저 관찰하고 나서 추상화. `task/nsc-slot/slot-engine-abstraction.md`, `task/ai-service-team/embedding-metadata-provider.md`
5. **알고리즘 기반 성능 개선 실제 적용 + 측정** — AliasMethod O(n)→O(1), Welford's Online Algorithm으로 OOM 제거, JMH 근거. `task/nsc-slot/slot-spin-performance.md`, `task/nsc-slot/slot-simulator-oom.md`
6. **제약 조건 하에서 운영 문제 해결** — NHN Cloud Container Service의 `terminationGracePeriodSeconds` 30s 고정 하에 preStop 15s + gRPC grace 12s + 여유 3s 예산 설계로 503 제거. `task/ai-service-team/graceful-shutdown-503-fix.md`
7. **팀 개발 생산성 인프라 구축** — 447개 테스트 파일, Cursor Rules 20종, 에이전트 단독 구현 3종. `resume/2603_김병태_이력서_v4.md` 문항2·4, `task/nsc-slot/ai-tool-adoption.md`
8. **의사결정 문서화 습관** — task 문서 각 파일이 "배경 → 접근 → 트러블 → 배운 것" 구조로 일관 작성. 블로그/저장소 형태로 지속. `task/**`

---

## 약점 / 학습 중인 영역

> 거짓 약점 금지. 출처 문서·자가 진단(`CLAUDE.md`) · smoke test 결과에 근거.

1. **JPA N+1 · 페치 조인 · 벌크 연산 실전 질의응답** — 운영에서 사용은 하고 있으나 깊이 있는 추가 질문에 즉답할 수준으로 정리가 부족. 개선 중(career-os smoke test에서 식별).
2. **Redis 캐싱 패턴 폭** — Cache-Aside는 익숙. Write-Through / Write-Behind / Read-Through / 인증·세션 분리 / 분산 락(Redisson 등) / Hot Key 처리 실전 사례는 상대적으로 얕음. 특정 회사 사례보다 범용적인 대규모 백엔드 운영/설계 관점으로 학습한다.
3. **Kafka 운영 디테일** — Outbox 설계·운영 경험은 있으나, **파티셔닝 키 선택 / Consumer Group rebalance / Exactly-Once Semantics / Lag 모니터링** 같은 운영 이슈에서 깊이가 부족할 수 있음.
4. **Kubernetes 실운영** — NHN Cloud Container Service의 K8s 추상화 위에서 preStop/grace 수준은 다뤘으나, 직접적인 Deployment/HPA/PDB 튜닝 기재는 출처 문서에 없음. 면접 질문 시 "운영 제약을 받는 사용자 관점"으로 답할 것.
5. **대규모 트래픽 TPS 숫자** — 이력서·task 전반에서 **구체 TPS / 레이턴시 수치는 명시하지 않음**. 과장 답변 리스크가 있으므로 "측정 여부 / 측정 방법 / 체감 단위"로 답해야 함.
6. **Kotlin** — 직접 운영 기재 없음. 현 MVP에서는 제외하나, 타깃 회사에 따라 단기 학습 필요 가능.

---

## 기술 의사결정 패턴

> 실제 에피소드 기반 trade-off 처리 방식.

1. **YAGNI vs 미래 확장성** — 슬롯 5종이 쌓인 뒤에야 `SlotTemplate`을 도입. "처음부터 추상화했으면 잘못된 경계를 그었을 것"을 명시적으로 판단. `task/nsc-slot/slot-engine-abstraction.md`
2. **보안 vs 성능** — `SecureRandom`의 암호학적 강도가 슬롯 서버 내부에서 불필요하다고 판단해 `ThreadLocalRandom`으로 전환. JMH 벤치마크로 58배 차이 근거. `task/nsc-slot/slot-spin-performance.md`
3. **복잡도 관리** — 14개 `remove` 호출 + DocumentType 분기가 누적되는 구조를 OCP 위반으로 진단 → **Blocklist → Allowlist** 전환으로 `EmbeddingService` 순수 위임 구조화. `task/ai-service-team/embedding-metadata-provider.md`
4. **동시성 선택** — 갱신 빈도 낮고 읽기 압도적 → `StampedLock` + `tryReadLock` 타임아웃 / 캐시 생성 충돌 빈도 낮음 → 낙관적 락 대신 DB 유니크 키 + 예외 처리 선택. `task/nsc-slot/slot-engine-abstraction.md`, `task/nsc-slot/rcc-rtp-cache-control.md`
5. **트랜잭션·메시지 경계** — 이벤트 발행은 커밋 이후에만(AFTER_COMMIT), 실패 기록은 별도 트랜잭션(REQUIRES_NEW)으로 원자성 분리. `resume/2603_김병태_이력서_v4.md` 문항1
6. **운영 제약을 예산으로 환산** — `terminationGracePeriodSeconds` 30s 고정 제약에서 preStop sleep 15s + gRPC grace 12s + 여유 3s로 계산. `task/ai-service-team/graceful-shutdown-503-fix.md`
7. **Step 분리 = 실패 격리** — 단일 거대 Step 대신 11개 Step 분리를 "댓글 Step이 죽어도 페이지 Step 결과는 살아있다"는 운영적 관점으로 설명. `task/ai-service-team/rag-vector-search-batch.md`

---

## 협업 / 리더십 / 코드 리뷰 스타일

> task 문서와 이력서에 드러난 실제 흔적 기반.

- **의사결정을 문서로 남긴다** — 모든 주요 task가 "배경 → 접근 → 어려웠던 점 → 배운 것" 포맷으로 기록됨. 동료가 맥락 없이도 의도를 파악 가능(이력서 문항4 명시). 증거: `task/**/*.md` 전반.
- **팀 전체 생산성에 자발적 투자** — 447개 테스트 파일 기반 안전망 구축, 테스트 추상 클래스(`AbstractSlotTest`) 제네릭화. `task/nsc-slot/slot-test-template.md`, `resume/2603_김병태_이력서_v4.md` 문항1·4
- **AI 에이전트 도입을 팀에 전파** — Cursor Rules 20종 이상 구축 + 팀 공유, Slot 41/44/47 에이전트 단독 구현으로 실효성 입증. `task/nsc-slot/ai-tool-adoption.md`
- **리팩터링을 조용히 이끈다** — 파편화된 로직(스핀 타입별 중복 흐름)을 `AbstractPlayService` + `SpinOperationHandler` 인터페이스 위임으로 통합. 단순 기능 추가 수준을 넘어 구조 개선을 자발적으로 수행. 이력서 문항1·4
- **에이전트 결과물 검토를 필수로 본다** — 도메인 규칙(RTP 계산, 특수 심볼 처리)은 반드시 사람이 검토해야 한다고 명시. `task/nsc-slot/ai-tool-adoption.md`
- **도메인 지식 문서화 = 온보딩 자산** — rules 파일이 에이전트용으로 시작했지만 팀원 온보딩에도 쓰이는 부수 효과를 명시.
- **PR/커밋 추적성** — `by agent` 커밋 태깅으로 AI 작업 범위 분리 추적. `task/nsc-slot/ai-tool-adoption.md`
- 출처 문서에 직접 명시되지 않은 항목(예: 팀 규모, 리포트 라인, 구체적 PR 리뷰 코멘트 문화)은 기재하지 않음.

---

## 면접 준비 우선순위

> 약점 섹션과 1:1 매핑. 구체 액션과 상태.

1. **JPA N+1 & 페치 전략 질의응답**
   - `@EntityGraph` / fetch join / `default_batch_fetch_size` / `open-in-view=false`.
   - 상태: study-pack 1편 작성 완료, 구술 면접 연습 반복 필요.
2. **Redis 캐싱 패턴 확장**
   - Write-Through / Write-Behind / Read-Through / Cache Stampede / Hot Key.
   - Cache-Aside + Kafka 하이브리드, Hot Key, TTL/invalidation, 장애 시 fallback 복기.
   - 상태: 범용 백엔드 면접 답변으로 재사용 가능하게 정리 중.
3. **Kafka 운영 질문 대비**
   - Consumer Group Rebalance, Partition 키 전략, Exactly-Once, Idempotent Producer.
   - Outbox Pattern 설명 시 "왜 AFTER_COMMIT이어야 하는가 / 왜 REQUIRES_NEW인가"를 1분 내 말할 수 있도록 정리.
4. **MSA 간 데이터 연동 질문**
   - Sync vs Async 선택 기준, 분산 트랜잭션(Saga), 이벤트 유실 대비.
5. **자기 프로젝트 1분 설명 3종 준비**
   - RAG 배치 파이프라인 / 캐시 정합성 / Outbox Pattern.
6. **CJ Foodville 디지털 채널 특화 보조 포인트**
   - F&B 주문/픽업/딜리버리 상태머신 / 쿠폰·프로모션 동시성 / 멤버십·CJ ONE 포인트 / 결제 멱등성·부분 취소·환불 / 레거시 JSP+jQuery와 신규 Spring API 공존 / MyBatis 운영 패턴을 우선 준비한다.
   - 회사·포지션 세부는 `private/cj-foodville/digital-channel-backend/interview/prep.md`와 `config/mvp-target.json`에서 주입한다.

---

## 제약 / 스코프

- **Kotlin은 현 MVP에서 제외** — 기존 프로필의 `Kotlin excluded from the current MVP focus` 정책 유지.
- **폴리그롯 가정 금지** — 이력서·task에 기재 없는 언어/도구(예: Scala, Rust 본격 운영)는 pipeline에서 전제하지 않는다.
- **수치 날조 금지** — TPS, 팀 규모, 성과 %, 감축율 등이 이력서·task에 명시되지 않았으면 pipeline은 "출처 문서에 기재 없음"으로 응답해야 한다. 이력서 문항1의 "447개 테스트 파일", 본 문서 JMH 수치는 출처 확인됨.
- **실무 근거 범위** — 본 프로필은 `resume/2603_김병태_이력서_v4.md` + `task/**/*.md` + `interview/kakao-healthcare-carechat-ai-agent.md`를 1차 근거로 사용한다. 기타 이력서 버전(v1~v3, 2108/2512/2601)은 참조용.
- **CJ Foodville 디지털 채널 타깃 유지** — 회사 특화 맥락은 `private/cj-foodville/digital-channel-backend/interview/prep.md`와 `config/mvp-target.json` primary에서 주입한다.

---

## Source provenance

| 파일 | 기여 섹션 |
|------|-----------|
| `sources/fos-study/resume/2603_김병태_이력서_v4.md` | 지원 대상 / 커리어 타임라인 / 주요 프로젝트(2·3) / 강점 1·2·7 / 협업 |
| `sources/fos-study/task/nsc-slot/README.md` | 커리어 타임라인 / 기술 스택 |
| `sources/fos-study/task/nsc-slot/slot-engine-abstraction.md` | 주요 프로젝트(2) / 의사결정 패턴 1·4 / 기술 스택(StampedLock) |
| `sources/fos-study/task/nsc-slot/slot-spin-performance.md` | 주요 프로젝트(5) / 의사결정 패턴 2 / 기술 스택(AliasMethod·ThreadLocalRandom) |
| `sources/fos-study/task/nsc-slot/rcc-rtp-cache-control.md` | 주요 프로젝트(4) / 의사결정 패턴 4 / 기술 스택(MySQL·비동기 캐시·DB 유니크 키) |
| `sources/fos-study/task/nsc-slot/ai-tool-adoption.md` | 주요 프로젝트(7) / 협업·리더십 |
| `sources/fos-study/task/nsc-slot/slot-simulator-oom.md` | 강점 5 |
| `sources/fos-study/task/nsc-slot/slot-simulator-jackpot-pool.md` | 기술 스택(AtomicReference) |
| `sources/fos-study/task/nsc-slot/slot-test-template.md` | 협업·리더십(테스트 인프라) |
| `sources/fos-study/task/ai-service-team/README.md` | 커리어 타임라인 / 기술 스택 |
| `sources/fos-study/task/ai-service-team/rag-vector-search-batch.md` | 주요 프로젝트(1) / 의사결정 패턴 7 / 기술 스택(Spring Batch) |
| `sources/fos-study/task/ai-service-team/embedding-metadata-provider.md` | 의사결정 패턴 3 / 강점 4 |
| `sources/fos-study/task/ai-service-team/graceful-shutdown-503-fix.md` | 강점 6 / 의사결정 패턴 6 / 약점(K8s) |
| `sources/fos-study/task/sb-dev-team/README.md` | 커리어 타임라인 |
| `sources/fos-study/task/sb-dev-team/cache-architecture.md` | 주요 프로젝트(6) / 강점 1 / 기술 스택(Ehcache·MQ Fanout) |
| `sources/fos-study/task/the-future-company/README.md` | 커리어 타임라인 / 기술 스택(Redis Streams) |
| `sources/fos-study/interview/kakao-healthcare-carechat-ai-agent.md` | 지원 대상 / 케어챗 포지션 분석 / 면접 준비 우선순위 |
| `career-os/CLAUDE.md` | 제약(Kotlin 제외) / 면접 준비 우선순위 |

> 미래 업데이트 규칙: 이력서 v5가 나오면 "커리어 타임라인 / 주요 프로젝트 / 강점" 우선 재생성. 신규 task 문서가 추가되면 "기술 스택 / 주요 프로젝트" 재생성. CJ가 아닌 회사로 타깃 전환 시 "지원 대상 / 면접 준비 우선순위 7항" 만 교체하면 중립성 유지됨.
