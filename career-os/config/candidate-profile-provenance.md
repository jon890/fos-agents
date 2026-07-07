# Candidate Profile — Source Provenance

`config/candidate-profile.md`의 각 섹션이 어떤 근거 파일에서 나왔는지 추적하는 문서다.
추천·면접 skill의 판단에는 쓰이지 않으므로 프로필 본문(프롬프트 주입 대상)에서 분리해 여기 둔다.
프로필 갱신 시 어느 근거를 다시 봐야 하는지 확인하는 용도다.

## 기여 섹션 표

| 파일 | 기여 섹션 |
|------|-----------|
| `sources/fos-study/resume/2603_김병태_이력서_v4.md` | 지원 대상 / 커리어 타임라인 / 핵심 무기 1 / 주요 프로젝트(2·3) / 강점 1·2·9 / 협업 |
| `sources/fos-study/task/nsc-slot/README.md` | 커리어 타임라인 / 기술 스택 |
| `sources/fos-study/task/nsc-slot/slot-engine-abstraction.md` | 핵심 무기 1·5 / 주요 프로젝트(2) / 의사결정 패턴 1·4 / 기술 스택(StampedLock) |
| `sources/fos-study/task/nsc-slot/slot-spin-performance.md` | 주요 프로젝트(5) / 의사결정 패턴 2 / 기술 스택(AliasMethod·ThreadLocalRandom) |
| `sources/fos-study/task/nsc-slot/rcc-rtp-cache-control.md` | 주요 프로젝트(4) / 의사결정 패턴 4 / 기술 스택(MySQL·비동기 캐시·DB 유니크 키) |
| `sources/fos-study/task/nsc-slot/ai-tool-adoption.md` | 핵심 무기 4 / 주요 프로젝트(7) / 협업·리더십 |
| `sources/fos-study/task/nsc-slot/slot-simulator-oom.md` | 강점 5 |
| `sources/fos-study/task/nsc-slot/slot-simulator-jackpot-pool.md` | 기술 스택(AtomicReference) |
| `sources/fos-study/task/nsc-slot/slot-test-template.md` | 협업·리더십(테스트 인프라) |
| `sources/fos-study/task/ai-service-team/README.md` | 커리어 타임라인 / 기술 스택 |
| `sources/fos-study/task/ai-service-team/rag-vector-search-batch.md` | 핵심 무기 3 / 주요 프로젝트(1) / 의사결정 패턴 7 / 기술 스택(Spring Batch) |
| `sources/fos-study/task/ai-service-team/embedding-metadata-provider.md` | 핵심 무기 5 / 의사결정 패턴 3 / 강점 4 |
| `sources/fos-study/task/ai-service-team/graceful-shutdown-503-fix.md` | 핵심 무기 2 / 강점 6 / 의사결정 패턴 6 / 약점(K8s) |
| `sources/fos-study/task/ai-service-team/playground-document-parser.md` | 핵심 무기 2·3·5 / 커리어 타임라인 / 주요 프로젝트(9) / 강점 7 / 기술 스택(FastAPI·ProcessPoolExecutor·품질 검증) |
| `sources/fos-study/task/ai-service-team/glibc-malloc-trim-python-leak.md` | 핵심 무기 2 / 강점 8 / 기술 스택(Python 워커 메모리 진단) |
| `sources/fos-study/task/ai-service-team/webtoon-maker-ai-pipeline.md` | 핵심 무기 4 / 주요 프로젝트(8) |
| `sources/fos-study/task/sb-dev-team/README.md` | 커리어 타임라인 |
| `sources/fos-study/task/sb-dev-team/cache-architecture.md` | 주요 프로젝트(6) / 강점 1 / 기술 스택(Ehcache·MQ Fanout) |
| `sources/fos-study/task/the-future-company/README.md` | 커리어 타임라인 / 기술 스택(Redis Streams) |
| `sources/fos-study/interview/kakao-healthcare-carechat-ai-agent.md` | 지원 대상 / 케어챗 포지션 분석 / 면접 준비 우선순위 |
| `career-os/CLAUDE.md` | 면접 준비 우선순위 |
| (업무 코드베이스, git 검증·추상화) 사내 문서 파싱 서비스 | 핵심 무기 2 / 주요 프로젝트(1·9) / 강점 9 / 타임라인 |
| (업무 코드베이스, git 검증·추상화) 사내 RAG 벡터 색인 배치 | 주요 프로젝트(1) / 기술 스택(OpenSearch·Testcontainers) |
| (업무 코드베이스, git 검증·추상화) 사내 OCR/Document AI 제품 (추론 서비스·API·배포 환경) | 타임라인 / 기술 스택(WebFlux·MyBatis·gRPC/Envoy·K8s/Helm/ArgoCD) / 약점 4(K8s) |
| (업무 코드베이스, git 검증·추상화) SB 어드민 백엔드·정산 워커 | 기술 스택(Kotlin·SELECT FOR UPDATE) / 주요 프로젝트(10) / 약점 6·제약(Kotlin) |
| (업무 코드베이스, git 검증·추상화) 슬롯 플랫폼 | 강점 10·11·12 / 기술 스택(다중 DataSource·CompletableFuture·Flyway) |
| (개인 repo, npm 공개) `@bifos/dooray-cli`·`@bifos/nhncloud-cli` | 핵심 무기 2 / 개인 프로젝트 |
| (개인 repo) fos-accountbook | 개인 프로젝트(Spring Boot 4 풀스택) |

> 업무 코드베이스 근거는 회사 소스/IP 보호를 위해 git 이력·기술스택·역할 수준으로만 추상화했다. 내부 저장소 식별자·독점 알고리즘·고객사·정산/베팅 로직 상세는 기재하지 않는다.

## 미래 업데이트 규칙

- 이력서 v5가 나오면 "커리어 타임라인 / 주요 프로젝트 / 강점"을 우선 재생성한다.
- 신규 task 문서가 추가되면 "기술 스택 / 주요 프로젝트"를 재생성한다.
- CJ가 아닌 회사로 타깃 전환 시 "지원 대상 / 면접 준비 우선순위 7항"만 교체하면 중립성이 유지된다.
