# Flow — health-care

이 문서는 건강 기록과 리포트 생성 흐름을 설명한다.
모든 흐름은 진단·처방을 대신하지 않는다.

## Intake

```text
사용자 보고
  -> 증상·검사·진료 안내 구분
  -> 원본 또는 요약을 private track에 저장
  -> current-context.md 갱신 제안
  -> 확인 필요 항목 분리
```

기준 경로:

- `private/conditions/<track>/current-context.md`
- `private/conditions/<track>/progress-log.jsonl`
- `private/conditions/<track>/source-*.md`

## Daily Coaching

```text
daily-health-coaching
  -> private 최신 문맥 확인
  -> 공개 재활·생활 관리 config 확인
  -> 오늘 할 행동과 중단 기준 생성
  -> 필요 시 진료 확인 항목 제시
```

private context가 없으면 공개 config만 사용하고 한계를 명시한다.

## Progress Tracking

```text
knee-progress-intake
  -> 통증, 불안정감, 붓기, 보행, 운동, 다음날 반응 구조화
  -> progress-log.jsonl append
  -> current-context.md 갱신 필요 여부 판단
```

사용자가 말하지 않은 증상은 추론하지 않는다.
위험 신호가 있으면 재평가 기준을 우선한다.

## Clinic Summary

```text
weekly-knee-clinic-summary
  -> 최신 context와 경과 로그 읽기
  -> 확정 사실, 사용자 보고, OCR 불확실성, 확인 필요 분리
  -> 1페이지 요약과 질문 리스트 생성
```

의료진에게 보여줄 문서는 짧게 쓴다.
진단명이나 치료 방향을 새로 단정하지 않는다.

## Meal Research

```text
personalized-healthy-meal-research
  -> 건강 목표와 제한 확인
  -> 공신력 자료와 조리 영상 분리
  -> 메뉴, 대체 규칙, 회전표, 장보기 목록 생성
```

개인 검사 수치와 병력은 공개 리포트에 복사하지 않는다.
비식별 HTML을 만들더라도 공개 전 범위를 점검한다.
