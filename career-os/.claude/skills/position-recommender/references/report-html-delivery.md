# 포지션 리포트 HTML 전달과 미리보기

## 사용자 선호

- 공고·포지션 추천 리포트는 텍스트 표만 보내지 않는다.
- 항상 다운로드해서 바로 볼 수 있는 HTML을 함께 첨부한다.
- HTML 안의 공고명은 개별 공고 URL로 이동하는 링크여야 한다.
- Discord 미리보기에도 상위 후보, 핵심 사유, 공고 링크를 포함한다.
- 사용자가 “전체 후보”를 요청하면 임의로 20개·50개 등으로 자르지 말고 전체 active/open 후보를 보여준다.

## 권장 산출물

- 전체 리포트: `data/runtime/downloads/position-recommendation-full-YYYY-MM-DD.html`
- 기본 후보 미리보기: `data/runtime/downloads/position-recommendation-preview-YYYY-MM-DD.html`
- 전체 후보 미리보기: `data/runtime/downloads/position-recommendation-preview-all-YYYY-MM-DD.html`
- runtime mirror: `data/runtime/position-recommendation.{json,md,html}`

## 권장 실행 흐름

```bash
# 전체 리포트 HTML은 표준 renderer에서 생성
node scripts/position-recommender/render_recommendation.ts \
  --input data/runtime/position-recommendation.json \
  --format html \
  --output data/runtime/position-recommendation.html

# 다운로드용 전체 HTML copy
cp data/runtime/position-recommendation.html \
  data/runtime/downloads/position-recommendation-full-$(TZ=Asia/Seoul date +%F).html

# 기본 후보 미리보기 HTML
node scripts/position-recommender/render_candidate_preview.ts \
  --input data/runtime/position-recommendation.json \
  --limit 10 \
  --output data/runtime/downloads/position-recommendation-preview-$(TZ=Asia/Seoul date +%F).html

# 전체 active/open 후보 미리보기.
# AI 모델 연구 중심, CTO/기술총괄, Tech Lead/Server Lead, Toss 루트 회사의 범용 Server Developer 공고는 제외된다.
node scripts/position-recommender/render_candidate_preview.ts \
  --input data/runtime/position-recommendation.json \
  --postings data/runtime/live-position-postings.md \
  --limit all \
  --output data/runtime/downloads/position-recommendation-preview-all-$(TZ=Asia/Seoul date +%F).html
```

## 검증 기준

- HTML 파일이 실제로 존재한다.
- 미리보기 HTML에 `<a class="title" href="https://..." target="_blank"` 형태의 개별 공고 링크가 있다.
- 텍스트 답변은 요약 수준이고, 본문은 HTML 첨부로 전달한다.
- 전체 후보 미리보기에서 제외 대상 문자열이 사용자에게 보이지 않는지 확인한다: `CTO`, `AI Engineer (Model)`, `Applied Scientist`, `Tech Lead`, `Server Developer (Product)`.
- 핵심 문서(AGENTS.md, SKILL.md, ADR, flow)를 수정했다면 완료 보고에 수정 사실과 파일 목록을 명시한다.
- 변경은 가능하면 관심사별로 commit/push한다. 인증 문제나 unrelated dirty 파일 때문에 push가 막히면 이유를 보고한다.

## Pitfalls

- 텍스트 표만 보내면 사용자 선호를 위반한다.
- 회사 채용홈이나 검색 페이지 링크를 추천 티어 공고 링크로 쓰면 안 된다.
- `data/runtime/downloads/` 밖의 HTML을 Discord에 직접 첨부하지 않는다.
- 마감 임박/사용자 하향 판단이 있는 후보를 snapshot의 `no_deadline`만 보고 최상위로 다시 올리지 않는다.
- Toss 루트 회사의 범용 `Server Developer (...)` 공고는 구체적 공고가 아니므로 제외한다.
- Tech Lead/Server Lead/CTO/기술총괄 계열은 현재 seniority 대비 과도하므로 제외한다.
