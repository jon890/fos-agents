# Phase 03 — cron payload before/after diff

- old: 3439 chars, 25 lines (English, verbose)
- new: 490 chars, 12 lines (Korean, slim)
- 감소율: 7.0x (~85% 감소)

## 정책 위임

본문에 박혀 있던 9단계 절차·search filter·credibility judgement·morning decision rule은
apartment-interior-reference-digest SKILL.md + interior-reference-digest.json 단일 출처로 위임.
payload는 "어떤 skill 어떤 runner 실행해라" + 오늘의 추가 컨텍스트만 유지.

## Diff

```diff
--- old-payload
+++ applied-payload
@@ -1,25 +1,12 @@
-Run the apartment 오늘의 인테리어 추천 + 업체 방문 전 의사결정 workflow for 구리 럭키아파트 5동 1004호.
+apartment 오늘의 인테리어 추천 workflow 실행 (대상: 구리 럭키아파트 5동 1004호).
 
-Source of truth:
-- Skill: /home/bifos/ai-nodes/apartment/.claude/skills/apartment-interior-reference-digest/SKILL.md
-- Runner scaffold: /home/bifos/ai-nodes/apartment/scripts/apartment-interior-reference-digest/run_digest.sh
-- Config: /home/bifos/ai-nodes/apartment/config/interior-reference-digest.json
-- Decision note: /home/bifos/ai-nodes/apartment/docs/interior/lucky-5-1004-interior-decisions.md
-- Decision summary: /home/bifos/ai-nodes/apartment/docs/interior/lucky-5-1004-decision-summary.md
-- Field checklist: /home/bifos/ai-nodes/apartment/docs/interior/lucky-5-1004-field-checklist.md
-- Contractor brief: /home/bifos/ai-nodes/apartment/docs/interior/lucky-5-1004-contractor-brief.md
-- Decision queue/state board: /home/bifos/ai-nodes/apartment/docs/interior/lucky-5-1004-decision-queue.md
-- Reference notebook: /home/bifos/ai-nodes/apartment/docs/interior/interior-references.md
-- Recent reports: /home/bifos/ai-nodes/apartment/data/interior-reference-digest/*/report.md
+Skill: apartment-interior-reference-digest (canonical source of truth — SKILL.md + config 가 모든 정책)
+Workspace: ~/ai-nodes/apartment
 
-Task:
-1. Read the canonical skill, config, decision note, decision summary, field checklist, contractor brief, decision queue/state board, reference notebook, and recent 7 days of report.md files if present.
-2. Before choosing questions, update the decision queue/state board if the other docs show newly completed decisions, newly introduced unresolved decisions, or items that should be checklist-only rather than morning questions. The queue is a state board, not a hardcoded source.
-3. Run the runner scaffold to create today's output paths.
-4. Search broadly but filter carefully: 오늘의집, 네이버 블로그, local/interior company portfolio pages, and brand/platform references only as secondary material.
-5. Prioritize same complex/similar 평수, 구리/수택/인창 구축 20평대, 거실 확장, 단열, 샷시, 욕실, 주방, 바닥재, 붙박이장, and 작업공간/모션데스크 layout relevance.
-6. Because this is the user's first interior project and they plan to visit interior vendors around next week, judge source/vendor credibility at a high level: photo/detail quality, scope transparency, material/process explanation, 하자/AS mention, and avoid overly ad-like low-information posts.
-7. Write a full markdown report to today's report.md under /home/bifos/ai-nodes/apartment/data/interior-reference-digest/YYYY-MM-DD/. Use the Korean title "오늘의 인테리어 추천", not "다이제스트".
-8. Append strong reference candidates to /home/bifos/ai-nodes/apartment/docs/interior/interior-references.md with stable R-00X IDs. Do NOT auto-confirm renovation decisions in lucky-5-1004-interior-decisions.md unless explicitly confirmed by the user; list decision candidates only.
-9. Morning decision rule: choose exactly 3 decision questions from the updated `다음 남은 질문` section in /home/bifos/ai-nodes/apartment/docs/interior/lucky-5-1004-decision-queue.md. Do not choose items under `클리어 완료`; do not ask again about items already marked 결정/방향 결정/현장 확인 후 최종 결정 unless today's evidence materially changes the decision. Do not repeat a topic asked in the recent 7 days of reports. Each question must be concise, A/B/C style, and include a short recommendation.
-10. Reply with a concise Discord-safe Korean summary titled "오늘의 인테리어 추천": 1-2 highly relevant references with clickable/source URLs, why each matters, source/vendor credibility note, then a section titled "오늘 결정할 3개" with the 3 non-repeated decision questions. Avoid markdown tables. Include report path at the end.
+오늘의 추가 컨텍스트:
+- Runner: scripts/apartment-interior-reference-digest/run_digest.sh
+- 추가 docs: lucky-5-1004-{decision-summary, field-checklist, contractor-brief, decision-queue}.md
+- 최근 7일 data/interior-reference-digest/*/report.md 비반복 체크
+- Discord 출력: 추천 3-5개 + 오늘 결정할 3개
+
+Reply NO_REPLY 후 성공/실패만 짧게.
```
