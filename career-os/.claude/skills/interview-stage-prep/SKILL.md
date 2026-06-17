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
