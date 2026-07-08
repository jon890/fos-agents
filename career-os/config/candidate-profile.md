# Candidate Profile

> 이 문서는 career-os 파이프라인(study-pack / question-bank / interview-master)에서 Claude 프롬프트의 candidate context로 주입되는 단일 출처입니다.
> 이 파일(core)은 추천·fit 판단용 사실·라벨을 담습니다.
> 프로젝트 서사·의사결정 패턴·협업 스타일·면접 준비 우선순위·기술 스택 증거 상세는 `config/candidate-profile-detail.md`(detail)로 분리했습니다.
> 면접 서사 skill(application-package-writer, application-reviewer, interview-asset-writer, interview-stage-prep)은 core와 detail을 함께 읽습니다.
> 사실관계는 `sources/fos-study/resume/2603_김병태_이력서_v4.md` 및 `sources/fos-study/task/**`에 근거합니다.
> 출처가 없는 수치·성과는 기재하지 않습니다.

---

## 지원 대상

- **현재 타깃**: active target이 없을 수 있다.
  회사·팀·면접 일자·포지션 핵심은 `career-os/state/mvp-target.json`이 단일 출처이며, `primary: null`이면 새 공고 탐색부터 시작한다.
- **지원 가능 범위 (재사용 가능 포지셔닝)** — 두 레인으로 지원한다.
  - **백엔드 코어 레인**: 운영형 자사 서비스 백엔드. 슬롯 도메인 점진 아키텍처 개선, 테스트/검증 기반 리팩터링, AI 활용 개발 생산성이 강점이다.
  - **AI 서비스·AI 플랫폼 전환 레인**: RAG 색인, 문서 파싱 운영, 품질 검증 인프라, 에이전트 기반 개발 생산성을 차별화 자산으로 쓴다.
  - **핵심 스택**: Spring Boot 3 / Java 17·21 / JPA / Redis / OpenSearch.
- **포지셔닝 한 줄**: "백엔드 코어(정합성·동시성·점진 아키텍처) 위에 AI를 제품·개발 생산성으로 접목해 온 백엔드 개발자." — AI 전문가도, 순수 백엔드도 아닌 **백엔드 코어에 AI를 접목하는 사람**이 일관된 정체성이다.
- **커리어 서사 원칙**: 백엔드가 뿌리, AI는 그 위의 확장이다. 이 서사가 "AI만 좇는다"·"AI 하다 왜 다시 백엔드로" 양쪽 오해를 모두 막는다. 그래서 백엔드/플랫폼 기반이 분명한 회사의 AI 접목 역할을 우선한다.

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

## 보유 기술 스택 (라벨 중심)

라벨: **실전 운영**(운영 환경 트래픽을 받음) / **설계 경험**(새로 설계·도입) / **사용 경험**(기능 단위로 사용).
각 항목의 여러 줄 서술과 증거 경로는 detail의 "보유 기술 스택 (증거 상세)"를 따른다.

### 언어 / 런타임
- **Java 17 · Java 21** (실전 운영, 4년+)
- **Kotlin** (실전 운영) — SB 어드민 백엔드. Java 경험 기반이라 갭으로 보지 않는다.
- **TypeScript / Node.js (NestJS)** (실전 운영, 2022~2024 일부)
- **Python** (운영 개선 경험) — 문서 파싱 서비스 워커·운영 진단. 주력 제품 서버 언어 근거는 제한적.

### 프레임워크
- **Spring Boot 3.x** (실전 운영, 2024~)
- **Spring Boot 2.6** (실전 운영, 2023~2024)
- **Spring WebFlux (Reactive)** (실전 운영) — OCR 제품 API (Java 21 virtual threads).
- **MyBatis** (사용 경험)
- **Spring Batch** (설계 경험, 2026.01~)
- **JPA / Hibernate** (실전 운영)
- **QueryDSL** (실전 운영)
- **Project Reactor** (사용 경험)

### 메시징 / 이벤트
- **Apache Kafka** (사용·패턴 이해) — 운영·튜닝을 핵심 강점으로 내세우지 않는다.
- **RabbitMQ Fanout** (사용 경험) — 캐시 갱신 전파 맥락. 본인 강점은 캐시 리로드·읽기 보호.
- **TCP/UDP·저수준 네트워크 프로토콜** (제한적) — 직접 설계·운영 근거 제한적, 필수 공고는 우선순위 낮춤.

### 데이터 / 스토리지
- **MySQL 8.x** (실전 운영)
- **Redis** (실전 운영 + 설계)
- **OpenSearch** (실전 운영 + 설계)
- **Ehcache (JSR-107)** (실전 운영)
- **Prisma / PostgreSQL** (사용 경험)
- **Azure Blob Storage** (사용 경험)
- **DB 샤딩** (실전 운영)
- **다중 DataSource** (실전 운영)
- **Flyway** (사용 경험)

### 동시성 / 성능
- **StampedLock** (실전 운영)
- **ReentrantReadWriteLock** (실전 운영)
- **AliasMethod (O(1) 가중치 랜덤)** (설계 경험)
- **ThreadLocalRandom vs SecureRandom** (JMH 기반 결정)
- **AtomicReference / Welford's Online Algorithm** (실전) — ThreadLocal 공유 버그·시뮬레이터 OOM 해결.
- **CompletableFuture 병렬 조율 + ThreadPool 튜닝** (실전 운영)
- **SELECT FOR UPDATE 행 선점** (실전 운영)

### 인프라 / 운영
- **NHN Cloud** (실전 운영)
- **Azure** (개발 경험, 운영 제한)
- **NHN Cloud Container Service** (실전 운영, 제약 경험)
- **Envoy / gRPC / supervisord** (실전 운영)
- **FastAPI / ProcessPoolExecutor / GPU 워커 풀** (운영 개선 경험)
- **Kubernetes / Helm / ArgoCD (GitOps) + Prometheus** (실전 운영) — HPA/PDB 심화 튜닝은 학습 여지.
- **Docker** (사용 경험)
- **Jenkins** (사용 경험)
- **Testcontainers / JUnit 5 / MockRestServiceServer / spring-batch-test** (실전 운영)
- **출력 품질 검증 / golden set / NED / 표 셀 F1** (설계 경험)

### 테스트
- 제네릭 기반 추상 테스트 클래스 설계, **447개 테스트 파일** 운영(이력서 기재).

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

## 제약 / 스코프

- **Kotlin은 갭이 아님** — SB 어드민 백엔드를 Kotlin·Spring Boot로 운영한 실무 경험이 있고, Java 경험자라 적응 부담이 낮다. Kotlin 요건 공고를 Java/Spring 공고와 동일 기준으로 평가한다.
- **폴리그롯 가정 금지** — 이력서·task에 기재 없는 언어/도구(예: Scala, Rust 본격 운영)는 pipeline에서 전제하지 않는다.
- **수치 날조 금지** — TPS, 팀 규모, 성과 %, 감축율 등이 이력서·task에 명시되지 않았으면 pipeline은 "출처 문서에 기재 없음"으로 응답해야 한다. 이력서 문항1의 "447개 테스트 파일", detail 문서 JMH 수치는 출처 확인됨.
- **실무 근거 범위** — 본 프로필은 `resume/2603_김병태_이력서_v4.md` + `task/**/*.md` + `interview/kakao-healthcare-carechat-ai-agent.md`를 1차 근거로 사용한다. 기타 이력서 버전(v1~v3, 2108/2512/2601)은 참조용.
- **회사 특화 타깃은 active primary에서만 주입** — `state/mvp-target.json`의 `primary`가 `null`이면 회사 특화 맥락을 기본값으로 쓰지 않는다.

---

## 관련 파일

- 면접 서사·심화(프로젝트 서사·의사결정 패턴·협업 스타일·면접 준비 우선순위·기술 스택 증거 상세): `config/candidate-profile-detail.md`
- 근거 파일 ↔ 섹션 매핑과 미래 업데이트 규칙(프롬프트 주입 대상에서 제외): `config/candidate-profile-provenance.md`
