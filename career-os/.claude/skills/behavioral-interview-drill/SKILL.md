---
name: behavioral-interview-drill
description: >
  매일 인성 면접 질문(STAR·가치관)에 1문장으로 답하고 채점·약점 환류하는 career-os 대화형 답변 연습 skill.
  공용 답변 연습 엔진(scripts/interview-drill/drill-engine.ts)을 재사용한다.
  "인성 면접 드릴", "behavioral drill", "오늘 인성 면접 연습", "STAR 면접 연습",
  "경험 질문 풀어보자", "인성 질문 연습", "/behavioral-interview-drill", "가치관 질문 연습",
  "behavioral 드릴"처럼 매일 인성 면접 준비를 위한 대화형 질문·답변·채점·약점 환류가 필요할 때 사용.
  사용자에게는 "드릴" 대신 "답변 연습"이라고 표현한다.
  기술 면접 답변 연습은 tech-interview-drill, 단계별 면접 준비는 interview-stage-prep 담당.
---

## 목적

공용 답변 연습 엔진(`scripts/interview-drill/drill-engine.ts`)을 활용해
간격 반복(Spaced Repetition) 기반으로 오늘 복습할 인성 면접 질문을 선정하고,
1문장 답변 → STAR·가치관 채점 → 약점 환류까지 한 사이클을 완성한다.

## 표현 규칙

사용자에게 보이는 제목, 안내, 완료 요약, 피드백에는 `드릴`을 쓰지 않는다.
기본 표현은 `인성 면접 답변 연습`이다.
짧게 줄일 때는 `답변 연습` 또는 `면접 답변 연습`을 쓴다.

`모의면접`은 실제 면접관 역할로 여러 질문을 이어가고 후속 압박 질문까지 포함할 때만 쓴다.
이 skill처럼 1문장 답변과 즉시 채점을 반복하는 흐름에는 `답변 연습`을 쓴다.

`훈련`, `트레이닝`, `드릴`은 한국어 사용자에게 딱딱하거나 어색하게 들릴 수 있으므로 사람용 문구에서 피한다.
다만 skill id, 파일명, 함수명, 로그 경로, 데이터 필드처럼 이미 정해진 내부 식별자는 호환성을 위해 유지한다.
사용자가 `드릴`이라고 요청하면 의도는 인식하되, 응답에서는 `답변 연습`으로 바꿔 말한다.

## 의존 자산

- `career-os/scripts/interview-drill/drill-engine.ts` — 질문 선정·채점·기록·weak_spots 갱신
- `career-os/public/question-bank/behavioral/questions.json` — 인성 면접 공개 질문 풀 (JSON 배열)
- `career-os/private/question-bank/behavioral-personal.jsonl` — 개인 인성 질문 추가 풀 (있으면 merge, JSONL)
- `career-os/config/mvp-target.json` — 현재 면접 대상 회사·직무·면접 단계 정본
- `career-os/config/study-progress.json` — weak_spots 정본 (pass_count·fail_count·next_review_date)
- `career-os/data/runtime/drill-log-YYYY-MM-DD.jsonl` — 답변 연습 일별 기록 (내부 파일명은 기존 `drill-log` 유지, `drill_type: "behavioral"` 구분)
- `career-os/data/runtime/behavioral-interview-target-context.md` — 현재 호출에서 생성·갱신한 면접 대상 회사 컨텍스트 (있으면 적용)
- `references/scoring-rubric.md` — STAR·가치관 채점 기준 상세

## 답변 연습 진행 흐름

### 단계 0 — 면접 대상과 회사 가치 오버레이 확인

답변 연습 시작 전에 `config/mvp-target.json`의 `primary`를 읽는다.
`company`, `team`, `role`, `position_focus`, `notes`, `interview.final_round`를 확인해 오늘 답변 연습의 면접 대상을 먼저 선언한다.

현재 회사 컨텍스트는 `data/runtime/behavioral-interview-target-context.md`를 우선한다.
파일이 없거나 `config/mvp-target.json`의 현재 `company_slug`와 맞지 않으면, 현재 호출에서 회사 공식 채용/회사소개 근거를 확인해 런타임 파일을 생성하거나 갱신한다.
회사별 컨텍스트를 skill `references/`에 넣지 않는다.
`references/`에는 모든 회사에 반복 적용되는 일반 규칙만 둔다.

회사 공식 가치, 채용 페이지, 면접 후기처럼 웹 근거가 필요한 자료는 실행 환경의 웹 검색 도구를 먼저 사용한다.
검색 결과에서 공식 채용/회사소개 페이지와 채용 플랫폼·개인 후기 원문을 우선 확인하고, 출처 URL과 확인 날짜를 런타임 파일에 남긴다.
웹 검색 도구가 한국어 후기 검색에서 관련 결과를 충분히 반환하지 못하거나 원문 접근이 막히면, 검색엔진 결과 페이지나 직접 원문 HTML 확인을 보조 수단으로 사용한다.
이 경우에도 검색 결과 스니펫만으로 단정하지 않고, 접근 가능한 원문 또는 공식 페이지를 별도 근거로 표시한다.

면접 후기 수집 결과는 `data/runtime/behavioral-interview-web-source-scan-YYYY-MM-DD.md`처럼 현재 호출의 런타임 자료로 저장한다.
유료 기출 판매 페이지, 코칭 홍보 글, 검색 결과 스니펫은 낮은 신뢰도로 분류하고 질문 본문을 그대로 대량 전재하지 않는다.
반복적으로 등장한 평가 의도와 질문 테마만 정규화해 답변 연습에 반영한다.
재사용 가능한 일반 인성 질문으로 정규화할 수 있는 항목은 `public/question-bank/behavioral/questions.json`에 누적한다.
회사명, 개인 이력, 포지션별 지원 전략이 들어간 항목은 public bank에 넣지 않고 런타임 자료나 private prep에만 둔다.

오버레이 적용 시 질문 제시와 채점은 다음 세 가지 기준을 함께 본다:

- 회사 공식 인재상 또는 행동 기준.
- 회사 미션·비전·핵심가치.
- 현재 지원 직무와 팀의 업무 맥락.

타깃이 없거나 회사 공식 근거를 확인하지 못하면 일반 인성 면접 답변 연습으로 진행한다.
근거가 없는 회사 가치나 면접 기준을 단정하지 않는다.

### 단계 1 — 답변 연습 시작 안내

답변 연습을 시작할 때 다음 정보를 제공한다:

```
[인성 면접 답변 연습] 오늘 YYYY-MM-DD
  면접 대상: <company> / <team> / <role>
  대비 단계: <final_round 또는 behavioral>
  회사 가치 오버레이: <적용됨 또는 미적용>
  복습 대상 질문: N개  (next_review_date <= 오늘)
  신규 질문: N개
  총 연습 질문: 5개 (기본)

준비되면 "시작" 또는 "연습 시작"이라고 말씀하세요.
```

질문 목록은 `drill-engine.ts`의 `selectQuestions("behavioral", weakSpots)` 결과를 사용한다.
현재 회사 오버레이가 적용된 경우 `private/question-bank/behavioral-personal.jsonl`에서 `company_slug` prefix가 붙은 질문이 병합되어 우선 후보가 된다.
선택된 질문은 실제 면접처럼 가벼운 협업·조율 질문에서 시작해 문제해결, 고객·운영 영향, 실패 회복, 성과 증명 순서로 재정렬한다.
질문 항목에 `sequenceHint`가 있으면 `opening → early → middle → late → closing` 순서를 따른다.
`sequenceHint`가 없으면 basic 질문을 앞쪽에, incident·failure·customer-impact 질문을 뒤쪽에 둔다.
질문 풀이 비어 있으면 `/question-bank-collector behavioral` 안내를 출력하고 종료한다.

### 단계 2 — 질문 제시 (질문당 반복)

질문을 하나씩 제시한다.
질문 문장 자체에는 `STAR 형식으로 답변해 주세요`처럼 평가 프레임을 직접 넣지 않는다.
STAR는 답변을 구성하고 채점할 때 쓰는 내부 기준이다.
사용자에게는 자연스러운 면접 질문을 먼저 보여 주고, 별도 안내 문장으로 짧게 답변 방식을 요청한다:

```
[1/5] 주제: <topic>  역량: <category>  난이도: <difficulty>
회사 연결 포인트: <target_value_axis>

<question>

구체적인 상황, 본인 행동, 결과가 드러나게 짧게 답변해 주세요.
("모르겠어" / "공부팩 만들어줘"도 OK)
```

`target_value_axis`는 내부 필드명이다.
사용자에게는 `회사 연결 포인트`라고 말한다.
값은 질문의 `answerSignals`, `positionFitHint`, `tags` 또는 `data/runtime/behavioral-interview-target-context.md`의 매핑에서 가장 가까운 기준을 선택한다.

### 단계 3 — STAR·가치관 채점 및 즉시 피드백

사용자 답변을 받으면 `references/scoring-rubric.md`의 STAR·지원자 가치관·회사 연결 포인트 세 가지 기준으로 채점한다:

| 결과 | 기준 | 피드백 형식 |
|------|------|-------------|
| ✅ 통과 | STAR 4요소 + 지원자 가치관 + 회사 연결 포인트 명확 | "STAR 4요소 확인. 회사 연결 포인트: … 보완: …" |
| ⚠ 얕음 | STAR, 지원자 가치관, 회사 연결 포인트 중 하나가 얕음 | "방향은 맞으나 얕음. 보완이 필요한 기준: … 추가로 서술해야 할 것: …" |
| ❌ 틀림 | STAR 누락 또는 가치관·회사 가치 연결이 드러나지 않음 | "핵심 놓침. STAR 누락 요소: … 가치관 문제: … 회사 관점 답변 방향: …" |

채점 후 `drill-engine.ts`의 `updateWeakSpots(question, score)`를 호출해 기록을 갱신한다.
채점 결과와 질문을 `recordDrillLog(entry)`로 `data/runtime/drill-log-YYYY-MM-DD.jsonl`에 기록할 때
`drill_type: "behavioral"` 필드를 반드시 포함한다.
회사 오버레이가 적용된 세션은 로그에 `target_company`, `target_role`, `target_value_axis`를 함께 남길 수 있으면 남긴다.

### 단계 4 — "모르겠어" / "공부팩 만들어줘" 처리

사용자가 모름을 표시하면:

1. `scoreAnswer(answer, question)` → `"unknown"` 처리로 `updateWeakSpots` 호출.
2. **백그라운드 서브에이전트**로 `study-pack-writer <topic>` 실행 — non-blocking.
   - 현재 답변 연습은 중단하지 않고 즉시 다음 질문으로 이동.
   - 완료 메시지: "📦 <topic> 공부팩을 백그라운드에서 생성 중입니다. 답변 연습을 계속 진행합니다."
3. `shouldDispatchStudyPack(weakSpots, topic, dispatchedToday)` — 중복 방지.
   같은 토픽을 당일 이미 위임했으면 "이미 생성 요청됨" 메시지 후 다음 질문으로.

### 단계 5 — 약점 환류 (자동)

답변 연습 중 `shouldDispatchStudyPack` 조건 확인:
- 같은 역량 범주(category: 협업·문제해결·리더십·성장 등) 2회 이상 `fail` 또는 `unknown`이면
  자동으로 `study-pack-writer <category>` 위임.
- 당일 동일 역량 범주 중복 위임 방지: `alreadyDispatchedToday` Set 유지.
- 과생성 방지 메시지: "[약점 감지] <category> 공부팩을 백그라운드에서 생성합니다. (당일 1회 한정)"

### 단계 6 — 답변 연습 완료 요약

5개 질문 완료 후 요약을 출력한다:

```
[답변 연습 완료] YYYY-MM-DD 인성 면접 답변 연습 결과

  ✅ 통과: N개
  ⚠ 얕음: N개
  ❌ 틀림/모름: N개

  누적 약점 역량 범주 상위 3개:
    1. <category> — fail N회
    2. <category> — fail N회
    3. <category> — fail N회

  📦 공부팩 생성 요청: <topic>, <topic>  (백그라운드 처리 중)
```

## 기록 규칙

- 답변 연습 로그: `career-os/data/runtime/drill-log-YYYY-MM-DD.jsonl` — 질문·점수·위임 여부 기록.
  - `drill_type: "behavioral"` 필드로 기술 면접 답변 연습 기록과 구분한다.
- weak_spots: `career-os/config/study-progress.json`의 `weak_spots` 필드 직접 갱신.
  - 갱신 필드: `pass_count`, `fail_count`, `next_review_date`, `last_passed`, `last_evaluated`, `status`.
  - `candidate-profile.md`는 수정하지 않는다 (사람이 직접 편집).

## 간격 반복 규칙

`drill-engine.ts`의 `REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60]` 기준 (기술 면접 답변 연습과 동일):

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

- 위임은 백그라운드(non-blocking)로 한다 — 답변 연습 세션은 기다리지 않고 다음 질문으로 계속한다.
- 넘기는 것은 **대상 토픽**뿐이다. 그 토픽의 공부팩 생성은 study-pack-writer가 담당한다.
- 어떻게 실행할지(서브에이전트·백그라운드 호출 방식)는 실행 환경에 맡긴다. 이 스킬은 "어떤 토픽으로 study-pack-writer를 호출할지"만 정하고 CLI 명령을 직접 박지 않는다.
- 완료 알림·결과 회수는 실행 환경의 알림 경로를 따른다.

## 개인 질문 즉석 생성

답변 연습 중 사용자가 "이 경험으로 질문 만들어줘", "내 경험 기반 질문 추가", "개인 질문 생성" 같은 요청을 하면
`interview-asset-writer` 스킬에 개인 인성 질문 생성을 위임한다.

- 위임 입력: 사용자가 언급한 경험 키워드 + 현재 답변 연습 역량 범주.
  `interview-asset-writer`에 "behavioral-personal 질문 생성 — 경험: <키워드>, 역량: <category>"처럼
  개인 질문 풀 생성 의도를 전달한다.
- 어떻게 실행할지(서브에이전트·호출 방식)는 실행 환경에 맡긴다.
  이 스킬은 "어떤 입력으로 interview-asset-writer를 호출할지"만 정하고 CLI 명령을 직접 박지 않는다.
- 위임은 백그라운드(non-blocking)로 처리하고 답변 연습 세션은 계속 진행한다.
- 생성된 질문은 `private/question-bank/behavioral-personal.jsonl`에 추가되고,
  이후 답변 연습 세션부터 자동으로 병합된다.

## 범위 외

- tech-interview-drill 진행 금지 (별도 스킬 담당).
- 면접 단계별 준비 금지 (interview-stage-prep 담당).
- fos-study 발행 금지 (study-pack-writer 담당).
- candidate-profile.md 직접 수정 금지 (사람이 직접 편집).
