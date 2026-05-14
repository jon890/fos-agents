---
name: planning
description: ai-nodes 워크스페이스에 새 기능/변경사항을 구현하기 전 8단계 설계 워크플로. 구현 가능성 → 기술 스택 → 호출 시나리오 → 데이터/스키마 → 흐름 → 코드 구조 → docs 영향 분석 → task 파일 생성. 각 단계에서 모호함을 제거하고 의사결정을 즉시 docs에 기록. /planning 호출 또는 "계획 세워보자" / "설계해보자" 요청 시 사용.
---

# planning

ai-nodes 워크스페이스에 새 기능이나 변경사항을 구현하기 전, 모호함을 모두 해소하고 5문서를 정비한 뒤 `/plan-and-build`로 실행을 넘기는 8단계 설계 워크플로.

fos-blog repo의 동명 스킬을 ai-nodes 멀티 워크스페이스 맥락으로 포팅한 것. 화면/UI 단계는 CLI 시나리오로 변형하고, fos-blog 특화 자산(pages/, fos-blog-docs-verifier)은 빼고, ai-nodes 5문서 컨벤션(`prd / data-schema / flow / code-architecture / adr`)에 정렬했다.

## 핵심 원칙

- **속도와 안정성의 트레이드오프**: 빠르게 끝나되 다음 사이클에서 빚을 만들지 않는다.
- **모호함 제로**: 각 단계에서 조금이라도 모호하면 반드시 사용자와 논의. 넘어가지 않는다.
- **AI 에이전트 관점**: 최종 문서는 AI 에이전트가 읽고 phase로 구현할 수 있을 정도로 명확해야 한다.
- **간결한 문서**: 컨텍스트 낭비 금지. 의사결정 *왜*는 보존하되 구현 상세는 코드에.
- **Critic 반복 지적 사전 소진**: task 파일 작성 시 `../plan-and-build/references/common-pitfalls.md`의 §1~§5 패턴을 모두 self-check. critic이 매번 같은 지적을 반복하지 않도록 plan 단계에서 미리 해결.
- **선택지 제시는 AskUserQuestion 으로**: 옵션 중 하나를 고르게 할 때는 `AskUserQuestion`. 추천안은 첫 번째 + label 끝 `(추천)`. 글로 늘어놓는 long-form 옵션 비교 금지.

## Critic 패턴 사전 소진 (필수)

task 파일을 **사용자에게 제출하기 전**에 반드시 [`../plan-and-build/references/common-pitfalls.md`](../plan-and-build/references/common-pitfalls.md)의 모든 §를 self-check.

**축적 규칙**: critic이나 verify가 **새 타입**의 지적을 하면 세션 종료 후 `common-pitfalls.md`에 패턴을 추가한다. 파일은 시간이 갈수록 두꺼워지고, critic이 할 말은 줄어든다.

## 실행 절차

사용자가 `/planning <기능 설명>`을 호출하면 아래 8단계를 **순차적으로** 진행. 각 단계는 사용자의 확인을 거친 후 다음 단계로. 규모가 작은 기능은 1+2를 합치거나 3을 생략할 수 있다.

### 1단계: 구현 가능성 검증

**역할**: CTO

- 기술적으로 구현 가능한지 검증.
- 기존 코드베이스(워크스페이스 안 + `_shared/bin/`)에서 재사용 가능한 부분 식별.
- 리스크·제약사항 도출.
- 모호한 부분이 있으면 즉시 사용자와 논의.

**확인할 것**:
- 기존 config 스키마로 충분한가, 변경이 필요한가? (`docs/data-schema.md` 점검)
- 기존 dispatcher (`run_now.sh`) 분기로 충분한가, 새 분기 추가가 필요한가?
- 기존 runner / extractor를 재사용 가능한가?
- 기존 `_shared/bin/` 헬퍼로 커버되는가, 새 헬퍼가 필요한가?
- 외부 의존성(`claude` CLI 외) 추가가 필요한가?

### 2단계: 기술 스택 검증

- ai-nodes 기존 스택(Python 3 stdlib, bash, claude CLI)으로 충분한지 확인.
- 새 라이브러리 도입이 필요하면 대안 비교 + 사용자와 논의. **신규 외부 의존성은 비용이 크다** — 정당화 없이 도입 금지.
- MVP 범위에 불필요한 복잡도(예: 별도 서비스, queue, DB)를 추가하지 않는지 검증.

### 3단계: 호출 시나리오 검증

**역할**: 시니어 워크플로 디자이너

- 새 기능이 dispatcher(`run_now.sh`)의 어떤 분기로 들어오는지 명확화.
- 명령 인자·플래그 조합, env 변수, cron 트리거 등 입력 경로 구체화.
- 정상 흐름 + 에러 흐름 + 빈 상태 + 권한·잠금 충돌 같은 엣지 케이스 점검.
- 모호한 부분은 전부 사용자에게 질문.

이 단계의 산출물: 새 기능을 어떻게 부르는가의 정확한 시그니처.

### 4단계: 데이터 / 스키마 설계

**역할**: 데이터 모델러

- 새 config 파일이 필요한가? 필요하면 정확한 JSON 스키마.
- 새 runtime 상태가 필요한가? `<workspace>/data/runtime/` 위치 + 스키마.
- 산출물(report.md, JSON 등)의 위치와 명명 규칙.
- ADR-015 위반 점검: 데이터는 반드시 `data/`에, docs는 의사결정·학습만.

새 데이터가 추가되면 `docs/data-schema.md` 갱신 필수.

### 5단계: 흐름 설계

- 새 기능이 dispatcher → runner → claude → extractor → 산출물 흐름의 어디에 들어가는지 한 줄 시퀀스로.
- 알림 발송 시점 (시작/완료/실패).
- 잠금이 필요한 경우 `data/runtime/locks/` 사용 명시.
- 토큰 회계가 자동으로 흘러가는지 (`claude_persist_usage` 호출 위치) 점검.

`docs/flow.md` 갱신 필수.

### 6단계: 코드 구조 영향 분석

- 새 스킬 디렉터리가 필요한가, 기존 스킬을 확장하는가?
- 새 runner 추가 시 `claude_lib.sh` source + `claude_persist_usage` 호출 보장.
- dispatcher case 추가 시 `run_tracked()` 헬퍼 통과 보장.
- 워크스페이스 격리: 다른 워크스페이스 자산을 참조하는가? 참조해야 한다면 정당화.

`docs/code-architecture.md` 갱신 필수.

### 7단계: docs 영향 종합 + ADR 작성

| 변경 유형 | 갱신할 docs |
|---|---|
| 제품 범위 / 기능 추가 | `prd.md` 기능 표 |
| 데이터 / 스키마 / 산출물 형식 | `data-schema.md` |
| 호출 시나리오 / 데이터 흐름 | `flow.md` |
| 디렉터리 / 계층 / 외부 의존 | `code-architecture.md` |
| 기술 결정 (왜) | `adr.md` 맨 아래 누적 |
| 회고·학습 | `docs/learn/YYYY-MM-DD-<topic>.md` |
| 인수인계 메모 | `docs/hand-off/` |

**문서 책임 표 (단일 소스 원칙)**:
- 같은 정보를 두 문서에 적지 않는다. 다른 문서가 참조해야 하면 ADR 번호로 링크.
- 새 결정은 항상 `adr.md` 맨 아래에 *append*. 개별 ADR 파일 신설 금지.
- 자명한 결정(예: "버그 수정 위치를 한 줄 옮긴다")은 ADR로 기록하지 않는다.

**ADR 작성 원칙 (토큰 효율 + drift 회피)**:

ADR은 *왜* 결정했는지를 AI 에이전트가 빠르게 파악하는 단일 출처다. 코드 구현 상세는 ADR이 아니라 코드·`docs/code-architecture.md`·git history가 책임진다.

각 ADR은 5개 섹션만 가진다:

1. **헤더** — `## ADR-N — 제목` + Status / Date 라인.
2. **맥락** — 왜 이 결정이 필요했는지. 기존 상태 + 발견된 문제. AI 에이전트가 결정의 *왜*를 추론하기에 충분한 만큼만.
3. **결정** — 무엇을 결정했는지. 핵심 trade-off + 거절한 대안 한 줄씩.
4. **결과** — 결정의 의도된 효과 + 알려진 단점.
5. **(선택) 적용** — 어디에 가이드라인이 박혀 있는지 *포인터*만 (예: "`<workspace>/skills/.../runner.sh`의 `attempt()` 함수 패턴 참조"). 코드 블록 ❌, 파일 전체 목록 ❌.

다음은 ADR에 **넣지 않는다**:

- 코드 블록 (before/after 비교, 함수 구현, 셸 명령 시퀀스).
- 적용 대상 파일의 전수 목록 (디렉터리 한 줄 또는 패턴으로 충분).
- 변경 이력 (git history가 단일 출처).
- 검증 결과의 구체 수치 (`docs/learn/` 또는 task phase 산출물로).
- 미래 enhancement / TODO (별도 plan이나 task로).

코드를 알아야 결정 자체를 이해할 수 없는 경우만 짧은 인용 1-2줄 허용 (예: "기존 `--output-format json` 폐기가 부작용을 일으켰음" 정도).

**왜 이 원칙인가**:
- AI 에이전트가 `docs/adr.md`를 읽을 때 소비하는 토큰을 줄인다. 의사결정 맥락에만 집중.
- ADR과 코드 사이 drift 위험 감소 — ADR은 *왜*만, 코드가 *어떻게*의 단일 출처.
- 구현 상세는 `docs/code-architecture.md`(현행 구조) / `docs/learn/`(회고) / git history / task phase 산출물로 자연스럽게 분산.

기존 ADR이 본 원칙에 어긋나면 (예: 코드 블록이 들어가 있음) 그 자리에서 슬림화하지 말고, 별도 `plan{N}-adr-cleanup` 후속 task로 처리한다 — 한 번에 너무 많은 변경을 한 ADR 사이클에 섞지 않는다.

**5문서 공통 작성 원칙 (토큰 효율 + drift 회피, 모두 적용)**:

`docs/` 5문서는 AI 에이전트가 워크스페이스 컨텍스트를 추론하는 단일 출처다. 구현 디테일이 들어오면 토큰을 낭비하고 코드와 drift된다. 각 문서는 *자기 책임 영역* 안에서 **AI가 의사·구조를 추론하기에 충분한 최소량**만 적는다.

각 문서의 책임과 *넣지 않는다* 목록:

- **prd.md** — 제품 범위 · 기능 표 · 성공 기준 · 알려진 미연결 항목.
  - 넣지 않는다: 구현 알고리즘 · runner 내부 동작 · 명령 인자 전수 옵션 · 변경 이력.
- **data-schema.md** — config / runtime / 산출물의 JSON 스키마와 그 *의도*.
  - 넣지 않는다: 호출 예제 코드 블록 · 마이그레이션 step-by-step · 폐기된 옛 스키마 보존(git history).
- **flow.md** — 명령별 데이터 흐름. 입력 → runner → 산출물 한 줄 시퀀스.
  - 넣지 않는다: 변수명 · 함수 내부 라인 · 셸 명령 시퀀스 · 절대 경로 디렉터리 트리(code-architecture.md 책임).
- **code-architecture.md** — 디렉터리 트리 + 계층 책임 + 외부 의존성. 패턴 예시 코드 블록은 *유형*만 (전체 구현 X).
  - 넣지 않는다: 파일 전수 목록 + 모든 함수 시그니처 + 변경 이력.
- **adr.md** — 의사결정의 *왜*만. 위의 ADR 작성 원칙 참조.

**5문서 공통으로 넣지 않는다**:

- 파일 전수 목록 (디렉터리 한 줄 또는 패턴으로 충분).
- 변경 이력 / 마이그레이션 step (git history + task phase 산출물).
- 검증 결과 구체 수치 (`docs/learn/`).
- 미래 enhancement / TODO (별도 plan으로).
- 같은 정보 두 문서에 중복 (단일 소스 원칙 — 다른 문서가 참조해야 하면 ADR 번호로 링크).

코드 블록은 *패턴 예시*가 결정 이해에 필수일 때만 짧게(5-15줄). before/after 비교 ❌. 전체 구현 ❌.

**왜 이 원칙인가**:

- AI 에이전트가 5문서를 모두 컨텍스트로 로드할 때의 토큰 효율 — 디테일이 많을수록 의사결정 추론은 더 느려진다.
- 5문서와 코드 사이 drift 회피 — 문서는 *왜·무엇을·어디에*, 코드는 *어떻게*의 단일 출처.
- 새 plan 작성 시 5문서 갱신 부담을 줄여 plan 사이클 속도가 빨라진다.

기존 문서가 본 원칙에 어긋나면 (예: code-architecture.md에 코드 블록이 비대) 별도 `plan{N}-docs-slim` 사이클로 처리. 한 plan에 너무 많은 정리 변경을 섞지 않는다.

### 8단계: task 파일 생성 + 커밋

`<workspace>/tasks/plan{N}-<kebab-slug>/` 아래:
```
index.json
phase-01.md
phase-02.md
...
```

상세 규칙은 [`task-create.md`](task-create.md) 참조 (index.json 스키마 / model 라우팅 / phase 작성 체크리스트 / 마지막 phase 표준).

`common-pitfalls.md` §1~§5 self-check 통과 후 사용자에게 제출.

## 중간 의사결정 시 즉시 docs 반영 (필수)

각 단계에서 사용자와 의사결정이 완료되면, 8단계를 기다리지 않고 **즉시 docs에 반영**한다. 결정 사항이 논의 중 유실되는 것을 방지.

## 완료 후 (필수 수행 절차)

8단계가 끝나면 항상 아래 순서를 수행 — 사용자의 별도 지시를 기다리지 않는다.

1. **docs 반영 완료 확인** — 7단계 표의 해당 문서에 이번 결정이 기록됐는지 점검.
2. **task 파일 생성 완료 확인** — `<workspace>/tasks/plan{N}-<slug>/` 디렉터리 + index.json + phase 파일들.
3. **`common-pitfalls.md` §1~§5 사전 소진** — task 제출 전 self-check.
4. **branch 확인** — `git branch --show-current`가 `main`이어야 함.
5. **git commit** — docs 변경과 task 파일을 **별도 커밋** 두 개로 분리 (docs-first 원칙, ADR-015):
   - 첫 커밋: `docs(<workspace>): <기능명> 관련 ADR + 명세 갱신`
   - 두 번째 커밋: `task(<workspace>): plan{N} <기능명> task 생성`
6. **git push origin main** — 둘 다 푸시.
7. 사용자 보고 + 실행 안내:

   > plan{N} task 파일 생성 + commit + push 완료. 별도 세션에서 다음을 실행하세요:
   > ```
   > python3 skills/plan-and-build/scripts/run-phases.py <workspace>/tasks/plan{N}-<slug>
   > ```

**실제 phase 실행은 사용자가 명시적으로 `/plan-and-build`(또는 직접 명령)을 호출할 때 시작.** planning 스킬은 task 생성 + push까지만 책임진다. 본 세션과 별도 세션 분리가 핵심 — 컨텍스트 격리.

### 예외

- **docs 변경 없음 + task 없음** (논의만): commit/push 생략, "task 생성할 규모 아니라 기록 없이 종료" 고지.
- **force push 필요**: 금지. 새 커밋 생성으로 대체.
- **원격 branch protection으로 main 직접 push 차단**: PR 경로로 우회.

## 단계 건너뛰기 가이드

| 기능 규모 | 권장 단계 |
|---|---|
| 소 (버그 수정, 한 줄 정책 변경) | 1 → 7 → 8 (3·4·5·6 생략) |
| 중 (기존 기능 확장, 새 토픽 추가) | 1 → 3 → 4 → 6 → 7 → 8 |
| 대 (신규 dispatcher 분기, 새 runner) | 전체 8단계 |

소·중 규모에서도 7단계 docs 영향 분석은 **항상** 수행 — 5문서 drift 방지.

## plan 네이밍 규칙

### 번호 충돌 방지 (필수)

**plan/ADR 번호를 부여하기 전에 반드시 기존 번호를 확인한다.** 다른 세션이 번호를 추가했을 수 있다.

```bash
# cwd: ai-nodes root
ls <workspace>/tasks/ | grep "plan{후보번호}"
grep "^## ADR-{후보번호}" <workspace>/docs/adr.md
```

다음 가용 번호를 사용. plan / ADR 번호는 워크스페이스별로 독립적.

### 서브넘버 규칙

비슷한 성격의 후속 작업은 같은 번호에 서브넘버를 붙여 묶는다:

```
plan003-cj-oliveyoung-decomposition         # 원본
plan003-2-cj-oliveyoung-renamer-rollout     # 동일 성격 후속
```

묶기 기준: 동일 스킬 확장 / 동일 도메인 후속 / 동일 기능 다른 영역.

별도 번호 기준: 서로 다른 도메인 / 독립 실행 가능 + 의존 관계 없음.

## 파일

- `SKILL.md` — 이 문서
- `task-create.md` — task / phase 파일 작성 정식 명세 (index.json 스키마 / phase 체크리스트 / 마지막 phase 표준)

## 의도적으로 안 하는 것

- **본 세션에서 phase 실행**: planning은 task 파일 생성까지만. 실행은 `/plan-and-build`가 별도 세션에서.
- **개별 ADR 파일 신설**: 모든 새 결정은 `<workspace>/docs/adr.md` 맨 아래 누적 (ADR-015).
- **데이터 파일을 docs/ 아래 둠**: 데이터는 항상 `<workspace>/data/` (ADR-015).
- **외부 의존성 무비판 도입**: 신규 라이브러리는 1단계·2단계에서 정당화 + 사용자 동의 필수.
- **워크스페이스 간 자산 참조**: 다른 워크스페이스 코드를 import / read / write 금지.
- **chat에서 끝나는 결정**: 결정은 즉시 docs에. chat은 휘발.
