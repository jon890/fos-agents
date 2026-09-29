# Phase 04. 공부 추천 스킬이 관심사를 learning-interests 문서에서 읽게 한다

**Execution profile**: fast

## 목표

`study-topic-recommender` 스킬 문서에서 분야를 직접 적은 문장과 `brain-search` 로 학습 관심사를 조회하는 단계를 지운다.
모델은 후보풀 옆 메타데이터 `study-library-meta.json` 의 `learningInterests.body` 를 관심사로 읽는다.
관심사 변경 안내는 `manage_candidate_context.ts` 로 바꾼다.

**범위 외**: 다른 스킬의 `brain-search` 단계와 `career-os/AGENTS.md` 의 brain 조회 규칙은 이 계획의 범위가 아니다.

## 컨텍스트

지금 스킬 문서에서 관심사를 스스로 정하는 자리다. 모두 `career-os/.claude/skills/study-topic-recommender/` 아래다.

| 자리 | 지금 문장 |
| --- | --- |
| `SKILL.md` frontmatter `description` | 「백엔드 설계·구현·운영 역량과 현재 관심사에 연결할 공부 주제를 고른다」 |
| `SKILL.md` 「목표」 | 「백엔드를 잘 만드는 데 도움이 되는 글을 중심으로」, 「AI도 관심 분야로 다루되 … 채우지 않는다」 |
| `SKILL.md` 「학습 목적과 최근 추천 확인」 | 「`brain-search`로 private 커리어 현황과 학습 관심사를 확인한다」 |
| `SKILL.md` 「원문 비교와 공부 주제 선정」 | 「백엔드 학습에서는 다음 영역에서 …」 와 그 아래 네 항목 |
| `SKILL.md` 「주제 균형과 추천 근거 검토」 | 「최근 AI 추천이 많았다면 아직 다루지 않은 백엔드 문제를 우선 검토한다」 와 다음 두 문장, 「관심사가 바뀌면 `configure_study_recommendation.ts`로 …」 두 문장 |
| `references/execution.md` 「실행」 | 「`--prepare-candidates`는 … `candidateContextVersion`을 후보풀 옆 메타데이터에 함께 저장한다」 |
| `references/execution.md` 「후보자 기준 변경」 절 | `configure_study_recommendation.ts` 실행 안내 |

`career-os/scripts/study-topic-recommender/skill_doc.test.ts` 의 「관심사 변경과 제외 판정 저장을 안내한다」 테스트가 문서에 `configure_study_recommendation.ts` 가 있는지 확인한다.

**근거 문서**: `career-os/docs/prd.md` 의 「study-topic-recommender」 절, `career-os/docs/flow.md` 의 「study-topic-recommender」 절(실행 흐름 6, 제외 판정의 재사용), ADR-131

## 의도 메모

- 스킬 문서에 분야 이름을 다시 적지 않는다. 백엔드, AI 에이전트 설계 같은 말이 스킬에 남으면 문서와 관심사가 다시 어긋난다
- 원문을 비교하는 기준(학습 가치, 원문 근거 표)은 관심사가 아니라 판단 방법이라 스킬에 남긴다
- 주제 균형은 「관심사 문서에 적힌 분야 가운데 한쪽으로 몰렸는지」 로 쓴다. 고정 비율을 두지 않는다는 문장은 남긴다
- 스킬 문서 구조는 `~/.claude/references/skill-structure.md` 를 따른다. 목표, 워크플로 개요, 워크플로 상세 순서를 바꾸지 않는다

## 작업 항목

### 1. `career-os/.claude/skills/study-topic-recommender/SKILL.md` 수정

- `description`: 「백엔드 설계·구현·운영 역량과 현재 관심사에 연결할」 을 「커리어 Backend 의 학습 관심사 문서에 연결할」 로 바꾼다. 트리거 문구는 그대로 둔다
- 「목표」: 굵은 문장을 「**학습 관심사 문서가 정한 분야에서, 자신의 설계와 구현에 적용할 판단을 얻도록 추천한다.**」 로 바꾼다. 둘째 문장을 「관심사는 후보풀 옆 `study-library-meta.json` 의 `learningInterests.body` 가 정한다. 스킬 문서는 분야를 정하지 않는다.」 로 바꾼다
- 「학습 목적과 최근 추천 확인」: `brain-search` 문장을 지우고, `learningInterests.body` 를 먼저 읽는다고 쓴다. 문서가 없어 후보 조회가 `409 CANDIDATE_CONTEXT_MISSING` 이면 추천을 멈추고 사용자에게 `manage_candidate_context.ts put` 으로 저장하라고 알린다
- 「원문 비교와 공부 주제 선정」: 「백엔드 학습에서는 …」 문장과 네 항목을 「`learningInterests.body` 에 적힌 분야와 우선순위에서 자신의 서비스에 적용할 판단을 찾는다.」 한 문장으로 바꾼다
- 「주제 균형과 추천 근거 검토」: 첫 두 문장을 「최근 추천이 관심사 문서의 한 분야로 몰렸다면 아직 다루지 않은 분야의 후보를 먼저 검토한다.」 로, 「적합한 백엔드 후보가 부족하면」 을 「관심사에 맞는 후보가 부족하면」 으로 바꾼다. `configure_study_recommendation.ts` 두 문장은 「관심사가 바뀌면 사람이 `manage_candidate_context.ts` 로 `learning-interests` 를 고쳐 저장한다. 기준 버전이 함께 바뀌어 이전 제외 판정이 다시 후보로 나온다.」 로 바꾼다

### 2. `career-os/.claude/skills/study-topic-recommender/references/execution.md` 수정

- 「실행」 의 메타데이터 문장에 `learningInterests` 를 더한다
- 「후보자 기준 변경」 절을 「관심사 변경」 으로 바꾸고 아래 명령으로 교체한다. 본문 파일은 시스템 임시 디렉터리에 두고 저장 뒤 지운다고 쓴다

```bash
bun --env-file=career-os/.env career-os/scripts/candidate-context/manage_candidate_context.ts get --key learning-interests --out "$TMPDIR/learning-interests.md"
bun --env-file=career-os/.env career-os/scripts/candidate-context/manage_candidate_context.ts put --key learning-interests --file "$TMPDIR/learning-interests.md" --expected-version "$VERSION" --note "$NOTE"
```

### 3. 이 phase 를 검증하는 `career-os/scripts/study-topic-recommender/skill_doc.test.ts` 수정

- 「관심사 변경과 제외 판정 저장을 안내한다」 테스트의 기대 문자열을 `configure_study_recommendation.ts` 에서 `manage_candidate_context.ts` 로 바꾼다
- 새 테스트를 더한다. 세 문서 합본에 `brain-search`, `configure_study_recommendation`, `백엔드를 잘 만드는 데` 가 없고 `learningInterests` 가 있는지 확인한다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/study-topic-recommender/skill_doc.test.ts
! git grep -n "brain-search\|configure_study_recommendation" -- career-os/.claude/skills/study-topic-recommender
! git grep -n "configure_study_recommendation" -- career-os/docs career-os/scripts
bash ~/.claude/skills/korean-check/scripts/check.sh career-os/.claude/skills/study-topic-recommender/SKILL.md career-os/.claude/skills/study-topic-recommender/references/execution.md
```

모두 종료 코드 0 이어야 한다. 마지막 명령은 한국어 문장 검사기다. 걸리면 문장을 풀어 쓴다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/study-topic-recommender/SKILL.md` | 수정 |
| `career-os/.claude/skills/study-topic-recommender/references/execution.md` | 수정 |
| `career-os/scripts/study-topic-recommender/skill_doc.test.ts` | 수정 |
