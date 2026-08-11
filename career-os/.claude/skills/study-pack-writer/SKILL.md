---
name: study-pack-writer
description: backend/AI/infra 기술 학습용 study pack 마크다운을 생성하는 career-os skill. `/study-pack-writer [topic-key-or-자연어]`, "[주제] study pack 만들어줘", "공고에서 발견한 갭을 공부할 문서 만들어줘", "[주제] 학습 정리해줘", "fos-study에 [주제] 초안 작성"처럼 공개 가능한 기술 토픽 학습 문서가 필요할 때 사용. 공고·핏 분석에서 나온 갭 학습 문서는 `[학습중]` 상태와 categories/tags 메타데이터를 사용하고, 회사명은 사용자가 요청한 경우 frontmatter tag에만 허용하며 본문은 일반 기술 문서로 작성한다. 개인 업무 회고·블로그 포스팅은 blog-post-writer로, 후보자 이력 기반 면접 자산은 interview-asset-writer로 라우팅한다. 사용자가 명시적으로 공개 발행을 승인한 경우에만 sources/fos-study commit/push를 수행한다.
---

# Study Pack Writer

backend/AI/infra 기술 학습용 마크다운(study pack) 생성·검증·발행 workflow.

## 출력 정책

먼저 `references/output-policy.md`를 읽고 공개 산출물 정책을 따른다.
study pack은 공개 `fos-study` 산출물이므로 기술 학습 문서로만 읽혀야 한다.
지원 전략, 후보자 private 맥락, 내부 reviewer 판단은 공개 본문에 섞지 않는다.
공개 발행과 `[초안]` 제거는 사용자 명시 승인 후에만 수행한다.
Discord 추천 버튼의 `career.study-pack.create:*`는 초안 생성 요청일 뿐 publish 승인이 아니다.

공고·핏 분석에서 발견한 기술 갭을 줄이는 문서는 일반 초안과 구분해 `[학습중]` 상태를 사용한다.
이 상태는 사용자가 학습 완료와 최종화를 확인할 때까지 유지한다.

상태와 발행 여부를 독립적으로 관리한다.

| 사건 | 제목 상태 | 발행 |
|---|---|---|
| gap-study 생성 | `[학습중]` | 미발행 |
| 학습 중 공개 승인 | `[학습중]` 유지 | artifact-specific 승인 후 가능 |
| 학습 완료·최종화 승인 | prefix 제거 | 기존 발행 여부 유지 |
| 일반 초안 생성 | `[초안]` | 미발행 |

## 호출 후 입력 해석

- topic-key가 있으면 실제 fos-study inventory와 config override를 함께 확인한다.
- 자연어 주제면 기존 문서와 중복 여부를 먼저 판단한다.
- 후보자 이력·task 기반 Q&A 질문 은행·플레이북은 `interview-asset-writer`로 라우팅한다.

## Inputs

현재 에이전트는 다음 파일과 명령 출력을 직접 로드:

1. `career-os/sources/fos-study/**/*.md` 트리 스캔 결과 — 학습 문서 inventory 정본. exclude `.git/**`, `.claude/**`, `private/**`.
2. `career-os/config/study-pack-topics.json` — 선택 사항. `<topic-key>` override/seed/fallback 후보 검색 → `outputPath` / `domain` / `title` / `promptAppend`
3. `career-os/config/candidate-profile.md` — 후보자 프로필 core: 경력·기술 스택 라벨·약점 (학습 문서 작성용). 면접 서사 detail은 읽지 않는다.
4. `career-os/state/mvp-target.json` — `primary.company`, `primary.role` (현재 면접 타깃)
5. `career-os/config/topic-profiles.json` — 선택 사항. 토픽 family별 작성 guide 또는 family override. 실제 파일 존재 여부보다 우선하지 않음.
6. `references/study-pack-prompt.md` — prompt 구조 가이드
7. `references/fos-study-writing-rules.md` — 작성 규칙 상세
8. `career-os/scripts/study-topic-recommender/duplicate_detection.ts` — duplicate guard helper. `git pull` 호출 금지.

## Workflow

### 1. Topic 해석

인자가 topic-key (kebab-case)면 먼저 `sources/fos-study` inventory에서 실제 파일 존재 여부와 유사 slug를 확인한다.
그다음 `study-pack-topics.json`을 override/seed/fallback 후보로 매칭한다.
자연어면 fos-study 파일명, heading, config fallback의 description/domain 순서로 유사 매칭한다.
매칭 실패 시 **freeform 모드**: domain·outputPath 본인이 결정. stderr에 결정 근거 1줄 로그 (예: `[study-pack] freeform 모드 — domain=database, outputPath=database/new-topic`).

입력이 공고 분석, 역할 fit, 후보자 약점, 학습 gap에서 파생됐으면 `gap-study` 유형으로 분류한다.
이 유형은 회사별 지원 전략을 공개 본문에 옮기지 않고, 학습 상태와 검색 맥락만 frontmatter에 기록한다.

### 2. Context 로드

위 Inputs를 읽는다.
`topic-profiles.json`이 있으면 `<topic-key>`가 어느 family의 `topicHints`에 속하는지 매칭해 해당 family의 `emphasis`를 작성 guide로만 적용한다.
파일이 없거나 매칭되지 않으면 일반 topic guide와 fos-study inventory 기반 freeform 판단으로 계속한다.

### 3. Duplicate guard (ADR-033)

new markdown 작성 직전 fos-study 진실원과의 중복을 강제 검사한다.
이 점검은 *사용자가 직접 호출한 주제*에도 동일하게 적용된다.
recommender만이 아닌 모든 writer 호출 경로의 최종 점검이다.

#### 3-1. Scan

`career-os/sources/fos-study/**/*.md` (exclude `.git/**`, `.claude/**`) 트리를 스캔. `git pull` 호출 금지 — 로컬 clone 기준.

import 및 호출 (셸 명령):

```bash
# bun이 있으면 기존 경로 사용
bun career-os/scripts/study-topic-recommender/duplicate_detection.ts ...

# bun이 없고 Node 22+가 있으면 Node의 TypeScript 실행 경로 사용
node career-os/scripts/study-topic-recommender/duplicate_detection.ts ...

# 둘 다 불가능하면 현재 에이전트가 파일을 직접 읽고 동등한 중복 판단을 수행
```

런타임 도구가 없다는 이유만으로 skill을 중단하지 않는다. `bun`이 없으면 현재 LLM 에이전트가 `read_file`/`search_files`/`write_file`/`patch` 도구로 같은 절차를 수행한다.

deterministic dedupe 결과는 ADR-033 duplicate decision schema 형태 (key / candidatePath / matchedPath / decision / reason / confidence).

#### 3-2. (가능하면) 현재 에이전트 의미 판정

deterministic이 `possibleDuplicates`로 분류한 후보가 있으면 현재 에이전트가 의미 판정을 추가한다.
새 에이전트 호출은 하지 않는다.
현재 컨텍스트 안에서 matched 파일을 읽어 판정한다.

판정 입력 최소화: candidatePath + matched 파일의 첫 30줄.

#### 3-3. 분기

| decision | 동작 |
|---|---|
| `new` | Step 4로 진행 — 새 markdown 작성. |
| `update-existing` | 새 파일 생성 금지. `matchedPath`의 기존 문서를 읽고 누락/약한 항목만 patch. commit message는 `update`. |
| `skip` | 작성 중단. stderr에 matched 문서 경로 + 사유 1줄 출력 + `exit 1`. |
| `needs-user-confirmation` | non-interactive면 stderr + `exit 1`. 대화형 환경에서는 사용자에게 확인한다. |

#### 3-4. 안전 기본값

deterministic dedupe도 현재 에이전트 의미 판정도 결정이 불가능하면 **`needs-user-confirmation`**으로 분류한다 — silent 새 파일 생성 금지가 핵심 안전 기본값.

`gap-study`가 기존 문서를 `update-existing`으로 판정해도 기존 문서의 제목, 상태, 회사 tag는 기본적으로 보존한다.
사용자가 그 기존 문서의 상태 전환을 명시 요청한 경우에만 `[학습중]`과 gap metadata를 적용한다.
기존 문서가 넓은 허브이고 요청이 충분히 좁은 운영·실습 심화라면, 역할을 명확히 나누고 허브를 선행 링크로 연결하는 새 deep-dive를 허용한다.

### 4. 외부/freeform 토픽 — 웹 자료 수집 및 교차검증

본인 코드베이스 없이 외부 기술·방법론·오픈소스를 다루는 토픽(freeform 모드 포함)은 내부 지식만으로 작성하지 않는다.
작성 전에 공식 소스를 수집하고 여러 소스를 교차검증해 정확도와 최신성을 확보한다.

**적용 조건** — 다음 중 하나에 해당하면 이 단계를 실행한다:

- freeform 모드로 진입한 경우
- `study-pack-topics.json`에 등록되지 않은 신규 외부 개념·방법론
- 공식 스펙이 자주 바뀌는 라이브러리·프레임워크 (예: LangChain, Spring Boot 최신 마이너)

**수집 순서:**

```
# 1. 공식 GitHub / 공식 docs 우선
WebSearch: "<기술명> official documentation site:github.com OR site:docs.*"

# 2. 실용 사례·워크플로
WebSearch: "<기술명> how it works workflow 2025"

# 3. 한계·절충점 포함
WebSearch: "<기술명> limitations tradeoffs when to use"
```

**웹 자료 활용 규칙:**

- 공식 GitHub·공식 docs를 1순위 인용 소스로 쓴다.
- 블로그 글은 여러 소스를 교차검증한 뒤 핵심만 본인 언어로 재해석한다.
  검색 결과를 그대로 번역하지 않는다.
- 수집한 소스 URL은 글 하단 **"## 참고 자료"** 섹션에 명시한다.
- 내부 토픽(후보자 이력 기반, fos-study inventory에 이미 있는 개념)에는 이 단계를 생략해도 된다.

### 5. 마크다운 작성

생성 구조:
- 일반 study pack의 H1: `# [초안] <topic-title>`
- `gap-study` 유형의 H1: `# [학습중] <topic-title>`
  사용자가 학습 완료와 최종화를 승인하기 전까지 `[학습중]`을 제거하지 않는다.
- `gap-study` 유형은 H1 앞에 YAML frontmatter를 둔다.
  - `categories`에는 `architecture`, `database`, `java`, `kafka`처럼 실제 최상위 기술 폴더명만 사용한다.
  - `tags`에는 `학습중`, 도메인, 핵심 기술 주제를 넣는다.
  - 특정 공고에서 파생됐고 사용자가 회사 태그를 요청했으면 회사명을 `tags`에만 넣을 수 있다.
  - 회사명, 포지션명, 후보자 평가, 지원 전략은 본문과 제목에 쓰지 않는다.
  - 어떤 갭을 줄이기 위한 문서인지 첫 10줄 안에서 기술 역량 기준으로 설명한다.

```yaml
---
categories: [database]
tags: [학습중, 금융도메인, JPA, 트랜잭션격리]
---
```

위 예시에서 파일의 primary 폴더가 `java/`라면 `java`는 `categories`에 반복하지 않는다.
- 일반 study pack과 `gap-study`는 80줄 이상이면서 1,500단어 이상으로 작성한다.
- 사용자가 짧은 note를 명시 요청한 경우에만 1,500단어 기준을 면제하되, 80줄 기준도 적용하지 않고 요청 길이를 따른다.
- 모든 ` ``` ` 코드 펜스에 언어 명시 (`bash`, `ts`, `sql`, `java` 등)
- 타깃 회사의 관점(그 회사가 중시하는 기술 깊이·설계/운영 포인트·자주 묻는 영역)은 어떤 주제를 얼마나 깊게 다룰지 **학습 방향을 잡는 데만** 반영한다.
  - 그 관점이 본문에 회사 이름·포지션명으로 드러나서는 안 된다. 공개 공부팩 본문에는 특정 회사·포지션 이름을 쓰지 않는다.
  - 특정 회사에만 해당하는 내용처럼 좁게 쓰지 않는다 — 같은 주제를 공부하는 누구에게나 유효한 일반 기술 문서로 작성한다.
  - "TossPlace 관점", "Applied AI Engineer 포지션 관점", "면접에서 평가받는 지점"처럼 회사명·포지션·지원 의도가 드러나는 표현은 쓰지 않는다.
  - 회사·면접 맥락과 직접 연결한 해석은 공개 본문이 아니라 `career-os/data/` 아래 비공개 지원 패키지/면접 메모에 둔다.
- 기본 구조는 기술 주제 중심: 개념 → 작동 원리 → 흔한 오해 → 설계/운영 체크포인트 → 실습 또는 점검 질문.
- 공개 공부팩에는 누구나 활용할 수 있는 일반 설명 구조와 점검 질문을 넣을 수 있다.
  특정 회사·공고·후보자의 답변 전략과 지원서 연결은 `career-os/data/` 아래 비공개 지원 패키지/면접 메모에 둔다.
- `직접 수행했다`, `운영했다`, `전환했다`는 경험 주장은 candidate profile 또는 task 문서 근거가 있을 때만 쓴다.
  근거가 없으면 실습, 학습 목표, 재현 환경으로 명시한다.
- `needs_evidence` 같은 raw marker는 공개 본문에 남기지 않고 `보강 필요 / 선택지 / 권장 행동`으로 바꾼다.
- 글 끝에 **`## 참고 자료`** 섹션을 추가한다.
  외부/freeform 토픽이면 단계 4에서 수집한 공식 문서·출처 URL을 모두 나열한다.
  내부 토픽(fos-study inventory 기반)이면 참고한 상위 문서 링크만으로도 충분하다.
- `references/fos-study-writing-rules.md` 모든 규칙 준수

파일 쓰기로 `career-os/sources/fos-study/<outputPath>.md`에 직접 저장.
현재 에이전트에서 실행 중이면 외부 Claude CLI에게 다시 위임하지 말고, 현재 세션의 파일 수정 도구로 저장한다.
파일 수정 권한 오류가 나면 `git rev-parse --show-toplevel`, `pwd`, `whoami`, 대상 경로 `stat`으로 저장소와 권한을 확인한다.

### 6. Self-check (재작성 ≤3회)

작성 후 자기 출력 점검 항목:

1. 일반 문서는 첫 줄이 `# `으로 시작하고, `gap-study` 문서는 YAML frontmatter 다음의 첫 heading이 `# [학습중] `으로 시작함
2. 총 줄 수 ≥80
3. 모든 펜스 언어 지정
4. 금지 prefix 부재
5. `references/fos-study-writing-rules.md` 명시 규칙 준수
6. 첫 10줄 안에 학습 목표, 결론, 또는 권장 행동이 있음
7. 섹션 제목은 한국어 우선이며 자연스러운 한국어 문장으로 작성됨
8. raw `needs_evidence`가 남아 있지 않고 필요한 경우 `보강 필요 / 선택지 / 권장 행동`으로 바뀌어 있음
9. 후보자 private 맥락, 회사별 지원 전략, 내부 reviewer 판단이 공개 본문에 섞이지 않음
10. 본문에 특정 회사·포지션 이름이 없고, 특정 회사에만 적용되는 내용으로 좁혀지지 않았으며, 같은 주제를 공부하는 누구에게나 유효한 일반 기술 문서로 작성됨
11. 사용자 승인 없이 공개 publish가 실행되지 않음
12. 글 끝에 `## 참고 자료` 섹션이 있으며, 외부/freeform 토픽이면 공식 소스를 교차검증해 URL을 명시함
13. 일반 study pack과 `gap-study`는 1,500단어 이상이며, 명시적 짧은 note만 요청 길이 기준을 적용함
14. 직접 수행·운영·전환 경험 주장이 candidate profile 또는 task 근거와 일치함

`gap-study` 유형에서는 다음 항목으로 바꿔 점검한다.

- YAML frontmatter 다음의 첫 H1이 `# [학습중] `으로 시작한다.
- `categories` 값이 실제 최상위 기술 폴더명과 일치한다.
- `categories`는 파일의 primary 최상위 폴더를 반복하지 않고, 추가 노출이 필요한 실제 최상위 폴더명만 YAML 문자열 배열로 기록한다.
- `tags`는 중복 없는 YAML 문자열 배열이며 `학습중`, 업무 도메인, 핵심 기술 주제가 포함된다.
- 회사 태그가 있더라도 회사명과 포지션명은 본문 및 제목에 나타나지 않는다.
- 첫 10줄 안에 줄이려는 기술 갭과 학습 완료 기준이 나타난다.

실패 항목이 있으면 그 항목 수정 후 재작성·재검증. **최대 3회 시도**. 4회째도 실패 시 stderr에 `study-pack 검증 실패: <실패 항목>` + 종료 (exit 1).

검증 명세를 본 skill 안에 박는 이유: 객관적(첫 줄·줄 수·펜스 언어) 기준은 self-check가 신뢰 가능. 3회 cap은 무한 루프 차단.

### 7. Publish (사용자 승인 후에만)

사용자가 공개 발행과 commit/push를 명시 승인하지 않았으면 여기서 멈춘다.
최종 응답에는 생성·수정한 초안 경로, self-check 결과, 발행 보류 사유를 적는다.
일반 문서는 `[초안]`, `gap-study` 문서는 `[학습중]` 제목을 유지한다.

최초 요청에 발행 지시가 포함됐더라도 초안 생성 승인으로만 취급한다.
생성된 파일 경로와 렌더링 미리보기, self-check 결과를 사용자에게 제시한 뒤 받은 artifact-specific 승인만 commit/push 승인으로 인정한다.

사용자가 명시 승인한 경우에만 다음 셸 명령을 실행한다.

```bash
cd career-os/sources/fos-study
git pull --rebase --autostash
git add <outputPath>
git commit -m "docs(<domain>): add|update <topic-key>"
git push origin main
```

`<domain>`은 topic에서 추출(database/redis/kafka/java/infra/architecture). add vs update는 `git status --porcelain`으로 자동 판단 — 신규 파일이면 add, 기존 파일 수정이면 update. push 실패 시 stderr + exit 1 (silent 실패 금지).

### 8. 외부 전달

생성한 문서 경로와 공개 가능한 짧은 요약을 표준 출력으로 반환한다.
외부 전달은 저장소 밖 호출자가 처리한다.

## Error handling

| 상황 | 처리 |
|---|---|
| topic-key 매칭 실패 + 자연어 해석 불가 | stderr + exit 1, 사용자에게 명시적 topic 요청 |
| sources/fos-study 없음 | stderr + exit 1, 환경 설정 안내 |
| 승인된 publish 단계의 git pull 실패 | stderr + exit 1, git stderr 그대로 |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |
| 승인된 publish의 git push 실패 (권한/충돌) | stderr + exit 1, git stderr 그대로 |
| 외부 전달 실패 | 이 skill 범위 밖의 실패로 분리하고 생성 산출물은 유지 |
| duplicate guard skip / needs-user-confirmation | stderr + exit 1, matched 문서 경로 + 사유 명시 |
| duplicate guard update-existing 진입 | 새 파일 생성 금지, 기존 matched 문서 patch 모드로 전환 |

## Why this design

- **Self-check 본 skill 안에 박는 이유**: 옛 외부 validator를 현재 에이전트 자체 검증으로. SKILL.md 단일 진실 출처.
- **재작성 ≤3회**: 무한 루프 차단. 3회로도 통과 못 하면 본질 문제 (topic 모호, 입력 부족) — 사용자 개입 필요.
- **생성과 발행 분리**: 기본은 초안 생성 후 사용자 승인 전에는 publish하지 않는다. 승인된 publish만 별도 단계에서 수행한다.
- **Duplicate guard (ADR-033)**: recommender·writer가 같은 4 decision schema를 공유. 사용자가 직접 호출한 주제에도 동일 게이트 — fos-study 진실원과 drift 없음.

## References

- `references/study-pack-prompt.md` — 옛 prompt 구조 (현재 에이전트가 참고)
- `references/fos-study-writing-rules.md` — 작성 규칙 상세
