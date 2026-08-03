## ADR-021 — 공용 리포트 게시 skill을 외부 skill 디렉터리로 공유한다

- Status: Accepted
- Date: 2026-08-03

### 맥락

`report-publisher`는 공개 가능한 HTML을 검사하고 Cloudflare Pages에 게시하는
저장소 공용 기능이지만 ADR-020은 Codex만 사용하는 실행 경로로 결정했다.
같은 `fos-agents`를 다른 실행 환경에서 사용하면 게시 절차를 복제하지 않고
동일한 안전 검사와 Wrangler 버전을 재사용해야 한다.

### 결정

- 정본을 `.agents/skills/report-publisher/`에 그대로 둔다.
- 외부 skill 디렉터리를 지원하는 실행 환경은 저장소의 `.agents/skills/`를 추가 탐색 경로로 등록한다.
- `CLOUDFLARE_API_TOKEN`은 실행 환경의 비밀 저장소에 두고,
  sandbox의 비밀 변수 전달 허용 목록에 이 키만 추가한다.
- ADR-020의 직접 업로드, 공개 범위 검사, 검증된 주소 반환 결정은 유지한다.

거절한 대안:

- 실행 환경별 게시 skill 복사는 안전 검사와 Wrangler 버전이 갈라지므로 채택하지 않는다.
- 정본을 다른 agent 전용 경로로 이동하면 기존 탐색 계약과 설치 경로가 깨지므로 채택하지 않는다.
- 토큰 값을 워크스페이스 문서나 skill 본문에 저장하면 비밀이 노출되므로 채택하지 않는다.

### 결과

여러 실행 환경이 같은 게시 계약과 스크립트를 사용한다.
워크스페이스별 추천 skill은 `/report-publisher` 의도만 위임하고
Cloudflare 전송 구현이나 인증 처리를 직접 소유하지 않는다.
