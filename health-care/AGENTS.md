# AGENTS.md — health-care 워크스페이스

`~/ai-nodes/health-care`는 개인 건강 기록·진료 준비·재활 경과 추적을 위한 독립 워크스페이스다.


## 문서 라우팅

- `docs/prd.md` — 제품 범위, MVP 기능, 성공/비범위
- `docs/data-schema.md` — 공개 config와 private data 스키마
- `docs/flow.md` — intake, tracking, clinic prep, skill flow
- `docs/code-architecture.md` — 디렉터리/skill 경계/cron 책임
- `docs/adr.md` — 의사결정의 왜
- `CLAUDE.md` — Claude/Codex가 같은 운영 기준을 보도록 `AGENTS.md`와 동기화

## 목적

- 병력/증상/복약/진료 기록을 일관된 문맥으로 유지한다.
- 병원 진료 전에 핵심 요약과 질문 리스트를 만든다.
- 재활/생활 관리 계획은 의료진 판단을 보완하는 기록·정리 수준으로 다룬다.
- 증상 변화, 위험 신호, 재방문 기준을 추적한다.

## 안전 원칙

- 진단·처방·치료 결정을 대신하지 않는다.
- 급성 악화, 신경/혈류 이상, 심한 통증, 반복 탈구/불안정, 잠김/걸림, 붓기 증가 등은 의료기관 재평가를 우선한다.
- 운동/재활 제안은 보수적으로 작성하고, 통증·불안정감·붓기 증가 시 중단 기준을 함께 둔다.
- 개인 의료 정보는 기본적으로 비공개로 취급한다. 공개 블로그/외부 전송 금지.

## 현재 관리 트랙

- `data/conditions/knee-patellar-instability/` — 슬개골 재발성 탈구 수술 이력 및 최근 무릎 불안정 증상

## 디렉터리

- `config/` — 외부 공개 가능 정책, 일반화된 회복 플랜, 비식별 운영 기준
- `data/conditions/` — 질환/증상별 원본 문맥, 경과 기록, 진료 노트. 민감정보이므로 git 커밋하지 않는다.
- `docs/` — 워크플로/ADR/운영 문서
- `.claude/skills/` — Claude native skill 컨텍스트 자산 (SKILL.md + references/). ADR-006 분리 표준.

## 작업 방식

0. Discord `#병태건강` 채널에서 커밋/푸시 요청을 받으면 `health-care/` 관련 파일만 대상으로 삼고, 다른 워크스페이스 변경은 건드리지 않는다.
1. 공개/비공개 경계가 애매하면 임의로 결정하지 말고 사용자와 먼저 논의한다.
2. 먼저 사용자의 증상 기록과 의료기관 안내를 구분한다.
3. 확정 사실 / 기억 기반 / 추론 / 확인 필요를 분리한다.
4. 병원 제출용 문서는 짧고 정확하게 만든다.
5. 재활 계획은 “안전한 범위 유지” 중심으로 제안하고, 강화 단계는 의료진/물리치료사 확인 후 진행한다.
6. 애매한 부분은 임의로 넘기지 말고 질문하거나 `확인 필요`로 남긴다.
7. 아침 재활 체크인 변경은 `.claude/skills/daily-knee-rehab-checkin/SKILL.md`, `config/knee-running-recovery-plan.md`, `config/knee-rehab-exercise-sets.md`, `docs/flow.md`, `docs/code-architecture.md`를 함께 확인한다.
8. 이후 참고 자료로 남길 만한 사용자 경과는 private `data/conditions/.../current-context.md`에, 일반화 가능한 운영 결정은 `docs/adr.md` 또는 `config/`에 남긴다.
