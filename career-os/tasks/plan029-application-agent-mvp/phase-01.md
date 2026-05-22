# Phase 01 — planning 산출물 고정 + 문서 연결

## 목표

지원 에이전트 MVP를 바로 구현하지 않고, `/planning` 흐름에 맞춰 결정사항, 범위, 단계, 성공 기준을 먼저 고정한다.

본 phase는 다음을 명확히 남긴다.

- 자동화 범위와 사용자 승인 게이트
- TossPlace Applied AI Engineer 샘플 공고 사용 정책
- 비공개 지원 전략과 공개 학습 자료의 경계
- 제출 후 면접 대비까지 이어지는 상태 흐름
- 이후 phase별 산출물과 검증 기준

## 배경

사용자 목표:

- 이력서 기반으로 열린 공고들을 탐색한다.
- 공고를 분석하고 정제한다.
- 각 공고에 맞게 이력서와 지원 패키지를 만든다.
- 제출 후에는 해당 직무 기준으로 공부자료, 면접 대비, 답변 연습까지 이어서 관리한다.
- GPT/Codex는 orchestration, JSON 검증, 상태 관리, 브라우저 보조를 담당하고, Claude native skills는 긴 문서 기반 분석과 작성 엔진으로 재사용한다.

## 확정 결정

### D1. 자동화 범위

MVP는 단계별 승인형으로 간다.

- 자동:
  - 공고 수집/정규화
  - fit/gap 분석
  - 맞춤 지원 패키지 초안
  - evidence/drift 검토
  - daily application digest
  - 제출 후 daily interview/study loop
- agent 내부 반복:
  - `draft -> reviewer -> revise -> reviewer -> pass` 루프를 최대 3회 수행
  - 품질 기준 미달이면 사용자에게 넘기기 전에 agent가 먼저 수정한다.
- 사용자 승인 필수:
  - 대상 공고 확정
  - 맞춤 이력서/지원동기 초안 승인
  - 외부 계정 로그인/권한이 필요한 행위
  - 실제 제출 버튼

### D2. 제출 자동화 경계

MVP에서는 실제 제출 자동화를 제외한다.

- 제출 페이지 열기/입력 보조는 후속 단계에서 별도 설계한다.
- 최종 제출은 수동 승인 필수다.
- 제출 자동화가 들어가는 순간 개인정보, 계정 권한, 회사별 중복 지원 리스크가 커지므로 별도 ADR 또는 phase가 필요하다.

### D3. TossPlace 샘플 공고

첫 fixture는 TossPlace `Applied AI Engineer` 공고로 한다.

- URL: `https://toss.im/career/job-detail?gh_jid=7746700003`
- 사용 목적: application agent MVP 검증용 샘플
- 실제 지원 목적 아님
- Toss 계열 쿨다운 이슈는 `review.md`와 ledger에 명시한다.

### D4. 공개/비공개 경계

지원 관련 산출물은 기본 비공개다.

- 비공개:
  - `data/applications/**/posting.md`
  - `data/applications/**/fit-analysis.md`
  - `data/applications/**/application-package.md`
  - `data/applications/**/review.md`
  - `data/applications/ledger.jsonl`
- 공개 가능:
  - 순수 기술 학습 자료
  - 회사명, 지원 전략, 개인 맞춤 이력서 문구가 빠진 study-pack
  - 기존 `study-pack-writer` 정책을 통과한 fos-study 문서

### D5. 제출 후 케어

application 상태는 제출 후 `interview_prep` 또는 `interview_scheduled`로 전환될 수 있다.

- 제출 후에는 공고 중심으로 daily drill 우선순위를 바꾼다.
- 부족 역량은 `study-topic-recommender` / `study-pack-writer` 후보로 연결한다.
- 경험 기반 질문과 답변 플레이북은 `interview-asset-writer`로 연결한다.
- 답변 피드백과 약점 추적은 `interview-prep-analyzer`로 연결한다.

## 상태 모델 초안

```text
discovered
  -> analyzing
  -> preparing_application
  -> needs_revision
  -> ready_for_user_review
  -> approved
  -> submitted
  -> interview_prep
  -> interview_scheduled
  -> closed
  -> blocked
```

상태 의미:

- `discovered`: 공고 발견, 원문 저장 전후
- `analyzing`: candidate-profile과 fit/gap 분석 중
- `preparing_application`: 맞춤 이력서/지원동기 초안 작성 중
- `needs_revision`: reviewer가 품질 미달을 판정해 agent 재수정 필요
- `ready_for_user_review`: 사용자 승인 대기
- `approved`: 다음 단계 진행 승인
- `submitted`: 제출 완료 기록
- `interview_prep`: 제출 후 면접 대비 루프
- `interview_scheduled`: 면접일이 확정되어 D-day 플랜 적용
- `closed`: 합격/불합격/철회/만료 등 종료
- `blocked`: 공고 만료, 로그인 필요, 쿨다운, 근거 부족 등 차단

## 계획된 산출물 구조

TossPlace fixture 기준:

```text
data/applications/
├── ledger.jsonl
└── tossplace/
    └── applied-ai-engineer/
        ├── posting.md
        ├── fit-analysis.md
        ├── application-package.md
        └── review.md
```

## 재사용할 기존 skill

- `/position-recommender`
  - 공고 수집/추천/초기 fit 분석
- `/study-topic-recommender`
  - 공고 gap 기반 daily study 후보 추천
- `/study-pack-writer`
  - 공개 가능한 기술 학습 자료 발행
- `/interview-asset-writer`
  - 직무/경험 기반 질문 은행, 답변 플레이북
- `/interview-prep-analyzer`
  - 제출 후 daily drill, 면접 답변 피드백
- `/candidate-baseline-suggester`
  - 누적 산출물에서 candidate-profile 개선 후보 제안

## 새로 만들 후보 skill

### application-package-writer

입력:

- 공고 URL 또는 `posting.md`
- `config/candidate-profile.md`
- 관련 resume/task 근거 파일

출력:

- `fit-analysis.md`
- `application-package.md`
- ledger 상태 갱신 후보

책임:

- 공고 요약
- fit/gap 분석
- 맞춤 이력서 bullet
- 지원동기/자기소개 초안
- 해당 직무 면접 대비 포인트

### application-reviewer

입력:

- `posting.md`
- `fit-analysis.md`
- `application-package.md`
- `candidate-profile.md`

출력:

- `review.md`
- pass/fail/revise 판단

책임:

- 근거 없는 주장 차단
- 과장/허위/드리프트 탐지
- 회사별 쿨다운/중복 지원 리스크 표시
- 공개 금지 정보 점검

### daily-application-digest

입력:

- `data/applications/ledger.jsonl`
- 오늘 생성/수정된 application files
- `data/runtime/position-recommendation.md`
- study/interview 관련 runtime report

출력:

- `data/reports/daily/YYYY-MM-DD/application-digest/report.md`
- Discord 요약

책임:

- 새 공고
- 진행 중 지원
- 승인 필요 항목
- 오늘 생성/수정 산출물
- 부족 역량 3개
- 오늘 공부/면접 액션 1~3개

## phase 계획

1. Phase 01 — planning 산출물 고정 + 문서 연결
2. Phase 02 — application 데이터 모델 + ledger 스키마 설계
3. Phase 03 — TossPlace Applied AI Engineer fixture 생성
4. Phase 04 — application-package-writer native skill 설계 + 구현
5. Phase 05 — application-reviewer native skill 설계 + 구현
6. Phase 06 — daily-application-digest native skill 설계 + 구현
7. Phase 07 — 기존 skill 연결 검증 + TossPlace 샘플 end-to-end 리허설

## Phase 01 작업 항목

1. `tasks/plan029-application-agent-mvp/index.json` 생성
2. 본 `phase-01.md` 생성
3. `docs/prd.md`에 planned feature 추가
4. `docs/flow.md`에 application agent planning flow 추가
5. `docs/data-schema.md`에 planned application data 영역 추가
6. `docs/code-architecture.md`에 planned native skills와 data/applications 구조 추가

## 검증 기준

- `index.json`이 존재하고 phase 7개를 포함한다.
- `phase-01.md`에 D1-D5 결정이 모두 기록되어 있다.
- 5문서 중 최소 `prd.md`, `flow.md`, `data-schema.md`, `code-architecture.md`에 plan029 예정 범위가 연결된다.
- 아직 실제 제출 자동화 지시가 없어야 한다.
- `sources/fos-study/` 발행 지시가 없어야 한다. 공개 학습 자료 발행은 후속 phase에서 별도 승인/정책에 따른다.

## 의도적으로 안 하는 것

- 이번 phase에서 TossPlace 공고 원문을 저장하지 않는다. Phase 03에서 수행한다.
- 이번 phase에서 새 skill을 만들지 않는다. Phase 04~06에서 수행한다.
- 이번 phase에서 cron 등록하지 않는다.
- 이번 phase에서 실제 지원 또는 제출 자동화를 하지 않는다.
