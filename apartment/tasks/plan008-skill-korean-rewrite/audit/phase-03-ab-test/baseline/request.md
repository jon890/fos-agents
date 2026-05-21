# 오늘의 인테리어 추천 요청

Run the apartment interior reference recommendation workflow.

Inputs:
- Config: /home/bifos/ai-nodes/apartment/config/interior-reference-digest.json
- Decision note: /home/bifos/ai-nodes/apartment/docs/interior/lucky-5-1004-interior-decisions.md
- Decision queue: /home/bifos/ai-nodes/apartment/docs/interior/lucky-5-1004-decision-queue.md
- Reference notebook: /home/bifos/ai-nodes/apartment/docs/interior/interior-references.md
- Output report: /home/bifos/ai-nodes/apartment/data/interior-reference-digest/2026-05-21/report.md

Required behavior:
1. Read the config, decision note, decision queue, and recent 7 days of previous reports if present.
2. Use web_search/web_fetch to find current interior references.
3. Prioritize 오늘의집, 네이버 블로그, and local/interior portfolio pages.
4. Score candidates against the config rubric.
5. Write the markdown digest to /home/bifos/ai-nodes/apartment/data/interior-reference-digest/2026-05-21/report.md.
6. Append strong reference candidates to the reference notebook with stable R-00X IDs.
7. Do not auto-confirm decisions in the decision note; only list decision candidates unless the user explicitly confirmed.
8. If delivering to Discord, send only a concise summary with 3-5 recommendations and exactly three decision questions for today.
9. The three decision questions must come from the  section in the decision queue. Do not repeat the same topic from the recent 7 days of reports. Do not ask again about items under  or marked 결정/방향 결정/현장 확인 후 최종 결정 unless today's evidence materially changes the decision. Each question must include short A/B/C options and a recommendation.

Do not contact vendors or request quotes.
