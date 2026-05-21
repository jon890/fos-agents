---
name: knee-progress-intake
description: 사용자가 무릎 증상·붓기·불안정감·가동범위(ROM, range of motion)·보행/계단·수행한 운동·다음날 반응을 보고하고 health-care private 컨텍스트 갱신을 원할 때 사용. "무릎 오늘 상태 기록", "증상 보고", "오늘 운동 기록해줘", "무릎 경과 입력" 또는 /knee-progress-intake 슬래시 호출. 진단·처방 금지, 사용자 보고 범위만 기록.
---

# knee-progress-intake

사용자의 무릎 경과 보고를 health-care private 데이터로 구조화한다.

## 입력

- 현재 대화에서 사용자 보고
- `health-care/data/conditions/knee-patellar-instability/current-context.md` — 가능하면 읽기
- `health-care/docs/data-schema.md` — `progress-log.jsonl` 항목 스키마 참조

## 데이터 대상

private 데이터만 기록한다:

- `health-care/data/conditions/knee-patellar-instability/progress-log.jsonl`에 추가(append)
- 새 보고가 현재 상태를 변경할 때만 `health-care/data/conditions/knee-patellar-instability/current-context.md` 갱신

이 내용을 `docs/`, `config/`, 또는 공개 skill 파일로 이동하지 않는다.

## progress-log.jsonl 항목 필드

줄마다 JSON 객체 하나:

- `date`: `YYYY-MM-DD`
- `pain`: string 또는 null
- `instability`: string 또는 null
- `swelling_heat`: string 또는 null
- `range_of_motion`: string 또는 null
- `walking_stairs`: string 또는 null
- `actions`: string 배열
- `next_day_reaction`: string 또는 null
- `red_flags`: string 배열
- `source`: 보통 `user_report`
- `created_at`: ISO-8601 타임스탬프

사용자가 언급하지 않은 항목은 null로 기록한다.
값을 추정하거나 만들어내지 않는다.

## 현재 컨텍스트 갱신 규칙

다음을 명확히 구분한다:

- **확정 사실**: 사용자가 직접 말했거나 신뢰할 수 있는 기록에 이미 있는 내용
- **사용자 보고**: 주관적 증상, 오늘 반응, 체감 안정성
- **확인 필요**: OCR 모호성, 의학적 해석, 의료진 검토가 필요한 내용

보고에 위험 신호(red flags)가 있으면 조용히 정상화하지 않는다.
재평가가 더 안전할 수 있다고 명시한다.

## 안전/개인정보 규칙

진단하거나 처방하지 않는다.
사용자 보고 범위를 넘어 의학적 결론을 추론하지 않는다.

플랫폼 ID(Discord/서버 ID 등), 병원 등록번호, 불필요한 개인 식별자를 저장하지 않는다.
공개/비공개 경계가 모호하면 임의로 `data/` 외부에 쓰지 말고 사용자에게 확인한다.
