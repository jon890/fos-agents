# Phase 06 — daily-application-digest native skill 설계 + 구현

## 목표

매일 application 상태와 새 산출물을 요약하고, 부족 역량/면접 대비 액션을 제안하는 digest skill을 만든다.

## 새 skill

`career-os/.claude/skills/daily-application-digest/SKILL.md`

## 입력

- `data/applications/ledger.jsonl`
- 오늘 변경된 `data/applications/**`
- `data/runtime/position-recommendation.md`
- 필요 시 `data/runtime/morning-topic-recommendation.md`
- 필요 시 interview-prep report

## 출력

- `data/reports/daily/YYYY-MM-DD/application-digest/report.md`
- Discord 요약

## 보고 항목

- 오늘 새로 발견한 공고
- 진행 중인 지원 상태 변화
- 오늘 생성/수정된 지원 패키지
- 사용자 승인 필요 항목
- agent가 자동 수정 중인 항목
- 해당 공고 기준 부족 역량 3개
- 오늘 공부/면접 대비 액션 1~3개

## 검증 기준

- report가 20줄 이상이다.
- 승인 필요 항목과 agent-only 작업이 분리되어 있다.
- 공개 가능한 학습 자료 후보와 비공개 지원 전략이 분리되어 있다.
- Discord 요약에는 민감한 맞춤 이력서 문구를 길게 노출하지 않는다.
