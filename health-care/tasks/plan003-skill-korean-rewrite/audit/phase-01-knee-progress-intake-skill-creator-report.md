# skill-creator 4축 검토 — knee-progress-intake

검토 대상: `health-care/.claude/skills/knee-progress-intake/SKILL.md`
검토 시점: 2026-05-21 (plan003 phase-01-B)
기준 버전 크기: 1,249 bytes (영문 원본)

## 축 1 — 트리거 정확도

### 현재 상태

- description: 영문만 있음 — "Use when the user reports knee symptoms, swelling..."
- 슬래시 명령 `/knee-progress-intake` 미기재
- 한국어 자연어 트리거 없음

### 문제

- "무릎 오늘 상태 기록해줘" 같은 한국어 자연어 호출 시 skill 매칭 불확실
- "증상 보고", "오늘 운동 기록" 같은 일상적 표현과 연결 없음

### 적용 개선

- description에 `/knee-progress-intake` 슬래시 명령 추가
- 한국어 트리거 phrase 추가: "무릎 오늘 상태 기록", "증상 보고", "오늘 운동 기록해줘", "무릎 경과 입력"
- 주요 입력 차원 한국어로 열거 (증상·붓기·불안정감·가동범위·보행)

## 축 2 — 출력 품질

### 현재 상태

- progress-log.jsonl 스키마 필드 상세 명시됨 (좋음)
- null 처리 규칙 있음 ("Do not invent values")
- 데이터 대상 파일 경로 명확

### 문제

- 스키마 필드 설명이 짧아 `range_of_motion`, `walking_stairs` 의미가 불명확
- JSONL append vs 전체 재작성 구분이 명확하지 않음

### 적용 개선

- "추가(append)" 명시로 overwrite 방지 명확화
- 필드 설명은 원본 유지 (과도한 확장 금지)

## 축 3 — 안전·경계

### 현재 상태

- 비진단 규칙 있음
- privacy 규칙 있음 (platform ID / 병원 등록번호 저장 금지)
- red flags 콜아웃 규칙 있음

### 문제

- 공개/비공개 경계 모호 시 처리 기준이 부드럽게 표현됨 — "ask before writing outside data/"

### 적용 개선

- 모호 시 "임의로 `private/` 외부에 쓰지 말고 사용자에게 확인" 으로 명확화

### 차단 확인

- 진단·처방 톤 강화 권장 → 거절 (health-care 정책 위반)

## 축 4 — 완성도

### 현재 상태

- 확정 사실 / 사용자 보고 / 확인 필요 3단계 구분 잘 됨 (좋음)
- current-context.md 갱신 조건 명시 (좋음)

### 판단

변경 없음. 충분함.

## 종합

| 축 | 변경 전 | 변경 후 |
|---|---|---|
| 트리거 정확도 | 슬래시 미기재, 한국어 트리거 없음 | 슬래시 + 한국어 트리거 추가 |
| 출력 품질 | append 명시 없음 | "추가(append)" 명시 |
| 안전·경계 | 모호 시 처리 부드럽게 표현 | 명확화 |
| 완성도 | 충분 | 유지 |
