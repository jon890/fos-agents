# 포지션 추천 cron 운영 점검

포지션 추천 cron이나 수동 실행 흐름을 바꾼 뒤 다음 실행자가 재현 가능한 검증을 하기 위한 체크리스트다.

## 언제 사용

- `career-os:daily-server-position-recommendation` cron prompt, workdir, delivery, HTML 전달 방식을 바꾼 뒤.
- 수집 adapter, preview renderer, 추천 제외 기준을 바꾼 뒤.
- 사용자가 “크론에서 잘 안 됐다”, “HTML이 빠졌다”, “구체적 공고가 아니다”, “이 포지션은 제외해 달라”고 피드백한 뒤.

## 검증 순서

1. 현재 cron 정의를 확인한다.
   - job name, schedule, deliver, workdir, prompt preview를 확인한다.
   - workdir은 file tool이 쓸 수 있는 workspace 경로여야 한다.
2. 최신 공고 snapshot을 새로 만든다.
   - `node scripts/position-recommender/collect_live_postings.ts --output data/runtime/live-position-postings.md`
   - `direct_active_or_open_postings > 0`인지 확인한다.
3. 전체 공고 HTML을 생성한다.
   - `node scripts/position-recommender/render_candidate_preview.ts --input data/runtime/position-recommendation.json --postings data/runtime/live-position-postings.md --limit all --output data/runtime/downloads/position-recommendation-all-$(TZ=Asia/Seoul date +%F).html`
4. 제외 기준을 grep 또는 간단한 script로 확인한다.
   - Toss 루트 회사의 범용 `Server Developer (Product)` 같은 챕터/직군 단위 공고 제외.
   - `Tech Lead`, `Server Lead`, CTO/기술총괄 제외.
   - `AI Engineer (Model)`, `Applied Scientist`, `Research Scientist`, AI 모델 연구 중심 포지션 제외.
5. HTML 전달 산출물을 확인한다.
   - 전체 공고 HTML: `data/runtime/downloads/position-recommendation-all-YYYY-MM-DD.html`
   - 각 공고명에 개별 공고 URL `<a href="...">`가 있어야 한다.
6. 완료 보고에는 핵심 문서/스킬 수정 여부와 검증 결과를 밝힌다.
   - `AGENTS.md`, `SKILL.md`, `references/*.md`, cron 정의, adapter, renderer 변경은 반드시 언급한다.

## Pitfalls

- 텍스트 표만 보내고 HTML 첨부를 빼먹지 않는다.
- `--limit 50`처럼 임의로 자르지 않는다. 첨부 HTML은 `--limit all`을 쓴다.
- `position-recommendation-preview-*.html`이나 `position-recommendation-full-*.html`을 새로 만들지 않는다.
- `source_diagnostics`의 이전 runtime 후보를 stale하게 재사용하지 않는다.
- 범용 채용 그룹, 채용 홈, 커리어 아티클, 검색 페이지는 추천 티어에 올리지 않는다.
- cron이 `ok`로 보이더라도 사용자-facing 품질이 실패할 수 있으므로 HTML, 링크, 제외 기준을 별도로 검증한다.
