# skill-creator 4축 검토 — daily-knee-rehab-checkin

검토 대상: `health-care/.claude/skills/daily-knee-rehab-checkin/SKILL.md`
검토 시점: 2026-05-21 (plan003 phase-01-A)
기준 버전 크기: 1,116 bytes (영문 원본)

## 축 1 — 트리거 정확도

### 현재 상태

- description: 영문만 있음 — "Use for health-care daily morning knee rehab check-ins"
- 슬래시 명령 `/daily-knee-rehab-checkin` 미기재
- 한국어 자연어 트리거 없음

### 문제

- 한국어로 "무릎 아침 체크인해줘" 호출 시 skill 매칭 불확실
- cron 자동 실행(openclaw) 환경에서는 문제 없으나 대화형 호출 경로 취약

### 적용 개선

- description에 `/daily-knee-rehab-checkin` 슬래시 명령 추가
- 한국어 트리거 phrase 추가: "무릎 아침 체크인", "오늘 재활 뭐 해야 해", "재활 리마인더"
- cron 08:30 KST 자동 진입 경로 명시

## 축 2 — 출력 품질

### 현재 상태

- 7개 항목 출력 체크리스트 정의됨 (좋음)
- "Discord-safe" 언급 있으나 길이 기준 미명시

### 문제

- Discord 2000자 제한에 대한 명시적 가이드 없음

### 적용 개선

- 출력 형식 섹션에 "Discord 2000자 제한 안에 맞춘다" 명시

## 축 3 — 안전·경계

### 현재 상태

- 비진단 규칙 있음: "Do not diagnose, prescribe, or claim medical certainty"
- 중단 기준 항목 명시됨 (좋음)
- privacy 규칙 있음

### 문제

- 한국어 안내에서의 언어 tone 가이드 없음
- "~하세요"(의사 지시형) vs "~권장합니다"(제안형) 차이 미명시

### 적용 개선

- 한국어 제안형 톤 명시: 의사 지시형("~하세요") 대신 제안형("~하는 것이 좋습니다") 유지
- 중단 기준 한국어 완전 표기 + 임상 용어 영문 병기

### 차단 확인

- 진단·처방 톤 강화 권장 → 거절 (health-care 정책 위반)
- cron payload 변경 권장 → 거절 (본 plan 범위 밖)

## 축 4 — 완성도

### 현재 상태

- private data 없을 때 fallback 있음 (좋음)
- 파일 경로 명시적

### 판단

변경 없음. 충분함.

## 종합

| 축 | 변경 전 | 변경 후 |
|---|---|---|
| 트리거 정확도 | 슬래시 미기재, 한국어 트리거 없음 | 슬래시 + 한국어 트리거 추가 |
| 출력 품질 | Discord 길이 기준 없음 | Discord 2000자 기준 추가 |
| 안전·경계 | 한국어 tone 미명시 | 제안형 톤 명시, 비진단 한국어 강화 |
| 완성도 | 충분 | 유지 |
