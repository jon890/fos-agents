# Architecture Decision Records

ADR에는 현재 설계를 이해하는 데 필요한 기술적 선택과 기각한 대안만 남긴다.
파일 배치, 이름 변경, 완료 작업은 현재 구조 문서와 Git 이력에서 확인한다.

| ADR | 결정 | 상태 |
| --- | --- | --- |
| [ADR-013](ADR-013-외부-읽을거리는-전체-수집-후-모델이-선별한다.md) | 외부 읽을거리는 전체 수집 후 모델이 선별 | Accepted |
| [ADR-035](ADR-035-typescript-실행-코드는-책임별-모듈로-분리한다.md) | TypeScript 실행 코드를 책임별 모듈로 분리 | Accepted |
| [ADR-037](ADR-037-application-flow-agent-runtime은-policy-decision-engine-중심.md) | application agent를 정책 결정 엔진 중심으로 구성 | Accepted |
| [ADR-038](ADR-038-application-flow-agent-상태-전이는-skill-artifact-검증-뒤에만-수행.md) | 지원 상태 전이는 산출물 검증 뒤에만 수행 | Accepted |
| [ADR-039](ADR-039-position-recommender-추천-단위는-개별-active-open-공고.md) | 현재 열린 개별 공고만 추천 | Accepted |
| [ADR-040](ADR-040-application-flow-agent-native-skill-실행은-명시-옵션에서만-수행.md) | application agent의 native skill 실행은 명시적으로 선택 | Accepted |
| [ADR-042](ADR-042-reviewer-pass-판정은-사용자-검토-대기-상태로-전환한다.md) | reviewer 통과 뒤에도 사용자 검토 대기 | Accepted |
| [ADR-047](ADR-047-position-recommender-collector-adapter를-모듈-경계로-승격한다.md) | 공고 수집기를 소스 어댑터 경계로 분리 | Accepted |
| [ADR-052](ADR-052-지원-우선순위는-회사-순위가-아니라-action-stage로-관리한다.md) | 지원 우선순위를 다음 행동 단계로 관리 | Accepted |
| [ADR-056](ADR-056-resume-package는-markdown-산출물-계약을-먼저-고정한다.md) | 지원 패키지는 Markdown 계약을 먼저 고정 | Accepted |
| [ADR-058](ADR-058-data-cleanup은-private-boundary와-retention을-먼저-고정한다.md) | 데이터 정리 전에 비공개 경계와 보존 기준을 결정 | Accepted |
| [ADR-059](ADR-059-지원용-html-pdf-이력서-export.md) | 지원용 HTML·PDF 이력서를 로컬에서 생성 | Accepted |
| [ADR-066](ADR-066-공개-가능-일반-면접-질문-bank는-public-question-bank에-둔다.md) | 공개 질문과 개인 질문을 분리 | Accepted |
| [ADR-074](ADR-074-position-source-coverage는-official-adapter와-wanted-target-discovery를-함께-쓴다.md) | 공식 채용 어댑터와 Wanted 탐색을 함께 사용 | Accepted |
| [ADR-079](ADR-079-포지션-수집은-동적-discovery를-우선하고-개별-공고-url-seed를-제거한다.md) | 동적 공고 탐색을 우선하고 고정 URL seed를 제거 | Accepted |
| [ADR-092](ADR-092-면접-준비-flow-재편-진단-드릴-분리.md) | 역할 진단과 답변 드릴을 분리 | Accepted |
| [ADR-096](ADR-096-job-fit-analyzer-의사결정-전략-재정의.md) | 역할 적합도 분석을 지원 판단과 전략 중심으로 구성 | Accepted |
| [ADR-100](ADR-100-position-recommender-신규-후보-강제-회전-폐기.md) | 신규 공고의 강제 회전 규칙을 사용하지 않음 | Accepted |
| [ADR-101](ADR-101-position-recommender-추천-json을-기준-데이터로-사용한다.md) | 추천 JSON을 기준 데이터로 사용 | Accepted |
| [ADR-102](ADR-102-별도-웹-대시보드보다-파일-기반-피드백-루프를-사용한다.md) | 별도 웹 대시보드 대신 파일 기반 피드백 루프 사용 | Accepted |
| [ADR-103](ADR-103-지원-준비는-단일-사용자-진입점과-내부-검증으로-제공한다.md) | 지원 준비를 단일 사용자 진입점과 내부 검증으로 제공 | Accepted |
| [ADR-104](ADR-104-기술-사용과-운영-깊이를-분리해-검증한다.md) | 기술 사용과 운영 깊이를 분리해 검증 | Accepted |
