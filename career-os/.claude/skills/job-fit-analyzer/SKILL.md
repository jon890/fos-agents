---
name: job-fit-analyzer
description: 타깃 직무(역할 단위) 대비 지원 의사결정·면접 전략·커리어 패스 정합을 진단하는 비공개 career-os skill. "타깃 직무 fit 분석", "이 역할 지원할까", "역할 핏 진단", "면접 전략 잡아줘", "이 직무 내 커리어에 맞나", "AI 에이전트 직무 진단", "backend 갭 분석", "job fit 체크", `/job-fit-analyzer [자연어 역할]`처럼 타깃 역할 기준 지원 판단과 강점·약점 전략을 진단해야 할 때 사용. 개별 공고 fit은 application-package-writer, 회사 최근 동향·active 공고 추천은 position-recommender, 답변 드릴 연습은 tech-interview-drill / behavioral-interview-drill, 면접 단계별 준비는 interview-stage-prep 담당. 공개 fos-study 발행은 하지 않는다.
---

# Job Fit Analyzer

타깃 직무(역할 단위) 기준으로 **지원 의사결정 + 면접 전략 + 커리어 패스 정합**을 진단하는 workflow (ADR-096).
산출물 정본은 구조화 JSON `JobFitRun`이고, `verdict`(go/no-go)·`careerPath`·`interviewStrategy`를 1급 가치로 둔다.
학습 갭(`reinforcement`)은 부차 필드로 내리고, 다음 스킬 라우팅은 `nextActions`로 구조화한다.

## 스킬 경계 (boundary)

아래는 이 스킬의 범위 밖이다:

- **개별 공고 단위 fit 분석** → `application-package-writer` 담당.
  특정 공고 URL·JD가 있으면 이쪽으로 라우팅.
- **회사 최근 동향·active 공고 추천·회사 평가** → `position-recommender` 담당.
  job-fit-analyzer는 역할 기준 진단에 집중하고, 회사 채용 동향이나 active 공고 수집은 하지 않는다.
- **기술 질문 답변 연습(드릴)** → `tech-interview-drill` 담당.
- **행동 질문 답변 연습(드릴)** → `behavioral-interview-drill` 담당.
- **면접 단계별 준비(단계별 실전 준비)** → `interview-stage-prep` 담당.
- **일반 학습 문서 생성** → `study-pack-writer`.
- **후보자 이력 기반 Q&A 자산 작성** → `interview-asset-writer`.

## 호출 후 타깃 해석

`/job-fit-analyzer [자연어 역할]` — 인자로 진단할 역할을 받는다.

- **인자가 있으면**: `targetRole.source = "argument"`.
  자연어 역할 텍스트를 그대로 `targetRole.role`에 쓰고, 역할 텍스트에서 슬러그를 만든다.
  슬러그는 소문자·숫자·하이픈만 허용한다 (예: "AI 에이전트 백엔드" → `ai-agent-backend`).
  회사·팀이 자연어에 드러나면 `company`·`team`에 채우고, 없으면 비워 둔다.
- **인자가 없으면**: `config/mvp-target.json`의 `primary`를 fallback으로 쓴다.
  `targetRole.source = "mvp-target"`, `company`·`team`·`role`을 `primary`에서 읽고,
  슬러그는 `primary.position_slug`(없으면 role에서 파생)로 쓴다.

자연어 역할로 진단하면 position-recommender가 추천한 직무를 mvp-target 고정 없이 바로 진단할 수 있다.

## 출력 정책

먼저 `references/output-policy.md`를 읽고 비공개 산출물 정책을 따른다.
진단은 비공개 내부 분석이지만 사용자가 바로 다음 행동을 정할 수 있어야 한다.
정본 JSON의 `verdict`와 `nextActions`가 첫 결론·다음 행동 역할을 하고, `render_job_fit.ts`가 md 첫 줄에 한 줄 결론을 둔다.
후보자 근거, 타깃 역할 맥락, 리스크 판단은 내부 분석에 유지한다.

## Inputs

현재 에이전트는 다음 파일을 직접 로드한다:

1. `career-os/config/mvp-target.json` — 인자 없을 때 타깃 fallback (`primary.company`, `primary.team`, `primary.role`, `primary.position_slug`)
2. `career-os/config/candidate-profile.md` — 후보자 이력·약점 (필수)
3. `career-os/config/baseline-core-files.json` — 큐레이션된 파일 경로 목록 (`files[].path`)
4. `career-os/sources/fos-study/<path>` — baseline-core-files에 나열된 파일 (각 파일 읽기)
5. (선택) `career-os/data/reports/job-fit-YYYY-MM-DD-<slug>.json` — 같은 슬러그의 가장 최근 지난 진단 (changeSince 채우기용)

## Workflow

### 1. fos-study git sync (셸 명령)

```bash
cd career-os/sources/fos-study
git pull --rebase --autostash
```

git pull 실패 시 → stderr warn + 로컬 캐시로 분석 계속.

### 2. 타깃 해석 + Context 로드

- 호출 인자에서 타깃을 해석한다 (위 "호출 후 타깃 해석").
- Inputs 1~4를 읽는다.
  `baseline-core-files.json`이 없으면 → stderr + exit 1.
  `candidate-profile.md`가 없으면 → stderr + exit 1.
- changeSince용 지난 진단 로드: `career-os/data/reports/`에서 같은 슬러그(`job-fit-*-<slug>.json`)의 가장 최근 지난 날짜 파일이 있으면 읽는다.

### 3. 분석 + JSON 정본 생성

`jobfit_schema.ts`의 `JobFitRun` 구조에 맞춰 분석 결과를 JSON으로 채운다.
사람이 읽는 Markdown은 이 JSON에서 파생하므로, 산문 markdown을 직접 쓰지 않는다.

저장 경로(정본): `career-os/data/reports/job-fit-YYYY-MM-DD-<slug>.json`

날짜는 Asia/Seoul 기준 (`TZ=Asia/Seoul date +%F`). UTC `new Date().toISOString()` 날짜를 사용하지 않는다.

`JobFitRun` 필드를 1급 가치 순으로 충실히 채운다 (`jobfit_schema.ts`가 필드 정의를 강제):

- `schemaVersion`(1) · `reportDate` · `generatedAt` · `targetRole`(source·role·slug 필수)
- **`verdict`** (1급) — `recommendation`(지원 권장 / 조건부 지원 / 보류) · `confidence`(강/중/약) · `rationale[]`
- **`careerPath`** (1급) — `expectedTrajectory[]` · `alignmentWithCurrent`(정합/확장/이탈) · `leverageOrRisk[]`
- `strengths[]` — `point` · `evidence`(candidate-profile 근거 필수) · `roleLeverage`
- `gaps[]` — `area` · `priority`(고/중/저) · `evidenceSupport` · `interviewRisk`
- **`interviewStrategy`** (1급) — `strengthPitch[]`(강점 어필) · `weaknessDefense[]`(약점 방어)
- `reinforcement` (부차) — `d30[]` · `d60[]` · `d90[]` 학습 갭. 1급 필드보다 가볍게 채운다.
- `interviewQuestions[]` — `q` · `risk` · `answerAngle`
- **`nextActions[]`** — `skill` · `input` · `why`. 다음 스킬 라우팅 (아래 6 참조)
- `changeSince`(선택) — 같은 슬러그 지난 진단이 있을 때만 (아래 5 참조)

분석 작성 규칙:

- 한국어 작성.
- 후보자 실제 이력 인용 필수 (`candidate-profile.md` 근거, generic advice 금지).
- `verdict.rationale`는 강점·갭·커리어 정합을 종합한 실제 지원 판단 근거로 쓴다.
- DB는 약점 가능성이 높은 영역으로 다루고 학습 노트 뒷받침 여부를 검증한다.
- 근거가 부족하면 raw `needs_evidence` 토큰을 쓰지 말고, `evidenceSupport`·`interviewRisk`에 보강 필요·선택지·권장 행동으로 풀어 쓴다.

### 4. 산출물 생성 — JSON 정본 + 파생

정본은 구조화 JSON이다. 정본 하나에서 md를 파생하므로 자체 markdown 파서를 거치지 않고 출력이 항상 일관된다.

```
쓰기 → career-os/data/reports/job-fit-YYYY-MM-DD-<slug>.json   (정본)
파생 → bun scripts/job-fit-analyzer/render_job_fit.ts --input <json> --format md --output career-os/data/reports/job-fit-YYYY-MM-DD-<slug>.md
```

`render_job_fit.ts`는 입력 JSON을 `JobFitRun.safeParse`로 먼저 검증하고, 실패하면 위반 필드를 stderr로 출력하며 exit 1한다.
자체 markdown을 직접 작성하지 않는다 — 렌더러가 정본에서 파생한다.

### 5. changeSince — 지난 진단 대비 변화

같은 슬러그의 가장 최근 지난 진단 JSON이 있으면 `changeSince`를 채운다 (없으면 필드 자체를 생략).

- `lastDate` — 지난 진단 날짜.
- `resolved[]` — 지난 진단의 갭 중 이번에 해소된 항목.
- `newGaps[]` — 이번에 새로 드러난 갭.
- `persisting[]` — 여전히 남아 있는 갭.

같은 역할을 반복 진단할 때 변화를 보여줘 반복 가치를 만든다.

### 6. nextActions — 다음 스킬 연결

`nextActions[]`로 다음 행동을 구조화한다.
**첫 액션은 `verdict.recommendation`에 따라 분기한다** — 진단이 "공부 목록"이 아니라 의사결정 산출물임을 끝까지 일관되게 유지하기 위함이다. study-pack은 부차 라우팅으로 둔다.

- **`verdict`가 "지원 권장" 또는 "조건부 지원"이면**: 첫 액션은 최우선 갭(`priority: "고"`) 보강이다.
  `skill: "study-pack-writer"`, `input: "<갭 주제>"`, `why: "최우선 갭 보강"`.
- **`verdict`가 "보류"이면**: 첫 액션은 학습 갭 보강이 아니라 **재탐색**이다.
  더 맞는 직무를 다시 찾거나(`position-recommender`) 다른 역할을 진단(`job-fit-analyzer`)하는 쪽으로 라우팅한다.
  `why: "현재 역할 핏이 낮아 보강보다 재탐색이 우선"`. 핏이 낮은데 갭만 메우는 공부로 모는 것을 피한다.
- 면접 답변 연습이 필요하면 `tech-interview-drill` / `behavioral-interview-drill` 라우팅.
- 개별 공고 지원 준비로 넘어가면 `application-package-writer` 라우팅.
- 면접 단계가 잡혀 있으면 `interview-stage-prep` 라우팅.

각 액션은 어떤 스킬에 무엇을 입력으로 넘기고 왜 그 행동인지를 명시한다.

### 7. Discord 알림 (셸 명령)

```bash
bun --env-file=career-os/.env _shared/lib/notify_discord.ts \
  "[완료] job-fit-analyzer: <slug> 역할 핏 진단 리포트 생성"
```

알림 실패는 비치명적 — stderr warn만, skill 자체는 success 종료.

## Self-check

산출물 검증은 **zod 스키마 검증**으로 한다 (ADR-096). 옛 markdown grep 8항목을 스키마가 대체한다.

`render_job_fit.ts`가 입력 JSON을 `JobFitRun.safeParse`로 검증하고, 실패하면 위반 필드를 stderr로 출력하며 exit 1한다.
즉 **4번의 md 파생 명령을 돌리는 것이 곧 self-check**다. 파생이 성공하면 아래 스키마 조건이 모두 충족된 것이다.

스키마 검증 (`render_job_fit.ts` 실행 시 자동) — `jobfit_schema.ts`의 `JobFitRun`이 보장:

- `schemaVersion` 1, `reportDate`·`generatedAt` 존재.
- `targetRole.source`가 `argument` 또는 `mvp-target` enum, `slug`가 소문자·숫자·하이픈.
- `verdict`·`careerPath`·`interviewStrategy` 1급 필드 채워짐.
- `strengths`·`gaps`·`nextActions` 최소 1개 이상.
- `verdict.recommendation`·`confidence`, `gaps[].priority`, `careerPath.alignmentWithCurrent`가 enum 값.

파생물 확인:

- `job-fit-YYYY-MM-DD-<slug>.md`가 정본 JSON에서 생성됨.

스키마로 잡히지 않는 사람-facing 점검:

- 후보자 이력 인용이 generic advice가 아닌 `candidate-profile.md` 구체 근거인지.
- raw `needs_evidence` 토큰이 사용자-facing 문장에 없음 (보강 필요·선택지·권장 행동으로 풀어 씀).
- 실제 제출·로그인·공개 발행·candidate-profile 수정 지시 없음 (필요시 `사용자 승인 필요`로만).
- 진단·전략 산출물이며 fos-study 공개 발행 대상이 아님.

스키마 검증 실패 시 해당 필드 보완 후 재생성. **최대 3회 시도**.
4회째도 실패 시 `stderr: job-fit-analyzer 검증 실패: <필드>`를 출력하고 exit 1로 종료한다.

## Error handling

| 상황 | 처리 |
|---|---|
| fos-study git pull 실패 | stderr warn + 로컬 캐시로 분석 계속 |
| baseline-core-files.json 없음 | stderr + exit 1 |
| candidate-profile.md 없음 | stderr + exit 1 |
| 지난 진단 JSON 없음 | changeSince 생략하고 계속 진행 |
| self-check(스키마 검증) 3회 실패 | stderr + exit 1, 실패 필드 명시 |
| Discord notify 실패 | stderr warn, skill success |

## Why this design

- **ADR-096 (의사결정·전략 재정의)**: 산출물 정본을 구조화 JSON `JobFitRun`으로 올리고, `verdict`·`careerPath`·`interviewStrategy`를 1급 필드로 둔다. `reinforcement`(학습 갭)는 부차로 내려, "공부 목록 생성기"에서 "지원 판단 + 면접 전략 + 커리어 정합" 진단으로 가치를 옮긴다.
- **자연어 타깃 override (ADR-096)**: `/job-fit-analyzer [역할]` 인자로 타깃을 받고, 없으면 mvp-target primary fallback. mvp-target 고정을 풀어 다른 직무 탐색 진단을 우회 표기 없이 수행한다.
- **JSON 정본 + 렌더러 파생 (ADR-096, ADR-094 패턴 재사용)**: `render_job_fit.ts`가 정본에서 md를 파생하고, self-check를 zod 검증으로 대체. 자체 markdown 파서를 폐기해 출력이 항상 일관되고, 진단 갭을 다음 스킬 입력으로 재사용하기 쉽다.
- **nextActions 구조화 (ADR-096)**: 다음 스킬 라우팅을 `nextActions{skill,input,why}`로 구조화. 첫 액션은 `verdict`에 따라 분기한다 — "지원 권장/조건부"면 study-pack 보강, "보류"면 재탐색(position-recommender / 다른 역할 job-fit). 핏이 낮은데도 갭 보강 공부로만 모는 것을 막아, 진단이 의사결정 산출물임을 일관되게 유지한다.
- **changeSince (ADR-096)**: 역할 슬러그 파일명으로 같은 역할 지난 진단 대비 변화를 보여줘 반복 진단 가치를 만든다.
- **경계 유지 (ADR-096)**: 회사 최근 동향은 범위 밖으로 두고 position-recommender(회사 평가)와 경계를 유지한다.
- **단일 모드 (ADR-092)**: baseline/daily/stage 3분기 대신 역할 단위 진단 단일 모드. stage 준비는 `interview-stage-prep`, 개별 공고 fit은 `application-package-writer` 책임.

## References

- `career-os/scripts/job-fit-analyzer/jobfit_schema.ts` — **산출물 정본 zod 스키마** (ADR-096). JSON을 채우기 전에 이 파일에서 `JobFitRun` 등 필드 정의를 확인한다.
- `career-os/scripts/job-fit-analyzer/render_job_fit.ts` — 정본 JSON에서 Markdown을 파생하는 렌더러. 입력 시 스키마 검증을 내장하므로 실행 자체가 self-check다.
- `career-os/docs/adr/INDEX.md` ADR-096 / ADR-092 — 본 설계 결정 근거
- `career-os/config/mvp-target.json` — 인자 없을 때 타깃 fallback (company / team / role)
- `career-os/config/baseline-core-files.json` — 진단 큐레이션 파일 목록
- `career-os/.claude/skills/job-fit-analyzer/references/output-policy.md` — 비공개 산출물 정책
- 관련 스킬: `position-recommender` — 회사 최근 동향·active 공고 추천 (경계 분리)
- 관련 스킬: `application-package-writer` — 개별 공고 단위 fit 분석 (라우팅 대상)
- 관련 스킬: `study-pack-writer` — 일반 학습 문서 생성 (nextActions 첫 라우팅 대상)
