# AGENTS.md — health-care 워크스페이스

`health-care`는 개인 건강 기록, 재활 경과, 진료 준비를 관리하는 독립 워크스페이스다.
이 파일은 행동 규칙과 라우팅만 담는다.

## 읽기 순서

| 문서 | 책임 |
|---|---|
| `README.md` | 범위, 설정, 실행, 검증 |
| `docs/prd.md` | 제품 범위와 비범위 |
| `docs/code-architecture.md` | 현재 구조와 skill 경계 |
| `docs/data-schema.md` | 공개 config와 private data 스키마 |
| `docs/flow.md` | intake, tracking, clinic prep 흐름 |
| `docs/adr/INDEX.md` | 기술 결정 |

## 안전 원칙

- 진단, 처방, 치료 결정을 대신하지 않는다.
- 급성 악화, 신경·혈류 이상, 심한 통증, 반복 탈구, 잠김, 붓기 증가는 의료기관 재평가를 우선한다.
- 재활 제안은 보수적으로 작성하고 중단 기준을 함께 둔다.
- 개인 의료 정보는 기본적으로 비공개로 취급한다.

## 데이터 경계

- 민감 건강 기록은 `private/` 아래에 둔다.
- 공개 가능한 일반 정책과 비식별 플랜만 `config/`와 `docs/`에 둔다.
- 개인 수치, 검사 결과, 진료 기록, 복약 정보는 `AGENTS.md`, `docs/`, `config/`에 복사하지 않는다.
- 공개 여부가 애매하면 공개하지 않는다.

## 주요 트랙

| 트랙 | 기준 경로 |
|---|---|
| 무릎 슬개골 불안정과 재활 | `private/conditions/knee-patellar-instability/` |
| 건강검진 기반 생활 관리 | `private/conditions/health-screening-2026-06-10/` |
| 공개 재활 기준 | `config/knee-running-recovery-plan.md`, `config/knee-rehab-exercise-sets.md` |

## 주요 skill

| skill | 목적 |
|---|---|
| `daily-health-coaching` | 매일 건강·재활 체크인 생성 |
| `knee-progress-intake` | 증상과 운동 반응 구조화 |
| `weekly-knee-clinic-summary` | 병원 제출용 경과 요약 초안 |
| `personalized-healthy-meal-research` | 건강 목표 기반 식단 리서치 |

## 작업 방식

- 사용자의 증상 기록과 의료기관 안내를 구분한다.
- 확정 사실, 사용자 보고, 추론, 확인 필요를 분리한다.
- 병원 제출용 문서는 짧고 정확하게 만든다.
- 재활 강화 단계는 의료진 또는 물리치료사 확인 전에는 보수적으로 둔다.
- 참고할 만한 경과는 `private/conditions/.../current-context.md` 또는 `progress-log.jsonl`에 남긴다.
- 기술 대안 선택은 `docs/adr/`에 남기고 일반 기준은 `config/`에 둔다.
