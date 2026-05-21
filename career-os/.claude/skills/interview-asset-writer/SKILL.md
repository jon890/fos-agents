---
name: interview-asset-writer
description: 후보자 이력 기반 면접 자산 마크다운을 생성하고 sources/fos-study에 자동 발행. 두 형식 흡수 — (1) Q&A 질문 은행 (5 main Q + follow-up + answer points + 1분 답변 + 압박 방어), (2) 시니어 백엔드 마스터 플레이북 (자기소개 + 커리어 narrative + 기술 의사결정 + 역질문 + 최종 체크리스트). "질문 은행" / "qbank" / "experience-..." / "마스터 플레이북" / "master" / "playbook" 키워드 또는 자연어 요청 시 사용. 후보자 이력서·task 노트 기반 면접 자산이 필요하면 무조건 이 skill을 호출. 일반 기술 토픽 학습 문서는 study-pack-writer가 담당 — 본 skill은 *후보자 이력 중심*.
---

# Interview Asset Writer

후보자 이력 기반 면접 자산 마크다운 생성·검증·발행 workflow. 두 형식 자동 분기:

- **Q&A 질문 은행** (옛 experience-question-bank-writer): 5 main Q + 5 follow-up + answer points + 1분 답변 + 압박 방어
- **마스터 플레이북** (옛 interview-master-writer): 자기소개 / 커리어 narrative / 기술 의사결정 스타일 / 역질문 / 최종 체크리스트

## When to use

- 슬래시 호출: `/interview-asset-writer <topic>`
- 자연어 요청 (Q&A): "AI 서비스팀 면접 질문 은행 만들어줘", "slot 팀 experience qbank 정리해줘"
- 자연어 요청 (master): "시니어 백엔드 마스터 플레이북 만들어줘", "면접 master playbook 갱신"
- fos-study repo에 즉시 publish할 *후보자 이력 기반 면접 자산*이 필요한 모든 경우
- "면접 자료 만들어줘", "경험 기반 질문 정리해줘", "자기소개 플레이북 만들어줘", "면접 준비 자산 만들어줘"

일반 기술 토픽 학습 문서는 study-pack-writer로 라우팅 (본 skill 호출 X).

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/config/question-bank-topics.json` — `<topic-key>` 검색 → `outputPath` / `domain` / `title` / `inputFiles` / `promptAppend`
2. `career-os/config/candidate-profile.md` — 11섹션 prose, 후보자 이력 (필수)
3. `career-os/config/mvp-target.json` — `primary.company`, `primary.role` (현재 면접 타깃)
4. `career-os/task/*` 또는 `career-os/resume/*` — `inputFiles` 명시되면 그 파일들, 아니면 candidate-profile에서 참조하는 경로
5. (선택) `sources/fos-study/<유사 outputPath>.md` — overlap 회피

## Workflow

### 1. Topic 해석 + 형식 판단

인자가 topic-key (kebab-case)면 `question-bank-topics.json` 매칭. 자연어면 description/domain으로 유사 매칭. 매칭 실패 시 **freeform 모드**: outputPath 본인이 결정.

산출물 형식 판단:
- **Q&A 질문 은행**: topic-key에 `qbank` / `question-bank` / `experience-` 포함, 또는 자연어에 "질문 은행" / "Q&A" / "qbank" 언급
- **마스터 플레이북**: topic-key에 `master` / `playbook` 포함, 또는 자연어에 "마스터" / "플레이북" / "master playbook" 언급
- 모호하면 사용자에게 확인 (기본값 Q&A 질문 은행). 비대화형(`claude -p`) 환경에서 모호 → 기본값 Q&A 질문 은행으로 자동 진행.

stderr에 결정 근거 1줄 로그 (예: `[interview-asset] topic=experience-qbank-ai-service-team → Q&A 질문 은행 형식`).

### 2. Context 로드 (Read)

Inputs 1~5 모두 Read. `inputFiles` 명시되면 task/resume 추가 Read.

### 3. Overlap 점검 (선택)

`sources/fos-study/<outputPath 디렉터리>`에 유사 파일 있으면 update 의도 확인. 비대화형(`claude -p`) 환경에서 유사 파일 발견 시 → update 모드로 자동 진행. update면 기존 본문 Read해서 통합 작성.

### 4. 마크다운 작성 (Write)

공통 구조:
- 첫 줄: `# <topic-title>` (단일 `#`, `## ` 시작 금지, `# 초안:` / `# Draft:` 금지)
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

- `Write` 도구로 *markdown 직접 작성* (JSON 출력 금지, JSON schema 따르지 않음 — native skill 패턴)
- 메타 보고 문구 금지 ("파일이 생성되었습니다", "문서 구성 요약", "아래와 같이" 등) — 본문 자체를 작성
- 첫 줄 `# [초안] <topic-title>` 형식. 작성 후에는 본문만 출력하지 *작성했다는 보고*는 하지 않음.

### 5. Self-check (재작성 ≤3회)

#### 5-A. 공통 항목

1. 첫 줄 `# ` 시작 (`## ` 아닌)
2. 총 줄 수 ≥80
3. 모든 펜스 언어 지정
4. 금지 prefix 부재

#### 5-B. Q&A 질문 은행 추가 항목

5. 메인 질문 ≥5개 (헤더에 "Q" 또는 "질문" 키워드로 카운트)
6. 각 메인 질문에 follow-up 1개 이상 + answer points 섹션 존재
7. 1분 답변 + 압박 질문 방어 섹션 존재

#### 5-C. 마스터 플레이북 추가 항목

5. 5 섹션 헤더 모두 존재
6. 회사명·면접일 직접 명시 없음 (cross-track 톤)

실패 항목이 있으면 그 항목 수정 후 재작성·재검증. **최대 3회 시도**. 4회째도 실패 시 stderr에 `interview-asset 검증 실패: <항목>` + 종료 (exit 1).

본 self-check가 옛 JSON schema 검증을 대체. 객관적 기준(첫 줄·줄 수·펜스·섹션 헤더) self-check가 신뢰 가능. 3회 cap은 무한 루프 차단.

### 6. Publish (Bash)

```bash
cd career-os/sources/fos-study
git pull --rebase --autostash
git add <outputPath>
git commit -m "docs(interview): add|update <topic-key>"
git push origin main
```

add vs update는 `git status --porcelain` 자동 판단. push 실패 시 stderr + exit 1 (silent 실패 금지).

### 7. Discord 알림 (Bash)

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
| git push 실패 (권한/충돌) | stderr + exit 1 |
| Discord notify 실패 | stderr warn, skill success |

## Why this design

- **두 형식 흡수 (plan015 사용자 통찰)**: master playbook과 Q&A 질문 은행은 모두 *후보자 이력 기반 면접 자산*. 학습 문서(study-pack-writer)와 책임 분리 — 본 skill은 *이력 중심*, study-pack-writer는 *주제 중심*. 두 형식을 한 skill로 묶고 분기 처리.
- **Self-check가 JSON schema 대체**: 옛 `--json-schema` + renderer 패턴은 외부 subprocess의 부산물. native에서는 Claude 자체 검증으로 동등 효과.
- **재작성 ≤3회 cap**: 무한 루프 차단. 그래도 실패하면 본질 문제 (topic 모호, 입력 부족) — 사용자 개입 필요.
- **Publish + notify Bash 통합**: 옛 외부 publish/notify shell을 Bash 도구로 직접. 의존 줄임.

