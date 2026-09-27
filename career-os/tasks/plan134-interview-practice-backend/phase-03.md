# Phase 03. 후보자 맥락 공급자와 doctor 명령을 만들고 스킬을 설정값 기준으로 바꾼다

**Execution profile**: standard

## 목표

`interview-practice` 가 개인 스킬 `brain-search` 없이도 돌게 한다.
후보자 맥락을 `CAREER_MEMORY` 로 고른 공급자에서 읽고, 스킬 문서는 저장소와 공급자를 설정값으로만 가리킨다.
다른 사람이 환경값 두 개와 파일 하나를 채워 바로 쓸 수 있게 `doctor` 명령과 템플릿을 둔다.

**범위 외**: 저장소 구현은 Phase 02 다. 다른 career-os 스킬의 brain 참조는 바꾸지 않는다.
hermes 와 노트북의 `.env` 에 `CAREER_STORE`, `CAREER_MEMORY` 를 넣는 일은 운영 작업이다.

## 컨텍스트

- 스킬이 지금 brain 을 가리키는 곳은 `career-os/.claude/skills/interview-practice/SKILL.md` 의 31, 38, 55번째 줄 부근, 123번째 줄 부근의 「private brain과 `sources/fos-study/`는 수정하지 않는다」, `references/source-discovery.md` 53번째 줄, `evals/evals.json` 의 10, 92, 95번째 줄 부근이다
- 스킬 문서의 연습 기록 서술(「진행」 6번, 「기록과 안전 경계」, 33번째 줄 부근의 `state/drill-progress.json` 설명, `library/question-bank/` 서술, 「질문 선택」 의 실행 예)은 Phase 02 전의 파일 방식을 적고 있다
- Phase 02 가 `drill-engine.ts` 에 `runDrillCli(argv, deps)` 를 두었다. 새 하위 명령은 여기에 더한다
- `career-os/.env.example` 에 `CAREER_WORKSPACE_*`, `CAREER_BACKEND_*` 가 있다

**근거 문서**: `docs/data-schema.md` 의 「후보자 맥락」 「면접 연습 저장소」 절,
`docs/flow.md` 의 「답변 연습」 절, `docs/code-architecture.md` 의 「interview-practice」 절,
`docs/adr/ADR-130-면접-연습의-후보자-맥락은-memory-공급자-경계로-읽는다.md`,
`docs/adr/ADR-129-면접-연습-기록과-개인-질문은-backend가-소유한다.md`

## 의도 메모

- 스크립트는 brain 을 조회하지 않는다. `brain` 공급자일 때 `memory` 명령은 채울 칸 목록과 조회 안내만 낸다. ADR-102 와 ADR-130 이 정했다
- 공급자는 `CAREER_MEMORY` 로만 고른다. `brain-search` 가 있는지로 추측하지 않는다
- 스킬 문서에서 `brain-search` 와 개인 지식 기반 entity 이름은 「`brain` 공급자」 절 한 곳에만 둔다. 다른 절은 「후보자 맥락」 이라고만 부른다
- 템플릿에는 실제 개인 정보를 넣지 않는다. 자리표시 값만 둔다
- 현재 직장 이름은 계약에 두지 않는다. 질문 난도는 `bar` 로 정한다

## 작업 항목

### 1. `career-os/scripts/interview-drill/memory.ts` 신규

```ts
export const candidateMemorySchema: z.ZodType<CandidateMemory>;   // data-schema 「후보자 맥락」 칸 그대로, .strict()
export type CandidateMemoryResult =
  | { provider: "file"; path: string; memory: CandidateMemory }
  | { provider: "brain"; fields: CandidateMemoryField[]; instruction: string };
export function loadCandidateMemory(environment: Record<string, string | undefined>, readFile: (path: string) => string): CandidateMemoryResult;
```

- `CAREER_MEMORY=file`: `CAREER_MEMORY_FILE` 이 있으면 그 경로, 없으면 `career-os/library/candidate-memory.json` 을 읽어 검사한다. 파일이 없거나 형식이 틀리면 어느 칸이 틀렸는지 담아 실패한다
- `CAREER_MEMORY=brain`: 파일을 읽지 않는다. `fields` 는 계약의 칸 이름과 한 줄 설명 목록이고, `instruction` 은 「brain-search 로 아래 칸을 채운다. 찾지 못한 칸은 비워 두고 사용자에게 묻는다.」 다
- 값이 없거나 둘 중 하나가 아니면 「CAREER_MEMORY 는 brain 이나 file 이어야 한다. drill-engine.ts doctor 로 설정을 점검한다.」 로 실패한다
- `targets[].applicationDir` 은 `career-os/` 기준 상대 경로만 받는다. 절대 경로와 `..` 는 거절한다

### 2. `career-os/scripts/interview-drill/drill-engine.ts` 수정

`runDrillCli` 에 하위 명령 둘을 더한다. `deps` 에 `environment` 를 더한다.

| 하위 명령 | 하는 일 | 돌려주는 값 |
| --- | --- | --- |
| `memory` | `loadCandidateMemory` 결과를 낸다 | `CandidateMemoryResult` |
| `doctor` | 아래 점검을 모두 돌린다. 하나가 실패해도 나머지를 계속한다 | `{ passed: boolean, checks: [{ name, ok, message }] }`. `passed` 가 거짓이면 종료 코드 1 |

`doctor` 의 점검 항목이다.

- `CAREER_STORE` 값이 `backend` 나 `file` 인가
- `backend` 면 `resolveCareerBackendConnection` 이 통과하고 `listProgress("tech")` 가 성공하는가
- `file` 이면 저장 디렉터리가 있거나 만들 수 있는가
- `CAREER_MEMORY` 값이 `brain` 이나 `file` 인가
- `file` 이면 맥락 파일이 있고 `candidateMemorySchema` 를 통과하는가
- 실패한 항목의 `message` 는 무엇을 채우면 되는지 적는다. 예: 「`career-os/.claude/skills/interview-practice/templates/candidate-memory.example.json` 을 `career-os/library/candidate-memory.json` 으로 복사해 값을 채운다」

`doctor` 는 main 에서 `store` 를 먼저 만들지 않는다. 저장소 설정이 틀렸어도 점검 결과를 내야 하기 때문이다. `doctor` 와 `memory` 는 저장소 없이 돌고, 나머지 하위 명령만 저장소를 만든다.

### 3. `career-os/.claude/skills/interview-practice/templates/candidate-memory.example.json` 신규

`candidateMemorySchema` 를 통과하는 자리표시 값이다. `targets` 는 빈 배열로 둔다.
`experience.direct` 같은 배열에는 `"예: 주문 API 설계와 운영"` 처럼 무엇을 적는지 보이는 값을 둔다.

### 4. `career-os/.env.example` 수정

아래 넷을 더한다. `CAREER_STORE=file`, `CAREER_MEMORY=file` 을 기본값으로 둔다.

```
CAREER_STORE=file
CAREER_STORE_DIR=
CAREER_MEMORY=file
CAREER_MEMORY_FILE=
```

### 5. `career-os/.claude/skills/interview-practice/SKILL.md` 수정

스킬 문서를 고치기 전에 `~/.claude/references/skill-structure.md` 를 읽고 따른다.

- 앞부분에 「준비」 절을 둔다. `CAREER_STORE`, `CAREER_MEMORY` 를 고르는 표, 템플릿을 복사해 채우는 방법, `drill-engine.ts doctor` 로 점검하는 방법이다. 연습을 시작하기 전에 `doctor` 가 통과해야 한다
- 「후보자 맥락」 절을 둔다. `drill-engine.ts memory` 를 먼저 부른다. `provider` 가 `file` 이면 출력을 그대로 쓴다. `brain` 이면 이 절 아래 「`brain` 공급자」 소절의 방법으로 칸을 채운다. `brain-search` 와 entity 이름은 이 소절에만 둔다
- 31, 38, 55번째 줄 부근의 brain 서술을 「후보자 맥락의 `targets`」, 「후보자 맥락의 `currentRole`」 로 바꾼다
- 「질문 선택」 의 실행 예를 `drill-engine.ts select tech ...` 로 바꾸고 출력이 JSON 이라고 적는다. 개인 질문은 저장소에서 함께 읽는다고 적는다
- 「진행」 6번을 「`drill-engine.ts record` 로 기록한다. `--attempt-id` 는 답변 하나마다 새 UUID 를 만들고, 같은 기록을 다시 보낼 때는 같은 값을 쓴다」 로 바꾼다. 꼬리질문도 한 건씩 기록한다
- 「기록과 안전 경계」 의 `state/drill-progress.json`, `state/drill-log-YYYY-MM-DD.jsonl` 줄과 33번째 줄 부근의 설명 줄을 지우고 「주제별 복습 상태, 연습 기록과 개인 질문은 `CAREER_STORE` 로 고른 저장소가 소유한다」 를 둔다
- 「개인 경험 기반 질문은 `library/question-bank/`에만 추가한다」 를 「개인 경험 기반 질문은 `drill-engine.ts personal add` 로만 추가한다」 로 바꾼다
- 명령이 종료 코드 1 로 끝나면 사용자에게 기록되지 않았다고 알리고 파일에 대신 쓰지 않는다고 적는다
- 「private brain과 `sources/fos-study/`는 수정하지 않는다」 는 「후보자 맥락과 `sources/fos-study/`는 수정하지 않는다」 로 바꾼다

### 6. `career-os/.claude/skills/interview-practice/references/source-discovery.md`, `question-bank-maintenance.md` 수정

- `source-discovery.md` 53번째 줄의 「private brain에서 현재 직장, 경력 깊이와 직접 경험 경계를 읽는다」 를 「후보자 맥락에서 `currentRole` 과 `experience` 를 읽는다」 로 바꾼다
- `question-bank-maintenance.md` 에 개인 질문을 `library/question-bank/` 에 둔다는 서술이 있으면 `drill-engine.ts personal add` 로 바꾼다

### 7. `career-os/.claude/skills/interview-practice/evals/evals.json` 수정

10, 92, 95번째 줄 부근의 「private brain에서」 를 「후보자 맥락에서」 로 바꾼다. 나머지 eval 은 바꾸지 않는다.

### 8. 이 phase 를 검증하는 테스트

`career-os/scripts/interview-drill/memory.test.ts` 신규.

- 템플릿 `candidate-memory.example.json` 이 `candidateMemorySchema` 를 통과한다
- `CAREER_MEMORY=brain` 이면 파일을 읽지 않고 `fields` 에 계약의 칸이 모두 있다
- 칸 하나가 빠진 파일은 그 칸 이름을 담은 오류로 실패한다
- `applicationDir` 에 `..` 가 있으면 실패한다
- `CAREER_MEMORY` 가 없으면 `doctor` 를 안내하는 메시지로 실패한다

`career-os/scripts/interview-drill/drill-engine.test.ts` 수정.

- `CAREER_STORE`, `CAREER_MEMORY` 가 모두 없을 때 `doctor` 가 `passed: false` 이고 두 항목 모두 실패로 나온다
- `CAREER_STORE=file`, `CAREER_MEMORY=file` 과 임시 디렉터리, 유효한 맥락 파일이면 `doctor` 가 `passed: true` 다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bun test ./career-os/.claude/skills/
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
! git grep -nE "drill-progress|drill-log|personal\.jsonl|library/question-bank" -- career-os/scripts/interview-drill career-os/.claude/skills/interview-practice
test "$(git grep -c 'brain-search' -- career-os/.claude/skills/interview-practice/SKILL.md)" -ge 1
! git grep -n "private brain" -- career-os/.claude/skills/interview-practice
```

모두 종료 코드 0 이어야 한다.
마지막 두 명령은 `brain-search` 가 「`brain` 공급자」 소절에 남아 있고, 다른 곳에서 private brain 을 직접 가리키지 않는지 본다.
`brain-search` 가 나오는 줄이 「`brain` 공급자」 소절 안에만 있는지는 사람이 SKILL.md 를 열어 확인한다.

검증이 통과하면 `career-os/tasks/plan134-interview-practice-backend/index.json` 의 `current_phase` 를 3 으로 두고, 마지막 phase 이므로 `status` 를 `completed` 로 바꾼다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/interview-drill/memory.ts` | 신규 |
| `career-os/scripts/interview-drill/memory.test.ts` | 신규 |
| `career-os/scripts/interview-drill/drill-engine.ts` | 수정 |
| `career-os/scripts/interview-drill/drill-engine.test.ts` | 수정 |
| `career-os/.claude/skills/interview-practice/templates/candidate-memory.example.json` | 신규 |
| `career-os/.env.example` | 수정 |
| `career-os/.claude/skills/interview-practice/SKILL.md` | 수정 |
| `career-os/.claude/skills/interview-practice/references/source-discovery.md` | 수정 |
| `career-os/.claude/skills/interview-practice/references/question-bank-maintenance.md` | 확인, 필요하면 수정 |
| `career-os/.claude/skills/interview-practice/evals/evals.json` | 수정 |
