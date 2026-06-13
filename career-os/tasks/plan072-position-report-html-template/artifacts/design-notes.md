# plan072 디자인 메모

Phase 01에서 현재 Markdown 구조, runner 연결, Discord 첨부 흐름, HTML 개선 요구를 감사한 뒤 갱신한다.

## 초기 방향

- Discord 본문은 짧은 triage 알림이다.
- HTML 첨부는 아침 리포트를 읽는 주 화면처럼 동작해야 한다.
- Markdown 정본은 유지하고, HTML은 표시 미러로 둔다.
- template은 `scripts/position-recommender/templates/report.html`에 둔다.
- 스타일은 SaaS/dashboard형으로 조용하고 읽기 쉽게 둔다.
- landing page hero, 과한 장식, 텍스트 겹침, 모바일 링크 깨짐은 피한다.
