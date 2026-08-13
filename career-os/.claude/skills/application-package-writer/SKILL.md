---
name: application-package-writer
description: 공고 1개와 후보자 프로필을 입력으로 받아 공고별 지원 패키지(fit-analysis.md + application-package.md + resume-draft.md + cover-letter.md + submission-checklist.md)를 생성하는 비공개 career-os skill. "지원 패키지 만들어줘", "지원서 초안 작성", "fit 분석해줘", "이 공고 지원 준비", "다음 지원 준비", `/application-package-writer [posting-path]`처럼 공고별 지원 문서와 role-fit 분석이 필요할 때 사용. 근거 있는 주장만 작성하고, 근거 부족은 보강 필요 / 선택지 / 권장 행동으로 정리. fos-study publish, 실제 제출, 로그인, 채용 사이트 입력은 하지 않는다.
---

# Application Package Writer

공고 요구사항과 후보자 근거를 교차 분석해 공고별 맞춤 지원 패키지를 생성하는 비공개 career-os skill.
내부 전략 문서와 제출용 Markdown 초안을 분리해서 작성한다.

## 호출 후 입력 해석

- posting path가 있으면 해당 파일을 사용한다.
- posting path가 없고 "다음 지원" 흐름이면 positions-queue에서 후보를 고른 뒤 사용자 확인을 받는다.
- 결과는 비공개 career-os 산출물만 생성한다.

## 출력 정책

지원 패키지는 내부 분석 문서와 제출용 문구 후보가 섞이기 쉬우므로 경계를 먼저 고정한다.
fit/gap 판단, reviewer용 리스크, 근거 파일 경로는 내부 분석 섹션에 둔다.
이력서 bullet·지원동기처럼 제출용으로 옮길 수 있는 문장에는 내부 경로, plan 번호, commit hash, runner 상태를 넣지 않는다.

이력서 MVP 산출물 체인은 `Markdown 이력서 초안 -> design.md를 적용한 HTML 이력서 -> HTML을 PDF로 변환한 완성 PDF 이력서`로 다룬다.
채용 사이트 업로드, 전송, 제출 버튼 클릭 자동화는 이번 MVP 범위 밖이며 별도 plan과 명시적 승인이 필요하다.

## Inputs

현재 에이전트는 다음 파일과 명령 출력을 직접 로드:

1. `career-os/applications/<company>/<role>/posting.md` — 공고 본문 (필수)
2. `career-os/config/candidate-profile.md` — 후보자 프로필 core: 사실·라벨 (필수)
3. `career-os/config/candidate-profile-detail.md` — 프로젝트 서사·의사결정 패턴·협업 스타일·면접 준비 우선순위·기술 스택 증거 상세 (필수)
4. 후보자 프로필이 참조하는 근거 파일 (`task/**/*.md`, `resume/*.md`) — 필요 시 선택적으로 읽는다
5. `career-os/state/positions-queue.jsonl` — posting path 자동 추출 시 참조 (선택)

## Workflow

### 1. posting path 추출

자연어에서 posting path를 추출한다.

- 예: `/application-package-writer applications/tossplace/applied-ai-engineer/posting.md`
  → path = `career-os/applications/tossplace/applied-ai-engineer/posting.md`
- path가 없으면 `career-os/state/positions-queue.jsonl`을 읽어 다음 조건의 첫 항목을 후보로 선택:
  - `needsUserReview=true` 또는 `status`가 `discovered|analyzing|preparing_application` 중 하나
  - 후보 선택 시 사용자에게 확인 ("TossPlace Applied AI Engineer 공고로 진행할까요?") 후 계속

posting path 특정 불가 시 stderr + exit 1.

### 2. 컨텍스트 로드

순서대로 읽는다:

1. posting.md
2. `career-os/config/candidate-profile.md` (core) + `career-os/config/candidate-profile-detail.md` (detail — 프로젝트 서사·의사결정 패턴·협업 스타일·면접 준비 우선순위)
3. 후보자 프로필에 직접 인용된 경로 중 공고와 관련된 근거 파일 2~5개를 읽는다.
   - 공고 요구사항과 겹치는 프로젝트와 기술 스택의 근거를 우선한다.
   - 고정된 출처 목록을 따로 유지하지 않고 실제 파일 존재 여부를 확인한다.

### 3. 후보자 인터뷰 (지원동기·서사 확보, 필수)

지원동기·커리어 방향성·회사 선택 이유는 AI가 지어내지 않는다. 공고 분석 다음 문서 작성 전에 후보자 본인에게 질문해 답을 받는다.
질문 세트는 `references/candidate-interview-questions.md`를 따른다 (제출용 Q1~7 + 내부 판단 Q8~10).
2차 면접 피드백이 "지원동기 불명확"이었으므로 이 단계는 지원 패키지 품질의 1급 축이다.

- 대화형 실행: 질문을 후보자에게 던지고 답을 받은 뒤, 그 답을 지원동기·커버레터·직무 적합성에 반영한다. 답이 막연하면("그냥 좋아서" 등) 후속 질문으로 구체화한다. 완성 문장이 아니어도 키워드·생각 조각을 받아 서사로 다듬는다.
- 비대화형 실행 (cron/backend 등 질문 불가): 지원동기·회사 선택 이유를 추측으로 채우지 않고 `보강 필요`로 두며, 질문 목록을 `application-package.md`·`cover-letter.md`의 `보강 필요`에 남긴다.
- 내부 판단 질문(Q8~10)의 답은 `fit-analysis.md`의 Risk Flags·지원 우선순위와 후보자 의사결정에만 쓰고, 제출용 문구에 직접 노출하지 않는다(특히 Q10 보상).

### 4. 공고 분석 + 후보자 교차 분석

posting.md에서 다음을 추출:

- **핵심 요구사항** (Requirements): 항목별 분해
- **우대 사항** (Preferred): 항목별 분해
- **팀/역할 특성**: 팀 소개, 주요 업무에서 추출

candidate-profile.md + 근거 파일과 교차 분석:

- 각 요구사항 항목에 대해 후보자 근거 파일 경로와 함께 match 여부 판정
- 근거 파일 경로가 확인되면 해당 경로를 명시
- 근거가 없거나 약한 항목은 내부 판단에서 `needs_evidence`로 취급하되, 최종 문서에는 raw label로 남기지 않는다.
  - 추측성 주장 / 이력서·task에 기재 없는 수치·성과 / 검증 불가 기술 경험 등은 `보강 필요 / 선택지 / 권장 행동`으로 작성한다.

### 5. fit-analysis.md 작성

저장 경로: `career-os/applications/<company>/<role>/fit-analysis.md`

**필수 섹션 7개:**

```markdown
# <Company> <Role> — Fit Analysis

## 결론

## 공고 요약

## Role-Fit 요약

## 강점 근거

## Gap 분석

## 지원 우선순위

## Risk Flags
```

작성 규칙:
- 첫 10줄 안에 지원 적합도 결론 또는 지금 취할 권장 행동을 쓴다.
- 강점 근거: 각 항목에 근거 파일 경로 명시 (`task/...`, `resume/...`)
- Gap 분석: 근거 없는 항목은 `보강 필요 / 선택지 / 권장 행동` 구조로 작성
- Risk Flags: posting.md의 `위험 플래그` + 후보자 포지셔닝 리스크 추가
- 총 30줄 이상
- `sources/fos-study/`에 쓰지 않음

### 6. application-package.md 작성

저장 경로: `career-os/applications/<company>/<role>/application-package.md`

**필수 섹션 7개:**

```markdown
# <Company> <Role> — Application Package

## 결론

## 맞춤 이력서 Bullet 초안

## 지원동기 / 자기소개 초안

## 직무별 강조 포인트

## 면접 대비 포인트

## 근거 파일 참조

## Positions Queue Update Suggestion
```

작성 규칙:
- 첫 10줄 안에 핵심 포지셔닝 결론 또는 제출 전 권장 행동을 쓴다.
- 이력서 bullet: 공고 키워드와 매핑되는 실제 에피소드 기반. 수치/성과 날조 금지 — 출처 없으면 제출용 문장에서는 수치를 빼고 내부 분석에 `보강 필요 / 선택지 / 권장 행동`으로 남긴다.
- 지원동기: 후보자 프로필과 공고 팀 소개 교차 기반. 추측성 공감 문구 대신 실제 프로젝트 연결
- 근거 없는 주장은 제출용 문구에 넣지 않고, 내부 섹션에서 `보강 필요 / 선택지 / 권장 행동`으로 처리한다.
- 맞춤 이력서 Bullet 초안과 지원동기 / 자기소개 초안에는 내부 파일 경로, plan 번호, commit hash, runner 상태를 쓰지 않는다.
- 이력서 초안 또는 후속 resume package를 안내할 때는 Markdown 초안, design.md 적용 HTML, 첨부 가능한 PDF를 서로 다른 산출물로 구분한다.
  PDF는 제출물 파일일 수 있지만 제출 행위 자체가 아니며, 외부 업로드·전송 자동화는 이번 MVP 범위 밖이다.
- 실제 지원서 제출·채용 사이트 접속·계정 로그인은 명령이 아닌 "사용자 승인 필요" 항목으로만 기재
- 총 30줄 이상
- `sources/fos-study/`에 쓰지 않음

**Positions Queue Update Suggestion 섹션 (필수):**

```markdown
## Positions Queue Update Suggestion

- current_status: <posting.md 또는 positions-queue에서 읽은 현재 status>
- suggested_next_status: ready_for_user_review
- userDecision: pending
- needsUserReview: true
- nextActions:
  - review_application_package
  - run_application_reviewer
```

### 7. resume-draft.md 작성

저장 경로: `career-os/applications/<company>/<role>/resume-draft.md`

**필수 섹션 6개:**

```markdown
# <Company> <Role> — Resume Draft

## 결론

## 제출용 요약

## 맞춤 경력 Bullet

## 프로젝트별 강조 문장

## 보강 필요

## 사용자 승인 필요
```

작성 규칙:
- 첫 10줄 안에 이 이력서 초안의 핵심 포지셔닝과 제출 전 남은 행동을 둔다.
- 제출용 요약과 맞춤 경력 Bullet은 채용 사이트나 PDF 이력서에 옮길 수 있는 문장으로 쓴다.
- 제출용 문장에는 내부 파일 경로, plan 번호, commit hash, runner 상태를 쓰지 않는다.
- 근거가 약한 항목은 제출용 문장에서 강하게 주장하지 않는다.
  `보강 필요 / 선택지 / 권장 행동` 구조로 분리한다.
- Markdown 초안은 후속 HTML/PDF 변환의 원본이다.
  `design.md` 적용 HTML과 첨부 가능한 PDF는 별도 산출물로 구분한다.
- 총 20줄 이상

### 8. cover-letter.md 작성

저장 경로: `career-os/applications/<company>/<role>/cover-letter.md`

**필수 섹션 5개:**

```markdown
# <Company> <Role> — Cover Letter Draft

## 결론

## 지원동기 초안

## 직무 적합성 초안

## 보강 필요

## 사용자 승인 필요
```

작성 규칙:
- 첫 10줄 안에 지원동기의 핵심 방향과 제출 전 확인할 내용을 둔다.
- 공고의 팀/역할 특성과 후보자 근거가 만나는 지점만 쓴다.
- 확인되지 않은 회사 내부 사정, 과장된 공감 문구, 근거 없는 수치 성과를 쓰지 않는다.
- 근거 부족은 `보강 필요 / 선택지 / 권장 행동` 구조로 둔다.
- 총 20줄 이상

### 9. submission-checklist.md 작성

저장 경로: `career-os/applications/<company>/<role>/submission-checklist.md`

**필수 섹션 5개:**

```markdown
# <Company> <Role> — Submission Checklist

## 결론

## 제출 전 확인

## 첨부 파일 준비

## 보강 필요

## 사용자 승인 필요
```

작성 규칙:
- 첫 10줄 안에 제출 가능 여부와 남은 승인/보강 행동을 둔다.
- 첨부 파일 준비에는 `resume-draft.md`, `cover-letter.md`, HTML 이력서, PDF 이력서의 상태를 분리해 적는다.
- PDF 이력서는 사용자가 첨부할 수 있는 파일일 뿐, 업로드·전송·제출 자동화 완료로 쓰지 않는다.
- 채용 사이트 로그인, 외부 제출, 공개 발행은 `사용자 승인 필요`로만 적는다.
- 총 15줄 이상

## Self-check (최대 3회)

다섯 출력 파일 작성 후 아래 항목 검증. 실패 시 해당 파일 재작성:

1. `fit-analysis.md` 줄 수 ≥ 30
2. `application-package.md` 줄 수 ≥ 30
3. `resume-draft.md` 줄 수 ≥ 20
4. `cover-letter.md` 줄 수 ≥ 20
5. `submission-checklist.md` 줄 수 ≥ 15
6. `fit-analysis.md`에 필수 7개 섹션 헤더 모두 존재
7. `application-package.md`에 필수 7개 섹션 헤더 모두 존재 (Positions Queue Update Suggestion 포함)
8. `resume-draft.md`, `cover-letter.md`, `submission-checklist.md`에 각 필수 섹션 헤더 모두 존재
9. 모든 파일 첫 10줄 안에 결론 또는 권장 행동이 있음
10. `sources/fos-study/` 아래 어떤 파일도 쓰지 않았는지 확인
11. 제출·로그인·외부 계정 작업 실행 지시가 없음 확인
12. 근거 부족 항목이 있으면 raw `needs_evidence` 대신 `보강 필요 / 선택지 / 권장 행동` 구조로 쓰였음
13. 제출용 문구 후보에 내부 파일 경로, plan 번호, commit hash, runner 상태가 없음
14. 내부 분석 섹션에는 확인된 근거 파일 경로가 유지됨
15. candidate-profile 수정, 공개 발행, 외부 제출은 `사용자 승인 필요`로만 표현됨
16. resume package를 언급하면 Markdown 초안 -> design.md 적용 HTML -> 첨부 가능한 PDF 체인을 구분하고, PDF를 외부 제출 자동화로 표현하지 않음
17. 지원동기·커리어 방향성·회사 선택 이유가 후보자 인터뷰 답변에 기반하거나(대화형), 답을 못 받았으면 `보강 필요`로 표시됨(비대화형) — AI 추측 서사가 아님 (Step 3)

실패 항목 있으면 수정 후 재작성. **최대 3회**. 4회째도 실패 시 `stderr: application-package-writer 검증 실패: <항목>` + exit 1.

## Error handling

| 상황 | 처리 |
|---|---|
| posting path 특정 불가 | stderr + exit 1 |
| posting.md 부재 | stderr + exit 1 |
| candidate-profile.md 부재 | stderr + exit 1 |
| positions-queue.jsonl 부재 (자동 선택 시) | stderr warn + posting path를 사용자에게 직접 입력 요청 |
| 근거 파일 읽기 실패 | stderr warn + 해당 파일 없이 계속 진행 (`보강 필요 / 선택지 / 권장 행동` 강화) |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |

## Why this design

- **근거 분리 원칙**: posting 요구사항 × 후보자 근거 파일 교차 매핑으로 추측성 주장을 구조적으로 차단. 근거 부족 항목은 `보강 필요 / 선택지 / 권장 행동`으로 바꿔 후보자 스스로 보강할 포인트를 명시.
- **positions-queue 연계**: positions-queue에서 다음 행동 후보를 자동 식별. 직접 positions-queue 변경은 하지 않고 `Positions Queue Update Suggestion`으로 사용자 의사결정 유도 (ADR-038 — 상태 전이는 artifact 검증 뒤에만).
- **fos-study 격리**: 지원 전략은 후보자 의사결정 자산 — 공개 저장소에 흘리지 않음.
- **Phase 05 연계**: 본 skill이 생성한 Markdown 제출 초안을 `application-reviewer` skill이 pass/fail 판정. 본 skill은 생성만 담당.

## References

- `career-os/docs/adr/INDEX.md` — ADR-110 (frontdoor-queue 폐기, 지원 후보 positions-queue 직행 등록으로 단순화), ADR-038 (artifact 검증 후 상태 전이) 설계 근거
- `career-os/docs/data-schema.md` — positions-queue.jsonl 스키마
- `career-os/state/positions-queue.jsonl` — 지원 이력 원장
- `career-os/config/candidate-profile.md` — 후보자 프로필 core (사실·라벨)
- `career-os/config/candidate-profile-detail.md` — 후보자 프로필 detail (프로젝트 서사·의사결정 패턴·기술 스택 증거 상세)
- `references/candidate-interview-questions.md` — 후보자 인터뷰 질문 세트 (Step 3, 지원동기·서사 확보)
