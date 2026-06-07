# Phase 02 — request queue와 processor 계약 구현

## 목표

fos-career에 interview skill request queue와 processor의 최소 구현을 추가한다.
dashboard는 career-os skill을 직접 실행하지 않고, processor만 허용된 native skill을 호출한다.

## 중요 지침

이 phase는 implementation phase다.
`career-os/docs/`, `AGENTS.md`, `TOOLS.md`, ADR, 정책 문서를 수정하지 않는다.
계약이 부족하면 구현을 추측하지 말고 `PHASE_BLOCKED`로 멈춘다.

## 범위

- fos-career DB schema 또는 migration에 `interview_skill_requests` 또는 동등한 request table 추가.
- request type: `interview_prep_report`, `interview_asset`, `study_pack`.
- feedback request type: `answer_feedback`.
- status: `pending`, `running`, `done`, `failed`, `stale`, `blocked`.
- skill allowlist:
  - `interview-prep-analyzer`
  - `interview-asset-writer`
  - `study-pack-writer`
- processor가 pending request를 읽고 allowlist와 stale guard를 확인하는 경로 구현.
- `study-pack-writer` 요청이 `[초안]` 제목의 fos-study 문서를 만들고 commit/push까지 완료하는 경로 구현.
- interview session mode status 구현: `active`, `read_only`, `archived`.
- interview session 기본 turn budget 5와 자유형 연장 플래그 구현.
- answer feedback request가 private answer record를 읽고 상세 feedback을 DB에 저장하는 경로 구현.
- feedback score fields 구현:
  - 기술 정확성
  - 경험 연결
  - 답변 구조
  - CJ푸드빌 맥락 반영
- 자연어 study-pack 요청을 public-safe topic으로 정규화해 `study_pack` request로 만드는 경로 구현.
- processor 결과에는 status, paths, summary, errorSummary만 저장.
- audit log event 이름과 payload 경계 구현.

## 범위 밖

- dashboard UI.
- career-os scripts 수정.
- career-os `.claude/skills` 수정.
- docs/ADR/정책 문서 수정.
- 외부 제출, 공개 발행, 로그인, 업로드.
- candidate-profile 자동 수정.
- request result와 audit log에 private 문서 본문, 면접 답변 전문, 상세 피드백, command stdout 전체 저장.
- answer record와 feedback을 fos-study, Discord, 외부 알림으로 복사.
- private 답변 전문을 그대로 study-pack topic으로 사용하는 일.

## 구현 힌트

- plan053 `priority_action_requests`와 plan059 `user_position_action_requests` 패턴을 먼저 확인한다.
- processor는 writable checkout에서 command를 실행해야 한다.
- `study-pack-writer` 요청은 public-safe topic 검증을 통과해야 한다.
- `study-pack-writer`는 기존 native skill publish 흐름을 사용하므로 push 실패를 failed로 반영한다.
- answer feedback은 답변 본문을 request row가 아니라 private answer record에서 읽고, 상세 피드백은 private feedback field에 저장한다.
- archive 상태의 session에서는 새 request 생성을 차단한다.
- 사용자가 "이 주제 모르겠어"처럼 요청하면 회사/개인 맥락을 제거한 공개 가능 기술 주제로 정규화한다.
- stdout 전문을 DB에 넣지 말고 필요한 오류 요약만 저장한다.

## 성공 기준

- request row 생성과 processor status update가 TypeScript 검증을 통과한다.
- allowlist 밖 skill 요청이 차단된다.
- `[초안]` study pack 요청이 fos-study commit/push 결과를 status와 path로 남긴다.
- `study-pack-writer`의 private topic 요청이 blocked 또는 rejected 상태로 남는다.
- answer feedback 요청이 private answer record의 상세 feedback을 갱신한다.
- feedback score 4축이 저장된다.
- 자연어 study-pack 요청이 public-safe topic으로 정규화된다.
- read_only/archive 상태에서 새 질문, 답변, feedback request가 차단된다.
- result payload에 private body나 stdout 전문을 저장하지 않는 검증이 있다.
- `git diff --check` 통과.

## PHASE_BLOCKED

fos-career의 기존 DB 또는 processor 구조에서 request queue를 안전하게 둘 위치를 찾을 수 없으면 `PHASE_BLOCKED: no safe interview skill request queue storage`를 출력한다.

## PHASE_FAILED

dashboard container가 career-os skill을 직접 실행하는 구현이 필요해지면 실패로 본다.

## 완료 기록

- status: completed
- completed_at: 2026-06-07T13:21:17Z
- fos-career commit: `737c992 feat(interview): skill request gateway 구현`
- 변경 요약:
  - `interview_skill_requests`, `interview_practice_sessions`, `interview_answer_records` schema/migration 추가.
  - `/api/interview/requests`, `/api/interview/sessions`, `/api/interview/answers` 추가.
  - `scripts/process-interview-requests.ts` processor와 public-safe/allowlist/self-test gate 추가.
- 검증:
  - `npx tsc --noEmit`
  - `npm run apply:interview-requests -- --self-test-gates`
  - `git diff --check`
