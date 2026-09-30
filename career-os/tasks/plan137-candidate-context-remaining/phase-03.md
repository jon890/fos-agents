# Phase 03. 면접 연습의 brain 공급자를 backend 공급자로 바꾼다

**Execution profile**: standard

## 목표

`CAREER_MEMORY` 가 `backend` 또는 `file` 을 받는다. `backend` 면 `drill-engine.ts memory` 가 `career-status` 와 `application-state` 문서 본문을 채울 칸 목록과 함께 낸다.
`brain` 값과 그 분기를 없앤다.

**범위 외**: 다른 스킬의 문서 갱신은 phase 04, 05 다. JSON 계약 칸과 `file` 공급자는 바꾸지 않는다.

## 컨텍스트

- `career-os/scripts/interview-drill/memory.ts` 의 `loadCandidateMemory(environment, readFile)` 가 동기 함수이고 `CandidateMemoryResult` 에 `provider: "brain"` 분기가 있다. `fields` 목록은 그대로 쓴다
- `career-os/scripts/interview-drill/drill-engine.ts` 가 `memory` 명령(282행 부근)과 `doctor` 의 `CAREER_MEMORY` 점검(311행 부근)에서 부른다. 의존성은 `deps` 로 주입한다. `deps.readFile`, `deps.createStore` 가 예다
- 문서 조회는 plan136 의 `career-os/scripts/candidate-context/client.ts` 를 쓴다. 정의를 먼저 읽는다
- `.claude/skills/interview-practice/SKILL.md` 의 「준비」 표와 「`brain` 공급자」 절, `career-os/.env.example` 의 `CAREER_MEMORY` 줄이 이 값을 설명한다

**근거 문서**: `career-os/docs/data-schema.md` 「후보자 맥락」 절(interview-practice), `career-os/docs/flow.md` 「답변 연습」 절, ADR-130, ADR-132

## 의도 메모

- 스크립트가 본문에서 칸을 뽑지 않는다. 본문은 모델이 읽는다. ADR-130 이 스크립트가 개인 맥락을 해석하지 않게 한 경계를 지킨다
- 문서가 하나라도 없으면 실패한다. 빈 칸으로 연습을 이어 가지 않는다
- `brain` 값을 받으면 `backend` 로 바꾸라는 안내와 함께 실패한다. 조용히 다른 공급자로 넘어가지 않는다

## Blocked 조건

- `career-os/scripts/candidate-context/client.ts` 가 없으면 `PHASE_BLOCKED: plan136 머지 전` 을 출력하고 종료한다

## 작업 항목

### 1. `career-os/scripts/interview-drill/memory.ts` 수정

- `CandidateMemoryResult` 의 `brain` 분기를 `{ provider: "backend"; fields; instruction; documents: Array<{ documentKey: "career-status" | "application-state"; version: number; body: string }> }` 로 바꾼다
- `loadCandidateMemory(environment, readFile, readDocuments)` 를 async 로 바꾼다. `readDocuments` 는 두 키의 문서를 돌려주는 함수다
- `instruction` 은 「`documents` 본문으로 아래 칸을 채운다. 본문에 없는 칸은 비워 두고 사용자에게 묻는다.」 다
- `CAREER_MEMORY` 오류 문구를 「`backend` 나 `file`」 로 바꾼다

### 2. `career-os/scripts/interview-drill/drill-engine.ts` 수정

- `deps.readContextDocuments` 를 더한다. 기본값은 `createCandidateContextClient()` 로 두 문서를 `getDocument` 한다
- `memory` 와 `doctor` 가 `await loadCandidateMemory(...)` 를 쓴다. `doctor` 의 실패 문구는 공급자에 따라 나눈다. `file` 이면 지금 템플릿 안내, `backend` 면 연결값과 빠진 문서 키를 알린다

### 3. `career-os/.claude/skills/interview-practice/SKILL.md` 와 `career-os/.env.example` 수정

- 「준비」 표의 `CAREER_MEMORY` 선택을 `backend` 또는 `file` 로 바꾼다
- 「`brain` 공급자」 절을 「`backend` 공급자」 로 바꾼다. `provider` 가 `backend` 면 `documents` 본문으로 `fields` 칸을 채우고, 없는 칸은 비워 두고 묻는다
- `.env.example` 의 `CAREER_MEMORY` 위 주석에 `backend` 는 커리어 Backend 의 후보자 맥락 문서를 읽는다고 적는다

### 4. 이 phase 를 검증하는 테스트

- `career-os/scripts/interview-drill/memory.test.ts`: `brain` 경우를 `backend` 로 바꾼다. 문서 둘을 주면 `documents` 와 `fields` 가 나온다. 문서 하나가 없으면 키가 담긴 오류다. `brain` 값은 안내와 함께 실패한다
- `career-os/scripts/interview-drill/drill-engine.test.ts`: `CAREER_MEMORY: "brain"` 경우를 가짜 `readContextDocuments` 를 쓰는 `backend` 로 바꾼다. 저장소 생성이 실패해도 `backend` 맥락 점검은 계속하는지 확인한다
- `career-os/scripts/interview-drill/drill-engine.cli.test.ts`: `brain` memory 경우를 「`CAREER_MEMORY=backend` 인데 `CAREER_BACKEND_URL` 이 없으면 종료 코드 1 과 `doctor` 안내」 로 바꾼다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/interview-drill/memory.test.ts career-os/scripts/interview-drill/drill-engine.test.ts career-os/scripts/interview-drill/drill-engine.cli.test.ts
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/interview-drill
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
! git grep -n "brain" -- career-os/scripts/interview-drill career-os/.claude/skills/interview-practice career-os/.env.example
```

모두 종료 코드 0 이어야 한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/interview-drill/memory.ts` | 수정 |
| `career-os/scripts/interview-drill/memory.test.ts` | 수정 |
| `career-os/scripts/interview-drill/drill-engine.ts` | 수정 |
| `career-os/scripts/interview-drill/drill-engine.test.ts` | 수정 |
| `career-os/scripts/interview-drill/drill-engine.cli.test.ts` | 수정 |
| `career-os/.claude/skills/interview-practice/SKILL.md` | 수정 |
| `career-os/.env.example` | 수정 |
