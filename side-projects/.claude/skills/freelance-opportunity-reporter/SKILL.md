---
name: freelance-opportunity-reporter
description: >-
  위시켓, 프리모아, 원티드 긱스의 현재 외주 코딩 공고를 수집하고,
  지원 가능성과 위험을 분류해 HTML 실행 리포트를 Cloudflare Pages에 게시한다.
  AI 자동화, 백엔드 API·데이터·인증·연동 개발, MVP, 대시보드, 크롤링,
  챗봇, 내부 도구, 작은 웹·앱 후보 탐색, 일간·주간 리드 스캔,
  지원 후보 선정, 지원·보류·거절 판단, 검증된 공유 링크가 필요할 때 사용한다.
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

무엇을 잘 맞는 공고로 보고 무엇을 거절하는지는 `references/classification.md`가 단일 출처다.
같은 기준을 이 파일에 옮겨 적지 않는다.
워크스페이스 `CLAUDE.md`에 상위 정책이 있으면 그것이 `classification.md`보다 우선한다.

## 작업 절차

1. 수집 범위를 정한다.
   기본 수집 대상은 아래 세 곳의 공개 프로젝트 목록이다.

   | 플랫폼 | 목록 | 필터와 주의 |
   | --- | --- | --- |
   | 위시켓 | `wishket.com/project/` | `외주(도급)` 필터를 걸고 모집 중만 본다.<br>목록 이동에 `?page=N`이 먹지 않아 페이지네이션을 눌러 순회한다. |
   | 프리모아 | `freemoa.net/m4/s41?page=N` | `도급(원격)` 필터를 적용한다.<br>`모집중`과 `마감임박`만 남기고 `마감`은 제외한다.<br>기존 Orca 로그인 세션을 먼저 사용한다. |
   | 원티드 긱스 | `wanted.co.kr/gigs/api-v2/projects` | 공개 API를 쓴다.<br>최종 리포트에는 `work_place == remote`인 공고만 남긴다.<br>`office`와 `both`는 제외한다. |

   기본 검색 축은 아래처럼 두 갈래로 둔다.

   - AI·자동화: AI 자동화, RAG, 챗봇, 업무자동화, 크롤링, 대시보드, API 연동
   - 백엔드
     - 프레임워크: FastAPI, Node.js, NestJS, Spring Boot
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
   수집 절차, 누락 검사, 불완전할 때의 보고 방식은 `references/collection.md`를 읽고 따른다.

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
   리포트의 표, 상세 설명, 결론에서 공고를 언급할 때는 제목을 상세 URL 링크로 표시한다.
   기간이나 공고 식별자만으로 공고를 가리키지 않는다.
   공고 식별자는 링크된 제목 옆의 보조 정보로만 표시할 수 있다.
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

6. 리포트를 작성하고 게시한다.
   파일 형식, 경로, 섹션 순서는 `결과물 형식`을 따른다.
   내용을 배치할 때만 아래를 적용한다.

   - 상단 추천 표에는 사용자가 개수를 지정하지 않으면 플랫폼별 상위 후보를 최대 3개만 제시한다.
   - 상단 추천 표와 하단 `수집한 공고 목록`은 같은 표 양식을 사용한다.
   - 공통 열은 `공고`, `예산`, `기간`, `지원자`, `적합도`, `판단`, `한줄평`,
     `먼저 확인할 것` 순서다.
   - `공고`에는 상세 페이지 링크를 건다.
   - `지원자`에는 수집 시점의 현재 지원자 수를 `N명`으로 표시한다.
   - `적합도`에는 일반 점수 또는 첫 수주 적합도 중 실제 추천 관점과 점수를 함께 쓴다.
   - `판단`은 `바로 지원`, `조건 확인 후 지원`, `비추천` 중 하나로 쓴다.
   - `한줄평`에는 사용자 경력과의 적합 이유를 한 문장으로 쓴다.
   - `먼저 확인할 것`에는 가장 큰 위험이나 지원 전 확인 조건을 한 문장으로 쓴다.
   - 예산, 기간, 지원자 수를 확인하지 못했으면 임의로 추정하지 않고 `미확인`으로 표시한다.
   - 대표 숫자는 `검토 후보`, `바로 지원`, `조건 확인 후 지원`만 사용한다.
   - 수집 건수, 마감·상주 제외 건수, 페이지 순회 같은 작업 과정은 HTML에 쓰지 않는다.
   - 제외 과정을 설명하지 말고 최종 후보와 지원 판단만 쓴다.
     단, 누락이나 접근 제한이 후보 판단의 신뢰도를 바꾸면 한 줄로 알린다.
   - 외주 이력이 0회이면 첫 수주 후보를 일반 수익성 후보보다 먼저 제시한다.
     첫 수주 후보가 없으면 일반 상위 후보를 먼저 제시한다.
   - 각 후보마다 지원 이유, 숨은 위험, 첫 질문, 지원 각도를 함께 쓴다.
   - 수수료나 정책 숫자는 출처를 붙인다.
   - 이전 실행의 원자료가 있으면 신규 공고를 `새로 발견`으로 표시한다.
   - 추가 공고를 나중에 발견해도 별도 긴급 섹션에 덧붙이지 않는다.
     원자료에 합친 뒤 점수, 후보 수, 결론, 표 순위, 이번 회차 액션을 다시 계산한다.
   - 하단 `수집한 공고 목록`에는 최종 수집 범위에 남은 활성·완전 원격 공고 전체를
     플랫폼별 표로 제시한다.
   - 하단 목록은 상단의 플랫폼별 최대 3개 제한에 포함하지 않는다.
   - 하단 표도 상단과 같은 열, 열 순서, 판단 배지, 값 형식을 사용한다.
   - 하단 공고를 링크만 있는 목록이나 축약 표로 바꾸지 않는다.
   - 수집 과정이나 제외 과정은 각 행에서 반복하지 않는다.
   - HTML과 원자료는 게시·검증을 위한 임시 파일로만 만든다.
   - HTML은 `report-publisher` 스킬로 Cloudflare Pages에 게시한다.
   - 공개 URL 검증이 끝나면 임시 HTML과 원자료를 삭제한다.
   - 게시에 실패해도 저장소의 `reports/`나 다른 영구 경로에 결과물을 남기지 않는다.

   원자료 검사가 끝나면 날짜별 전용 생성기를 만들지 않고 공용 생성기를 실행한다.

   ```bash
   python3 .claude/skills/freelance-opportunity-reporter/scripts/render_report.py \
     data/runtime/downloads/freelance-opportunities-YYYY-MM-DD.json \
     --date YYYY-MM-DD \
     --output data/runtime/downloads/freelance-opportunity-report-YYYY-MM-DD.html
   ```

7. 운영 루프를 붙인다.
   반복 실행 계획이 필요하면 `references/operating-loop.md`를 읽는다.
   단발 리포트로 끝내지 않고 수집, 분류, 지원 자산 작성, 지원, 회고까지 이어지는 다음 행동을 적는다.
   루프에는 주기, 담당 산출물, 중단 기준, 기록할 지표를 포함한다.

8. 지원 자산을 만든다.
   필요하면 상위 후보별 지원문 초안과 미팅 전 질문을 작성한다.
   외부 플랫폼에 실제 제출하거나 메시지를 보내기 전에는 반드시 사용자 확인을 받는다.

## 결과물 형식

사용자에게 전달하는 최종 산출물은 검증된 Cloudflare Pages 주소다.

| 산출물 | 위치 | 성격 |
| --- | --- | --- |
| 공개 리포트 | Cloudflare Pages `public_url` | 사용자용 최종 산출물이다.<br>검증된 HTTPS 주소만 전달한다. |
| 임시 HTML | `data/runtime/downloads/freelance-opportunity-report-YYYY-MM-DD.html` | 게시 입력으로만 사용한다.<br>게시 검증 후 삭제한다. |
| 임시 원자료 | `data/runtime/downloads/freelance-opportunities-YYYY-MM-DD.json` | 누락과 중복을 검사한다.<br>게시하지 않고 실행 종료 전에 삭제한다. |

Cloudflare Pages 게시가 실패하면 로컬 파일 링크로 대신 완료하지 않는다.

HTML에는 UTF-8 선언, 반응형 viewport, 제목, 기준일, 공고 상세 링크,
모바일에서도 읽을 수 있는 표 스타일을 포함한다.
표와 상세 섹션의 공고명은 상세 페이지로 가는 클릭 가능한 링크로 만든다.

HTML 본문은 아래 순서로 구성한다.

- 기준일과 대표 숫자
- 결론
- 플랫폼별 상위 후보
- 이번 회차 액션
- 의논할 결정
- 수집한 공고 목록

첫 수주 후보, 상세 평가, 거절 후보, 지원 전 체크리스트, 운영 루프는
사용자가 요청하거나 실제 결정에 필요한 경우에만 추가한다.

`수집한 공고 목록`은 기본 섹션이며 생략하지 않는다.
플랫폼별 표에는 최종 수집 범위의 공고를 적합도 순으로 모두 넣는다.
상단 표와 같은 열과 값 형식을 사용하고 각 공고의 데이터를 모두 채운다.
각 행만 읽어도 사용자에게 맞는 공고인지 판단할 수 있어야 한다.

## 게시

게시 단계에서는 `report-publisher` 스킬을 읽고 그대로 따른다.

- 게시 대상은 임시 HTML 한 파일로 제한한다.
- Pages 프로젝트는 `fos-reports`를 사용한다.
- `slug`는 `freelance-YYYY-MM-DD`로 만든다.
- `prepare` 결과에서 파일 수, 크기, 경고, 민감 정보 노출을 확인한다.
- 이 스킬 호출에는 게시 요청이 포함된 것으로 보고 별도 게시 확인 없이 진행한다.
- 반환된 `public_url`을 브라우저로 열어 HTTP 성공, 문서 제목, 주요 본문을 확인한다.
- `branch_url`은 `report-publisher`가 실제 검증한 경우에만 안정 주소로 안내한다.
- 게시 성공과 실패 모두에서 임시 HTML과 원자료를 정확한 경로로 삭제한다.

Cloudflare 인증이나 게시 권한이 없어 게시하지 못하면 작업을 완료로 간주하지 않는다.
실패 원인과 필요한 권한만 보고하고 로컬 산출물은 전달하지 않는다.

## 검증

플랫폼별 수집 파일을 공용 스크립트로 조립한 뒤 원자료와 점수를 검사한다.

```bash
python3 .claude/skills/freelance-opportunity-reporter/scripts/assemble_report_data.py \
  data/runtime/downloads/*-enriched-YYYY-MM-DD.json \
  --output data/runtime/downloads/freelance-opportunities-YYYY-MM-DD.json
python3 .claude/skills/freelance-opportunity-reporter/scripts/audit_collection.py data/runtime/downloads/freelance-opportunities-YYYY-MM-DD.json --pretty
python3 .claude/skills/freelance-opportunity-reporter/scripts/score_opportunities.py data/runtime/downloads/freelance-opportunities-YYYY-MM-DD.json --remote-only --first-win --pretty
```

리포트를 만든 뒤 아래를 확인한다.

- HTML의 필수 섹션이 모두 있는지
- 상단 플랫폼별 상위 후보가 사용자 지정 수 또는 기본 3개를 넘지 않는지
- 하단 `수집한 공고 목록`에 최종 수집 범위의 공고가 플랫폼별로 모두 있는지
- 상단과 하단 표의 열, 열 순서, 판단 배지, 값 형식이 같은지
- 하단 표의 모든 행에 공고 상세 링크, 예산, 기간, 지원자, 적합도, 판단,
  한줄평, 먼저 확인할 것이 있는지
- 하단 목록이 링크만 있는 목록이나 축약 표로 렌더링되지 않았는지
- 하단의 같은 플랫폼 표가 적합도 내림차순인지
- 대표 숫자 외의 수집·제외 통계와 필터 과정 설명이 없는지
- 공고명이 상세 페이지 링크로 연결되는지
- 기간이나 공고 식별자만으로 공고를 가리킨 문장이 없는지
- Orca 브라우저에서 데스크톱과 모바일 레이아웃이 읽히는지
- `report-publisher prepare` 검사가 통과하는지
- 게시된 `public_url`의 제목과 주요 본문이 로컬 검증 결과와 같은지
- 임시 HTML과 원자료가 실행 종료 후 남지 않았는지

## 보조 자료

| 파일 | 언제 읽는지 |
| --- | --- |
| `references/collection.md` | 목록을 수집하고 누락을 검사할 때 |
| `references/classification.md` | 지원·보류·거절을 나눌 때 |
| `references/operating-loop.md` | 반복 실행 계획을 붙일 때 |
| `scripts/assemble_report_data.py` | 플랫폼별 수집 결과를 감사 가능한 원자료로 합칠 때 |
| `scripts/audit_collection.py` | 원자료의 중복·필수 필드·수집 건수를 검사할 때 |
| `scripts/score_opportunities.py` | 공고 목록의 점수를 계산할 때 |
| `scripts/render_report.py` | 검사한 원자료를 공통 8열 HTML 리포트로 만들 때 |

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

실행 명령은 `검증`에 있다.
