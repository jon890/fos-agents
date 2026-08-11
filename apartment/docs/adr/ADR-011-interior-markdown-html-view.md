## ADR-011 — 인테리어 결정은 Markdown 정본과 HTML 표시본으로 분리한다

- Status: Accepted
- Date: 2026-06-14

### 맥락

인테리어 결정 기록은 Markdown이 변경 추적에 유리하지만 사용자 검토에는 상태별 시각적 구분이 필요하다.

### 결정

- 결정 정본은 Markdown으로 유지한다.
- 사용자 검토용 HTML은 확정, 미결정, 현장 확인 항목을 구분한 파생 표시본으로 만든다.
- 외부 게시는 [루트 ADR-020](../../../docs/adr/ADR-020-cloudflare-pages-report-publishing.md)을 따른다.

### 거절한 대안

- HTML만 정본으로 두면 diff와 장기 편집이 어렵다.
- 자동 공개는 개인 주거 정보가 노출될 수 있다.

### 결과

Markdown의 추적성과 HTML의 읽기 경험을 함께 유지한다.
