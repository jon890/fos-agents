## ADR-010 — brain 쓰기 안전·프라이버시: 산출물 종류별 네임스페이스 라우팅 + cron 읽기전용

- Status: Accepted
- Date: 2026-05-28

### 맥락

ADR-009로 ai-nodes가 brain에 양방향 연동한다.
쓰기(brain-add)는 두 위험을 동반한다.

- 프라이버시 — ai-nodes 데이터 대부분이 개인 자료(커리어·건강·재무·매물·여행). public 네임스페이스로 잘못 가면 Quartz 공개 빌드로 유출.
- 무인 실행 — brain-add는 대화 집약형(네임스페이스·소스·검증 게이트가 전부 AskUserQuestion). openclaw cron 무인 세션에서 멈추거나, 검증 게이트를 무인화하면 오지식 유입.

한편 brain-add엔 이미 "fos-study 출처 = public-OK 기본" 규칙이 있어 career-os study 산출물은 공개 가능하다.

### 결정

- **산출물 종류별 라우팅** — 워크스페이스가 아니라 산출물 *종류*로 네임스페이스를 정한다.
  - fos-study 파생 지식 → public-OK (brain-add 기본 규칙 준수).
  - 개인 데이터(career baseline·건강·재무·매물·여행 등) → private 기본.
  - public은 게시 적정성이 확인된 일반 지식에 한해 명시적 opt-in.
  - 워크스페이스 skill이 brain-add 호출 시 네임스페이스를 명시 전달 → brain-add 0단계 프롬프트 회피.
- **cron 읽기전용 / 쓰기 대화형 한정** — openclaw cron 무인 세션은 brain-search 읽기만 한다. brain 적재(brain-add)는 discord 대화 세션에서 사람 검토 후. brain-add의 대화 게이트(검증 게이트 포함)를 무인화하지 않는다.

거절한 대안:

- 전부 private 통일 — 안전하나 fos-study public-OK 이점 포기.
- 워크스페이스별 단일 네임스페이스 — career-os가 study(public)와 개인 baseline(private)을 섞어 부정확.
- cron도 인자 사전공급해 무인 brain-add — 검증 게이트 무인화 = 오지식 유입 위험.
- cron이 쓰기 후보를 큐에 적재 후 사람이 검토 — 큐 관리 복잡도 추가, 현 규모에 과설계.

### 결과

- 개인 데이터의 public 유출 경로가 정책으로 차단된다.
- cron 데일리는 brain을 읽어 컨텍스트로만 활용 — 쓰기 노이즈·오지식 유입 없음.
- brain 적재는 사람 검토를 거쳐 품질 유지.
- 단점: 자동 적재 부재 — 가치 있는 cron 발견도 사람이 대화형으로 옮겨야 함(의도된 트레이드오프).

### 적용

- 단일 소스: `ai-nodes/AGENTS.md` 13번 섹션의 네임스페이스 라우팅 표 + cron 정책.
- 워크스페이스 AGENTS.md는 자기 산출물 종류 → 네임스페이스 매핑만 명시.
- `ai-nodes/tasks/plan003-fos-brain-integration` phase 참조.

---
