# skill-creator 4축 검토 — weekly-knee-clinic-summary

검토 대상: `health-care/.claude/skills/weekly-knee-clinic-summary/SKILL.md`
검토 시점: 2026-05-21 (plan003 phase-01-C)
기준 버전 크기: 1,463 bytes (영문/한국어 혼용 원본)

## 축 1 — 트리거 정확도

### 현재 상태

- description: 영문만 있음 — "Use for weekly knee progress reviews, clinic-visit preparation..."
- 슬래시 명령 `/weekly-knee-clinic-summary` 미기재
- "When to use" 섹션 내부에는 한국어 트리거가 있으나 description에는 없음

### 문제

- description과 When-to-use 섹션의 트리거가 분리 — skill discovery 매칭은 description 기준
- 슬래시 명령 누락

### 적용 개선

- description에 `/weekly-knee-clinic-summary` 슬래시 명령 추가
- 한국어 트리거 phrase 추가: "주간 무릎 요약", "병원 갈 준비", "진료 준비", "무릎 경과 정리"

## 축 2 — 출력 품질

### 현재 상태

- 6개 요약 섹션 구조 정의됨 (이미 한국어, 좋음)
- Discord 전송 기준 있음 ("short Discord summary")
- private 산출물 경로 명확

### 문제

- "short Discord summary" 에 길이 기준 없음
- "Do not send full sensitive content unless..." 조건이 수동적 표현

### 적용 개선

- Discord 전송 조건을 "사용자가 명시적으로 요청하지 않는 한 민감한 전체 내용을 전송하지 않는다"로 강화
- Discord 길이 가이드는 일일 체크인보다 요약이 길 수 있어 별도 제한 없음 (합리적)

## 축 3 — 안전·경계

### 현재 상태

- 비진단 규칙 있음
- OCR 불확실성 가시화 규칙 있음 (좋음)
- privacy 규칙 있음
- 외부 공유 명시적 확인 규칙 있음 (좋음)

### 문제

- 안전/개인정보 섹션이 영어와 한국어 혼용 — 일관성 없음

### 적용 개선

- 전체 한국어 prose로 통일
- OCR → 확정 사실 격상 금지 규칙 유지

### 차단 확인

- 진단·처방 톤 강화 권장 → 거절 (health-care 정책 위반)

## 축 4 — 완성도

### 현재 상태

- progress-log.jsonl 없을 때 fallback 있음 (좋음)
- clinic-records-ocr-*.md 패턴 참조 있음 (좋음)
- 더 강력한 모델 권장 언급 있음 (좋음)

### 판단

변경 없음. 충분함.

## 종합

| 축 | 변경 전 | 변경 후 |
|---|---|---|
| 트리거 정확도 | 슬래시 미기재, description 한국어 트리거 없음 | 슬래시 + 한국어 트리거 추가 |
| 출력 품질 | Discord 전송 조건 수동적 | 명시적 확인 조건 강화 |
| 안전·경계 | 영어/한국어 혼용 | 전체 한국어 통일 |
| 완성도 | 충분 | 유지 |
