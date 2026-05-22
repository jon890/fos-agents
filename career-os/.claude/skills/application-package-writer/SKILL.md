---
name: application-package-writer
description: 공고 1개와 후보자 프로필을 입력으로 받아 공고별 지원 패키지(fit-analysis.md + application-package.md)를 생성하는 비공개 career-os skill. 근거 있는 주장만 작성, 근거 없는 주장은 needs_evidence 마킹. '지원 패키지 만들어줘', '지원서 초안 작성', 'fit 분석해줘', '/application-package-writer' 슬래시 호출.
---

# Application Package Writer

공고 요구사항과 후보자 근거를 교차 분석해 공고별 맞춤 지원 패키지를 생성하는 비공개 career-os skill.

## When to use

- 슬래시 호출: `/application-package-writer [posting-path]`
- 자연어 요청: "지원 패키지 만들어줘", "지원서 초안 작성해줘", "fit 분석해줘", "이 공고 지원 준비해줘"
- 특정 공고 파일 지정: `data/applications/tossplace/applied-ai-engineer/posting.md`
- ledger에서 후보 자동 선택: "다음 지원 준비해줘"

fos-study publish 안 함 — 비공개 career-os 산출물만 생성.
실제 지원서 제출·로그인·채용 사이트 입력 자동화 안 함 — 사용자 승인 필요 단계로만 안내.

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/data/applications/<company>/<role>/posting.md` — 공고 본문 (필수)
2. `career-os/config/candidate-profile.md` — 후보자 프로필 11섹션 (필수)
3. 후보자 프로필이 참조하는 근거 파일 (`task/**/*.md`, `resume/*.md`) — 필요 시 선택적 Read
4. `career-os/data/applications/ledger.jsonl` — posting path 자동 추출 시 참조 (선택)

## Workflow

### 1. posting path 추출

자연어에서 posting path를 추출한다.

- 예: `/application-package-writer data/applications/tossplace/applied-ai-engineer/posting.md`
  → path = `career-os/data/applications/tossplace/applied-ai-engineer/posting.md`
- path가 없으면 `career-os/data/applications/ledger.jsonl`을 Read해 다음 조건의 첫 항목을 후보로 선택:
  - `needsUserReview=true` 또는 `status`가 `discovered|analyzing|preparing_application` 중 하나
  - 후보 선택 시 사용자에게 확인 ("TossPlace Applied AI Engineer 공고로 진행할까요?") 후 계속

posting path 특정 불가 시 stderr + exit 1.

### 2. 컨텍스트 로드 (Read)

순서대로 Read:

1. posting.md
2. `career-os/config/candidate-profile.md`
3. candidate-profile.md의 "Source provenance" 섹션에서 관련성 높은 근거 파일 2~5개 선택적 Read
   - 공고 요구사항과 겹치는 프로젝트·기술 스택의 근거 파일 우선 선택
   - 전체 `task/**` 탐색 금지 — 관련성 판단은 프로필 인용 경로 기반

### 3. 공고 분석 + 후보자 교차 분석

posting.md에서 다음을 추출:

- **핵심 요구사항** (Requirements): 항목별 분해
- **우대 사항** (Preferred): 항목별 분해
- **팀/역할 특성**: 팀 소개, 주요 업무에서 추출

candidate-profile.md + 근거 파일과 교차 분석:

- 각 요구사항 항목에 대해 후보자 근거 파일 경로와 함께 match 여부 판정
- 근거 파일 경로가 확인되면 해당 경로를 명시
- 근거가 없거나 약한 항목은 `needs_evidence` 마킹 필수
  - 추측성 주장 / 이력서·task에 기재 없는 수치·성과 / 검증 불가 기술 경험 등

### 4. fit-analysis.md 작성 (Write)

저장 경로: `career-os/data/applications/<company>/<role>/fit-analysis.md`

**필수 섹션 6개:**

```markdown
# <Company> <Role> — Fit Analysis

## 공고 요약

## Role-Fit 요약

## 강점 근거

## Gap 분석

## 지원 우선순위

## Risk Flags
```

작성 규칙:
- 강점 근거: 각 항목에 근거 파일 경로 명시 (`task/...`, `resume/...`)
- Gap 분석: 근거 없는 항목은 `needs_evidence` 마킹
- Risk Flags: posting.md의 `위험 플래그` + 후보자 포지셔닝 리스크 추가
- 총 30줄 이상
- `sources/fos-study/`에 쓰지 않음

### 5. application-package.md 작성 (Write)

저장 경로: `career-os/data/applications/<company>/<role>/application-package.md`

**필수 섹션 6개:**

```markdown
# <Company> <Role> — Application Package

## 맞춤 이력서 Bullet 초안

## 지원동기 / 자기소개 초안

## 직무별 강조 포인트

## 면접 대비 포인트

## 근거 파일 참조

## Ledger Update Suggestion
```

작성 규칙:
- 이력서 bullet: 공고 키워드와 매핑되는 실제 에피소드 기반. 수치/성과 날조 금지 — 출처 없으면 "구체 수치는 출처 문서에 기재 없음" 병기
- 지원동기: 후보자 프로필과 공고 팀 소개 교차 기반. 추측성 공감 문구 대신 실제 프로젝트 연결
- 근거 없는 주장은 `needs_evidence` 마킹
- 실제 지원서 제출·채용 사이트 접속·계정 로그인은 명령이 아닌 "사용자 승인 필요" 항목으로만 기재
- 총 30줄 이상
- `sources/fos-study/`에 쓰지 않음

**Ledger Update Suggestion 섹션 (필수):**

```markdown
## Ledger Update Suggestion

- current_status: <posting.md 또는 ledger에서 읽은 현재 status>
- suggested_next_status: ready_for_user_review
- userDecision: pending
- needsUserReview: true
- nextActions:
  - review_application_package
  - run_application_reviewer
```

### 6. Self-check (최대 3회)

두 출력 파일 작성 후 아래 항목 검증. 실패 시 해당 파일 재작성:

1. `fit-analysis.md` 줄 수 ≥ 30
2. `application-package.md` 줄 수 ≥ 30
3. `fit-analysis.md`에 필수 6개 섹션 헤더 모두 존재
4. `application-package.md`에 필수 6개 섹션 헤더 모두 존재 (Ledger Update Suggestion 포함)
5. Gap 분석 또는 application-package.md에 `needs_evidence` 1건 이상 존재 (근거 없는 주장이 있으면 반드시 마킹됨을 확인)
6. `sources/fos-study/` 아래 어떤 파일도 쓰지 않았는지 확인
7. 제출·로그인·외부 계정 작업 실행 지시가 없음 확인

실패 항목 있으면 수정 후 재작성. **최대 3회**. 4회째도 실패 시 `stderr: application-package-writer 검증 실패: <항목>` + exit 1.

## Error handling

| 상황 | 처리 |
|---|---|
| posting path 특정 불가 | stderr + exit 1 |
| posting.md 부재 | stderr + exit 1 |
| candidate-profile.md 부재 | stderr + exit 1 |
| ledger.jsonl 부재 (자동 선택 시) | stderr warn + posting path를 사용자에게 직접 입력 요청 |
| 근거 파일 Read 실패 | stderr warn + 해당 파일 없이 계속 진행 (needs_evidence 마킹 강화) |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |

## Why this design

- **근거 분리 원칙**: posting 요구사항 × 후보자 근거 파일 교차 매핑으로 추측성 주장을 구조적으로 차단. `needs_evidence` 마킹은 후보자 스스로 보강할 포인트를 명시.
- **ledger 연계**: ledger에서 다음 행동 후보를 자동 식별. 직접 ledger 변경은 하지 않고 `Ledger Update Suggestion`으로 사용자 의사결정 유도 (ADR-032 직접 갱신 금지 원칙).
- **fos-study 격리**: 지원 전략은 후보자 의사결정 자산 — 공개 저장소에 흘리지 않음.
- **Phase 05 연계**: 본 skill이 생성한 application-package.md를 `application-reviewer` skill이 pass/fail 판정. 본 skill은 생성만 담당.

## References

- `career-os/docs/adr.md` — ADR-032 application ledger 스키마 설계 근거
- `career-os/docs/data-schema.md` — ledger.jsonl 스키마
- `career-os/data/applications/ledger.jsonl` — 지원 이력 원장
- `career-os/config/candidate-profile.md` — 후보자 프로필 단일 출처
