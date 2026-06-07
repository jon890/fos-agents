# Phase 03 — dashboard 면접 hub와 요청 UI

## 목표

fos-career dashboard에 CJ푸드빌 2026-06-15 면접 준비 hub를 추가하고, hub에서 면접 분석, 면접 asset, study pack 생성을 request queue로 요청할 수 있게 한다.

## 중요 지침

이 phase는 implementation phase다.
`career-os/docs/`, `AGENTS.md`, `TOOLS.md`, ADR, 정책 문서를 수정하지 않는다.
계약이 부족하면 구현을 추측하지 말고 `PHASE_BLOCKED`로 멈춘다.

## 범위

- career-os read-only adapter로 hub projection 구성.
- projection 표시 항목:
  - target company: CJ푸드빌
  - interview date: 2026-06-15
  - 준비 자산 상태
  - 파일 경로
  - 짧은 요약
  - 다음 요청 후보
- hub UI에서 request 생성 action 제공.
- 요청 가능한 action:
  - `interview-prep-analyzer` 기반 면접 준비 리포트
  - `interview-asset-writer` 기반 면접 asset
- `study-pack-writer` 기반 공개 가능 `[초안]` study pack
- 면접 대화 세션 UX 제공:
  - 기본 5턴
  - 자유형 연장
  - 질문 생성/선택
  - 답변 입력
  - 피드백
  - 꼬리질문
  - 답변
  - 최종 요약/보완 주제/study-pack 후보
- 예상 질문별 답변 textarea와 답변 전문 저장 action 제공.
- 상세 feedback DB 결과 표시.
- feedback 점수 4축 표시:
  - 기술 정확성
  - 경험 연결
  - 답변 구조
  - CJ푸드빌 맥락 반영
- 고정 추천과 자연어 study-pack 요청 UI 제공.
- 인터뷰 중 "이 주제 모르겠다"에서 바로 study-pack 요청을 만드는 action 제공.
- 2026-06-15 면접 종료 후 read-only/archive badge와 조회 전용 UI 제공.
- request 상태 표시: `pending`, `running`, `done`, `failed`, `stale`, `blocked`.

## 범위 밖

- processor 구현 변경.
- career-os 파일 mutation.
- career-os scripts 수정.
- docs/ADR/정책 문서 수정.
- career-os private 문서 본문이나 command stdout 전문을 화면에 그대로 노출.
- 사용자가 입력한 답변을 fos-study, Discord, 외부 알림으로 복사.
- archive 상태에서 새 질문, 답변, feedback request를 생성.
- 외부 제출, 공개 발행, 로그인, 업로드.
- candidate-profile 자동 수정.

## 구현 힌트

- application workbench projection UI와 상태 badge 패턴을 재사용한다.
- hub는 landing page가 아니라 실제 준비 상태를 스캔하는 dashboard 화면이어야 한다.
- study pack 요청 버튼은 public-safe topic일 때만 활성화한다.
- study pack 요청은 `[초안]` 생성과 commit/push까지 이어진다는 상태 설명을 화면에 반영한다.
- natural language study-pack input은 public-safe topic 정규화 전에는 실행 요청을 만들지 않는다.
- answer feedback은 합격 보장이 아니라 강점, 리스크, 권장 수정 방향, 꼬리질문, 보완 주제, study-pack 후보로 표시한다.
- score는 합격 가능성 점수가 아니라 연습 개선 지표로 표시한다.
- 답변 전문과 상세 피드백은 dashboard에서 바로 읽을 수 있어야 한다.
- 긴 본문 preview보다 경로, 상태, 짧은 summary, next action을 우선한다.

## 성공 기준

- dashboard에서 CJ푸드빌 2026-06-15 hub가 보인다.
- hub가 career-os read-only adapter에서 준비 자산 상태를 계산한다.
- 버튼은 request queue API를 호출하고 skill을 직접 실행하지 않는다.
- answer textarea 저장, 답변 전문 표시, 상세 feedback 표시가 동작한다.
- 대화 세션에서 기본 5턴과 자유형 연장을 사용할 수 있다.
- 대화 세션에서 질문 생성/선택 -> 답변 입력 -> 피드백 -> 꼬리질문 -> 답변 -> 최종 요약/보완 주제/study-pack 후보 흐름을 따라갈 수 있다.
- 기술 정확성, 경험 연결, 답변 구조, CJ푸드빌 맥락 반영 점수가 표시된다.
- 고정 추천과 자연어 요청 양쪽에서 study-pack request를 만들 수 있다.
- read_only/archive 상태에서는 기존 기록만 조회되고 새 입력이 차단된다.
- private 문서 본문이나 command stdout 전문이 UI에 표시되지 않는다.
- 관련 frontend/type 검증이 통과한다.
- `git diff --check` 통과.

## PHASE_BLOCKED

현재 fos-career routing 또는 adapter 구조로 read-only hub projection을 만들 수 없으면 `PHASE_BLOCKED: no safe read-only interview hub projection`을 출력한다.

## PHASE_FAILED

UI가 career-os writable path를 요구하거나 `claude -p`를 직접 호출하면 실패로 본다.
