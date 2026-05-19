---
name: apartment-interior-reference-digest
description: Find and summarize interior renovation references for 구리 럭키아파트 5동 1004호, especially 오늘의집, 네이버 블로그, and portfolio pages. Use when the user asks for interior reference recommendations, similar 평수/구축 apartment examples, morning cron interior recommendations, or decision-support for renovation scope, materials, 샷시, 확장, 단열, 욕실, 주방, 바닥재, lighting, and budget tradeoffs.
---

# Apartment Interior Reference Recommendations

## Source of truth

- Workspace: `~/ai-nodes/apartment`
- Decision note: `~/ai-nodes/apartment/docs/interior/lucky-5-1004-interior-decisions.md`
- Reference notebook: `~/ai-nodes/apartment/docs/interior/interior-references.md`
- Config: `~/ai-nodes/apartment/config/interior-reference-digest.json`
- Output root: `~/ai-nodes/apartment/data/interior-reference-digest/`

## Workflow

1. Read the decision note to understand current scope, budget, references, and pending decisions.
2. Read the config for search keywords, scoring rules, and output preferences.
3. Search current web results. Prefer:
   - 오늘의집 project pages
   - 네이버 블로그 renovation posts
   - local/interior company portfolio pages
   - brand or platform references only as secondary sources
4. Fetch promising pages when accessible. Do not rely on thumbnails alone.
5. Score candidates using the rubric in the config.
6. Save a dated markdown digest under `data/interior-reference-digest/YYYY-MM-DD/report.md`.
7. Append high-quality reference candidates to `docs/interior/interior-references.md` with stable IDs (`R-00X`).
8. Send a short Discord-safe summary if running from cron.
9. If a candidate changes a decision, append a proposed `D-00X` item to the decision note only when the user has confirmed it. Otherwise record it as "검토 후보" in the recommendation/reference notebook.

## Daily recommendation output

Keep the morning report short:

- 오늘의 추천 레퍼런스 3~5개
- 각 추천 레퍼런스별:
  - 제목/출처
  - 클릭 가능한 원문 URL
  - 한 줄 요약
  - 우리 집 적용 포인트
  - 업체/글 신뢰도 1차 판단
  - 예산/하자 리스크
  - 샷시/확장/단열/욕실/주방/바닥재/수납/작업공간 관련 힌트
- 오늘 결정해볼 질문 3개
  - 먼저 `docs/interior/lucky-5-1004-interior-decisions.md`, `docs/interior/lucky-5-1004-decision-summary.md`, `docs/interior/lucky-5-1004-field-checklist.md`, `docs/interior/lucky-5-1004-contractor-brief.md`를 훑어 새 미결정/완료 항목이 있으면 `docs/interior/lucky-5-1004-decision-queue.md`를 갱신한다.
  - 갱신된 `docs/interior/lucky-5-1004-decision-queue.md`의 `다음 남은 질문`에서 우선순위가 높은 항목 3개를 고른다.
  - 최근 7일 `data/interior-reference-digest/*/report.md`에 이미 나온 질문과 같은 주제는 반복하지 않는다.
  - 이미 `클리어 완료`에 있거나 `결정`, `방향 결정`, `현장 확인 후 최종 결정`으로 정리된 항목은 새 근거가 없으면 질문으로 다시 올리지 않는다.
  - 각 질문은 A/B/C 선택지와 짧은 추천을 포함한다.
  - 답변을 받으면 `lucky-5-1004-interior-decisions.md`와 `lucky-5-1004-decision-queue.md`에 기록하고, 필요한 경우 `decision-summary`, `field-checklist`, `contractor-brief`도 같이 갱신한다.
- 레퍼런스 누적 여부
- 의사결정 문서 반영 후보

Avoid markdown tables for Discord. Use bullets.

## Search guidance

Use multiple narrow searches instead of one broad query. Start with exact/high-signal queries:

- `구리 럭키아파트 인테리어`
- `구리 럭키아파트 24평 인테리어`
- `구리 럭키아파트 베란다 확장`
- `구리 럭키아파트 샷시 교체`
- `구리 구축 아파트 20평대 베이지 우드 인테리어`
- `수택동 구축 아파트 인테리어 거실 확장`
- `인창동 구축 아파트 인테리어 24평`

Broaden only when exact 단지 results are sparse.

## Boundaries

- Do not contact vendors or request quotes without explicit user approval.
- Do not treat blog pricing as reliable final cost; label it as reference only.
- Distinguish confirmed decisions from ideas.
- For legal/structural topics such as 발코니 확장 허가, 방화/대피공간, 난방 배관, or 외벽/내력벽, recommend professional/관리사무소 confirmation.
