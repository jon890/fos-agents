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

- `private/conditions/knee-patellar-instability/` — 슬개골 재발성 탈구 수술 이력 및 최근 무릎 불안정 증상

## 디렉터리

- `config/` — 외부 공개 가능 정책, 일반화된 회복 플랜, 비식별 운영 기준
- `private/conditions/` — 질환/증상별 원본 문맥, 경과 기록, 진료 노트. 민감정보이므로 git 커밋하지 않는다.
- `private/reports/` — 병원 후보 조사, 진료 준비 요약, 개인 증상·수술 이력·복약 맥락이 들어간 리포트. 민감정보이므로 git 커밋하지 않는다.
- `docs/` — 워크플로/ADR/운영 문서
- `.claude/skills/` — agent skill 정본 (SKILL.md + references/). ADR-006 분리 표준.
- `.codex/skills/` — Codex 노출용 심볼릭 링크.

## Private Storage Rule

- 민감 건강 기록은 `private/`에 둔다. 폴더명만 봐도 비공개 영역임을 알 수 있게 하기 위함이다.
- `data/`를 private 대용으로 쓰지 않는다. 기존 `data/conditions/` 경로는 `private/conditions/`로 이전했다.
- 현재 무릎 트랙의 기준 경로는 `private/conditions/knee-patellar-instability/`다.
- 경과 로그는 `progress-log.jsonl`, 최신 요약은 `current-context.md`, 맞춤 재활 계획은 `rehab-plan-YYYY-MM-DD.md`에 둔다.
- 병원 후보 조사, 진료 준비 리포트, 의료진에게 전달할 요약처럼 개인 건강 맥락이 들어간 산출물은 `private/reports/`에 둔다.
- 루트 `reports/`는 기본적으로 사용하지 않는다. 완전 비식별 공개 산출물일 때만 예외적으로 쓰고, 그 전에는 공개/비공개 경계를 확인한다.
- `private/`는 ai-nodes `.gitignore` 대상이어야 하며, 커밋·공개·외부 전송 전에 사용자 확인을 우선한다.
- 공개 가능한 일반 정책과 비식별 재활 기준만 `config/`나 `docs/`에 둔다.

## 작업 방식

0. Discord `#병태건강` 채널에서 커밋/푸시 요청을 받으면 `health-care/` 관련 파일만 대상으로 삼고, 다른 워크스페이스 변경은 건드리지 않는다.
1. 공개/비공개 경계가 애매하면 임의로 결정하지 말고 사용자와 먼저 논의한다.
2. 먼저 사용자의 증상 기록과 의료기관 안내를 구분한다.
3. 확정 사실 / 기억 기반 / 추론 / 확인 필요를 분리한다.
4. 병원 제출용 문서는 짧고 정확하게 만든다.
5. 재활 계획은 “안전한 범위 유지” 중심으로 제안하고, 강화 단계는 의료진/물리치료사 확인 후 진행한다.
6. 애매한 부분은 임의로 넘기지 말고 질문하거나 `확인 필요`로 남긴다.
7. 아침 종합 건강 코칭 변경은 `.claude/skills/daily-health-coaching/SKILL.md`, `private/conditions/health-screening-2026-06-10/current-context.md`, `private/conditions/health-screening-2026-06-10/health-coaching-plan-2026-06-29.md`, `config/knee-running-recovery-plan.md`, `config/knee-rehab-exercise-sets.md`, `docs/flow.md`, `docs/code-architecture.md`를 함께 확인한다.
8. 이후 참고 자료로 남길 만한 사용자 경과는 `private/conditions/.../current-context.md`에, 일반화 가능한 운영 결정은 `docs/adr.md` 또는 `config/`에 남긴다.

## fos-brain 연동

이 워크스페이스 agents의 brain 읽기/쓰기 규약.
단일 정책은 ai-nodes 루트 `AGENTS.md` 13번 + ADR-009(구조) / ADR-010(쓰기 안전·프라이버시).

- 접근: thin caller — brain-search(읽기) / brain-add(쓰기). brain 로직 재구현 금지.
- cron 무인 실행: brain-search 읽기만. brain-add 적재는 discord 대화 세션에서 사람 검토 후.
- 산출물 네임스페이스 라우팅:
  - 무릎 재활·건강 데이터 → private.
