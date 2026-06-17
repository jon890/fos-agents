## ADR-096 — job-fit-analyzer를 의사결정·전략 중심으로 재정의한다

- Status: Accepted
- Date: 2026-06-17

### 맥락

job-fit-analyzer는 [[ADR-092]]로 daily 모드를 제거하고 역할 단위 단일 모드가 됐다.
2026-06-17 AI 에이전트 직무로 실사용한 결과 세 가지 한계가 드러났다.

- **study-pack 전단계에 머문다**: 산출물이 30/60/90 학습 계획에 치우쳐, 다음 액션이 대부분 study-pack/drill 라우팅이다. 진단 고유 가치가 약해 "공부 목록 생성기"로 보인다.
- **mvp-target 고정**: 타깃을 `mvp-target.json`(CJ Foodville)에서만 읽어, AI 에이전트 같은 다른 직무 탐색 진단을 보고서에 "탐색 진단"이라 우회 표기해야 했다.
- **산문 markdown 산출물**: 진단 갭을 다음 스킬(study-pack/drill) 입력으로 재사용하려면 사람이 다시 옮겨야 한다.

진단의 진짜 가치는 "이 직무에 지원할지 + 강점을 어떻게 어필하고 약점을 어떻게 방어할지 + 내 커리어에 맞는지"인데, 현재 설계가 이를 약하게 다룬다.

### 결정

job-fit-analyzer를 **지원 의사결정 + 면접 전략 + 커리어 패스 정합** 중심으로 재정의한다.

- 산출물 정본을 구조화 JSON `JobFitRun`(schemaVersion 1)으로 올린다([[ADR-094]] 패턴 재사용).
  `verdict`(go/no-go)·`careerPath`·`interviewStrategy`를 1급 필드로 두고, `reinforcement`(학습 갭)는 부차 필드로 내린다.
- **자연어 타깃 override**: `/job-fit-analyzer [역할]` 인자로 타깃을 받고, 없으면 `mvp-target.json` primary fallback.
- **다음 스킬 연결**을 `nextActions{skill,input,why}`로 구조화한다. 최우선 갭은 study-pack 생성을 첫 액션으로 제안.
- **역할 슬러그 파일명**(`job-fit-YYYY-MM-DD-<slug>.{json,md}`), 같은 역할 지난 진단 대비 `changeSince`.
- `render_job_fit.ts`가 JSON에서 md를 파생하고, self-check를 zod 검증으로 대체한다.

핵심 전환: 진단의 고유 가치를 "학습 갭 나열"에서 **"지원 판단 + 면접 전략 + 커리어 정합"**으로 옮긴다. study-pack은 부차 라우팅으로 남는다.

### 결과

- job-fit이 study-pack 전단계를 넘어 의사결정·전략 산출물로 선다.
- 자연어 타깃으로 추천(position-recommender)한 직무를 바로 진단할 수 있다.
- JSON 정본으로 다음 스킬 입력 재사용이 쉬워진다.
- 같은 역할 반복 진단 시 변화(`changeSince`)를 보여줘 반복 가치가 생긴다.
- 회사 최근 동향은 범위 밖으로 두고 position-recommender(회사 평가)와 경계를 유지한다.

### 적용

- 스키마 `scripts/job-fit-analyzer/jobfit_schema.ts`, 렌더러 `render_job_fit.ts`([[ADR-019]] scripts 분리 컨벤션).
- 구현은 plan088 phase로 옮긴다(스키마 → 렌더러 → SKILL 재작성 → 통합 검증).
- 데이터 스키마·흐름·코드 구조·기능 표는 `data-schema.md`·`flow.md`·`code-architecture.md`·`prd.md`에 반영한다.
- [[ADR-092]](daily 제거·역할 단일모드) 위에 서고, [[ADR-094]](JSON 정본 패턴)를 재사용한다.
