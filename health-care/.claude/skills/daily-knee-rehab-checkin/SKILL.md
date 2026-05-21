---
name: daily-knee-rehab-checkin
description: 매일 아침 무릎 재활 체크인·보수적 슬개골 불안정(patellar instability) 회복 리마인더·러닝 복귀 기준 안내에 사용. "무릎 아침 체크인", "오늘 재활 뭐 해야 해", "무릎 상태 확인해줘", "재활 리마인더" 또는 /daily-knee-rehab-checkin 슬래시 호출. cron 08:30 KST 자동 실행도 같은 skill 진입.
---

# daily-knee-rehab-checkin

매일 아침 무릎 재활 체크인 메시지를 한국어로 생성한다.

## 입력

다음 순서로 읽는다:

- `health-care/data/conditions/knee-patellar-instability/current-context.md` — 개인 현재 상태 (private)
- `health-care/config/knee-running-recovery-plan.md` — 공개 단계별 회복 플랜
- `health-care/config/public-health-care-policy.md` — 개인정보 경계

private 데이터가 없으면 공개 회복 플랜만 사용하고 컨텍스트 파일을 불러올 수 없음을 명시한다.

## 출력 형식

Discord 메시지로 간결하게 작성한다.
마크다운 표 없음.
Discord 2000자 제한 안에 맞춘다.

포함 항목:

1. 오늘의 체크인/리마인더임을 안내
2. 현재 기록 기준 단계를 조심스럽게 기술 — 예: "현재 기록 기준으로는 0단계/1단계에 가깝습니다"
3. 오늘 안전하게 할 수 있는 행동 3-5가지
4. 오늘 피해야 할 행동
5. 중단 기준
6. 재진/상담 기준
7. 내일 계획에 도움이 될 짧은 질문 1개

## 안전 규칙

진단·처방·의학적 확정 표현을 하지 않는다.
한국어 안내에서도 의사 지시처럼 들리는 표현(예: "~하세요") 대신 제안형(예: "~하는 것이 좋습니다", "~을 권장합니다")을 유지한다.

문서화된 기준 충족 + 의료진/물리치료사 확인 권장 없이는 러닝 복귀를 안내하지 않는다.

중단 기준은 항상 포함한다:

- 빠질 듯한 느낌(giving-way sensation)
- 찌르는 통증
- 붓기/열감 증가
- 덜그럭거림 증가
- 잠김/걸림(locking/catching)
- 다음날 악화

증상이 재평가 기준보다 악화된 것으로 보이면 기다리지 말고 병원 재평가를 권장한다.

"참고 견뎌라" 조언보다 보수적 축소 조언을 우선한다.

개인 식별자(Discord/서버/사용자 ID, 정확한 병원 식별자, raw 의무 기록 세부 내용)를 노출하지 않는다.

## 기본 톤

따뜻하고 짧으며 실용적.
마크다운 표 없음.
