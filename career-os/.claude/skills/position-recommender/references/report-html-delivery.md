# 포지션 리포트 HTML 전달과 전체 공고

## 사용자 선호

- 공고·포지션 추천 리포트는 텍스트 표만 보내지 않는다.
- 항상 다운로드해서 바로 볼 수 있는 HTML을 함께 첨부한다.
- 첨부 HTML은 **추천 공고와 전체 조건 통과 공고를 한 파일에 함께** 담는다. 파일을 두 개로 나누지 않는다.
- HTML 안의 공고명은 개별 공고 URL로 이동하는 링크여야 한다.
- Discord 미리보기에도 상위 후보, 핵심 사유, 공고 링크를 포함한다.
- 첨부 HTML은 임의로 20개·50개 등으로 자르지 말고 전체 active/open 후보를 보여준다.

## 통합 HTML 구조

`render_candidate_preview.ts`에 `--postings`를 주면 한 파일 안에 두 섹션을 만든다.

- **추천 공고**: 강력·도전·보류 티어 전체. 티어 뱃지를 함께 보여준다.
  수집 snapshot 밖에서 직접 확보한 공고도 여기에 들어가므로, 이 섹션이 없으면 신규 발굴 공고가 첨부에서 누락된다.
- **전체 조건 통과 공고**: snapshot에서 역할 구성·고용 형태·필수조건 필터를 통과한 active/open 공고 전체.

두 섹션이 겹치는 건수는 전체 섹션 설명에 그대로 표시한다.

## 권장 산출물

- 통합 HTML: `reports/downloads/position-recommendation-all-YYYY-MM-DD.html` (유일한 HTML 산출물)
- runtime mirror: `reports/latest/position-recommendation.{json,md}`

## 선택적 Cloudflare Pages 게시

현재 요청에 공개 게시 의도가 명시된 경우에만 통합 HTML을 `/report-publisher`로 넘긴다.

- 게시 대상은 이번 실행에서 만든 `reports/downloads/position-recommendation-all-YYYY-MM-DD.html` 하나로 제한한다.
- `Use skill: /report-publisher [HTML 파일 경로]` 형식으로 위임한다.
- 게시 slug는 `position-recommendation-YYYY-MM-DD` 형식을 사용한다.
- Cloudflare 인증, 준비 검사, 실제 업로드와 배포 검증은 `report-publisher`가 담당한다.
- 성공하면 검증된 `public_url`과 검증 결과를 사용자에게 전달한다.
- `branch_url`은 게시기가 HTTP 검증을 통과해 반환한 경우에만 안내한다.
- 실패하면 로컬 HTML을 유지하고 게시 실패 사유를 별도로 알린다.
- 토큰 값이나 로컬 비밀 정보는 본문, 명령 출력, 리포트에 기록하지 않는다.

## 권장 실행 흐름

```bash
# HTML은 이 통합 파일 하나만 만든다. 날짜별 report.html과 latest HTML 미러는 만들지 않는다.
# 추천 공고 섹션과 전체 조건 통과 공고 섹션이 한 파일에 들어간다.
# AI 모델 연구 중심, CTO/기술총괄, Tech Lead/Server Lead, Toss 루트 회사의 범용 Server Developer 공고는 전체 섹션에서 제외된다.
node scripts/position-recommender/render_candidate_preview.ts \
  --input reports/latest/position-recommendation.json \
  --postings cache/live-position-postings.md \
  --limit all \
  --output reports/downloads/position-recommendation-all-$(TZ=Asia/Seoul date +%F).html
```

## 검증 기준

- HTML 파일이 실제로 존재한다.
- 통합 HTML에 `추천 공고`와 `전체 조건 통과 공고` 두 섹션이 모두 있다.
- 추천 티어의 모든 개별 공고 URL이 통합 HTML 안에 있다. snapshot 밖에서 확보한 공고도 포함되어야 한다.
- 통합 HTML에 `<a class="title" href="https://..." target="_blank"` 형태의 개별 공고 링크가 있다.
- 텍스트 답변은 요약 수준이고, 본문은 HTML 첨부로 전달한다.
- 전체 섹션에서 제외 대상 문자열이 사용자에게 보이지 않는지 확인한다: `CTO`, `AI Engineer (Model)`, `Applied Scientist`, `Tech Lead`, `Server Developer (Product)`.
- 핵심 문서(AGENTS.md, SKILL.md, ADR, flow)를 수정했다면 완료 보고에 수정 사실과 파일 목록을 명시한다.
- 변경은 가능하면 관심사별로 commit/push한다. 인증 문제나 unrelated dirty 파일 때문에 push가 막히면 이유를 보고한다.

## Pitfalls

- 텍스트 표만 보내면 사용자 선호를 위반한다.
- `position-recommendation-preview-*.html`이나 `position-recommendation-full-*.html`을 새로 만들지 않는다.
- 회사 채용홈이나 검색 페이지 링크를 추천 티어 공고 링크로 쓰면 안 된다.
- `reports/downloads/` 밖의 HTML을 Discord에 직접 첨부하지 않는다.
- 마감 임박/사용자 하향 판단이 있는 후보를 snapshot의 `no_deadline`만 보고 최상위로 다시 올리지 않는다.
- Toss 루트 회사의 범용 `Server Developer (...)` 공고는 구체적 공고가 아니므로 제외한다.
- Tech Lead/Server Lead/CTO/기술총괄 계열은 현재 seniority 대비 과도하므로 제외한다.
