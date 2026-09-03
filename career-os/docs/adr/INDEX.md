# Architecture Decision Records

ADR에는 현재 설계를 이해하는 데 필요한 기술적 선택과 기각한 대안만 남긴다.
파일 배치, 이름 변경, 완료 작업은 현재 구조 문서와 Git 이력에서 확인한다.

| ADR | 결정 | 상태 |
| --- | --- | --- |
| ADR-013 | [외부 읽을거리는 전체 수집 후 모델이 선별](ADR-013-외부-읽을거리는-전체-수집-후-모델이-선별한다.md) | Accepted |
| ADR-035 | [TypeScript 실행 코드를 책임별 모듈로 분리](ADR-035-typescript-실행-코드는-책임별-모듈로-분리한다.md) | Accepted |
| ADR-039 | [현재 열린 개별 공고만 추천](ADR-039-position-recommender-추천-단위는-개별-active-open-공고.md) | Accepted |
| ADR-047 | [공고 수집기를 소스 어댑터 경계로 분리](ADR-047-position-recommender-collector-adapter를-모듈-경계로-승격한다.md) | Accepted |
| ADR-056 | [지원 패키지는 Markdown 계약을 먼저 고정](ADR-056-resume-package는-markdown-산출물-계약을-먼저-고정한다.md) | Accepted |
| ADR-058 | [데이터 정리 전에 비공개 경계와 보존 기준을 결정](ADR-058-data-cleanup은-private-boundary와-retention을-먼저-고정한다.md) | Accepted |
| ADR-059 | [지원용 HTML·PDF 이력서를 로컬에서 생성](ADR-059-지원용-html-pdf-이력서-export.md) | Accepted |
| ADR-066 | [공개 질문과 개인 질문을 분리](ADR-066-공개-가능-일반-면접-질문-bank는-public-question-bank에-둔다.md) | Accepted |
| ADR-074 | [공식 채용 어댑터와 Wanted 탐색을 함께 사용](ADR-074-position-source-coverage는-official-adapter와-wanted-target-discovery를-함께-쓴다.md) | Accepted |
| ADR-079 | [동적 공고 탐색을 우선하고 고정 URL seed를 제거](ADR-079-포지션-수집은-동적-discovery를-우선하고-개별-공고-url-seed를-제거한다.md) | Accepted |
| ADR-100 | [신규 공고의 강제 회전 규칙을 사용하지 않음](ADR-100-position-recommender-신규-후보-강제-회전-폐기.md) | Accepted |
| ADR-101 | [추천 JSON을 기준 데이터로 사용](ADR-101-position-recommender-추천-json을-기준-데이터로-사용한다.md) | Accepted |
| ADR-102 | [별도 웹 대시보드 대신 파일 기반 피드백 루프 사용](ADR-102-별도-웹-대시보드보다-파일-기반-피드백-루프를-사용한다.md) | Accepted |
| ADR-103 | [지원 준비를 단일 사용자 진입점과 내부 검증으로 제공](ADR-103-지원-준비는-단일-사용자-진입점과-내부-검증으로-제공한다.md) | Accepted |
| ADR-104 | [기술 사용과 운영 깊이를 분리해 검증](ADR-104-기술-사용과-운영-깊이를-분리해-검증한다.md) | Accepted |
| ADR-105 | [이력서는 블라인드 검토자 전원이 통과해야 함](ADR-105-이력서는-블라인드-검토자-전원이-통과해야-한다.md) | Accepted |
| ADR-106 | [면접 질문은 다양한 출처에서 발견하고 공식 원문으로 검증](ADR-106-면접-질문은-다양한-출처에서-발견하고-공식-원문으로-검증한다.md) | Accepted |
| ADR-107 | [비공개 커리어 산출물은 홈서버 파일 release로 동기화](ADR-107-비공개-커리어-산출물은-홈서버-파일-release로-동기화한다.md) | Accepted |
| ADR-108 | [비공개 작업 release는 범용 S3 collection에 보관](ADR-108-비공개-작업-release는-범용-s3-collection에-보관한다.md) | Accepted |
