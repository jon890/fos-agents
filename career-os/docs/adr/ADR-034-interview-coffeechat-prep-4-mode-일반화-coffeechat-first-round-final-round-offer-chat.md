## ADR-034 — interview-coffeechat-prep 4 mode 일반화 (coffeechat / first-round / final-round / offer-chat)

- Status: Accepted
- Date: 2026-05-19

### 맥락

interview-coffeechat-prep skill 은 `mvp-target.json` `primary.coffeechat` 단일 객체 기반으로 커피챗 전략 리포트만 생성.
CJ Foodville 1차 면접 임박 — first-round 분석 자료 (회사·비즈니스 / 역할·팀 전략 / 후보자 포지셔닝 / 예상 질문 / 역질문) 필요.

옵션 검토:

- 새 skill `interview-first-round-prep` 신설 — 4 mode 각자 skill 분리 시 mvp-target.json 4 객체 + collect helper 4벌 + SKILL.md 4벌. 중복 비용 큼.
- coffeechat skill 을 4 mode 분기로 확장 — Claude 자연어 라우팅 + mvp-target.json `primary.interview.{coffeechat, first_round, final_round, offer_chat}` 단일 구조 + helper 공유.

### 결정

interview-coffeechat-prep skill 을 4 mode 일반화. backward compat 유지.

- `mvp-target.json` 스키마 마이그: `primary.coffeechat` → `primary.interview.{coffeechat, first_round, final_round, offer_chat}`.
  - coffeechat 객체는 그대로 보존 + 위치 이동.
  - first_round / final_round / offer_chat 은 nullable — 본 plan 에서 first_round 만 활성화.
- mode 트리거: slash arg (`/interview-coffeechat-prep first-round`) 우선, 자연어 키워드 (`1차 면접`, `first-round`) fallback.
- 산출물 2 파일: `report.md` (private) + `report-public.md` (sanitized — Claude 가 프롬프트 가이드 따라 개인명·추수 액수·내부 리서치 마스킹).
- 본 plan 에서 final_round / offer_chat 동작 구현 미수행 — 스키마만 정의. 사용자 시점에 별도 plan 으로 활성화.
- skill rename (interview-company-prep) 은 본 plan 범위 외. 향후 별도 결정.

거절한 대안:

- 4 mode 각자 별도 skill — 중복 자산 4배. mvp-target.json 단일 진실원 원칙 무너짐.
- public-safe 산출물 inline 마커 + 후처리 split — Claude 프롬프트 정합 부담 ↑. 두 파일 동시 생성이 더 단순.
- coffeechat-prompt.md 4 파일 분리 — 중복 ↑. 단일 prompt 안에서 mode 분기.

### 결과

- CJ Foodville first-round 즉시 운영 가능.
- final_round / offer_chat 향후 활성화 비용 ↓ (스키마 + 트리거 분기 이미 준비).
- backward compat 100% — 기존 `/interview-coffeechat-prep` 호출 동작 동일.
- 단점: SKILL.md 본문 분기 비대화 가능성 — 4 mode 모두 동작 시 SKILL.md split 별도 plan 가능.

### 적용

- `_shared/lib/mvp_target_schema.ts` — `InterviewModeSchema` + `InterviewSchema` 추가.
- `career-os/config/mvp-target.json` — `primary.coffeechat` → `primary.interview.{coffeechat, first_round, ...}` 마이그 + first_round 본문 채움.
- `career-os/.claude/skills/interview-coffeechat-prep/SKILL.md` — mode 분기 본문.
- `career-os/.claude/skills/interview-coffeechat-prep/references/coffeechat-prompt.md` — first-round 가이드 + public-safe sanitize 규칙.
- `career-os/scripts/interview-coffeechat-prep/collect_company_sites.ts` — mode 인자 받음. 당시에는 coffeechat을 기본값으로 두었다.
- `career-os/tasks/plan026-interview-mode-generalization/` — 3 phase.
