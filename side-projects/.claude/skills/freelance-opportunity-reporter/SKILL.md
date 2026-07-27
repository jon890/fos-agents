---
name: freelance-opportunity-reporter
description: >-
  위시켓, 프리모아, Upwork, Contra 같은 플랫폼의 현재 외주 코딩 공고를 수집하고,
  지원 가능성과 위험을 분류해 HTML 실행 리포트를 만든다.
  AI 자동화, 백엔드 API·데이터·인증·연동 개발, MVP, 대시보드, 크롤링,
  챗봇, 내부 도구, 작은 웹·앱 후보 탐색, 일간·주간 리드 스캔,
  지원 후보 선정과 지원·보류·거절 판단이 필요할 때 사용한다.
---

# Freelance Opportunity Reporter

## 목적

실제 공개 공고와 플랫폼 정책을 근거로 외주 지원 리포트를 만든다.
플랫폼 소개가 아니라, 사용자가 실제로 지원하고 돈을 벌 가능성이 있는 후보를 고르는 것이 목표다.

## 기본 관점

사용자가 별도 조건을 주지 않으면 아래 기준으로 판단한다.

- 혼자 또는 작은 agent 팀으로 수행한다.
- 원격 또는 대부분 원격인 일을 우선한다.
- 외주 이력이 없으면 첫 후기와 거래 이력을 만들기 좋은 단기 공고를 별도 후보군으로 평가한다.
- 작은 웹 도구, 업무자동화, 대시보드, 스크래핑, API 연동, 챗봇, MVP 일부, 관리자 화면을 우선한다.
- AI 여부와 무관하게 범위가 닫힌 백엔드 개발을 함께 수집한다.
  - API 서버와 외부 서비스 연동
  - 인증과 권한
  - DB 모델링과 마이그레이션
  - 데이터 수집과 처리
  - 백오피스 백엔드
  - 기존 서비스 기능 추가와 안정화
- 대형 앱 전체 구축, 장기 상주, 금융·의료·보안 핵심 시스템은 보수적으로 본다.

## 작업 절차

1. 수집 범위를 정한다.
   기본 수집 대상은 위시켓과 프리모아의 공개 프로젝트 목록이다.
   기본 검색 축은 아래처럼 두 갈래로 둔다.

   - AI·자동화: AI 자동화, RAG, 챗봇, 업무자동화, 크롤링, 대시보드, API 연동
   - 백엔드
     - 프레임워크: FastAPI, Django, Flask, Node.js, NestJS, Spring Boot
     - API와 인증: REST API, GraphQL, OAuth, 결제 제외 인증
     - 데이터: PostgreSQL, MySQL, Redis, ETL, 데이터 파이프라인
     - 작업 유형: API 서버, 관리자 API, 기존 서비스 기능 추가

   기술명만으로 후보를 확정하지 않는다.
   공고 상세에서 원격 조건, 기능 범위, 데이터·배포 책임, 기간과 예산을 함께 확인한다.
   외주 이력이 0회이면 검색 금액 하한을 두지 않는다.
   1-14일 안에 끝나고 납품물이 명확한 소액 공고도 `첫 수주 후보`로 수집한다.

2. 최신 자료를 확인한다.
   공고, 수수료, 플랫폼 정책은 바뀔 수 있으므로 웹 검색이나 브라우저로 현재 페이지를 확인한다.
   블로그 요약보다 공식 목록, 고객센터, 가격 정책 페이지를 우선한다.
   수집 절차와 원자료 형식은 `references/collection.md`를 읽고 따른다.
   플랫폼이 표시한 전체 건수와 실제로 확보한 고유 공고 ID 수를 비교한다.
   차이가 남으면 전수 수집으로 표현하지 않고 누락 가능성과 실패 지점을 리포트 첫 부분에 표시한다.

3. 공고 필드를 정리한다.
   다음 항목을 가능한 범위에서 뽑는다.

   - 플랫폼
   - 공고 식별자
   - 제목
   - URL
   - 등록 시각
   - 수집 시각
   - 예산
   - 기간
   - 외주/상주 여부
   - 원격 가능성
   - 지원자 수
   - 요구 기술
   - 클라이언트 신뢰 신호
   - 눈에 보이는 위험

   공고 상세 URL은 반드시 저장한다.
   목록 URL만으로 리포트를 끝내지 않는다.
   프리모아처럼 카드에 `data-pno`만 있는 경우 실제 클릭 URL이나 상세 URL 패턴을 확인한다.
   상세 URL을 끝내 얻지 못한 경우에는 해당 공고를 `상세 링크 미확인`으로 표시하고 분석 근거가 목록 요약임을 명시한다.
   적합하지 않은 공고도 원자료에서 삭제하지 않는다.
   제외 사유를 기록해 수집 누락과 분류 제외를 구분한다.

4. 분류 기준을 적용한다.
   자세한 기준은 `references/classification.md`를 읽는다.
   반복 가능한 점수표가 필요하면 JSON으로 정리한 뒤 `scripts/score_opportunities.py`를 실행한다.
   외주 이력이 0회이면 `--first-win` 옵션으로 일반 점수와 첫 수주 적합도를 함께 확인한다.

5. 평가 관점과 행동을 분리한다.
   평가 관점은 아래처럼 나눈다.

   - `first-win`: 짧고 범위가 닫혀 있어 첫 거래와 후기를 만들기 좋은 후보
   - `standard`: 일반적인 수익성, 경력 활용도, 장기 가치가 높은 후보

   행동은 아래처럼 나눈다.

   - `apply-now`: 범위가 닫혀 있고, 납품 가능성이 높고, 경쟁이 과하지 않은 후보
   - `clarify-first`: 매력은 있지만 상주, 범위, 권한, 검수 기준을 먼저 확인해야 하는 후보
   - `avoid`: 위험이 크거나, 범위가 넓거나, 가격이 맞지 않는 후보

6. 리포트를 작성한다.
   사용자의 외주 이력이 0회이면 첫 수주 후보를 일반 수익성 후보보다 먼저 제시한다.
   첫 수주 후보가 없으면 일반 상위 후보를 먼저 제시한다.
   사용자가 전체 시장을 보고 싶어 하면, 모집 마감과 기간제를 제외한 해당 플랫폼의 전수 목록을 함께 제시하고 적합도 순으로 정렬한다.
   전수 목록이 여러 페이지면 수집 페이지 수와 총 건수를 명시한다.
   각 후보마다 지원 이유, 숨은 위험, 첫 질문, 지원 각도를 함께 쓴다.
   수수료나 정책 숫자는 출처를 붙인다.
   표와 상세 섹션의 공고명은 상세 페이지로 가는 클릭 가능한 링크로 만든다.
   리포트는 항상 HTML 파일 하나로만 만든다.
   Markdown, PDF, DOCX 등 다른 형식의 리포트는 만들지 않는다.
   출력 경로는 `reports/freelance-opportunity-report-YYYY-MM-DD.html`로 고정한다.
   수집 근거는 `reports/freelance-opportunities-YYYY-MM-DD.json`에 저장한다.
   JSON은 사용자용 리포트가 아니라 수집 검증용 원자료로 취급한다.
   HTML에는 UTF-8 선언, 반응형 viewport, 제목, 기준일, 외부 링크, 모바일에서도 읽을 수 있는 표 스타일을 포함한다.
   생성 뒤에는 HTML 파일의 필수 섹션, 공고 상세 링크, `git diff --check`를 확인한다.
   추가 공고를 나중에 발견하면 별도 긴급 섹션에 덧붙이지 않는다.
   원자료에 합친 뒤 점수, 후보 수, 결론, 표 순위, 이번 회차 액션을 다시 계산한다.
   이전 실행의 원자료가 있으면 신규 공고를 `새로 발견`으로 표시한다.

7. 운영 루프를 붙인다.
   반복 실행 계획이 필요하면 `references/operating-loop.md`를 읽는다.
   단발 리포트로 끝내지 않고 수집, 분류, 지원 자산 작성, 지원, 회고까지 이어지는 다음 행동을 적는다.
   루프에는 주기, 담당 산출물, 중단 기준, 기록할 지표를 포함한다.

8. 지원 자산을 만든다.
   필요하면 상위 후보별 지원문 초안과 미팅 전 질문을 작성한다.
   외부 플랫폼에 실제 제출하거나 메시지를 보내기 전에는 반드시 사용자 확인을 받는다.

## 결과물 형식

리포트는 `reports/freelance-opportunity-report-YYYY-MM-DD.html` 하나로 작성한다.
수집 근거는 `reports/freelance-opportunities-YYYY-MM-DD.json`에 항상 저장한다.
JSON은 사용자용 리포트가 아니라 누락과 중복을 검사하는 내부 근거다.

HTML 본문은 아래 순서로 구성한다.

- 수집 범위와 날짜
- 수집 완전성
- 결론
- 첫 수주 후보
- 상위 후보 표
- 지원 후보 상세
- 보류 후보
- 거절 후보
- 지원 전 체크리스트
- 운영 루프
- 이번 회차 액션
- 의논할 결정

외부에 지원문·댓글을 실제 등록하기 전에는 HTML 리포트와 별도로 채팅에 본문 미리보기를 제공한다.

## 보조 자료

- `references/collection.md`: 공고 ID 기반 수집과 누락 검사 기준
- `references/classification.md`: 지원/보류/거절 분류 기준
- `references/operating-loop.md`: 반복 운영 루프와 지표 기준
- `scripts/audit_collection.py`: 원자료 중복, 필수 필드, 수집 건수 검사 스크립트
- `scripts/score_opportunities.py`: JSON 공고 목록 점수 계산 스크립트

점수 계산 스크립트 입력 예시:

```json
[
  {
    "platform": "Wishket",
    "title": "웹 대시보드 UI/UX 개선 및 AI 기능 연동",
    "budget_krw": 15000000,
    "duration_days": 90,
    "applicants": 8,
    "fit": 4,
    "risk": 3,
    "portfolio": 5,
    "remote": 3,
    "remote_only_pass": null,
    "scope_clarity": 5,
    "delivery_confidence": 4,
    "experience_match": 4,
    "reputation_value": 5
  }
]
```

수집 원자료와 점수를 아래 순서로 검사한다.

```bash
python3 .claude/skills/freelance-opportunity-reporter/scripts/audit_collection.py reports/freelance-opportunities-YYYY-MM-DD.json --pretty
python3 .claude/skills/freelance-opportunity-reporter/scripts/score_opportunities.py reports/freelance-opportunities-YYYY-MM-DD.json --remote-only --first-win --pretty
```
