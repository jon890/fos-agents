---
name: study-pack-writer
description: backend/AI/infra 기술 학습용 study pack 마크다운을 생성하고 sources/fos-study 저장소에 자동 발행. /study-pack-writer <topic-key-or-자연어> 슬래시 명령 또는 "<주제> study pack 만들어줘" / "<주제> 학습 정리해줘" / "<주제>에 대한 스터디팩" 같은 자연어 요청 시 무조건 사용. backend·db·infrastructure·언어·아키텍처 주제로 fos-study에 즉시 commit/push해야 하는 작업이면 이 skill을 호출.
---

# Study Pack Writer

backend/AI/infra 기술 학습용 마크다운(study pack) 생성·검증·발행 workflow.

## When to use

- 사용자가 `/study-pack-writer <topic>` 슬래시 호출
- 자연어 요청: "MySQL 인덱스 study pack 만들어줘", "Redis 캐시 전략 학습 자료 정리해줘"
- fos-study repo에 즉시 publish할 study pack이 필요한 모든 경우
- "fos-study에 <주제> 올려줘", "<주제> 공부 자료 만들어줘", "<주제> 학습 문서 작성해줘"

후보자 이력·task 기반 Q&A 질문 은행·플레이북은 `/interview-asset-writer` 로 라우팅 (본 skill은 기술 토픽 학습 문서 전담).

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/config/study-pack-topics.json` — `<topic-key>` 검색 → `outputPath` / `domain` / `title` / `promptAppend`
2. `career-os/config/candidate-profile.md` — 11섹션 prose, 후보자 이력
3. `career-os/config/mvp-target.json` — `primary.company`, `primary.role` (현재 면접 타깃)
4. `career-os/config/topic-profiles.json` — 토픽 family별 (mysql/redis/kafka/spring-jpa) emphasis + output path 패턴. topic-key가 어느 family에 속하는지 `topicHints` 매칭으로 파악
5. `references/study-pack-prompt.md` — prompt 구조 가이드
6. `references/study-pack-writing-rules.md` — 작성 규칙 상세
7. **필수**: `sources/fos-study/**/*.md` 트리 스캔 결과 — `career-os/scripts/study-topic-recommender/duplicate_detection.ts` helper로 결정. exclude `.git/**`, `.claude/**`. `git pull` 호출 금지.

## Workflow

### 1. Topic 해석

인자가 topic-key (kebab-case)면 `study-pack-topics.json` 매칭. 자연어면 description/domain으로 유사 매칭. 매칭 실패 시 **freeform 모드**: domain·outputPath 본인이 결정. stderr에 결정 근거 1줄 로그 (예: `[study-pack] freeform 모드 — domain=database, outputPath=database/new-topic`).

### 2. Context 로드 (Read)

위 Inputs 1~6 모두 Read. topic-profiles.json에서 `<topic-key>`가 어느 family의 `topicHints`에 속하는지 매칭 → 해당 family의 `emphasis` 적용.

### 3. Duplicate guard (ADR-033)

new markdown Write 직전 fos-study 진실원과의 중복을 강제 검사한다. 이 게이트는 *사용자가 직접 호출한 주제*에도 동일하게 적용된다 — recommender만이 아닌 모든 writer 호출 경로의 최종 gate.

#### 3-1. Scan

`career-os/sources/fos-study/**/*.md` (exclude `.git/**`, `.claude/**`) 트리를 스캔. `git pull` 호출 금지 — 로컬 clone 기준.

import 및 호출 (Bash):

```bash
bun career-os/scripts/study-topic-recommender/duplicate_detection.ts ...
# 또는 native skill 내부에서 직접 Read + 동등 로직 적용
```

deterministic dedupe 결과는 ADR-033 duplicate decision schema 형태 (key / candidatePath / matchedPath / decision / reason / confidence).

#### 3-2. (가능하면) Claude 의미 판정

deterministic이 `possibleDuplicates`로 분류한 후보가 있으면 Claude(현재 native skill 컨텍스트)가 의미 판정을 추가. 새 호출 X — 같은 Claude 컨텍스트 안에서 matched 파일을 Read해 판정.

판정 입력 최소화: candidatePath + matched 파일의 첫 30줄.

#### 3-3. 분기

| decision | 동작 |
|---|---|
| `new` | Step 4로 진행 — 새 markdown 작성. |
| `update-existing` | 새 파일 생성 금지. `matchedPath`의 기존 문서를 Read하고 누락/약한 항목만 patch. commit message는 `update`. |
| `skip` | 작성 중단. stderr에 matched 문서 경로 + 사유 1줄 출력 + `exit 1`. |
| `needs-user-confirmation` | non-interactive(`claude -p`)면 stderr + `exit 1`. interactive 환경에서도 `AskUserQuestion`은 `claude -p`에서 사용 금지(SKILL.md 기존 정책) — *사용자에게 다시 명시해 호출해 달라는 메시지* + `exit 1`. |

#### 3-4. 안전 기본값

deterministic dedupe도 Claude 의미 판정도 결정이 불가능하면 **`needs-user-confirmation`**으로 분류한다 — silent 새 파일 생성 금지가 핵심 안전 기본값.

### 4. 마크다운 작성 (Write)

생성 구조:
- 첫 줄: `# <topic-title>` (단일 `#`, `## ` 시작 금지, `# 초안:` / `# Draft:` 금지)
- ≥80줄
- 모든 ` ``` ` 코드 펜스에 언어 명시 (`bash`, `ts`, `sql`, `java` 등)
- 공개 공부팩은 특정 회사/포지션/지원 여부를 전제로 쓰지 않는다. "TossPlace 관점", "Applied AI Engineer 포지션 관점", "면접에서 평가받는 지점"처럼 지원 의도가 강하게 드러나는 표현은 사용자가 명시 요청한 경우에만 쓴다.
- 기본 구조는 기술 주제 중심: 개념 → 작동 원리 → 흔한 오해 → 설계/운영 체크포인트 → 실습 또는 점검 질문.
- 면접·지원서 연결이 필요하면 공개 공부팩 본문이 아니라 `career-os/data/` 아래 비공개 지원 패키지/면접 메모에 따로 둔다.
- `references/study-pack-writing-rules.md` 모든 규칙 준수

`Write` 도구로 `career-os/sources/fos-study/<outputPath>.md`에 직접 저장.

### 5. Self-check (재작성 ≤3회)

작성 후 자기 출력 점검 5항목:

1. 첫 줄 `# ` 시작 (`## ` 아닌)
2. 총 줄 수 ≥80
3. 모든 펜스 언어 지정
4. 금지 prefix 부재
5. `references/study-pack-writing-rules.md` 명시 규칙 준수

실패 항목이 있으면 그 항목 수정 후 재작성·재검증. **최대 3회 시도**. 4회째도 실패 시 stderr에 `study-pack 검증 실패: <실패 항목>` + 종료 (exit 1).

검증 명세를 본 skill 안에 박는 이유: 객관적(첫 줄·줄 수·펜스 언어) 기준은 self-check가 신뢰 가능. 3회 cap은 무한 루프 차단.

### 6. Publish (Bash)

```bash
cd career-os/sources/fos-study
git pull --rebase --autostash
git add <outputPath>
git commit -m "docs(<domain>): add|update <topic-key>"
git push origin main
```

`<domain>`은 topic에서 추출(database/redis/kafka/java/infra/architecture). add vs update는 `git status --porcelain`으로 자동 판단 — 신규 파일이면 add, 기존 파일 수정이면 update. push 실패 시 stderr + exit 1 (silent 실패 금지).

### 7. Discord 알림

권장 실행 경로는 OpenClaw wrapper가 호출하는 `scripts/study-pack-writer/run_with_discord_notify.ts "<topic>"` 이다. 이 wrapper는 `claude --permission-mode acceptEdits -p "/study-pack-writer <topic>"`로 실행하며 다음 알림을 보장한다.

- `[시작] study-pack-writer: <topic>` — Claude 실행 직전
- `[완료] study-pack-writer: <topic> (fos-study <sha>)` — exit 0 후
- `[에러] study-pack-writer 실패: <topic>` — non-zero exit 후 최근 로그 포함

native skill 내부에서 직접 알림을 보낼 때는 다음 도구를 사용한다.

```bash
bun --env-file=career-os/.env ../_shared/lib/notify_discord.ts \
  "[완료] study-pack-writer <topic-key>: sources/fos-study/<outputPath>.md"
```

알림 실패는 비치명적 — stderr warn만, skill 자체는 success 종료.

## Error handling

| 상황 | 처리 |
|---|---|
| topic-key 매칭 실패 + 자연어 해석 불가 | stderr + exit 1, 사용자에게 명시적 topic 요청 |
| sources/fos-study 없음 or git pull 실패 | stderr + exit 1, 환경 설정 안내 |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |
| git push 실패 (권한/충돌) | stderr + exit 1, git stderr 그대로 |
| Discord notify 실패 | stderr warn, skill은 success |
| duplicate guard skip / needs-user-confirmation | stderr + exit 1, matched 문서 경로 + 사유 명시 |
| duplicate guard update-existing 진입 | 새 파일 생성 금지, 기존 matched 문서 patch 모드로 전환 |

## Why this design

- **Self-check 본 skill 안에 박는 이유**: 옛 외부 validator를 Claude 자체 검증으로. SKILL.md 단일 진실 출처.
- **재작성 ≤3회**: 무한 루프 차단. 3회로도 통과 못 하면 본질 문제 (topic 모호, 입력 부족) — 사용자 개입 필요.
- **Publish + notify 통합**: 기본은 `scripts/study-pack-writer/run_with_discord_notify.ts` wrapper가 시작/완료/에러 알림을 담당한다. native skill의 완료 알림은 보조 경로로 유지한다.
- **Duplicate guard (ADR-033)**: recommender·writer가 같은 4 decision schema를 공유. 사용자가 직접 호출한 주제에도 동일 게이트 — fos-study 진실원과 drift 없음.

## References

- `references/study-pack-prompt.md` — 옛 prompt 구조 (Claude가 참고)
- `references/study-pack-writing-rules.md` — 작성 규칙 상세
