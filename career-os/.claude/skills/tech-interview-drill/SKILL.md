---
name: tech-interview-drill
description: >
  매일 기술 면접 질문에 1문장으로 답하고 채점·약점 환류하는 career-os 대화형 드릴 skill.
  "기술 면접 드릴", "tech drill", "오늘 기술 면접 연습", "면접 질문 풀어보자",
  "기술 질문 연습", "/tech-interview-drill", "드릴 시작", "약점 질문 복습"처럼
  매일 기술 면접 준비를 위한 대화형 질문·답변·채점·약점 환류가 필요할 때 사용.
  인성 면접 드릴은 behavioral-interview-drill, 단계별 면접 준비는 interview-stage-prep 담당.
---

## 목적

공용 드릴 엔진(`scripts/interview-drill/drill-engine.ts`)을 활용해
간격 반복(Spaced Repetition) 기반으로 오늘 복습할 기술 면접 질문을 선정하고,
1문장 답변 → 즉시 채점 → 약점 환류까지 한 사이클을 완성한다.

## 의존 자산

- `career-os/scripts/interview-drill/drill-engine.ts` — 질문 선정·채점·기록·weak_spots 갱신
- `career-os/public/question-bank/{java-spring,database,cs,operations,system-design}/questions.json` — 기술 면접 공개 질문 풀 (JSON 배열)
- `career-os/private/question-bank/tech-personal.jsonl` — 개인 기술 질문 추가 풀 (있으면 merge, JSONL)
- `career-os/config/study-progress.json` — weak_spots 정본 (pass_count·fail_count·next_review_date)
- `career-os/data/runtime/drill-log-YYYY-MM-DD.jsonl` — 드릴 일별 기록 (자동 생성)

## 드릴 진행 흐름

### 단계 1 — 드릴 시작 안내

드릴을 시작할 때 다음 정보를 제공한다:

```
[기술 면접 드릴] 오늘 YYYY-MM-DD
  복습 대상 질문: N개  (next_review_date <= 오늘)
  신규 질문: N개
  총 드릴 질문: 5개 (기본)

준비되면 "시작" 또는 "드릴 시작"이라고 말씀하세요.
```

질문 목록은 `drill-engine.ts`의 `selectQuestions("tech", weakSpots)` 결과를 사용한다.
질문 풀이 비어 있으면 `/question-bank-collector tech` 안내를 출력하고 종료한다.

### 단계 2 — 질문 제시 (질문당 반복)

질문을 하나씩 제시하고 1문장 답변을 요청한다:

```
[1/5] 주제: <topic>  난이도: <difficulty>

<question>

1문장으로 핵심만 답변해 주세요. ("모르겠어" / "공부팩 만들어줘"도 OK)
```

### 단계 3 — 채점 및 즉시 피드백

사용자 답변을 받으면 3단계로 채점한다:

| 결과 | 기준 | 피드백 형식 |
|------|------|-------------|
| ✅ 통과 | 핵심 시그널 70%+ 포함 | "핵심 키워드 N개 확인. 보완: …" |
| ⚠ 얕음 | 시그널 30~70% | "방향은 맞으나 얕음. 추가로 알아야 할 것: …" |
| ❌ 틀림 | 시그널 30% 미만 | "핵심 놓침. 핵심 답변 예시: …" |

채점 후 `drill-engine.ts`의 `updateWeakSpots(question, score)`를 호출해 기록을 갱신한다.
채점 결과와 질문을 `recordDrillLog(entry)`로 `data/runtime/drill-log-YYYY-MM-DD.jsonl`에 기록한다.

### 단계 4 — "모르겠어" / "공부팩 만들어줘" 처리

사용자가 모름을 표시하면:

1. `scoreAnswer(answer, question)` → `"unknown"` 처리로 `updateWeakSpots` 호출.
2. **백그라운드 서브에이전트**로 `study-pack-writer <topic>` 실행 — non-blocking.
   - 현재 드릴은 중단하지 않고 즉시 다음 질문으로 이동.
   - 완료 메시지: "📦 <topic> 공부팩을 백그라운드에서 생성 중입니다. 드릴 계속 진행합니다."
3. `shouldDispatchStudyPack(weakSpots, topic, dispatchedToday)` — 중복 방지.
   같은 토픽을 당일 이미 위임했으면 "이미 생성 요청됨" 메시지 후 다음 질문으로.

### 단계 5 — 약점 환류 (자동)

드릴 중 `shouldDispatchStudyPack` 조건 확인:
- 같은 토픽 2회 이상 `fail` 또는 `unknown`이면 자동으로 `study-pack-writer <topic>` 위임.
- 당일 동일 토픽 중복 위임 방지: `alreadyDispatchedToday` Set 유지.
- 과생성 방지 메시지: "[약점 감지] <topic> 공부팩을 백그라운드에서 생성합니다. (당일 1회 한정)"

### 단계 6 — 드릴 완료 요약

5개 질문 완료 후 요약을 출력한다:

```
[드릴 완료] YYYY-MM-DD 기술 면접 드릴 결과

  ✅ 통과: N개
  ⚠ 얕음: N개
  ❌ 틀림/모름: N개

  누적 약점 토픽 상위 3개:
    1. <topic> — fail N회
    2. <topic> — fail N회
    3. <topic> — fail N회

  📦 공부팩 생성 요청: <topic>, <topic>  (백그라운드 처리 중)
```

## 기록 규칙

- 드릴 로그: `career-os/data/runtime/drill-log-YYYY-MM-DD.jsonl` — 질문·점수·위임 여부 기록.
- weak_spots: `career-os/config/study-progress.json`의 `weak_spots` 필드 직접 갱신.
  - 갱신 필드: `pass_count`, `fail_count`, `next_review_date`, `last_passed`, `last_evaluated`, `status`.
  - `candidate-profile.md`는 수정하지 않는다 (사람이 직접 편집).

## 간격 반복 규칙

`drill-engine.ts`의 `REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60]` 기준:

| 누적 통과 수 | 다음 복습 간격 |
|------------|-------------|
| 0회 → 1회 | 1일 후 |
| 1회 → 2회 | 3일 후 |
| 2회 → 3회 | 7일 후 |
| 3회 → 4회 | 14일 후 |
| 4회 → 5회 | 30일 후 |
| 5회 이상 | 60일 후 |

## 공부팩 위임 (백그라운드)

부족 토픽의 공부팩이 필요하면 `study-pack-writer` 스킬에 위임한다.

- 위임은 백그라운드(non-blocking)로 한다 — 드릴 세션은 기다리지 않고 다음 질문으로 계속한다.
- 넘기는 것은 **대상 토픽**뿐이다. 그 토픽의 공부팩 생성은 study-pack-writer가 담당한다.
- 어떻게 실행할지(서브에이전트·백그라운드 호출 방식)는 실행 환경에 맡긴다. 이 스킬은 "어떤 토픽으로 study-pack-writer를 호출할지"만 정하고 CLI 명령을 직접 박지 않는다.
- 완료 알림·결과 회수는 실행 환경의 알림 경로를 따른다.

## 개인 질문 즉석 생성

드릴 중 사용자가 "이 경험으로 질문 만들어줘", "내 경험 기반 질문 추가", "개인 질문 생성" 같은 요청을 하면
`interview-asset-writer` 스킬에 개인 기술 질문 생성을 위임한다.

- 위임 입력: 사용자가 언급한 경험 키워드 + 현재 드릴 토픽.
  `interview-asset-writer`에 "tech-personal 질문 생성 — 경험: <키워드>, 토픽: <topic>"처럼
  개인 질문 풀 생성 의도를 전달한다.
- 어떻게 실행할지(서브에이전트·호출 방식)는 실행 환경에 맡긴다.
  이 스킬은 "어떤 입력으로 interview-asset-writer를 호출할지"만 정하고 CLI 명령을 직접 박지 않는다.
- 위임은 백그라운드(non-blocking)로 처리하고 드릴 세션은 계속 진행한다.
- 생성된 질문은 `private/question-bank/tech-personal.jsonl`에 추가되고,
  이후 드릴 세션부터 자동으로 병합된다.

## 범위 외

- behavioral-interview-drill 진행 금지 (별도 스킬 담당).
- 면접 단계별 준비 금지 (interview-stage-prep 담당).
- fos-study 발행 금지 (study-pack-writer 담당).
- candidate-profile.md 직접 수정 금지 (사람이 직접 편집).
