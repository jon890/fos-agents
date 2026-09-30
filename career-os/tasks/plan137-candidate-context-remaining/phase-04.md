# Phase 04. 포지션, 이력서, 프로필 스킬이 개인 맥락을 문서에서 읽게 한다

**Execution profile**: standard

## 목표

`position-recommender`, `resume-preparer`, `sync-profile` 스킬에서 `brain-search` 와 `brain-add` 를 지운다.
개인 맥락은 `manage_candidate_context.ts get` 이나 실행 디렉터리의 `candidate-context.json` 에서 읽고, 새 개인 사실은 변경 전후를 보여 주고 승인받은 뒤 `put` 으로 저장한다.

**범위 외**: `application-package-writer` 와 `career-os/AGENTS.md` 는 phase 05 다.

## 컨텍스트

고칠 자리다. 모두 `career-os/.claude/skills/` 아래다.

| 파일 | 줄 | 지금 |
| --- | --- | --- |
| `position-recommender/SKILL.md` | 31 | `brain-search`로 현재 역할 기준과 이직 우선순위를 확인한다 |
| `resume-preparer/SKILL.md` | 35, 40 | `brain-search`로 조회, `references/brain-context.md` 링크 |
| `resume-preparer/references/brain-context.md` | 전체 44줄 | `brain-search` 조회 시점과 `brain-add` 환원 분기 |
| `resume-preparer/references/resume-taste.md` | 56 | `brain-context.md` 의 환원 분기 링크 |
| `resume-preparer/references/hard-review.md` | 16 | 「private brain, 지원 패키지, …」 |
| `resume-preparer/evals/evals.json` | 102~181 | `brain-search`, `brain-add` 를 전제로 한 합성 평가 |
| `sync-profile/SKILL.md` | 55 | `brain-search` 로 확인한다 |

phase 02 가 `collect` 때 실행 디렉터리에 `candidate-context.json` 을 둔다. 형식은 `career-os/docs/flow.md` 「position-recommender」 절 1단계다.
문서 조회와 저장 명령은 `career-os/docs/code-architecture.md` 「후보자 맥락 문서」 절이다.

**근거 문서**: `career-os/docs/flow.md` 「개인 맥락 조회와 환원」 절(resume-preparer), ADR-132

## 의도 메모

- 문서 이름과 문서 키를 스킬에 적고 본문 내용은 적지 않는다. 개인 맥락을 공개 저장소에 쓰지 않는다
- `brain-context.md` 는 `candidate-context.md` 로 이름을 바꾸고 내용을 옮긴다. 회사 지식은 `nbrain` 대상이라는 문장은 그대로 둔다
- evals 의 합성 입력도 문서 조회로 바꾼다. 평가가 없는 도구를 전제로 하면 평가가 무의미하다
- 스킬 문서 구조는 `~/.claude/references/skill-structure.md` 를 따른다

## Blocked 조건

- `career-os/scripts/candidate-context/manage_candidate_context.ts` 가 없으면 `PHASE_BLOCKED: plan136 머지 전` 을 출력하고 종료한다

## 작업 항목

### 1. `career-os/.claude/skills/position-recommender/SKILL.md` 수정

31행을 「공고를 분석할 때는 실행 디렉터리의 `candidate-context.json` 에 담긴 `position-preferences` 와 `application-state` 본문으로 현재 역할 기준과 이직 우선순위를 확인한다.」 로 바꾼다.
「실행」 절에 `collect` 가 기준 버전이 다르면 멈추고 `manage_candidate_context.ts sync-position-policy` 를 안내한다고 한 줄 더한다.

### 2. `career-os/.claude/skills/resume-preparer/` 수정

- `references/brain-context.md` 를 `references/candidate-context.md` 로 옮기고 내용을 바꾼다. 조회는 `manage_candidate_context.ts get --key career-status`, 결과에는 문서 키와 version 을 출처로 붙인다. 재사용할 개인 사실은 변경 전후를 보여 주고 승인받은 뒤 `put` 으로 저장하고 `note` 에 날짜와 내용을 남긴다. 연결 실패는 알리고 확인된 근거 범위에서만 편집한다
- `SKILL.md` 35, 40행과 `references/resume-taste.md` 56행의 링크와 문장을 새 파일로 맞춘다
- `references/hard-review.md` 16행의 「private brain」 을 「후보자 맥락 문서」 로 바꾼다
- `evals/evals.json` 의 `brain-search` 합성 결과를 「`career-status` 문서 조회 결과」 로, `brain-add` 미리보기와 승인을 「변경 전후 미리보기와 승인 뒤 `put`」 으로 바꾼다. 평가 항목의 의도(현재 설명 우선, 승인 전 저장 금지, 조회 실패와 결과 없음 구분)는 그대로 둔다

### 3. `career-os/.claude/skills/sync-profile/SKILL.md` 수정

55행을 「현재 경력과 경험 경계는 `manage_candidate_context.ts get --key career-status` 로 확인한다.」 로 바꾼다.

### 4. 이 phase 를 검증하는 `career-os/scripts/candidate-context/skill_boundary.test.ts` 신규

`career-os/.claude/skills/` 아래 `position-recommender`, `resume-preparer`, `sync-profile`, `interview-practice`, `study-topic-recommender` 의 모든 파일에 `brain-search`, `brain-add`, `private brain` 이 없는지 확인한다.
`resume-preparer/references/candidate-context.md` 가 있고 `brain-context.md` 가 없는지 확인한다.

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/candidate-context/skill_boundary.test.ts
python3 -c "import json; json.load(open('career-os/.claude/skills/resume-preparer/evals/evals.json'))"
bash ~/.claude/skills/korean-check/scripts/check.sh career-os/.claude/skills/position-recommender/SKILL.md career-os/.claude/skills/resume-preparer/SKILL.md career-os/.claude/skills/resume-preparer/references/candidate-context.md career-os/.claude/skills/sync-profile/SKILL.md
```

모두 종료 코드 0 이어야 한다. 마지막 명령은 한국어 문장 검사기다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/position-recommender/SKILL.md` | 수정 |
| `career-os/.claude/skills/resume-preparer/SKILL.md` | 수정 |
| `career-os/.claude/skills/resume-preparer/references/brain-context.md` | 삭제 |
| `career-os/.claude/skills/resume-preparer/references/candidate-context.md` | 신규 |
| `career-os/.claude/skills/resume-preparer/references/resume-taste.md` | 수정 |
| `career-os/.claude/skills/resume-preparer/references/hard-review.md` | 수정 |
| `career-os/.claude/skills/resume-preparer/evals/evals.json` | 수정 |
| `career-os/.claude/skills/sync-profile/SKILL.md` | 수정 |
| `career-os/scripts/candidate-context/skill_boundary.test.ts` | 신규 |
