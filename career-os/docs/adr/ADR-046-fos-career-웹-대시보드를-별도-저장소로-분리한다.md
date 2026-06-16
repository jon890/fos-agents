## ADR-046 — fos-career 웹 대시보드를 별도 저장소로 분리한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

career-os 자동화 데이터(frontdoor queue, ledger, position recommendation, candidate profile)를 브라우저에서 읽고 LLM과 채팅으로 해석할 수 있는 대시보드가 필요하다.
career-os 자체는 에이전트/데이터/자동화의 진실 출처로 유지하면서, 사람이 보는 웹 제품 계층을 별도 저장소로 분리한다.

### 결정

- 웹 대시보드 저장소는 `~/services/fos-career`에 생성한다.
- career-os(`~/ai-nodes/career-os/`)는 에이전트/데이터/자동화 진실 출처를 유지한다.
- fos-career는 human-facing 웹 제품이다.
- fos-career는 career-os 파일을 읽기 전용 마운트(`/data/career-os`)로만 읽는다.
  - 환경 변수: `CAREER_OS_ROOT=/data/career-os`.
  - fos-career가 career-os 파일에 쓰거나 수정하는 것을 금지한다.
- 기술 스택: Next.js 15 App Router, MySQL, Docker 이미지, 홈서버 역방향 프록시(기존 npm/Node 웹서버) 뒤에 배포.
- 관리자 로그인: ID/password 방식. 단일 관리자 계정.
- MySQL 소유 데이터: admin 계정/인증/세션, LLM 채팅 이력, audit log, action history.
  - career-os ledger, materials, frontdoor queue는 MySQL로 마이그레이션하지 않는다.
  - 프로그레시브 마이그레이션은 별도 승인된 결정에서 다룬다.
- MVP 쓰기 범위: 읽기 전용 대시보드 + LLM 채팅.
  - prepare-start/hold/reject 같은 버튼은 별도 승인된 쓰기 phase에서 다룬다.

### 결과

- career-os는 자동화 워크플로를 그대로 유지한다. fos-career 도입으로 career-os 스크립트/skill/cron이 바뀌지 않는다.
- fos-career는 career-os 파일을 읽기만 하므로 대시보드 버그가 career-os 데이터를 오염시키지 않는다.
- MySQL은 fos-career가 직접 소유하는 데이터(세션, 채팅 이력, audit)에만 쓴다. career-os 데이터 이중화가 없다.
- Docker 이미지로 배포하면 기존 역방향 프록시 설정을 최소로 바꾸면서 새 서비스를 올릴 수 있다.

### 적용

- `tasks/plan039-fos-career-dashboard/` — 구현 계획 5 phase.
- fos-career 저장소는 phase-01 구현 시 생성한다.
- [[ADR-045]] frontdoor queue/ledger 분리가 이 대시보드의 읽기 입력을 정의한다.
