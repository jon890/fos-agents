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

- `config/candidate-profile.md` → ADR-104의 13섹션 전수 분류대로 core/detail 분리:
  - **core**(경로 `config/candidate-profile.md` 유지): 지원 대상 / 핵심 무기 / 커리어 타임라인 / 보유 기술 스택(라벨 중심) / 입증된 강점 / 약점·학습 중인 영역 / 제약·스코프
  - **detail**(신규 파일로 분리): 주요 프로젝트 요약 / 개인 프로젝트 / 기술 의사결정 패턴 / 협업·리더십·코드 리뷰 스타일 / 면접 준비 우선순위
  - **meta**(어느 파일에도 미포함): Source provenance — 이미 `candidate-profile-provenance.md`로 분리됨
- 9개 skill의 `SKILL.md` Inputs 섹션: position-recommender, job-fit-analyzer, study-pack-writer, application-package-writer, interview-stage-prep, interview-asset-writer, application-reviewer, tech-interview-drill, behavioral-interview-drill
- profile 참조 코드는 `scripts/application-agent/*`(4개)가 실제 참조처다. `scripts/position-recommender/live-postings/config.ts`는 실측상 profile 미참조이므로 변경 대상 아님(착수 시 `grep`로 재확인).
- `position-recommender/references/position-context-index.md`가 `config/candidate-profile.md`를 나열 — core 경로를 유지하므로 파손 없음(확인만).

## 작업

- ADR-104 매핑대로 profile을 core/detail 2파일로 분리. core 경로는 `config/candidate-profile.md` 유지, detail은 신규 파일.
- 내부 에피소드 4중 중복은 core=라벨, detail=서사로 정리(같은 사례 중복 제거).
- 각 skill의 Inputs를 "core만" 또는 "core+detail"로 갱신(ADR-104 매핑 준수, 벗어나면 PHASE_BLOCKED).
- profile을 읽는 코드 경로(`scripts/application-agent/*`)도 함께 갱신.

## 성공 기준

- 추천 계열(position-recommender·job-fit-analyzer)은 core만 주입, 면접 계열은 필요 detail까지 주입 — ADR-104 매핑과 일치.
- 각 skill의 Inputs 경로가 실제 파일과 일치(끊긴 링크 0).
- 분리 후 내부 에피소드 중복(같은 사례 4중 서술)이 해소 — 대표 사례 1개를 `grep -c`로 core+detail 합산 1회만 서술됨을 확인(destructive 아닌 additive 분리, pitfall 6-5).
- 대표 skill 1개 이상 실행/드라이런으로 입력 정합 확인.

## 보류 조건

- 특정 면접 skill이 필요한 detail 섹션 경계가 불명확하면 Phase 01 매핑으로 되돌린다.

## 실패 조건

- 어떤 skill이 존재하지 않는 profile 경로를 참조하게 되면 실패.
