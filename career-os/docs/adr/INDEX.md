# Architecture Decision Records

ADR에는 현재 설계를 이해하는 데 필요한 기술적 선택과 기각한 대안만 남긴다.
파일 배치, 이름 변경, 완료 작업은 현재 구조 문서와 Git 이력에서 확인한다.

| ADR | 결정 | 상태 |
| --- | --- | --- |
| ADR-013 | [외부 읽을거리는 전체 수집 후 모델이 선별](ADR-013-외부-읽을거리는-전체-수집-후-모델이-선별한다.md) | Accepted. 전체 후보 조항은 ADR-127이 대체 |
| ADR-035 | [TypeScript 실행 코드를 책임별 모듈로 분리](ADR-035-typescript-실행-코드는-책임별-모듈로-분리한다.md) | Accepted |
| ADR-039 | [현재 열린 개별 공고만 추천](ADR-039-position-recommender-추천-단위는-개별-active-open-공고.md) | Accepted |
| ADR-047 | [공고 수집기를 소스 어댑터 경계로 분리](ADR-047-position-recommender-collector-adapter를-모듈-경계로-승격한다.md) | Accepted |
| ADR-058 | [데이터 정리 전에 비공개 경계와 보존 기준을 결정](ADR-058-data-cleanup은-private-boundary와-retention을-먼저-고정한다.md) | Accepted |
| ADR-059 | [지원용 HTML·PDF 이력서를 로컬에서 생성](ADR-059-지원용-html-pdf-이력서-export.md) | Accepted |
| ADR-066 | [공개 질문과 개인 질문을 분리](ADR-066-공개-가능-일반-면접-질문-bank는-public-question-bank에-둔다.md) | Accepted |
| ADR-074 | [공식 채용 어댑터와 Wanted 탐색을 함께 사용](ADR-074-position-source-coverage는-official-adapter와-wanted-target-discovery를-함께-쓴다.md) | Accepted |
| ADR-079 | [동적 공고 탐색을 우선하고 고정 URL seed를 제거](ADR-079-포지션-수집은-동적-discovery를-우선하고-개별-공고-url-seed를-제거한다.md) | Accepted |
| ADR-100 | [신규 공고의 강제 회전 규칙을 사용하지 않음](ADR-100-position-recommender-신규-후보-강제-회전-폐기.md) | Accepted |
| ADR-101 | [추천 JSON을 기준 데이터로 사용](ADR-101-position-recommender-추천-json을-기준-데이터로-사용한다.md) | Accepted |
| ADR-102 | [별도 웹 대시보드 대신 파일 기반 피드백 루프 사용](ADR-102-별도-웹-대시보드보다-파일-기반-피드백-루프를-사용한다.md) | Accepted. 면접 연습 기록과 개인 질문 조항은 ADR-129가 대체 |
| ADR-103 | [지원 준비를 단일 사용자 진입점과 내부 검증으로 제공](ADR-103-지원-준비는-단일-사용자-진입점과-내부-검증으로-제공한다.md) | Accepted. 공통 프로필 스냅샷의 출처 조항은 ADR-136이 대체 |
| ADR-104 | [기술 사용과 운영 깊이를 분리해 검증](ADR-104-기술-사용과-운영-깊이를-분리해-검증한다.md) | Accepted |
| ADR-105 | [이력서는 블라인드 검토자 전원이 통과해야 함](ADR-105-이력서는-블라인드-검토자-전원이-통과해야-한다.md) | Accepted |
| ADR-106 | [면접 질문은 다양한 출처에서 발견하고 공식 원문으로 검증](ADR-106-면접-질문은-다양한-출처에서-발견하고-공식-원문으로-검증한다.md) | Accepted |
| ADR-107 | [비공개 커리어 산출물은 홈서버 파일 release로 동기화](ADR-107-비공개-커리어-산출물은-홈서버-파일-release로-동기화한다.md) | Superseded |
| ADR-108 | [비공개 작업 release는 범용 S3 collection에 보관](ADR-108-비공개-작업-release는-범용-s3-collection에-보관한다.md) | Accepted. ADR-148이 대체 |
| ADR-109 | [지원 산출물을 역할별 디렉터리로 나누고 검토 화면을 탭으로 제공](ADR-109-지원-산출물을-역할별-디렉터리로-나눈다.md) | Accepted |
| ADR-110 | [지원 적합도를 가중 점수로 판정하고 스킬 목표를 그 판정에 맞춤](ADR-110-지원-적합도를-가중-점수로-판정한다.md) | Accepted |
| ADR-111 | [학습자료와 추천 상태는 블로그 API로 관리](ADR-111-학습자료와-추천-상태는-블로그-api로-관리한다.md) | Superseded by ADR-118 |
| ADR-112 | [현재 직장 대비 업사이드를 축별로 판정](ADR-112-현재-직장-대비-업사이드를-축별로-판정한다.md) | Superseded by ADR-115 |
| ADR-113 | [수집 실행은 실패 소스 개수로 성패를 판정](ADR-113-수집-실행은-실패-소스-개수로-성패를-판정한다.md) | Accepted |
| ADR-114 | [개인 공고 제외 정책을 비공개 release로 전송](ADR-114-개인-공고-제외-정책을-비공개-release로-전송한다.md) | Superseded by ADR-123 |
| ADR-115 | [회사 조사 사실은 유효기간과 함께 재사용](ADR-115-회사-조사-사실은-유효기간과-함께-재사용한다.md) | Superseded by ADR-123 |
| ADR-116 | [검증한 주장은 근거 해시와 함께 state에서 재사용](ADR-116-검증한-주장은-근거-해시와-함께-state에서-재사용한다.md) | Accepted |
| ADR-117 | [포지션 분석은 우선순위 큐와 버전 이력으로 재사용](ADR-117-포지션-분석은-우선순위-큐와-버전-이력으로-재사용한다.md) | Superseded by ADR-118 |
| ADR-118 | [추천 상태는 career-os API와 MySQL로 관리](ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md) | Accepted. 스택 조항은 ADR-121이 대체. 공고·공부의 저장 자리는 ADR-146이 대체 |
| ADR-119 | [분석 실행의 처리 결과와 분석의 생성 출처를 분리해 저장](ADR-119-분석-실행의-처리-결과와-분석의-생성-출처를-분리해-저장한다.md) | Accepted |
| ADR-120 | [회사 tier는 사람 override와 모델 평가를 분리해 저장](ADR-120-회사-tier는-사람-override와-모델-평가를-분리해-저장한다.md) | Accepted |
| ADR-121 | [추천 Backend는 NestJS와 Prisma로 운영](ADR-121-추천-backend는-nestjs와-prisma로-운영한다.md) | Accepted. 공고·공부의 저장 자리는 ADR-146이 대체 |
| ADR-122 | [추천 상태는 질의 단위로 읽고 씀](ADR-122-추천-상태는-질의-단위로-읽고-쓴다.md) | Accepted |
| ADR-123 | [회사 근거와 개인 제외 정책은 Backend가 소유](ADR-123-회사-근거와-개인-제외-정책은-backend가-소유한다.md) | Accepted |
| ADR-124 | [판정 스키마는 모르는 상태를 표현](ADR-124-판정-스키마는-모르는-상태를-표현한다.md) | Accepted |
| ADR-125 | [회사 판정은 세 축을 각각 냄](ADR-125-회사-판정은-세-축을-각각-낸다.md) | Accepted |
| ADR-126 | [읽을거리 소스 목록은 Backend가 원본을 가짐](ADR-126-읽을거리-소스-목록은-backend가-원본을-가진다.md) | Accepted |
| ADR-127 | [공부 추천은 고르지 않은 후보의 판정을 재사용](ADR-127-공부-추천은-고르지-않은-후보의-판정을-재사용한다.md) | Accepted |
| ADR-128 | [커리어 Backend로 이름을 넓힘](ADR-128-커리어-backend로-이름을-넓힌다.md) | Accepted |
| ADR-129 | [면접 연습 기록과 개인 질문은 저장소 경계 뒤에 두고 운영은 Backend가 소유](ADR-129-면접-연습-기록과-개인-질문은-backend가-소유한다.md) | Accepted. 면접 기록의 저장 자리는 ADR-146, 저장소 경계는 ADR-147이 대체 |
| ADR-130 | [면접 연습의 후보자 맥락은 memory 공급자 경계로 읽음](ADR-130-면접-연습의-후보자-맥락은-memory-공급자-경계로-읽는다.md) | Accepted. `backend` 공급자는 ADR-147이 대체 |
| ADR-131 | [후보자 맥락은 Backend 문서로 두고 공부 추천 기준 버전을 문서 버전에서 계산](ADR-131-후보자-맥락은-backend-문서로-두고-공부-추천-기준-버전을-문서-버전에서-계산한다.md) | Accepted. 공부 추천 기준 버전 계산은 ADR-146이 대체. 문서의 자리는 ADR-147이 대체 |
| ADR-132 | [스킬의 개인 맥락은 후보자 맥락 문서에서 읽고 지원서 공통 프로필만 brain에 둠](ADR-132-스킬의-개인-맥락은-후보자-맥락-문서에서-읽고-지원서-공통-프로필만-brain에-둔다.md) | Accepted. 분석 정책 맞추기 조항은 ADR-134가, 공통 프로필을 brain에 두는 조항은 ADR-136이 대체 |
| ADR-133 | [프로필 원고와 에이전트 사용량 기록은 Backend 의 profile 모듈이 가짐](ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md) | Accepted. 프로필 원고의 자리는 ADR-147이, 사용량 기록의 자리는 ADR-148이 대체 |
| ADR-134 | [공고 분석의 기준 버전은 position-preferences 문서 버전에서 계산](ADR-134-공고-분석의-기준-버전은-position-preferences-문서-버전에서-계산한다.md) | Accepted. 기준 버전 계산은 ADR-146이 대체 |
| ADR-135 | [fos-assistant 커넥터는 Backend 를 감싸고 숫자는 기록에서 직접 읽음](ADR-135-fos-assistant-커넥터는-backend를-감싸고-숫자는-기록에서-직접-읽는다.md) | Accepted. Backend 를 감싸는 것과 차트·배지 조항은 ADR-147이 대체 |
| ADR-136 | [지원서 공통 프로필은 fos-assistant Memory 에서 서비스 토큰으로 읽음](ADR-136-지원서-공통-프로필은-fos-assistant-memory에서-서비스-토큰으로-읽는다.md) | Accepted. 서비스 토큰으로 읽는 조항은 ADR-148이 대체 |
| ADR-137 | [스킬과 MCP 를 plugin 하나로 묶고 세 단계로 옮김](ADR-137-스킬과-mcp를-plugin-하나로-묶고-세-단계로-옮긴다.md) | Accepted. 브라우저 조작 조항은 ADR-145가 개정. MCP 서버의 데이터 접근과 실행기 저장소 조항은 ADR-147이 대체 |
| ADR-138 | [plugin 로컬 실행기는 scripts 원본을 번들해 부르고 작업본 위치는 설정으로 받음](ADR-138-plugin-로컬-실행기는-scripts-원본을-번들해-부르고-작업본-위치는-설정으로-받는다.md) | Accepted. 공고·공부 실행기의 실행 폴더와 저장 자리는 ADR-146이, 작업본 위치의 기본값과 동기화 설정은 ADR-148이 대체 |
| ADR-139 | [plugin 의 대화용 스킬과 Claude Code 전용 스킬을 디렉터리로 나눔](ADR-139-plugin-의-대화용-스킬과-claude-code-전용-스킬을-디렉터리로-나눈다.md) | Accepted. ADR-147이 대체 |
| ADR-140 | [노트북 client 는 선택적 Cloudflare Access service token 머리말을 앱 인증과 함께 보냄](ADR-140-노트북-client-는-선택적-cloudflare-access-service-token-머리말을-앱-인증과-함께-보낸다.md) | Accepted |
| ADR-141 | [일반 에이전트가 읽는 스킬은 plugin 의 agent-skills 에 두고 따로 올림](ADR-141-일반-에이전트가-읽는-스킬은-plugin-의-agent-skills-에-두고-따로-올린다.md) | Accepted. 2026-11-05 개정으로 스킬을 지움. 2026-11-20 개정으로 manifest `agent_skills` 와 실행기 스킬 사본을 둠. 사본 조항은 ADR-148이 대체 |
| ADR-142 | [먼저 살펴보기의 공고 제외 판정은 수집기와 같은 코드가 하고 식별 불가는 보류함](ADR-142-먼저-살펴보기의-공고-제외-판정은-수집기와-같은-코드가-하고-식별-불가는-보류한다.md) | Accepted. 제외 규칙의 저장 자리는 ADR-146이 대체. 판정을 MCP 도구가 하는 조항은 ADR-147이 대체 |
| ADR-143 | [Claude Code 의 fos-career MCP 서버는 선택적 Cloudflare Access 머리말을 보냄](ADR-143-claude-code-의-fos-career-mcp-서버는-선택적-cloudflare-access-머리말을-보낸다.md) | Accepted. 변수 선언 위치 조항은 ADR-144가 대체. ADR-147이 대체 |
| ADR-144 | [Claude Code 전용 Access 값은 커넥터 선언에 두지 않고 실행 환경에서 받음](ADR-144-claude-code-전용-access-값은-커넥터-선언에-두지-않고-실행-환경에서-받는다.md) | Accepted. ADR-147이 대체 |
| ADR-145 | [비서 웹의 프로필 사이트 반영은 MCP 서버가 「내 브라우저」 중계로 함](ADR-145-비서-웹의-프로필-사이트-반영은-mcp-서버가-내-브라우저-중계로-한다.md) | Accepted |
| ADR-146 | [커리어 표 데이터는 에이전트 작업 폴더의 SQLite 가 가짐](ADR-146-커리어-표-데이터는-에이전트-작업-폴더의-sqlite-가-갖는다.md) | Accepted |
| ADR-147 | [후보자 맥락 문서는 비서의 기억이, 프로필 원고는 작업 폴더 파일이 갖고 MCP 서버는 밖의 사이트에 닿는 도구만 가짐](ADR-147-후보자-맥락-문서는-비서의-기억이-프로필-원고는-작업-폴더-파일이-갖는다.md) | Accepted |
| ADR-148 | [지원 준비는 비서의 셸 실행 공간에서 하고 작업본 동기화와 노트북 전용 스킬을 두지 않음](ADR-148-지원-준비는-비서의-셸-실행-공간에서-하고-작업본-동기화와-노트북-전용-스킬을-두지-않는다.md) | Accepted |
