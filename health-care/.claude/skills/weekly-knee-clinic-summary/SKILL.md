---
name: weekly-knee-clinic-summary
description: health-care private 데이터로 주간 무릎 경과 검토, 병원 방문 준비, 1페이지 의료 컨텍스트 요약, 질문 목록 갱신을 수행하는 skill. "주간 무릎 요약", "병원 갈 준비", "진료 준비", "무릎 경과 정리", "이번 주 무릎 어때", `/weekly-knee-clinic-summary`처럼 최근 증상 로그와 clinic OCR 기반 진료 준비 요약이 필요할 때 사용. 진단·처방을 하지 않고 privacy 경계를 지킨다.
---

# weekly-knee-clinic-summary

private health-care 데이터로 주간 또는 진료 전 한국어 요약을 생성한다.

## 호출 후 범위 해석

- 주간 요약과 진료 전 요약은 같은 출력 구조를 사용한다.
- 기록이 부족하면 실패하지 말고 충분한 기록 경과가 없다고 안내한다.
- 외부 공유는 사용자 명시 확인이 있을 때만 수행한다.

## 입력

가능하면 다음 파일을 읽는다:

- `health-care/private/conditions/knee-patellar-instability/current-context.md`
- `health-care/private/conditions/knee-patellar-instability/progress-log.jsonl`
- `health-care/private/conditions/knee-patellar-instability/clinic-records-ocr-*.md`
- `health-care/config/knee-running-recovery-plan.md`
- `health-care/config/public-health-care-policy.md`

`progress-log.jsonl`이 아직 없으면 실패하지 않는다.
충분한 기록 경과가 없다고 안내한다.

## 출력 대상

기본 private 산출물:

- `health-care/private/conditions/knee-patellar-instability/weekly-summaries/YYYY-MM-DD.md`

private 산출물 작성 후 짧은 Discord 요약을 보낼 수 있다.
사용자가 명시적으로 요청하지 않는 한 민감한 전체 내용을 전송하지 않는다.

## 요약 구조

간결한 한국어 섹션으로 작성한다:

1. 이번 주 핵심 변화
2. 현재 남은 문제
3. 운동/일상에서의 반응
4. 중단/축소해야 하는 신호
5. 병원에 물어볼 질문
6. 확인 필요 / OCR 불확실성

## 안전/개인정보 규칙

진단·처방하거나 의료진 판단을 대체하지 않는다.

다음을 명확히 구분한다:

- 확정 사실
- 사용자 보고
- OCR 기반 정보
- 확인 필요

OCR 불확실성을 가시적으로 유지한다.
불명확한 OCR을 확정 사실로 격상하지 않는다.

외부 공유는 사용자 명시적 확인이 있어야 한다.
개인 식별자(Discord/서버/사용자 ID, 정확한 병원 식별자, raw 의무 기록 세부 내용)를 노출하지 않는다.
