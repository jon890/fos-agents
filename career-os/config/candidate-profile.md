# 후보자 프로필

> 이 문서는 추천, 지원, 면접에서 공통으로 읽는 후보자 정보의 기준 원본입니다.
> 이 파일은 경력, 강점, 약점, 지원 방향을 간결하게 정리합니다.
> 프로젝트별 근거와 면접 준비 내용은 `config/candidate-profile-detail.md`에 둡니다.
> 면접 문서를 만드는 스킬은 두 파일을 함께 읽습니다.
> 사실관계는 `sources/fos-study/resume/2603_김병태_이력서_v4.md` 및 `sources/fos-study/task/**`에 근거합니다.
> 출처가 없는 수치·성과는 기재하지 않습니다.

---

## 지원 대상

- **현재 지원 대상**: 진행 중인 대상이 있으면 로컬 `state/current-target.json`에 기록한다.
  파일이 없으면 새 공고 탐색부터 시작한다.
- **지원 가능 분야**
  - **백엔드 중심 역할**: 운영형 자사 서비스 백엔드를 우선한다.
    점진적 구조 개선, 테스트 기반 리팩터링, 인공지능 활용 개발 생산성이 강점이다.
  - **인공지능 서비스·플랫폼 역할**: RAG 색인 파이프라인과 문서 파싱 서비스 구축·운영 경험을 활용한다.
    담당 범위는 **RAG의 앞단인 수집·정규화·벡터 색인**이다.
    검색 API 구현과 검색 품질 최적화는 담당하지 않았다.
    "RAG 시스템을 설계했다"로 넓히지 않는다 — 범위를 먼저 긋고 그 안에서 답하는 편이 방어에 유리하다.
  - **핵심 기술**
    - Spring Boot 3
    - Java 17·21
    - JPA
    - Redis
    - OpenSearch
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
   - 출력 회귀 검증과 정답지 채점을 나눠 안전한 품질 개선이 가능하게 했다. — `task/ai-service-team/playground-document-parser.md`
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
| 2025.12 ~ 현재 | NHN AI 서비스 개발팀 | Spring Boot 3 / Java 21 / Spring Batch / OpenSearch, Python/FastAPI 문서 파싱 운영.<br>· 사내 RAG **색인 계층** 담당 — 다중 소스 벡터 색인 배치(위키·업무·문서·음성 STT) 설계·구현, **AsyncItemProcessor** 입출력 병렬화, 전략 패턴 기반 메타데이터 제공자.<br>&nbsp;&nbsp;검색 API 구현과 검색 품질 최적화는 담당 범위가 아니었다.<br>· 문서 파싱 서비스 최다 기여자 — 품질 검증 체계, 워커 풀·메모리 운영 개선, 모듈 분해<br>· Next.js 기반 사내 AI 웹툰 제작 MVP 풀스택<br>· 보조로 NHN Cloud OCR 제품 API(Java 21 · Spring WebFlux)와 배포 환경(K8s/Helm/ArgoCD)에 기여 (`task/ai-service-team/`) |

- 총 개발 경력은 **약 7년차**로 본다. 별도 SI 개발 경험 약 3년이 있으며, 현재 이력/프로젝트 문서에 상세히 정리된 최근 경력은 위 표 기준이다.
- NHN 재직 자체는 4년차이지만, 경력기술서 기준 **"시니어 Java 백엔드 실무"는 2023.01부터 약 3년+** 축적.
- 포지션 추천 시 5년+ 공고는 현실권으로 보고, 7년+ 공고도 정규직이면 도전 가능 후보로 평가한다. 단, 계약직/임시직/프리랜서는 제외한다.
- 출처: `sources/fos-study/resume/2603_김병태_이력서_v4.md` 문항1, 각 팀 `README.md`, 사용자 직접 정정(2026-05-08: SI 개발 경험 약 3년 포함 총 7년차).

---

## 보유 기술 요약

숙련도는 **실전 운영**, **설계 경험**, **사용 경험**으로 구분한다.
구체적인 수행 내용과 근거 경로는 상세 프로필의 "보유 기술 근거"를 따른다.

### 언어와 실행 환경
- **Java 17 · Java 21** (실전 운영, 4년+)
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

### 메시징과 이벤트
- **Apache Kafka** (사용·패턴 이해) — 운영·튜닝을 핵심 강점으로 내세우지 않는다.
- **RabbitMQ Fanout** (사용 경험) — 캐시 갱신 전파 맥락. 본인 강점은 캐시 리로드·읽기 보호.

### 데이터와 저장소
- **MySQL 8.x** (실전 운영)
- **Redis** (실전 운영 + 설계)
- **OpenSearch** (실전 운영 + 설계)
- **Prisma / PostgreSQL** (사용 경험)
- **Flyway** (사용 경험)

### 동시성과 성능
- **StampedLock** (실전 운영)
- **ReentrantReadWriteLock** (실전 운영)
- **AliasMethod (O(1) 가중치 랜덤)** (설계 경험)
- **AtomicReference / Welford's Online Algorithm** (실전) — ThreadLocal 공유 버그·시뮬레이터 OOM 해결.
- **SELECT FOR UPDATE 행 선점** (실전 운영)

### 인프라와 운영
- **NHN Cloud** (실전 운영)
- **NHN Cloud Container Service** (실전 운영, 제약 경험)
- **Envoy / gRPC / supervisord** (실전 운영)
- **FastAPI / ProcessPoolExecutor / GPU 워커 풀** (운영 개선 경험)
- **Kubernetes / Helm / ArgoCD (GitOps) + Prometheus** (실전 운영) — HPA/PDB 심화 튜닝은 학습 여지.
- **Docker** (사용 경험)
- **Jenkins** (사용 경험)
- **출력 품질 검증 / golden set / NED / 표 셀 F1** (설계 경험)

### 테스트
- 제네릭 기반 추상 테스트 클래스 설계, **447개 테스트 파일** 운영(이력서 기재).

---

## 근거로 확인된 강점

> 추상어 금지. 실제 에피소드 기반. 각 항목 뒤에 증거 파일 경로.

1. **슬롯 도메인 점진 아키텍처 개선** — 슬롯 5종 이상을 직접 만들며 반복 패턴을 확인한 뒤 `SlotTemplate`, `BaseSlotService`, `ExtraConfig` 분리로 구조를 개선했다. `task/nsc-slot/slot-engine-abstraction.md`
2. **AI 활용 개발 생산성 인프라 구축** — Cursor Rules 20종 이상, 에이전트 단독 슬롯 구현 3종, `by agent` 커밋 태깅으로 AI 작업 범위를 분리 추적했다. `resume/2603_김병태_이력서_v4.md` 문항2·4, `task/nsc-slot/ai-tool-adoption.md`
3. **검증 가능한 처리 흐름 설계** — Spring Batch 11단계 RAG 색인과 문서 파싱 품질 검증으로 실패 격리와 회귀 차단을 함께 설계했다. `task/ai-service-team/rag-vector-search-batch.md`, `task/ai-service-team/playground-document-parser.md`
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
6. **대규모 인공지능 에이전트 설계** — RAG, 작업 흐름 자동화, 품질 검증 경험은 있다.
   다만 대규모 서비스에서 여러 에이전트의 실행 흐름을 주도적으로 설계한 이력은 아직 얕다.
   이 역량이 핵심인 공고는 보완 대상으로 둔다.
7. **LLM routing·공용 Agent 플랫폼 설계** — 모델·도구 선택 routing, MCP Gateway, long-term memory, 여러 팀이 쓰는 agent platform의 경계·운영 모델을 설계한 실무 노하우는 아직 없다. 이 역량이 핵심인 공고는 RAG 또는 개발 자동화 경험만으로 높게 추천하지 않고 보류로 둔다.
8. **데이터 엔지니어링·ML 데이터 플랫폼 운영** — Spring Batch 기반 RAG 색인과 문서 데이터 파이프라인 경험은 있지만, 대규모 로그·ETL 플랫폼, Spark·Kafka Connect·Airflow, 데이터 레이크·웨어하우스를 주도 운영한 근거는 없다. 이 역량을 필수조건으로 둔 AI Data Pipeline·Data Engineering 역할은 보류하고, 크래프톤 같은 회사도 백엔드 또는 AI 제품·플랫폼 역할을 우선 탐색한다.
9. **RAG 검색 품질** — 색인 계층은 담당했지만 검색 API를 구현한 적이 없다.
   청킹 크기와 중첩 조정, 재정렬, 혼합 검색, 재현율 측정 경험도 없다.
   색인 결정을 검색 품질 기준으로 내린 사례는 있다(구조 보존을 위한 ADF→Markdown 변환, 내용 혼입을 막기 위한 ZIP 엔트리 분리). 판단 근거는 있으나 측정은 하지 않았다.
   검색 품질 최적화가 핵심인 공고는 보류한다.

---

## 제약 / 스코프

- **Kotlin은 갭이 아님** — SB 어드민 백엔드를 Kotlin·Spring Boot로 운영한 실무 경험이 있고, Java 경험자라 적응 부담이 낮다. Kotlin 요건 공고를 Java/Spring 공고와 동일 기준으로 평가한다.
- **폴리그롯 가정 금지** — 이력서·task에 기재 없는 언어/도구(예: Scala, Rust 본격 운영)는 pipeline에서 전제하지 않는다.
- **수치 날조 금지** — 처리량, 팀 규모, 성과, 감축률 등이 근거 문서에 없으면 "출처 문서에 기재 없음"으로 표시한다.
  이력서의 "447개 테스트 파일"과 상세 프로필의 JMH 수치는 근거가 확인됐다.
- **실무 근거 범위** — 본 프로필은 `resume/2603_김병태_이력서_v4.md` + `task/**/*.md` + `interview/kakao-healthcare-carechat-ai-agent.md`를 1차 근거로 사용한다. 기타 이력서 버전(v1~v3, 2108/2512/2601)은 참조용.
- **회사별 정보는 진행 중인 지원 대상에만 적용** — `state/current-target.json`이 없거나 `primary`가 없으면 회사별 맥락을 기본값으로 쓰지 않는다.
- **회사 규모 선호** — 다음 이직에서는 토스·쿠팡·네이버처럼 브랜드, 엔지니어링 조직 규모, 대규모 서비스 운영 밀도가 검증된 회사를 우선한다. 작은 AI 스타트업은 개별 역할이 이 기준을 명확히 상쇄할 때만 검토한다.
- **AI 협업 경계 (면접 방어 범위)** — 2026년부터 개발 대부분을 AI 에이전트 협업으로 수행한다. 2025년까지의 작업은 본인이 직접 작성했다.
  - 2022~2025년 작업(거래소 체결 엔진, 캐시 아키텍처, 슬롯 엔진 추상화, 동시성, 점진 리팩터링)은 코드 세부까지 방어 가능하다.
  - 2026년 작업(색인 배치, 웹툰 MVP, 문서 파싱 서비스, OCR 진입점 이전)은 설계 판단이 본인 것이고 코드 세부는 에이전트 비중이 크다.
- **공고 채점 규칙** — 공고의 "담당 업무"를 "자격 요건"처럼 채점하지 않는다.
  담당 업무는 그 팀이 앞으로 만들 것의 목록이고, 특히 신설 팀은 팀 내부에도 경험자가 없다.
  적합도는 명시된 지원 자격과 우대 사항으로 판정하고, 담당 업무는 면접 대비 범위로만 쓴다.

---

## 관련 파일

- 프로젝트별 근거와 면접 준비 내용: `config/candidate-profile-detail.md`
- 각 사실의 근거는 본문과 상세 프로필에 직접 연결된 `sources/fos-study/` 경로를 따른다.
