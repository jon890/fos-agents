---
name: interview-practice
description: 기술·인성·포지션별 면접 질문을 준비하고 한 번에 하나씩 연습하며, 답변 평가와 복습 상태를 관리하는 career-os 스킬. "면접 준비", "면접 연습", "기술 면접 질문", "인성 면접 답변", "STAR 연습", "모의 질문", "약점 복습", "질문 은행 보강"처럼 질문 준비·수집·연습이 필요할 때 사용한다.
---

# 면접 준비와 답변 연습

**완료 조건: 후보자 맥락과 저장소 점검을 통과한 뒤, 한 번에 한 질문씩 답변을 평가하고 결과를 `CAREER_STORE`에 기록한다.**

| 순서 | 단계 | 하는 일 | 통과 조건 | 참고 자료 |
| --- | --- | --- | --- | --- |
| 1 | 준비 | 저장소와 후보자 맥락 공급자를 설정하고 `doctor`를 통과한다. | `doctor`의 `passed`가 참이다. | `career-os/docs/flow.md`의 「비공개 작업본 동기화」 |
| 2 | 후보자 맥락 | `memory` 출력으로 목표 역할, 경험 경계와 지원 대상을 읽는다. | 공급자별 필수 칸을 확보했다. | `memory` 출력의 `fields` |
| 3 | 질문 선택 | 공개·개인·포지션 질문에서 JSON 결과를 고른다. | 한 문제씩 낼 질문 묶음이 있다. | |
| 4 | 답변 연습과 기록 | 한 문제씩 평가하고 UUID로 기록한다. | 각 답변이 저장소에 기록됐다. | `references/behavioral-scoring.md` |
| 5 | 질문 은행 보강 | 질문 풀이 모두 비었을 때만 공개 질문을 보강한다. | 공개 질문 은행 검증을 통과했다. | `references/question-bank-maintenance.md` |

## 1. 준비

`career-os/docs/flow.md`의 「비공개 작업본 동기화」를 `SKILL_NAME=interview-practice`로 적용한다.

| 값 | 선택 | 기본값 |
| --- | --- | --- |
| `CAREER_STORE` | `backend` 또는 `file` | `file` |
| `CAREER_MEMORY` | `brain` 또는 `file` | `file` |

파일 공급자를 쓸 때는 템플릿을 `career-os/library/candidate-memory.json`으로 복사해 자리표시 값을 채운다.
`CAREER_MEMORY_FILE`과 `CAREER_STORE_DIR`로 다른 경로를 지정할 수 있다.

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
mkdir -p "$REPO_ROOT/career-os/library"
cp "$REPO_ROOT/career-os/.claude/skills/interview-practice/templates/candidate-memory.example.json" "$REPO_ROOT/career-os/library/candidate-memory.json"
bun "$REPO_ROOT/career-os/scripts/interview-drill/drill-engine.ts" doctor
```

연습을 시작하기 전에 `doctor`가 통과해야 한다.

## 2. 후보자 맥락

먼저 다음 명령을 실행한다.

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
bun "$REPO_ROOT/career-os/scripts/interview-drill/drill-engine.ts" memory
```

`provider`가 `file`이면 출력의 값을 그대로 쓴다.
현재 직장 이름으로 난도를 정하지 않고 `currentRole.bar`와 공고의 문제 규모, 소유권, 여러 팀에 미치는 영향과 운영 책임으로 `production`, `large-scale`, `global-scale` 중 목표 수준을 정한다.
직접 운영하지 않은 기술은 `experience.studyOnly`와 인접 경험으로 구분한다.

### `brain` 공급자

`provider`가 `brain`이면 `brain-search`로 `fields`에 나온 후보자 맥락의 entity를 조회해 칸을 채운다.
찾지 못한 칸은 비워 두고 사용자에게 묻는다.

## 3. 질문 선택

기술·인성·포지션별 질문을 JSON으로 고른다. 개인 질문은 저장소에서 함께 읽는다.

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
APPLICATION_DIR="$REPO_ROOT/career-os/applications/example-company/backend-engineer"
bun "$REPO_ROOT/career-os/scripts/interview-drill/drill-engine.ts" select tech \
  --application-dir "$APPLICATION_DIR" \
  --target-bar large-scale
```

현재 대상이 없으면 `--application-dir`와 `--target-bar`를 생략한다.
`--target-bar`를 공고별 질문의 난도보다 낮게 잡으면 그 질문이 난도 창 밖으로 빠진다.
다섯 문제 세션에서는 포지션 질문 세 개와 공통 기반 질문 두 개를 우선한다.

## 4. 답변 연습과 기록

질문을 한 번에 하나씩 보여주고 사용자의 답을 기다린다.
답변 직후 `pass`, `shallow`, `fail`, `unknown` 중 하나로 판정하고, 잘된 점·가장 큰 공백·후속 질문을 각각 하나씩 준다.
충분한 답변은 선택 근거, 반례, 운영 상황과 근거 경계 순으로 최대 네 단계까지 묻고, 틀렸거나 답하지 못한 경우에는 한 번 좁혀 묻고 학습 항목으로 전환한다.

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
ATTEMPT_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
bun "$REPO_ROOT/career-os/scripts/interview-drill/drill-engine.ts" record \
  --attempt-id "$ATTEMPT_ID" --drill-type tech --question-id transaction-basics \
  --topic transaction --question "트랜잭션을 설명해 주세요." --score shallow
```

`--attempt-id`는 답변 하나마다 위 명령으로 새 UUID를 만들고, 같은 기록을 다시 보낼 때는 앞에서 만든 같은 값을 쓴다.
꼬리질문도 한 건씩 기록한다.
인성 답변은 `references/behavioral-scoring.md`를 읽고, 상황보다 본인 행동과 판단, 확인 가능한 결과를 평가한다.
개인 경험 기반 질문은 `drill-engine.ts personal add`로만 추가한다.
명령이 종료 코드 1로 끝나면 사용자에게 기록되지 않았다고 알리고 파일에 대신 쓰지 않는다.
주제별 복습 상태, 연습 기록과 개인 질문은 `CAREER_STORE`로 고른 저장소가 소유한다.
포지션별 질문은 해당 지원 디렉터리의 `evidence/interview-questions.json`에만 둔다.
후보자 맥락과 `sources/fos-study/`는 수정하지 않는다.

## 5. 질문 은행 보강

일반 연습에서는 공개 질문 은행을 자동으로 수정하지 않는다.
공개·개인·포지션 질문 묶음이 모두 비었을 때만 최소한의 공개 질문을 보강한 뒤 연습을 이어간다.
공개 질문을 추가하거나 고칠 때만 `references/question-bank-maintenance.md`를 읽는다.
외부 자료를 수집하거나 질문 공백과 목표 수준을 보강할 때만 `references/source-discovery.md`를 읽는다.

공개 질문 은행에는 실제 면접 일정, 지원 전략, 회사별 비공개 정보, 유료 강의·문제집·면접 후기의 질문과 답변 원문을 넣지 않는다.
