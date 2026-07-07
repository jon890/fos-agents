# Candidate Profile

> 이 문서는 career-os 파이프라인(study-pack / question-bank / interview-master)에서 Claude 프롬프트의 candidate context로 주입되는 단일 출처입니다.
> 사실관계는 `sources/fos-study/resume/2603_김병태_이력서_v4.md` 및 `sources/fos-study/task/**`에 근거합니다.
> 출처가 없는 수치·성과는 기재하지 않습니다.

---

## 지원 대상

- **현재 타깃**: active target이 없을 수 있다.
  회사·팀·면접 일자·포지션 핵심은 `career-os/config/mvp-target.json`이 단일 출처이며, `primary: null`이면 새 공고 탐색부터 시작한다.
- **지원 가능 범위 (재사용 가능 포지셔닝)** — 두 레인으로 지원한다.
  - **백엔드 코어 레인**: 운영형 자사 서비스 백엔드. 슬롯 도메인 점진 아키텍처 개선, 테스트/검증 기반 리팩터링, AI 활용 개발 생산성이 강점이다.
  - **AI 서비스·AI 플랫폼 전환 레인**: RAG 색인, 문서 파싱 운영, 품질 검증 인프라, 에이전트 기반 개발 생산성을 차별화 자산으로 쓴다.
  - **핵심 스택**: Spring Boot 3 / Java 17·21 / JPA / Redis / OpenSearch.
- **포지셔닝 한 줄**: "복잡한 도메인을 직접 구현하며 반복을 관찰한 뒤 구조를 고치고, AI를 개발 생산성과 서비스 검증 파이프라인에 연결해 온 백엔드 개발자."

## 핵심 무기

정통 백엔드 레인과 AI 전환 레인을 함께 평가할 때 아래 순서로 본다.

1. **슬롯 도메인에서 검증된 점진 아키텍처 개선력**
   - 슬롯을 여러 개 직접 만들며 반복 패턴을 먼저 확인했다.
   - 잘못된 선추상화를 피하고, 실제 중복이 자란 지점에서 `SlotTemplate`·`BaseSlotService`·`ExtraConfig`로 구조를 고쳤다. — `task/nsc-slot/slot-engine-abstraction.md`
2. **AI를 개발 생산성·개발자 경험(DX)으로 전환하는 능력**
   - 반복 업무·클라우드 운영을 AI 에이전트가 직접 수행하도록 CLI 두 종을 설계해 npm에 공개 배포했다. — dooray-cli·nhncloud-cli (npm 공개)
   - CI에 LLM 기반 코드리뷰·자동 테스트를 붙여 개발→리뷰→품질 검증을 자동화했다. — dooray-cli
   - 운영 서비스에 계획·아키텍처 결정·테스트·릴리스 검증을 재사용 skill로 정착시켜 빠른 개발과 품질 자동 차단을 함께 얻었다. — 사내 문서 파싱 서비스(최다 기여자), `task/nsc-slot/ai-tool-adoption.md`
3. **복잡한 구현을 테스트·검증 가능한 구조로 바꾸는 습관**
   - Spring Batch RAG 색인 파이프라인을 Step 단위로 분리해 실패를 격리했다. — `task/ai-service-team/rag-vector-search-batch.md`
   - 비대해진 문서 파싱 모듈을 입력/적재/변환/생성 단계로 분해해 변경 비용을 줄였다. — `task/ai-service-team/playground-document-parser.md`
   - 출력 회귀 검증(NED)과 golden 채점을 나눠, 회귀 차단과 안전한 품질 개선을 동시에 가능하게 했다. — `task/ai-service-team/playground-document-parser.md`
4. **운영 문제를 끝까지 파는 문제 해결력**
   - graceful shutdown 503을 종료 예산 설계(preStop·grace)로 제거했다. — `task/ai-service-team/graceful-shutdown-503-fix.md`
   - 문서 파싱 워커 RSS 증가를 메모리 단편화로 진단해 `malloc_trim`으로 해결했다. — `task/ai-service-team/glibc-malloc-trim-python-leak.md`
   - OCR 워커 상태 오염을 워커 종료·감시 재시작 격리로 복구했다. — `task/ai-service-team/playground-document-parser.md`
5. **상태 갱신과 동시성에 대한 실전 감각**
   - 정적 데이터 갱신 중 읽기 보호(StampedLock·ReentrantReadWriteLock)와 NPE 방지를 구현했다. — `task/nsc-slot/slot-engine-abstraction.md`, `task/sb-dev-team/cache-architecture.md`
   - 스핀 가중치 랜덤을 AliasMethod로 O(n)→O(1) 개선했다. — `task/nsc-slot/slot-spin-performance.md`

---

## 커리어 타임라인

| 기간 | 회사 · 팀 | 역할 · 대표 기술 결정 |
|------|-----------|----------------------|
| 2022.02 ~ 2022.11 | 더퓨쳐컴퍼니 | Node.js 백엔드.<br>· 게임 아이템 거래소 **체결 엔진·호가창**을 Redis Streams/RediSearch 기반으로 구현<br>· 블록체인 입출금 데몬 설계 (`task/the-future-company/`) |
| 2023.01 ~ 2024.03 | SB 개발팀 (스포츠 베팅 플랫폼) | Java 11 / Spring Boot 2.6 백엔드.<br>· **인메모리 reloadable 캐시와 읽기 락 기반 캐시 정합성** — 갱신 중 조회 보호, 응답 객체 재활용으로 GC 압력 감소<br>· KYC 서버(Azure Blob 저장·6개월 자동 삭제)<br>· 추천/미션 보상 프로그램, 분산 정산 워커 (`task/sb-dev-team/`) |
| 2024.06 ~ 2025.11 | NHN NSC 슬롯개발팀 | Spring Boot 3.x / Java 17 / MySQL / Redis.<br>· 신규 슬롯 8종 개발, **슬롯 엔진 추상화**(`SlotTemplate`·`BaseSlotService`)<br>· **RCC(RTP Cache Control)** 백그라운드 캐시 시스템<br>· **StampedLock** 기반 정적 데이터 갱신 중 동시성 해결<br>· **AliasMethod O(1)** 스핀 최적화<br>· **Cursor Rules 20종 이상** 구축 및 AI 에이전트 단독 슬롯 3종 구현 (`task/nsc-slot/`) |
| 2025.12 ~ 현재 | NHN AI 서비스 개발팀 | Spring Boot 3 / Java 21 / Spring Batch / OpenSearch + Python/FastAPI 문서 파싱 운영.<br>· 사내 RAG용 **다중 소스 벡터 색인 배치**(위키·업무·문서·음성 STT) 설계·구현, **AsyncItemProcessor** I/O 병렬화, 전략 패턴 메타데이터 Provider<br>· 문서 파싱 파이프라인 최다 기여자 — 품질 검증·워커 운영 개선<br>· Next.js 기반 사내 AI 웹툰 제작 MVP 풀스택<br>· 보조로 NHN Cloud OCR 제품 API(Java 21 · Spring WebFlux)와 배포 환경(K8s/Helm/ArgoCD)에 기여 (`task/ai-service-team/`) |

- 총 개발 경력은 **약 7년차**로 본다. 별도 SI 개발 경험 약 3년이 있으며, 현재 이력/프로젝트 문서에 상세히 정리된 최근 경력은 위 표 기준이다.
- NHN 재직 자체는 4년차이지만, 경력기술서 기준 **"시니어 Java 백엔드 실무"는 2023.01부터 약 3년+** 축적.
- 포지션 추천 시 5년+ 공고는 현실권으로 보고, 7년+ 공고도 정규직이면 도전 가능 후보로 평가한다. 단, 계약직/임시직/프리랜서는 제외한다.
- 출처: `sources/fos-study/resume/2603_김병태_이력서_v4.md` 문항1, 각 팀 `README.md`, 사용자 직접 정정(2026-05-08: SI 개발 경험 약 3년 포함 총 7년차).

---

## 보유 기술 스택 (증거 기반)

라벨: **실전 운영**(운영 환경 트래픽을 받음) / **설계 경험**(새로 설계·도입) / **사용 경험**(기능 단위로 사용).

### 언어 / 런타임
- **Java 17 · Java 21** (실전 운영, 4년+) — `task/nsc-slot/slot-engine-abstraction.md`, `task/ai-service-team/rag-vector-search-batch.md`
- **Kotlin** (실전 운영, SB 어드민 백엔드) — Kotlin·Spring Boot 2.6 기반 운영 어드민 백엔드를 다수 파일 규모로 개발했다(관리 API·보안 필터·트랜잭션 후 스토리지/큐 전달·Elasticsearch 조회 동기화). Java 실전 운영 경험 기반이라 적응 부담이 낮아 갭으로 보지 않는다. (SB 어드민 백엔드 실무)
- **TypeScript / Node.js (NestJS)** (실전 운영, 2022~2024 일부) — `task/the-future-company/`, `task/sb-dev-team/kyc-system.md`
- **Python** (운영 개선 경험, 제한적 제품 백엔드) — FastAPI 기반 문서 파싱 서비스의 멀티프로세스 워커 풀, OCR 호출, RSS 증가 진단, `malloc_trim` 적용, graceful shutdown 문제를 다뤘다.
  단, Python을 주력 제품 서버 언어로 장기간 운영한 근거는 제한적이다.
  `task/ai-service-team/playground-document-parser.md`, `task/ai-service-team/glibc-malloc-trim-python-leak.md`, `task/ai-service-team/graceful-shutdown-503-fix.md`

### 프레임워크
- **Spring Boot 3.x** (실전 운영, 2024~) — `task/nsc-slot/README.md`, `task/ai-service-team/README.md`
- **Spring Boot 2.6** (실전 운영, 2023~2024) — `task/sb-dev-team/README.md`
- **Spring WebFlux (Reactive, Mono/Flux)** (실전 운영) — OCR 제품 API 서버를 Java 21 virtual threads + WebFlux 기반으로 개발. (OCR 제품 API 실무)
- **MyBatis** (사용 경험) — OCR 제품 API 서버. (OCR 제품 API 실무)
- **Spring Batch** (설계 경험, 2026.01~) — 11 Step 파이프라인, `AsyncItemProcessor`, `@JobScope`, `CompositeItemProcessor`. `task/ai-service-team/rag-vector-search-batch.md`
- **JPA / Hibernate** (실전 운영) — 엔티티 매핑, QueryDSL, 커밋 이후 갱신 이벤트 처리 경험. `resume/2603_김병태_이력서_v4.md` 문항1
- **QueryDSL** (실전 운영) — `task/nsc-slot/`, `task/sb-dev-team/`
- **Project Reactor** (사용 경험) — `task/nsc-slot/simulator-template.md` (ReactiveSimulator)

### 메시징 / 이벤트
- **Apache Kafka** (사용·패턴 이해) — 비동기 처리와 이벤트 발행 패턴을 접했으나, Kafka 운영·파티셔닝·Consumer Group 튜닝을 핵심 강점으로 내세우지는 않는다.
- **RabbitMQ Fanout (캐시 갱신 전파 맥락)** (사용 경험) — 다중 서버 캐시 갱신이 Fanout으로 전파되는 구조에서, 본인은 갱신 중 읽기 보호와 NPE 방지 쪽을 구현했다. Fanout 발행 인프라 자체는 팀 공용이며, 본인 강점은 캐시 리로드·동시성 보호다. `task/nsc-slot/`, `task/sb-dev-team/cache-architecture.md`
- **TCP/UDP·Socket 서버·저수준 네트워크 프로토콜** — HTTP API, gRPC 경계 트러블슈팅, MQ, Redis Streams 사용 경험은 있으나, TCP/UDP socket server, custom protocol, Netty 기반 네트워크 서버 아키텍처를 직접 설계·운영한 근거는 제한적이다.
  해당 경험을 필수로 요구하는 공고에서는 강점으로 과장하지 않고, 지원 우선순위를 낮춘다.

### 데이터 / 스토리지
- **MySQL 8.x** (실전 운영) — 복합 인덱스 추가로 캐시 충족 판정 쿼리 개선. `task/nsc-slot/rcc-rtp-cache-control.md`
- **Redis** (실전 운영 + 설계) — 거래소 호가창, 체결 엔진(Redis Streams / RediSearch / Redis JSON). `task/the-future-company/trading-engine.md`
- **OpenSearch** (실전 운영 + 설계) — 벡터 색인, 벌크 색인, 삭제 동기화, `_refresh` Step 설계. `task/ai-service-team/rag-vector-search-batch.md`
- **Ehcache (JSR-107)** (실전 운영) — `@Cacheable` + MQ Fanout 기반 전역 무효화. `task/sb-dev-team/cache-architecture.md`
- **Prisma / PostgreSQL** (사용 경험) — KYC 서버. `task/sb-dev-team/kyc-system.md`
- **Azure Blob Storage** (사용 경험) — 신분증 업로드 · 6개월 자동 삭제 배치. `task/sb-dev-team/kyc-system.md`
- **DB 샤딩** (실전 운영) — 유저 데이터가 샤드로 분산 저장되어, 조회 시 샤드를 직접 지정해 컨텍스트를 전환하는 정합성 처리. `task/sb-dev-team/referral-program.md`
- **다중 DataSource** (실전 운영) — `@Qualifier` 기반 Repository 분기로 두 환경 DB를 한 앱에서 비교/복사. `task/nsc-slot/admin-slot-compare-copy.md`
- **Flyway** (사용 경험) — 상태 구조 변경 시 스키마 마이그레이션을 기능과 동시 설계. `task/nsc-slot/global-personal-data.md`

### 동시성 / 성능
- **StampedLock** (실전 운영) — 정적 데이터 갱신 중 읽기 차단 + `tryReadLock` 타임아웃 2.5s. `task/nsc-slot/slot-engine-abstraction.md`
- **ReentrantReadWriteLock** (실전 운영) — `task/sb-dev-team/cache-architecture.md`
- **AliasMethod (O(1) 가중치 랜덤)** (설계 경험) — 누적합 방식 대체. `task/nsc-slot/slot-spin-performance.md`
- **ThreadLocalRandom vs SecureRandom** (JMH 기반 결정) — `task/nsc-slot/slot-spin-performance.md`
- **AtomicReference / Welford's Online Algorithm** — ThreadLocal 공유 상태 버그 해결, 시뮬레이터 OOM 제거. `task/nsc-slot/slot-simulator-jackpot-pool.md`, `task/nsc-slot/slot-simulator-oom.md`
- **CompletableFuture 병렬 실행 조율 + ThreadPool 튜닝** (실전 운영) — `supplyAsync`+`allOf` 병렬 조립, `CallerRunsPolicy` 백프레셔, 개별 실패 격리, 진행률 폴링. `task/nsc-slot/admin-asset-async-sync.md`
- **SELECT FOR UPDATE 행 선점** (실전 운영) — 다중 서버 정산 워커의 중복 처리 방지 + 멱등성. `task/sb-dev-team/referral-program.md`

### 인프라 / 운영
- **NHN Cloud** (실전 운영) — 퍼블릭 클라우드. 서비스 배포·운영에 활발히 활용. `task/sb-dev-team/README.md`, `task/ai-service-team/`
- **Azure** (개발 경험, 운영 제한) — 애플리케이션 개발 맥락에서 사용. 인프라 운영은 별도 DevOps 팀이 담당해 직접 운영 경험은 제한적이다.
- **NHN Cloud Container Service** (실전 운영, 제약 경험) — `terminationGracePeriodSeconds` 30s 고정 제약 하 예산 설계. `task/ai-service-team/graceful-shutdown-503-fix.md`
- **Envoy / gRPC / supervisord** (실전 운영) — preStop + SIGTERM 핸들러 조합 설계 + OCR 추론 서비스의 gRPC + Envoy 기반 GPU 모델 서빙 운영(대용량 이미지 대응 버퍼 한도 조정 등). `task/ai-service-team/graceful-shutdown-503-fix.md`, (OCR 추론 서비스 실무)
- **FastAPI / ProcessPoolExecutor / GPU 워커 풀** (운영 개선 경험) — 문서 파싱 API의 OCR 워커 병렬화, 대기열 관측, 워커 오류 복구 구조 개선. `task/ai-service-team/playground-document-parser.md`
- **Kubernetes / Helm / ArgoCD (GitOps) + Prometheus** (실전 운영) — OCR 제품의 다단계(alpha/beta/real) 배포 환경과 모니터링을 구축·운영. HPA/PDB 심화 튜닝은 학습 여지. (OCR 제품 배포 환경 실무)
- **Docker** (사용 경험) — 실제 운영 배포 파이프라인에서 사용.
- **Jenkins** (사용 경험) — `Jenkinsfile_deploy_real` 수정. `task/ai-service-team/graceful-shutdown-503-fix.md`
- **Testcontainers / JUnit 5 / MockRestServiceServer / spring-batch-test** (실전 운영) — `task/ai-service-team/rag-vector-search-batch.md`
- **출력 품질 검증 / golden set / NED / 표 셀 F1** (설계 경험) — 문서 파싱 결과 회귀 검증과 정답지 채점 체계를 구축했다. `task/ai-service-team/playground-document-parser.md`

### 테스트
- 제네릭 기반 추상 테스트 클래스 설계, **447개 테스트 파일** 운영(이력서 기재). `resume/2603_김병태_이력서_v4.md` 문항1. AOP / Kafka 이벤트 발행 / Redis 통합 테스트 커버.

---

## 주요 프로젝트 요약

4줄 포맷: **문제 / 접근 / 결과(출처 기재 범위) / 기술적 핵심**.

### 1. Confluence 벡터 색인 배치 파이프라인 (AI 서비스팀, 2026.01~2026.03)
- **문제**: 사내 RAG용 지식 베이스를 OpenSearch에 벡터 색인해야 함. I/O 바운드(임베딩 API + 문서 파싱)가 심해 동기 처리 시 청크 하나에 수 분 소요, 중간 실패 시 처음부터 재시작해야 하는 리스크.
- **접근**: Spring Batch 11 Step 분리(수집→변환→임베딩→색인→삭제 동기화) + `AsyncItemProcessor`로 청크 내 병렬 + `CompositeItemProcessor`로 4단계 체이닝 + `ChangeFilter`로 변경 없는 문서 스킵 + `@JobScope` 빈으로 Step 간 데이터 공유.
- **결과 (출처 명시 범위)**: 사내 AI 서비스 RAG 기능의 색인 파이프라인을 처음부터 설계·구현. 구체적 TPS/감축율은 출처 문서에 기재 없음.
- **현행 확장 (2026 상반기~현재)**: Confluence 단일에서 **다중 소스(사내 위키·업무·문서·음성 STT·스페이스 메타데이터) 벡터 색인 플랫폼**으로 발전. 문서 파싱 서비스를 클라이언트로 연동하고, 배치 동시성 제어(in-flight 제한·파티셔닝·재시작)를 갖췄다. Java 21 · Spring Boot 3.5 · Spring Data OpenSearch. **Testcontainers(OpenSearch+MySQL) 통합 테스트 + JaCoCo 커버리지 게이트 + SonarQube**로 색인 파이프라인 회귀·품질을 자동 검증.
- **기술적 핵심**: Step 단위 실패 격리 / `ItemStream` 구현으로 커서 기반 재시작 / Confluence ADF → Markdown 변환 / 전략 패턴(`ConfluenceDocumentMetadataProvider`)으로 스페이스별 메타데이터 분기 제거.
- 출처: `task/ai-service-team/rag-vector-search-batch.md`

### 2. 다중 서버 인메모리 캐시 갱신 구조 (NSC 슬롯팀)
- **문제**: 정적 설정 데이터를 DB 부하 절감용으로 메모리 캐싱했지만, 어드민에서 변경 시 다중 서버 인스턴스 간 정합성이 깨지고 갱신 중 조회 요청에서 일시적 NPE 발생.
- **접근**: 어드민 변경 후 RabbitMQ Fanout 메시지를 발행하고, 각 서버가 자기 큐에서 수신 후 해당 데이터만 선택 갱신. 갱신 구간은 `StampedLock` writeLock으로 보호, 조회는 `tryReadLock(2.5s)` 타임아웃.
- **결과 (출처 명시 범위)**: 일시적 정합성 오류(NPE) 해소. `StaticDataManager` 인터페이스로 init/refresh/clear 책임 분리해 신규 캐시 타입 추가 시 기존 코드 미수정.
- **기술적 핵심**: JPA 커밋 이벤트 리스너 / Fanout Exchange / Java 동시성 기본기(StampedLock) / OCP 준수.
- 출처: `resume/2603_김병태_이력서_v4.md` 문항1, `task/nsc-slot/slot-engine-abstraction.md`, `task/sb-dev-team/cache-architecture.md`

### 3. 트랜잭션 이후 비동기 처리 패턴 경험 (NSC 슬롯팀)
- **문제**: 핵심 API에서 금액·레벨 처리(동기) + 미션·통계·알림(비동기)를 분리하면서도 메시지 유실과 DB-브로커 원자성 깨짐을 방지해야 함.
- **접근**: 커밋 이후 이벤트 발행과 실패 기록 분리 패턴을 적용했다. 다만 이 경험은 Kafka 운영 전문성이나 분산 트랜잭션 설계 강점으로 과장하지 않는다.
- **결과 (출처 명시 범위)**: 메시지 유실 없는 비동기 후처리 구조 운영. 정량 지표는 출처 문서에 기재 없음.
- **기술적 핵심**: 트랜잭션 이후 후처리 경계 이해 / 실패 기록 분리 / 관측 가능성(traceId) 내재화.
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

### 6. 인메모리 캐시 정합성·읽기 보호 (SB 개발팀, 2023~2024)
- **문제**: 정적 설정 데이터를 인메모리로 캐싱하는데, 갱신이 일어나는 동안 들어오는 조회 요청이 부분 상태를 보거나 새 객체를 매번 만들어 GC 압력이 커지는 문제가 있었다.
- **접근**: `AbstractStaticReloadable` 기반 인메모리 리로드 캐시를 구성하고, 갱신 구간을 `ReentrantReadWriteLock`으로 보호했다. 응답 시 새 객체를 만들지 않고 기존 객체를 재활용하도록 바꿨다.
- **결과 (출처 명시 범위)**: 갱신 중 조회에서 부분 상태 노출 없이 캐시 정합성을 유지하고 GC 압력을 낮췄다.
- **기술적 핵심**: 인메모리 리로드 캐시 / `ReentrantReadWriteLock` 읽기 보호 / 객체 재활용. (전 서버 동시 무효화를 위한 MQ 발행 계층은 다른 담당자가 구현했고, 본인 기여는 캐시 리로드·읽기 보호 계층이다.)
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

### 9. Playground 문서 파싱 파이프라인 (AI 서비스 개발팀, 2026.05~현재)
- **개요**: 사내 LLM workflow 제품 Playground의 문서 입력 정규화 서비스. PDF/DOC(X)/PPTX/XLSX/HWP/이미지 등 다양한 포맷을 markdown으로 변환하며, 한국어는 NHN Cloud OCR·일본어는 PaddleOCR을 내부 호출. Python 3.11 · FastAPI · docling(+TableFormer) · ProcessPoolExecutor 워커 풀 · Docker(CUDA)/GPU.
- **주요 기여**:
  - OCR 처리를 한 건씩 처리에서 멀티프로세스 워커 풀(한국어/일본어/우선순위) 병렬 구조로 전환 — 인스턴스당 워커 4개(운영 8대), OCR 모델 백엔드가 최대 16 인스턴스까지 확장되는 점을 고려한 설정
  - 비대해진 단일 파서 모듈을 입력/적재/변환/markdown 생성 단계로 분해해 변경 비용 축소
  - 관측 정보 단일화 — 지표·로그·조회 API 3중 기록을 지표(Grafana)로 통일하고 중복 조회 API 제거
  - 워커 작업 대기 현황 대시보드 정립 — 실제 적체(pending)와 작게 고정된 전달 버퍼(call_queue)를 구분해 워커 증설 판단 근거 마련
  - **출력 품질 다층 검증 체계 구축** — 1차 회귀 검증(이전 출력 대비 글자 일치도 NED ≥ 0.95)에 더해, 정답에 얼마나 가까운지 재는 정답지(golden) 채점(LLM 초안 → 사람 확정) + 텍스트 NED·표 셀 F1 두 지표를 별도로 둬, 회귀 차단과 안전한 품질 개선을 동시에 가능케 함
  - **안전한 일회성 테스트 환경 구축** — 운영 인스턴스를 트래픽에서 빼내(drain) 검증하던 방식을, 직접 만든 NHN Cloud CLI로 테스트 인스턴스를 발급·종료하는 방식으로 전환해 비용 절감·운영 무영향
  - **워커 메모리 누수 진단·해결** — 워커 강제 종료 방어(예열 비용)에서, gc로 안 풀리는 원인(메모리 단편화)을 진단해 OS 반환을 유도(malloc_trim)하는 방식으로 개선
  - 일본어 OCR(PaddleOCR) 오류를 워커 종료 + 감시 장치 재시작으로 복구 (상태 오염 회피)
  - 사내 GitHub Enterprise 자체 실행기에 자동 테스트 + 코드 리뷰 파이프라인 구축
- **기술적 핵심**: 출력 품질 검증 인프라(회귀 검증 + 정답지 채점) 설계로 안전한 반복 개선 환경 구축 / 멀티프로세스 GPU 워커 풀 운영·메모리 단편화 진단 / 런타임 내부 구조 이해 기반 운영 지표 해석 / 일회성 테스트 환경 자동화(자체 CLI) / 상태 오염 자원의 격리·재시작 설계.
- 출처: `task/ai-service-team/playground-document-parser.md`

### 10. 분산 정산 워커 (SB 개발팀)
- **문제**: 여러 서버가 함께 도는 환경에서 메시지 기반 정산 후처리가 중복 처리되면 안 됨. 샤딩된 데이터의 정합성도 지켜야 함.
- **접근**: MQ 메시지를 소비하는 다중 서버 정산 워커가 상태 머신(초기→진행→완료)과 `SELECT FOR UPDATE` 행 선점으로 작업을 나눠 갖고 중복 정산을 차단. 샤딩된 데이터는 엔티티에서 읽지 않고 샤드를 직접 지정해 한 메서드 안에서 샤드 경계를 처리, 실패 케이스 후처리 방어 로직을 강화.
- **결과 (출처 명시 범위)**: 다중 서버 분산 정산의 중복 방지·정합성 구조에 기여. 정산 로직 상세는 비공개.
- **기술적 핵심**: 상태 머신 기반 작업 분산 / `SELECT FOR UPDATE` 행 선점 / 샤딩 정합성 / 트랜잭션 이후 후처리 방어. (SB 정산 워커 실무)

---

## 개인 프로젝트

> 회사 기여 외 개인 프로젝트. AX(AI Transformation) 전환·개발 자동화 기여 자산.

### dooray-cli — 업무 자동화 CLI (`@bifos/dooray-cli`, npm 공개 배포)
- Dooray REST API와 IMAP/SMTP를 단일 CLI로 통합해 터미널·AI 에이전트에서 업무/위키/메일/첨부를 자동화. TypeScript · Node.js · Commander.js.
- AI 에이전트 친화 설계 — 전 명령 `--json` / `--quiet` 출력 계약 + 비대화형 분기(`--no-confirm`, `--body-file`)로 에이전트가 파싱·체이닝하도록 구성, 669줄 에이전트 skill 동봉.
- 다형 입력 해석기(URL 3형식 / 프로젝트코드+번호 / ID / 멤버 자동 분기), 약 396커밋, npm 공개 배포.
- CI에서 PR 리뷰를 LLM 4-에이전트(TypeScript/Conventions/Security/Architecture)로 자동화.

### nhncloud-cli — NHN Cloud 통합 CLI (`@bifos/nhncloud-cli`, npm 공개 배포)
- NHN Cloud 98개 명령(Log & Crash, Deploy, Compute, VPC, Volume, Floating IP, NCR, NKS)을 AWS CLI 방식으로 통합. TypeScript · Node.js · Commander.js. 약 349커밋, 현재도 활발히 개발.
- 에이전트 자기기술(self-describing) 설계 — `commands --json`이 명령 트리 메타데이터를 출력해 에이전트가 런타임에 전체 카탈로그를 발견. 명령별 정규화된 `--json` shape + 표준 종료 코드 규약으로 안전한 자동 운영·프로비저닝 지원.

### fos-accountbook — 가계부 풀스택 (개인)
- Spring Boot 4 / Java 21 백엔드(JPA · Flyway · Spring Security+JWT · OpenAPI, Layered Architecture) + Next.js 16 / React 19 프론트(NextAuth OAuth). 최신 Spring Boot 4 실전 근거.

---

## 입증된 강점 (with evidence)

> 추상어 금지. 실제 에피소드 기반. 각 항목 뒤에 증거 파일 경로.

1. **슬롯 도메인 점진 아키텍처 개선** — 슬롯 5종 이상을 직접 만들며 반복 패턴을 확인한 뒤 `SlotTemplate`, `BaseSlotService`, `ExtraConfig` 분리로 구조를 개선했다. `task/nsc-slot/slot-engine-abstraction.md`
2. **AI 활용 개발 생산성 인프라 구축** — Cursor Rules 20종 이상, 에이전트 단독 슬롯 구현 3종, `by agent` 커밋 태깅으로 AI 작업 범위를 분리 추적했다. `resume/2603_김병태_이력서_v4.md` 문항2·4, `task/nsc-slot/ai-tool-adoption.md`
3. **검증 가능한 파이프라인 설계** — Spring Batch 11 Step RAG 색인과 문서 파싱 품질 검증(NED·golden·표 셀 F1)으로 실패 격리와 회귀 차단을 함께 설계했다. `task/ai-service-team/rag-vector-search-batch.md`, `task/ai-service-team/playground-document-parser.md`
4. **알고리즘 기반 성능 개선 실제 적용 + 측정** — AliasMethod O(n)→O(1), Welford's Online Algorithm으로 OOM 제거, JMH 근거. `task/nsc-slot/slot-spin-performance.md`, `task/nsc-slot/slot-simulator-oom.md`
5. **캐시 갱신 중 읽기 보호 경험** — 다중 서버 캐시가 MQ Fanout으로 갱신되는 구조에서, refresh 구간을 StampedLock·ReentrantReadWriteLock으로 보호해 NPE를 막고 응답 객체를 재활용했다. Fanout 발행 인프라는 팀 공용이고, 본인 기여는 리로드·읽기 보호 계층이다. `task/nsc-slot/slot-engine-abstraction.md`, `task/sb-dev-team/cache-architecture.md`
6. **제약 조건 하에서 운영 문제 해결** — NHN Cloud Container Service의 `terminationGracePeriodSeconds` 30s 고정 하에 preStop 15s + gRPC grace 12s + 여유 3s 예산 설계로 503 제거. `task/ai-service-team/graceful-shutdown-503-fix.md`
7. **Python 워커 런타임 문제 진단** — `gc.collect()`로 RSS가 줄지 않는 이유를 glibc allocator·단편화 관점에서 진단하고 `malloc_trim` helper와 카나리 검증으로 운영 리스크를 줄였다. `task/ai-service-team/glibc-malloc-trim-python-leak.md`
8. **트랜잭션 이후 후처리 경계 이해** — 커밋 이후 이벤트 발행과 실패 기록 분리 패턴을 접했지만, 분산 트랜잭션/Kafka 운영을 핵심 강점으로 내세우지는 않는다. `resume/2603_김병태_이력서_v4.md` 문항1
9. **의사결정 문서화 습관** — task 문서 각 파일이 "배경 → 접근 → 트러블 → 배운 것" 구조로 일관 작성. 블로그/저장소 형태로 지속. `task/**`. 운영 서비스에는 plan 50여 건·ADR 40건을 저장소에 체계화. (사내 문서 파싱 서비스)
10. **장기 점진 리팩터링 실행력** — 테스트 불가 상태의 레거시 슬롯 코드베이스를 1년 반에 걸쳐 작은 PR 수십 개로 static 호출 제거·템플릿 메서드화(`SpinOperationHandler`)해 통합 테스트 가능 구조로 전환. "한 번에 갈아엎지 않는다" 원칙 일관 적용. `task/nsc-slot/slot-architecture-evolution.md`
11. **GoF 패턴을 실무 제약에 맞게 적용** — 슬롯 타입별 판정을 제네릭 체커 + Spring `List<Interface>` 자동 수집 Factory로 런타임 O(1) 디스패치(OCP), 당첨 계산은 우선순위 기반 Decorator+Strategy 체인으로 규칙 추가 시 기존 코드 미수정. `task/nsc-slot/slot-payment-factory.md`, `task/nsc-slot/slot-win-decorator-chain.md`
12. **비동기 병렬 실행 조율 + 백프레셔** — `CompletableFuture.allOf`로 N개 작업 병렬 조립, 전용 ThreadPool + `CallerRunsPolicy`로 백프레셔, 개별 실패 격리, taskId 반환 후 진행률 폴링. `task/nsc-slot/admin-asset-async-sync.md`
13. **상태 기계·멱등성 설계** — 추천/미션 보상 프로그램을 상태 머신(진행→달성→완료)으로 구현하고, 중복 지급 방지를 위해 멱등성 체크 + 비관적 락을 함께 적용. 스키마는 "미션 수 상한 고정" 정책을 기획에 확인한 뒤 확정. `task/sb-dev-team/referral-program.md`
14. **풀스택 단독 설계** — 13개 로케일 다국어 시스템을 프론트(Svelte)~백엔드 캐시까지 단독 설계, 응답 시점 계산을 캐시 빌드 시점으로 전환해 GC 압력 감소. `task/sb-dev-team/i18n-system.md`

---

## 약점 / 학습 중인 영역

> 거짓 약점 금지. 출처 문서·자가 진단(`CLAUDE.md`) · smoke test 결과에 근거.

1. **JPA N+1 · 페치 조인 · 벌크 연산 실전 질의응답** — 운영에서 사용은 하고 있으나 깊이 있는 추가 질문에 즉답할 수준으로 정리가 부족. 개선 중(career-os smoke test에서 식별).
2. **Redis 캐싱 패턴 폭** — Cache-Aside는 익숙. Write-Through / Write-Behind / Read-Through / 인증·세션 분리 / 분산 락(Redisson 등) / Hot Key 처리 실전 사례는 상대적으로 얕음. 특정 회사 사례보다 범용적인 대규모 백엔드 운영/설계 관점으로 학습한다.
3. **Kafka 운영 디테일** — Outbox 설계·운영 경험은 있으나, **파티셔닝 키 선택 / Consumer Group rebalance / Exactly-Once Semantics / Lag 모니터링** 같은 운영 이슈에서 깊이가 부족할 수 있음.
4. **Kubernetes 심화 튜닝** — Helm/ArgoCD 기반 GitOps 다단계(alpha/beta/real) 배포 환경과 Prometheus 모니터링은 실제 구축·운영했다(OCR 제품 배포 환경). 다만 HPA/PDB 등 세밀한 스케줄링·오토스케일 튜닝은 추가 학습 여지가 있다.
5. **대규모 트래픽 TPS 숫자** — 이력서·task 전반에서 **구체 TPS / 레이턴시 수치는 명시하지 않음**. 과장 답변 리스크가 있으므로 "측정 여부 / 측정 방법 / 체감 단위"로 답해야 함.
6. **대규모 실서비스 AI Agent 설계** — RAG·workflow·에이전트 자동화·품질 검증 경험은 있으나, 대규모 실서비스에서 multi-agent orchestration을 주도 설계한 이력은 아직 얕다. 실무형 AI Agent 설계가 핵심인 공고는 이 점을 보완 대상으로 둔다.

---

## 기술 의사결정 패턴

> 실제 에피소드 기반 trade-off 처리 방식.

1. **YAGNI vs 미래 확장성** — 슬롯 5종이 쌓인 뒤에야 `SlotTemplate`을 도입. "처음부터 추상화했으면 잘못된 경계를 그었을 것"을 명시적으로 판단. `task/nsc-slot/slot-engine-abstraction.md`
2. **보안 vs 성능** — `SecureRandom`의 암호학적 강도가 슬롯 서버 내부에서 불필요하다고 판단해 `ThreadLocalRandom`으로 전환. JMH 벤치마크로 58배 차이 근거. `task/nsc-slot/slot-spin-performance.md`
3. **복잡도 관리** — 14개 `remove` 호출 + DocumentType 분기가 누적되는 구조를 OCP 위반으로 진단 → **Blocklist → Allowlist** 전환으로 `EmbeddingService` 순수 위임 구조화. `task/ai-service-team/embedding-metadata-provider.md`
4. **동시성 선택** — 갱신 빈도 낮고 읽기 압도적 → `StampedLock` + `tryReadLock` 타임아웃 / 캐시 생성 충돌 빈도 낮음 → 낙관적 락 대신 DB 유니크 키 + 예외 처리 선택. `task/nsc-slot/slot-engine-abstraction.md`, `task/nsc-slot/rcc-rtp-cache-control.md`
5. **후처리 경계** — 커밋 이후 처리와 실패 기록 분리 패턴을 이해하되, 분산 트랜잭션 전문성으로 과장하지 않는다. `resume/2603_김병태_이력서_v4.md` 문항1
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
6. **지원동기·회사 선택 이유 보강**
   - 2차 면접 이후 받은 피드백은 기술적 자질은 충분하나 지원동기가 명확히 받아들여지지 않았다는 평가였다.
   - 다음 지원 루프에서는 회사 선택 이유, 도메인 관심, 커리어 전환 논리, 입사 후 기여 시나리오를 기술 역량과 같은 1급 점검 축으로 둔다.

---

## 제약 / 스코프

- **Kotlin은 갭이 아님** — SB 어드민 백엔드를 Kotlin·Spring Boot로 운영한 실무 경험이 있고, Java 경험자라 적응 부담이 낮다. Kotlin 요건 공고를 Java/Spring 공고와 동일 기준으로 평가한다.
- **폴리그롯 가정 금지** — 이력서·task에 기재 없는 언어/도구(예: Scala, Rust 본격 운영)는 pipeline에서 전제하지 않는다.
- **수치 날조 금지** — TPS, 팀 규모, 성과 %, 감축율 등이 이력서·task에 명시되지 않았으면 pipeline은 "출처 문서에 기재 없음"으로 응답해야 한다. 이력서 문항1의 "447개 테스트 파일", 본 문서 JMH 수치는 출처 확인됨.
- **실무 근거 범위** — 본 프로필은 `resume/2603_김병태_이력서_v4.md` + `task/**/*.md` + `interview/kakao-healthcare-carechat-ai-agent.md`를 1차 근거로 사용한다. 기타 이력서 버전(v1~v3, 2108/2512/2601)은 참조용.
- **회사 특화 타깃은 active primary에서만 주입** — `config/mvp-target.json`의 `primary`가 `null`이면 회사 특화 맥락을 기본값으로 쓰지 않는다.

---

## Source provenance

근거 파일 ↔ 섹션 매핑과 미래 업데이트 규칙은 별도 파일로 분리했다(프롬프트 주입 대상에서 제외).
→ `config/candidate-profile-provenance.md`
