## ADR-080 — position daily HTML 리포트는 template 기반 표시 미러로 둔다

- Status: Accepted; 게시 경로는 루트 ADR-020으로 대체됨
- Date: 2026-06-14

### 맥락

아침 포지션 추천은 Discord 본문으로만 읽기에는 정보 밀도가 높다.
사용자는 추천 티어, 회사, 직무, 링크, 이유, 확인할 점을 모바일과 브라우저에서 훑어보고 싶어 한다.
기존 daily runner는 Markdown 리포트 검증 뒤 단순 HTML을 만들어 Discord에 첨부했다.
하지만 HTML 구조와 CSS가 renderer 코드 안에 섞여 있어 시각 스타일을 다듬을수록 파서, template, runner 책임이 흐려진다.

### 결정

대체된 부분:
Discord HTML 직접 첨부 경로는 [루트 ADR-020](../../../docs/adr/ADR-020-cloudflare-pages-report-publishing.md)의 승인 기반 Cloudflare Pages 게시 경로로 대체됐다.

- 포지션 daily HTML은 Markdown 추천 리포트의 표시 미러로 둔다.
- 사람용 내용 정본은 Markdown 리포트이며, HTML은 그 표시 미러다.
- 표시 template은 별도 파일로 분리하고, renderer는 Markdown 파싱, HTML escaping, template 주입만 맡는다.
- daily runner는 HTML 생성 실패를 알림 성공으로 숨기지 않는다.
- Discord 본문은 짧은 요약용으로 유지한다.
- 외부 공유가 승인되면 `report-publisher`로 HTML을 게시하고 검증한다.
  자세한 읽기는 검증한 URL과 Markdown 정본에 맡긴다.
- HTML 스타일은 조용한 dashboard형으로 둔다. 과한 장식, 텍스트 겹침, 모바일 링크 깨짐은 피한다.
- template 파일은 ASCII 중심으로 작성하고, 한국어 리포트 콘텐츠는 renderer 입력에서 주입한다.

### 거절한 대안

- renderer 코드 안에 HTML 구조·CSS를 인라인으로 유지: 시각 스타일 수정이 파서·runner 로직과 얽혀 점진적 개선이 어렵다.

### 결과

- HTML 리포트의 시각 스타일을 코드 로직과 분리해 고칠 수 있다.
- Markdown 정본과 HTML 미러의 책임이 분리되어 후속 application workbench와 충돌하지 않는다.
- 단점은 renderer가 Markdown 구조를 안정적으로 해석하고 template placeholder 계약을 검증해야 한다는 점이다.
