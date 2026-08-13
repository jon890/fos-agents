## ADR-096 — job-fit-analyzer를 의사결정·전략 중심으로 재정의한다

- Status: Accepted
- Date: 2026-06-17

### 맥락

job-fit-analyzer는 [[ADR-092]]로 daily 모드를 제거하고 역할 단위 단일 모드가 됐다.
2026-06-17 AI 에이전트 직무로 실사용한 결과 세 가지 한계가 드러났다.

- **학습 문서 생성 전단계에 머문다**: 산출물이 30/60/90 학습 계획에 치우쳐 진단 고유 가치가 약해 보인다.
- **current-target 고정**: 타깃을 `current-target.json`(CJ Foodville)에서만 읽어, AI 에이전트 같은 다른 직무 탐색 진단을 보고서에 "탐색 진단"이라 우회 표기해야 했다.
- **산문 markdown 산출물**: 진단 갭을 다음 추천과 드릴 입력으로 재사용하려면 사람이 다시 옮겨야 한다.

진단의 진짜 가치는 "이 직무에 지원할지 + 강점을 어떻게 어필하고 약점을 어떻게 방어할지 + 내 커리어에 맞는지"인데, 현재 설계가 이를 약하게 다룬다.

### 결정

job-fit-analyzer를 **지원 의사결정 + 면접 전략 + 커리어 패스 정합** 중심으로 재정의한다.

- 구조화 JSON `JobFitRun`을 결과의 기준 데이터로 사용한다.
  - `schemaVersion`은 1이다.
  `verdict`(go/no-go)·`careerPath`·`interviewStrategy`를 1급 필드로 두고, `reinforcement`(학습 갭)는 부차 필드로 내린다.
- **자연어 타깃 override**: `/job-fit-analyzer [역할]` 인자로 타깃을 받고, 없으면 `current-target.json` primary fallback.
- **다음 스킬 연결**을 `nextActions{skill,input,why}`로 구조화한다. 최우선 갭은 외부 읽을거리 추천 입력으로 전달한다.
- **역할 슬러그 파일명**(`job-fit-YYYY-MM-DD-<slug>.{json,md}`), 같은 역할 지난 진단 대비 `changeSince`.
- `render_job_fit.ts`가 JSON에서 md를 파생하고, self-check를 zod 검증으로 대체한다.

핵심 전환: 진단의 고유 가치를 "학습 갭 나열"에서 **"지원 판단 + 면접 전략 + 커리어 정합"**으로 옮긴다.

### 결과

- job-fit이 학습 목록 생성을 넘어 의사결정·전략 산출물로 선다.
- 자연어 타깃으로 추천(position-recommender)한 직무를 바로 진단할 수 있다.
- 기준 JSON으로 다음 skill의 입력 재사용이 쉬워진다.
- 같은 역할 반복 진단 시 변화(`changeSince`)를 보여줘 반복 가치가 생긴다.
- 회사 최근 동향은 범위 밖으로 두고 position-recommender(회사 평가)와 경계를 유지한다.

### 적용

- 스키마는 `scripts/job-fit-analyzer/jobfit_schema.ts`에 둔다.
- 렌더러는 `scripts/job-fit-analyzer/render_job_fit.ts`에 둔다.
- 데이터 스키마·흐름·코드 구조·기능 표는 `data-schema.md`·`flow.md`·`code-architecture.md`·`prd.md`에 반영한다.
- 역할 단위 진단은 [[ADR-092]]를 따른다.
- JSON 결과를 기준으로 표시 파일을 만드는 방식은 [[ADR-101]]을 재사용한다.
