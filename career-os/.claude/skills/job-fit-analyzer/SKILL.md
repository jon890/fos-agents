---
name: job-fit-analyzer
description: 타깃 직무(역할 단위) 대비 후보자 핏·부족분을 1회/주기로 진단하는 비공개 career-os skill. "타깃 직무 fit 분석", "역할 핏 진단", "부족분 갭 분석", "이 역할에 내가 맞나", "면접 준비 갭", "backend 갭 분석", "job fit 체크", `/job-fit-analyzer`처럼 타깃 역할 기준 강점·부족분을 진단해야 할 때 사용. 개별 공고 fit은 application-package-writer, 답변 드릴 연습은 tech-interview-drill / behavioral-interview-drill, 면접 단계별 준비는 interview-stage-prep 담당. 공개 fos-study 발행은 하지 않는다.
---

# Job Fit Analyzer

타깃 직무(역할 단위) 기준으로 후보자 핏·부족분을 진단하는 workflow.
`config/mvp-target.json`의 역할 정보와 `config/candidate-profile.md`의 후보자 이력을 읽고
강점, 부족분, 우선 보강 영역을 단일 보고서로 산출한다.

## 스킬 경계 (boundary)

아래는 이 스킬의 범위 밖이다:

- **개별 공고 단위 fit 분석** → `application-package-writer` 담당.
  특정 공고 URL·JD가 있으면 이쪽으로 라우팅.
- **기술 질문 답변 연습(드릴)** → `tech-interview-drill` 담당 (plan086 phase-03).
- **행동 질문 답변 연습(드릴)** → `behavioral-interview-drill` 담당 (plan086 phase-04).
- **면접 단계별 준비(단계별 실전 준비)** → `interview-stage-prep` 담당.
- **일반 학습 문서 생성** → `study-pack-writer`.
- **후보자 이력 기반 Q&A 자산 작성** → `interview-asset-writer`.

## 출력 정책

먼저 `references/output-policy.md`를 읽고 비공개 산출물 정책을 따른다.
진단 보고서는 비공개 내부 분석이지만 사용자가 바로 다음 행동을 정할 수 있어야 한다.
첫 10줄 안에 결론, 핵심 부족 영역, 또는 권장 행동을 둔다.
후보자 근거, 타깃 역할 맥락, 리스크 판단은 내부 분석에 유지한다.

## Inputs

현재 에이전트는 다음 파일을 직접 로드한다:

1. `career-os/config/mvp-target.json` — `primary.company`, `primary.team`, `primary.role`, `primary.data_root`
2. `career-os/config/candidate-profile.md` — 후보자 이력·약점 (필수)
3. `career-os/config/baseline-core-files.json` — 큐레이션된 파일 경로 목록 (`files[].path`)
4. `career-os/sources/fos-study/<path>` — baseline-core-files에 나열된 파일 (각 파일 읽기)

## Workflow

### 1. fos-study git sync (셸 명령)

```bash
cd career-os/sources/fos-study
git pull --rebase --autostash
```

git pull 실패 시 → stderr warn + 로컬 캐시로 분석 계속.
오프라인 분석 시 보고서 첫 줄 아래 "(오프라인 분석 — git sync 실패)" 경고 1줄 추가.

### 2. Context 로드

Inputs에 나열된 파일을 모두 읽는다.
`baseline-core-files.json`이 없으면 → stderr + exit 1.
`candidate-profile.md`가 없으면 → stderr + exit 1.

### 3. 분석 + 보고서 작성

파일 쓰기로 마크다운 직접 작성. JSON 출력·JSON schema 불사용 — agent skill 패턴.

저장 경로: `career-os/data/reports/job-fit-YYYY-MM-DD.md`

첫 줄: `# 타깃 직무 핏 진단 — YYYY-MM-DD`

6개 섹션 (모두 필수):

1. 진단 범위 요약 (타깃 역할·회사·분석 날짜)
2. 현재 강점 (타깃 역할 기준 핵심 강점 3-5개, 후보자 이력 인용 필수)
3. 부족분·갭 (면접 고위험 영역, 학습 노트 뒷받침 여부 포함)
4. 우선 보강 영역 (지원 전·시즌 시작 전 집중해야 할 영역, 30/60/90일 기준)
5. 예상 면접 질문 샘플 (부족분에서 도출한 3-5개)
6. 다음 액션 (어떤 스킬로 무엇을 할지: drill·stage-prep·study-pack 라우팅 포함)

#### 공통 출력 규칙

- 한국어 작성
- `mvp-target.json`의 `primary.company` · `primary.team` · `primary.role` 명시
- 후보자 실제 이력 인용 필수 (`candidate-profile.md` 근거, generic advice 금지)
- DB는 약점 가능성이 높은 영역으로 다루고 학습 노트 뒷받침 여부 검증
- 근거가 부족한 항목은 raw `needs_evidence` 대신 `보강 필요 / 선택지 / 권장 행동`으로 쓴다
- 메타 보고 문구 금지 ("파일이 생성되었습니다" 등) — 보고서 본문만 작성

### 4. Discord 알림 (셸 명령)

```bash
bun --env-file=career-os/.env _shared/lib/notify_discord.ts \
  "[완료] job-fit-analyzer: primary.data_root 기반 진단 리포트 생성"
```

알림 실패는 비치명적 — stderr warn만, skill 자체는 success 종료.

## Self-check

보고서 작성 후 자기 점검 (재작성 ≤3회):

1. 첫 줄 `# ` 시작 (`## ` 아닌)
2. 6개 섹션 헤더 모두 존재 ("진단 범위", "강점", "부족분", "우선 보강", "예상 면접", "다음 액션" 포함)
3. `mvp-target.json` 회사·롤 명시 여부 확인
4. 후보자 이력 인용 1건 이상 (`candidate-profile` 구체 근거)
5. 한국어 작성 확인
6. 첫 10줄 안에 결론, 핵심 부족 영역, 또는 권장 행동이 있음
7. raw `needs_evidence`가 남아 있지 않음
8. daily 모드, stage 모드, study-progress 갱신 로직이 없음

실패 항목이 있으면 수정 후 재작성. **최대 3회 시도**.
4회째도 실패 시 stderr에 `job-fit-analyzer 검증 실패: <항목>` + exit 1.

## Error handling

| 상황 | 처리 |
|---|---|
| fos-study git pull 실패 | stderr warn + 로컬 캐시로 분석 계속 |
| baseline-core-files.json 없음 | stderr + exit 1 |
| candidate-profile.md 없음 | stderr + exit 1 |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |
| Discord notify 실패 | stderr warn, skill success |

## Why this design

- **daily 모드 제거 (ADR-092)**: 매일 토픽별 집중 점검은 드릴 스킬(`tech-interview-drill`, `behavioral-interview-drill`)이 담당.
  job-fit-analyzer는 역할 단위 핏·갭 진단에 집중하고 반복 실행 부담을 줄인다.
- **단일 모드 (ADR-092)**: baseline/daily/stage 3분기 대신 역할 단위 진단 단일 모드로 단순화.
  stage 준비는 `interview-stage-prep`으로 분리.
- **입자 분리 (ADR-092)**: 개별 공고 단위 fit은 `application-package-writer` 책임.
  job-fit-analyzer는 공고 없이도 타깃 역할 기준 baseline fit 진단을 수행.

## References

- `career-os/docs/adr/ADR-092-*.md` — 면접 준비 flow 재편 결정 근거
- `career-os/config/mvp-target.json` — 현재 면접 타깃 (company / team / role)
- `career-os/config/baseline-core-files.json` — 진단 큐레이션 파일 목록
- `career-os/.claude/skills/job-fit-analyzer/references/output-policy.md` — 비공개 산출물 정책
- 관련 스킬: `application-package-writer` — 개별 공고 단위 fit 분석 (라우팅 대상)
- 관련 스킬: `study-pack-writer` — 일반 학습 문서 생성
- 관련 스킬: `interview-asset-writer` — 후보자 이력 기반 면접 자산

