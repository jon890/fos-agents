---
name: interview-asset-writer
description: 후보자 이력 기반 면접 자산 마크다운 초안을 생성하는 career-os skill. "면접 자료 만들어줘", "경험 기반 질문 정리", "AI 서비스팀 면접 질문 은행", "experience qbank", "자기소개 플레이북", "마스터 플레이북", `/interview-asset-writer <topic>`처럼 후보자 이력서·task 노트 기반 Q&A 질문 은행이나 마스터 플레이북이 필요할 때 사용. 일반 기술 토픽 학습 문서는 study-pack-writer로 라우팅. 사용자가 명시적으로 공개 발행을 승인한 경우에만 sources/fos-study commit/push를 수행한다.
---

# Interview Asset Writer

후보자 이력 기반 면접 자산 마크다운 생성·검증·발행 workflow. 두 형식 자동 분기:

- **Q&A 질문 은행** (옛 experience-question-bank-writer): 5 main Q + 5 follow-up + answer points + 1분 답변 + 압박 방어
- **마스터 플레이북** (옛 interview-master-writer): 자기소개 / 커리어 narrative / 기술 의사결정 스타일 / 역질문 / 최종 체크리스트

## 출력 정책

먼저 `references/output-policy.md`를 읽고 공개 산출물 정책을 따른다.
interview asset은 후보자 이력 기반 자료지만 `fos-study` 공개 발행 경로를 가진다.
후보자 private 평가, 특정 회사 지원 전략, reviewer 판단은 공개 본문에 복사하지 않는다.
후보자 이력 근거는 공개 가능하도록 일반화하고, 내부 URL과 비공개 시스템명은 제거하거나 비공개 career-os note로 분리한다.
공개 발행은 사용자 명시 승인 후에만 수행한다.

## 호출 후 입력 해석

- `qbank`, `question-bank`, "질문 은행", "Q&A" 신호가 있으면 Q&A 질문 은행 형식으로 작성한다.
- `master`, `playbook`, "마스터", "플레이북" 신호가 있으면 마스터 플레이북 형식으로 작성한다.
- 일반 기술 토픽 학습 문서로 보이면 `study-pack-writer`로 라우팅한다.

## Inputs

현재 에이전트는 다음 파일과 명령 출력을 직접 로드:

1. `career-os/public/question-bank/` inventory — 공개 질문 bank 정본. 질문 본문은 public-safe JSON에서만 읽는다.
2. `career-os/config/question-bank-topics.json` — 선택 사항. public bank 정본이 아니라 interview asset 전용 `<topic-key>` override 후보 → `outputPath` / `domain` / `title` / `inputFiles` / `promptAppend`
3. `career-os/config/candidate-profile.md` — 11섹션 prose, 후보자 이력 (필수)
4. `career-os/config/mvp-target.json` — `primary.company`, `primary.role` (현재 면접 타깃)
5. `career-os/task/*` 또는 `career-os/resume/*` — `inputFiles` 명시되면 그 파일들, 아니면 candidate-profile에서 참조하는 경로
6. (선택) `sources/fos-study/<유사 outputPath>.md` — overlap 회피

## Workflow

### 1. Topic 해석 + 형식 판단

인자가 topic-key (kebab-case)면 먼저 `public/question-bank` category와 id inventory를 확인한다.
그다음 `question-bank-topics.json`을 interview asset 전용 override 후보로만 매칭한다.
자연어면 public bank category/tag와 override description/domain 순서로 유사 매칭한다.
매칭 실패 시 **freeform 모드**: outputPath 본인이 결정.

산출물 형식 판단:
- **Q&A 질문 은행**: topic-key에 `qbank` / `question-bank` / `experience-` 포함, 또는 자연어에 "질문 은행" / "Q&A" / "qbank" 언급
- **마스터 플레이북**: topic-key에 `master` / `playbook` 포함, 또는 자연어에 "마스터" / "플레이북" / "master playbook" 언급
- 모호하면 사용자에게 확인 (기본값 Q&A 질문 은행). 비대화형 환경에서 모호 → 기본값 Q&A 질문 은행으로 자동 진행.

stderr에 결정 근거 1줄 로그 (예: `[interview-asset] topic=experience-qbank-ai-service-team → Q&A 질문 은행 형식`).

### 2. Context 로드

Inputs 1~5 모두 읽는다. `inputFiles` 명시되면 task/resume 추가로 읽는다.

### 3. Overlap 점검 (선택)

`sources/fos-study/<outputPath 디렉터리>`에 유사 파일 있으면 update 의도 확인. 비대화형 환경에서 유사 파일 발견 시 → update 모드로 자동 진행. update면 기존 본문 읽어서 통합 작성.

### 4. 마크다운 작성

공통 구조:
- 첫 줄: `# [초안] <topic-title>` (단일 `#`, `## ` 시작 금지, `# 초안:` / `# Draft:` 금지)
- ≥80줄
- 모든 ` ``` ` 코드 펜스에 언어 명시

#### 4-A. Q&A 질문 은행 형식

저장 경로: `career-os/sources/fos-study/interview/experience-based/<topic>.md`

본문 구조 (각 항목 모두 필수):
- **메인 질문 정확히 5개** + 각 메인 질문에 **follow-up 정확히 5개** + 각 메인 질문에 다음 부속 섹션:
  - **interviewer intent** — 면접관이 왜 이 질문을 던지는지
  - **answer points** — 답변 핵심 포인트 3-5개
  - **1분 답변 구조** — 도입·핵심·마무리 흐름
  - **압박 질문 방어** — 추가 압박 시 대응
  - **피해야 할 약한 답변** (weak answers to avoid) — 면접관이 negative로 받는 표현/접근
- **자기소개 1분 + 동기·회사 적합도** (확장 영역 2개) 별도 섹션
- 모든 내용은 후보자의 *실제 task/resume*에서 구체 근거 인용 (generic advice 금지)
- trade-off · 실제 설계 맥락 우선 (slogan 금지)

#### 4-B. 마스터 플레이북 형식

저장 경로: `career-os/sources/fos-study/interview/<topic>.md` (master-playbook은 cross-track이라 family 폴더 없이 interview/ 바로 아래)

본문 구조:
- 5 섹션 모두 포함: 자기소개 / 커리어 narrative / 기술 의사결정 스타일 / 역질문 / 최종 체크리스트
- **회사 불문 cross-track 톤** — 특정 회사명·면접일 직접 박지 않음 (mvp-target.json 값 참고만)

#### 공통 출력 규칙

- 파일 쓰기로 *markdown 직접 작성* (JSON 출력 금지, JSON schema 따르지 않음 — agent skill 패턴)
- 메타 보고 문구 금지 ("파일이 생성되었습니다", "문서 구성 요약", "아래와 같이" 등) — 본문 자체를 작성
- 첫 줄 `# [초안] <topic-title>` 형식. 작성 후에는 본문만 출력하지 *작성했다는 보고*는 하지 않음.
- 공개 본문에 `needs_evidence`를 남기지 않고, 필요한 경우 `보강 필요 / 선택지 / 권장 행동`으로 바꾼다.

### 5. Self-check (재작성 ≤3회)

#### 5-A. 공통 항목

1. 첫 줄 `# ` 시작 (`## ` 아닌)
2. 총 줄 수 ≥80
3. 모든 펜스 언어 지정
4. 금지 prefix 부재
5. 첫 10줄 안에 문서 목적, 결론, 또는 권장 행동이 있음
6. 섹션 제목은 한국어 우선이며 자연스러운 한국어 문장으로 작성됨
7. raw `needs_evidence`가 남아 있지 않고 필요한 경우 `보강 필요 / 선택지 / 권장 행동`으로 바뀌어 있음
8. 내부 분석, 특정 회사 지원 전략, reviewer 판단이 공개용 문구와 섞이지 않음
9. 사용자 승인 없이 공개 publish가 실행되지 않음

#### 5-B. Q&A 질문 은행 추가 항목

10. 메인 질문 ≥5개 (헤더에 "Q" 또는 "질문" 키워드로 카운트)
11. 각 메인 질문에 follow-up 1개 이상 + answer points 섹션 존재
12. 1분 답변 + 압박 질문 방어 섹션 존재

#### 5-C. 마스터 플레이북 추가 항목

10. 5 섹션 헤더 모두 존재
11. 회사명·면접일 직접 명시 없음 (cross-track 톤)

실패 항목이 있으면 그 항목 수정 후 재작성·재검증. **최대 3회 시도**. 4회째도 실패 시 stderr에 `interview-asset 검증 실패: <항목>` + 종료 (exit 1).

본 self-check가 옛 JSON schema 검증을 대체. 객관적 기준(첫 줄·줄 수·펜스·섹션 헤더) self-check가 신뢰 가능. 3회 cap은 무한 루프 차단.

### 6. Publish (사용자 승인 후에만)

사용자가 공개 발행과 commit/push를 명시 승인하지 않았으면 여기서 멈춘다.
최종 응답에는 생성·수정한 초안 경로, self-check 결과, 발행 보류 사유를 적는다.
`[초안]` 제목은 유지한다.

사용자가 명시 승인한 경우에만 다음 셸 명령을 실행한다.

```bash
cd career-os/sources/fos-study
git pull --rebase --autostash
git add <outputPath>
git commit -m "docs(interview): add|update <topic-key>"
git push origin main
```

add vs update는 `git status --porcelain` 자동 판단. push 실패 시 stderr + exit 1 (silent 실패 금지).

### 7. Discord 알림 (셸 명령)

```bash
bun --env-file=career-os/.env _shared/lib/notify_discord.ts \
  "[완료] interview-asset <topic-key>: sources/fos-study/<outputPath>.md"
```

알림 실패는 비치명적 — stderr warn만, skill 자체는 success 종료.

## Error handling

| 상황 | 처리 |
|---|---|
| topic 형식 판단 불가 + 자연어 키워드 없음 | stderr + 사용자 확인 요청 |
| candidate-profile / task / resume 필수 입력 부재 | stderr + exit 1 |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |
| 승인된 publish의 git push 실패 (권한/충돌) | stderr + exit 1 |
| Discord notify 실패 | stderr warn, skill success |

## Why this design

- **두 형식 흡수 (plan015 사용자 통찰)**: master playbook과 Q&A 질문 은행은 모두 *후보자 이력 기반 면접 자산*. 학습 문서(study-pack-writer)와 책임 분리 — 본 skill은 *이력 중심*, study-pack-writer는 *주제 중심*. 두 형식을 한 skill로 묶고 분기 처리.
- **Self-check가 JSON schema 대체**: 옛 `--json-schema` + renderer 패턴은 외부 subprocess의 부산물. native에서는 현재 에이전트 자체 검증으로 동등 효과.
- **재작성 ≤3회 cap**: 무한 루프 차단. 그래도 실패하면 본질 문제 (topic 모호, 입력 부족) — 사용자 개입 필요.
- **Publish + notify 셸 명령 통합**: 옛 외부 publish/notify shell을 셸 명령 도구로 직접. 의존 줄임.

## References

- `career-os/config/candidate-profile.md` — 후보자 이력 단일 출처 (Q&A 질문 은행 + 마스터 플레이북 양쪽 공통 입력)
- `career-os/config/mvp-target.json` — 현재 면접 타깃 (마스터 플레이북 cross-track 톤 기준)
- `career-os/public/question-bank/` — 공개 질문 bank 정본 (topic-key 매칭 1순위)
- `career-os/config/question-bank-topics.json` — interview asset 전용 override 후보 (outputPath / domain / inputFiles)
- `career-os/.claude/skills/interview-asset-writer/references/output-policy.md` — 공개 산출물 경계 정책 (내부 전략과 공개 문구 분리 기준)
- 관련 스킬: `study-pack-writer` — 일반 기술 토픽 학습 문서 (이력 기반 자산과 책임 분리)
- 관련 스킬: `question-bank-collector` — 공개 일반 backend/CS 질문 bank 보강
- 관련 스킬: `job-fit-analyzer` — 직무 핏·갭 진단 (본 skill 산출물을 입력으로 사용)
