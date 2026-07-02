---
name: interview-stage-prep
description: 1차·최종·오퍼 단계별 면접 실전 준비를 생성하는 비공개 career-os skill. "1차 면접 준비", "최종 면접 준비", "오퍼 협상 준비", "단계별 면접 준비", "면접 다음 단계 준비", "stage prep", `/interview-stage-prep`처럼 현재 면접 단계에 맞는 실전 준비 가이드가 필요할 때 사용. 드릴(매일 답변 연습)은 tech-interview-drill / behavioral-interview-drill, 공고 fit 분석은 application-package-writer, 역할 기준 핏·갭 진단은 job-fit-analyzer 담당.
---

# Interview Stage Prep

현재 면접 단계(`config/mvp-target.json`의 `interview` 필드)를 읽고 단계에 맞는 실전 준비 가이드를 생성하는 workflow.

## 스킬 경계 (boundary)

아래는 이 스킬의 범위 밖이다:

- **매일 기술 질문 답변 연습(드릴)** → `tech-interview-drill` 담당.
- **매일 인성 질문 답변 연습(드릴)** → `behavioral-interview-drill` 담당.
- **공고별 fit 분석 및 지원 패키지** → `application-package-writer` 담당.
- **역할 단위 핏·갭 진단** → `job-fit-analyzer` 담당.

## Inputs

현재 에이전트는 다음 파일을 직접 로드한다:

1. `career-os/config/mvp-target.json` — `primary.interview` (단계별 날짜/상태), `primary.company`, `primary.role`
2. `career-os/config/candidate-profile.md` — 후보자 이력·약점·강점 (필수)

최종/2차 인성면접 산출물을 생성할 때는 추가로 확인한다:

3. `public/question-bank/behavioral/questions.json` — 공개 인성 질문 풀 (있으면 참고)
4. `private/<target>/interview/**` 또는 `primary.data_root/interview/**` — 기존 회사별 준비 자료와 current-practice (있으면 참고)

## 2차/최종·인성면접 daily artifact 모드

트리거: `second-round`, `final`, `personality-draft`, `2차`, `최종`, `인성면접`, 또는 `mvp-target.json`에 1차 종료/2차 대비 문구가 있을 때.

이 모드에서는 1차 기술면접 드릴을 만들지 않는다.
`mvp-target.json`에 오래된 1차 표현이 남아 있어도 1차가 종료됐다는 최신 지시와 `primary.notes`를 우선해 2차/최종·인성면접으로 작성한다.

### 산출물 경로

1. `primary.data_root`를 기준으로 아래 두 파일을 쓴다.
   - `<primary.data_root>/interview/personality-question-bank-YYYY-MM-DD.md`
   - `<primary.data_root>/interview/current-practice.md`
2. `primary.data_root`가 상대 경로이면 현재 실행 중인 career-os 워크스페이스 루트 기준으로 해석한다.
   사용자가 `/home/.../career-os` 같은 절대 경로를 줬더라도, 파일 도구가 보호 정책으로 쓰기를 거부하면 곧바로 fallback하지 말고 동일 repo의 활성 워크스페이스 경로(`/opt/data/...` 등 현재 cwd 기준)로 한 번 재시도한다.
   이때 최종 응답의 저장 파일 경로는 private 절대 경로가 아니라 `primary.data_root` 기준 상대 경로로 보고한다.
3. 경로 해석이 불가능하거나 활성 워크스페이스 기준 재시도도 실패할 때만 `data/reports/daily/YYYY-MM-DD/interview-second-round/report.md`로 fallback하고, 완료 보고에 fallback 이유를 밝힌다.
4. 저장 후 파일 존재와 비어 있지 않음, 질문 수 50개, current-practice Top 10개를 검증한다.

### 내용 구성

- `personality-question-bank-YYYY-MM-DD.md`에는 후보자 맞춤 50문항을 만든다.
- 각 문항에는 15초짜리 한 줄 답변 방향만 붙인다.
  모든 답변을 길게 확장하지 않는다.
- `current-practice.md`에는 오늘 우선 연습할 Top 10과 1번 질문의 답변 시작점만 담는다.
- 기존 `current-practice.md`에 더 나은 active set이 있으면 무조건 덮어쓰기보다 유지·갱신한다.

### 답변 주도권 원칙

면접 준비에서는 사용자가 먼저 자신의 생각과 답변을 말하고, 에이전트가 이를 보강·정리·다듬는 방식을 우선한다.
사용자가 명시적으로 "초안 작성", "답변 예시", "스크립트 만들어줘"라고 요청하지 않는 한 완성 답변 초안을 먼저 길게 만들지 않는다.
대신 아래 형태로 준비를 돕는다:

- 회사·직무 리서치 핵심 포인트
- 답변에 사용할 수 있는 근거와 피해야 할 과장
- 말하기 순서와 셀프 체크 질문
- 사용자의 원문 답변을 받은 뒤 문장, 구조, 근거, 톤 보강

이 원칙의 이유는 사용자가 단순히 에이전트 답변을 외우는 방식이 아니라, 스스로 생각한 내용을 바탕으로 자신의 밸류를 만들기 위함이다.

### 2차/최종·인성면접 테마

반드시 아래 축을 우선한다:

- 이직 동기와 CJ Foodville 지원동기
- 오너십, 협업, 갈등, 실패, 압박, 모호함 대응
- F&B/e-commerce/digital channel backend의 고객·매장 운영 관점
- 제품·운영·이해관계자와의 커뮤니케이션
- 직책 없는 리더십과 팀 생산성 기여
- AI/backend 경험의 안전한 연결: 과장하지 말고 문서화·검증·자동화·팀 생산성 근거로만 사용

금지:

- “1차 면접 연습”, “기술면접 직전”처럼 stale first-round wording 사용
- 1차용 기술 deep dive 5문항 생성
- 출처 없는 수치, 팀 규모, 성과율 생성

### Discord-facing 완료 응답

최종 응답에는 50문항 전체를 붙이지 않는다.
아래만 짧게 보낸다:

- 오늘의 초점 2-3개 bullet
- Top 10 우선 질문 짧은 줄
- 지금 답할 1번 질문
- 저장 파일 경로
- 검증 결과 한 줄

스케줄러가 `Skill(s) not found and skipped: ...` 같은 누락 skill 공지를 요구한 경우에는 최종 응답 첫 줄에 그 공지를 그대로 먼저 둔다.
누락된 skill이 있어도 현재 요청이 `second-round` / `personality-draft` 산출물 생성이면 이 skill의 2차/최종·인성면접 daily artifact 모드로 계속 처리한다.

마지막 줄은 필요 시 다음 문구로 닫는다:

`오늘은 1번부터 답해보면 내가 면접관처럼 꼬리질문할게.`

### 검증 주의점

질문 수를 검증할 때 `오늘 우선 연습 10개` 섹션의 번호까지 같이 세지 않는다.
`personality-question-bank-YYYY-MM-DD.md`에서는 본문 50문항만 세고, Top 10은 별도로 검증한다.
예: `오늘 우선 연습 10개` 헤더가 나오기 전까지만 `^[0-9]+\. ` 패턴을 카운트한다.

## 단계 감지

`mvp-target.json`의 `primary.interview` 필드를 읽어 현재 단계를 판단한다:

| 필드 | 단계 | 준비 모드 |
|---|---|---|
| `first_round` 날짜 있음, `final_round` null | 1차 면접 준비 | 기술 역량 중심 |
| `final_round` 날짜 있음, `offer_chat` null | 최종 면접 준비 | 가치관·문화 핏 중심 |
| `offer_chat` 날짜 있음 | 오퍼 협상 준비 | 보상·조건 협상 중심 |
| 모두 null 또는 모두 완료 | 다음 단계 대기 | 범용 단계별 체크리스트 출력 |

## Workflow

### 1. Context 로드

```bash
# mvp-target.json 읽기
cat career-os/config/mvp-target.json
# candidate-profile.md 읽기
cat career-os/config/candidate-profile.md
```

파일이 없으면 → stderr + exit 1.

### 2. 단계 감지 및 준비 가이드 작성

단계에 따라 아래 내용으로 보고서를 직접 작성한다.

저장 경로: `career-os/data/reports/stage-prep-YYYY-MM-DD.md`

첫 줄: `# 면접 단계별 준비 가이드 — YYYY-MM-DD`

#### 1차 면접 준비 섹션

1. **면접 개요** — 회사·팀·역할·예정 날짜
2. **기술 역량 집중 영역** — `candidate-profile.md`의 약점 기반 1차 면접 핵심 기술 토픽 3-5개
3. **예상 기술 질문 목록** — 역할·스택 기준 10-15개, 각 질문에 답변 힌트 1줄
4. **포트폴리오 강조 포인트** — 이 역할에서 내세울 프로젝트·경험 2-3개, 핵심 메시지
5. **드릴 연계** — `tech-interview-drill`로 연습할 약점 토픽 목록
6. **면접 당일 체크리스트** — 복장·장소·준비물·10분 전 복습 루틴

#### 최종 면접 준비 섹션

1. **면접 개요** — 회사·팀·역할·예정 날짜, 1차 통과 핵심 강점 요약
2. **가치관·문화 핏 포인트** — 회사 미션·팀 스타일 기반 핵심 메시지 3개
3. **회사·팀 리서치 포인트** — 최근 뉴스·제품·조직 변화 파악할 항목
4. **예상 인성·가치관 질문** — STAR 구조 대응 10개, 각 질문에 내 경험 연결 힌트
5. **드릴 연계** — `behavioral-interview-drill`로 연습할 STAR 시나리오
6. **최종 면접 체크리스트** — 역질문 준비·팀 문화 체크·리더십 경험 정리

#### 오퍼 협상 준비 섹션

1. **협상 개요** — 오퍼 날짜·조건 요약 (mvp-target.json 기준)
2. **보상 체크리스트** — 기본급·인센티브·스톡옵션·연봉 인상 기준 확인 항목
3. **성장 기회 체크리스트** — 교육 지원·승진 경로·프로젝트 자율성 확인 항목
4. **팀 환경 체크리스트** — 온보딩·코드 리뷰 문화·근무 방식 확인 항목
5. **역협상 포인트** — 내가 요청할 수 있는 조건 2-3개, 근거와 접근법
6. **결정 프레임워크** — 수락/보류/거절 판단 기준

#### 범용 체크리스트 (단계 미결정 시)

단계가 null이거나 모두 완료된 경우에는 아래 범용 가이드를 출력한다:

1. 현재 `primary.interview` 상태 요약
2. 각 단계(1차·최종·협상)별 준비 항목 개요
3. 다음 단계 준비 시작 시점 권장

### 3. 공통 출력 규칙

- 한국어 작성
- `mvp-target.json`의 `primary.company` · `primary.team` · `primary.role` 명시
- `candidate-profile.md` 실제 이력 인용 (generic advice 금지, 후보자 근거 필수)
- 메타 보고 문구 금지 ("파일이 생성되었습니다" 등) — 보고서 본문만 작성

### 4. Discord 알림

```bash
bun --env-file=career-os/.env _shared/lib/notify_discord.ts \
  "[완료] interview-stage-prep: 단계별 면접 준비 가이드 생성"
```

알림 실패는 비치명적 — stderr warn만, skill 자체는 success 종료.

## Self-check

보고서 작성 후 자기 점검 (재작성 ≤3회):

1. 첫 줄 `# ` 시작
2. 현재 단계에 맞는 섹션 헤더 모두 존재
3. `mvp-target.json` 회사·롤 명시 여부 확인
4. `candidate-profile.md` 이력 인용 1건 이상
5. 한국어 작성 확인
6. generic advice 없이 후보자 근거 기반 내용으로 구성

실패 항목이 있으면 수정 후 재작성. 최대 3회 시도.
4회째도 실패 시 stderr에 `interview-stage-prep 검증 실패: <항목>` + exit 1.

## Error handling

| 상황 | 처리 |
|---|---|
| mvp-target.json 없음 | stderr + exit 1 |
| candidate-profile.md 없음 | stderr + exit 1 |
| interview 필드 모두 null | 범용 체크리스트 출력 (exit 0) |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |
| Discord notify 실패 | stderr warn, skill success |

## References

- `career-os/config/mvp-target.json` — 현재 면접 단계 (interview.first_round / final_round / offer_chat)
- `career-os/config/candidate-profile.md` — 후보자 이력·약점
- 관련 스킬: `tech-interview-drill` — 기술 질문 드릴 (1차 면접 준비 연계)
- 관련 스킬: `behavioral-interview-drill` — 인성 질문 드릴 (최종 면접 준비 연계)
- 관련 스킬: `application-package-writer` — 개별 공고 fit 분석
- 관련 스킬: `job-fit-analyzer` — 역할 단위 핏·갭 진단
