# Phase 03 — candidate-profile core/detail 분리

**Model**: opus
**Status**: pending

## 목표

candidate-profile.md를 추천/핏용 core와 면접용 detail로 나눠, 9개 skill의 프롬프트 주입을 관심사에 맞게 슬림화한다. Phase 01 ADR의 skill↔파일 매핑을 구현한다.

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다.
이 변경은 9개 skill의 Inputs를 함께 바꾸는 고위험 작업이다. ADR 매핑을 벗어나면 PHASE_BLOCKED.
면접 계열 skill이 detail을 못 받으면 품질이 떨어지므로, 각 skill이 필요한 파일을 받는지 반드시 검증한다.

## 관련 파일

- `config/candidate-profile.md` → core(지원 대상·핵심 무기·기술스택 라벨·강점·약점·제약) + detail(주요 프로젝트 서사·의사결정 패턴·협업·면접 준비 우선순위)로 분리
- 9개 skill의 `SKILL.md` Inputs 섹션: position-recommender, job-fit-analyzer, study-pack-writer, application-package-writer, interview-stage-prep, interview-asset-writer, application-reviewer, tech-interview-drill, behavioral-interview-drill
- `scripts/application-agent/*`, `scripts/position-recommender/live-postings/config.ts` 등 profile 참조 코드

## 작업

- ADR 매핑대로 profile을 core/detail 2파일로 분리(내부 4중 중복은 core=라벨, detail=서사로 정리).
- 각 skill의 Inputs를 "core만" 또는 "core+detail"로 갱신.
- profile을 읽는 코드 경로도 함께 갱신.

## 성공 기준

- 추천 계열(position-recommender·job-fit-analyzer)은 core만 주입, 면접 계열은 필요 detail까지 주입 — ADR 매핑과 일치.
- 각 skill의 Inputs 경로가 실제 파일과 일치(끊긴 링크 0).
- 분리 후 내부 에피소드 중복(같은 사례 4중 서술)이 해소.
- 대표 skill 1개 이상 실행/드라이런으로 입력 정합 확인.

## 보류 조건

- 특정 면접 skill이 필요한 detail 섹션 경계가 불명확하면 Phase 01 매핑으로 되돌린다.

## 실패 조건

- 어떤 skill이 존재하지 않는 profile 경로를 참조하게 되면 실패.
