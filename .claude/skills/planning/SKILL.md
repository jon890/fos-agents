---
name: planning
description: ai-nodes 워크스페이스에 새 기능·변경사항을 구현하기 전 8단계 설계 워크플로를 수행하는 skill. `/planning <기능 설명>`, "계획 세워보자", "설계해보자", "plan 세워줘", "기획해줘", "task 파일 만들어줘", "구현 전 검토", "새 기능 설계", "리팩토링 계획"처럼 구현 전 모호함 제거, docs 영향 분석, task 파일 생성이 필요할 때 사용. 구현 가능성 → 기술 스택 → 호출 시나리오 → 데이터/스키마 → 흐름 → 코드 구조 → docs 영향 분석 → task 생성 순서로 의사결정을 기록한다.
---

# planning

ai-nodes 워크스페이스에 새 기능이나 변경사항을 구현하기 전, 모호함을 모두 해소하고 5문서를 정비한 뒤 `/plan-and-build`로 실행을 넘기는 8단계 설계 워크플로.

fos-blog repo의 동명 스킬을 ai-nodes 멀티 워크스페이스 맥락으로 포팅한 것. 화면/UI 단계는 CLI 시나리오로 변형하고, fos-blog 특화 자산(pages/, fos-blog-docs-verifier)은 빼고, ai-nodes 5문서 컨벤션(`prd / data-schema / flow / code-architecture / adr`)에 정렬했다.

## 호출 후 범위 해석

- 새 기능, 리팩토링, 폴더 분해처럼 구현 시작 전 모호함을 닫아야 하는 요청에 적용한다.
- docs 영향이 불명확하면 planning 범위에 포함한다.
- planning 완료 후 실행이 필요하면 `plan-and-build`로 넘긴다.

## 핵심 원칙

- **속도와 안정성의 트레이드오프**: 빠르게 끝나되 다음 사이클에서 빚을 만들지 않는다.
- **모호함 제로**: 각 단계에서 조금이라도 모호하면 반드시 사용자와 논의. 넘어가지 않는다.
- **AI 에이전트 관점**: 최종 문서는 AI 에이전트가 읽고 phase로 구현할 수 있을 정도로 명확해야 한다.
- **간결한 문서**: 컨텍스트 낭비 금지. 의사결정 *왜*는 보존하되 구현 상세는 코드에.
- **구현 중 문서 수정 금지 설계**: 구현 phase가 docs/ADR/정책 문서를 고치지 않아도 될 만큼 계획 단계에서 계약을 닫는다. 구현 중 문서 수정이 필요하면 `PHASE_BLOCKED`가 나와야 한다.
- **Critic 반복 지적 사전 해소**: task 파일 작성 시 `../plan-and-build/references/common-pitfalls/INDEX.md`에서 현재 작업과 맞는 pattern file을 고르고 self-check. critic이 매번 같은 지적을 반복하지 않도록 plan 단계에서 미리 해결.
- **선택지 제시는 AskUserQuestion 으로**: 옵션 중 하나를 고르게 할 때는 `AskUserQuestion`. 추천안은 첫 번째 + label 끝 `(추천)`. 글로 늘어놓는 long-form 옵션 비교 금지.

## Critic 패턴 사전 소진 (필수)

task 파일을 **사용자에게 제출하기 전**에 반드시 [`../plan-and-build/references/common-pitfalls/INDEX.md`](../plan-and-build/references/common-pitfalls/INDEX.md)를 읽는다.
현재 작업의 trigger와 맞는 pattern file만 추가로 읽고 self-check한다.
어떤 항목이 필요한지 모호하면 해당 category 디렉터리 전체를 확인한다.

**축적 규칙**: critic이나 verify가 **새 타입**의 지적을 하면 세션 종료 후 `common-pitfalls/`에 pattern file을 추가한다.
추가 전 `INDEX.md`의 축적 기준을 통과하는지 확인한다.
실제 발생 사례는 `history.md`에 1줄로 남긴다.

## 실행 절차

사용자가 `/planning <기능 설명>`을 호출하면 아래 8단계를 **순차적으로** 진행. 각 단계는 사용자의 확인을 거친 후 다음 단계로. 규모가 작은 기능은 1+2를 합치거나 3을 생략할 수 있다.

### 1단계: 구현 가능성 검증

**역할**: CTO

- 기술적으로 구현 가능한지 검증.
- 기존 코드베이스(워크스페이스 안 + `_shared/lib/`)에서 재사용 가능한 부분 식별.
- 리스크·제약사항 도출.
- 모호한 부분이 있으면 즉시 사용자와 논의.

**확인할 것**:
- 기존 config 스키마로 충분한가, 변경이 필요한가? (`docs/data-schema.md` 점검)
- 기존 skill 또는 script helper로 충분한가, 새 진입점이 필요한가?
- 기존 `_shared/lib/` helper로 커버되는가, 새 helper가 필요한가?
- 외부 의존성 추가가 필요한가?

### 2단계: 기술 스택 검증

- ai-nodes 기존 스택(Bun TypeScript, Python 3, Bash, agent skill 직접 호출)으로 충분한지 확인.
- 새 라이브러리 도입이 필요하면 대안 비교 + 사용자와 논의. **신규 외부 의존성은 비용이 크다** — 정당화 없이 도입 금지.
- MVP 범위에 불필요한 복잡도(예: 별도 서비스, queue, DB)를 추가하지 않는지 검증.

### 3단계: 호출 시나리오 검증

**역할**: 시니어 워크플로 디자이너

- 새 기능이 어떤 skill, script, env 변수, cron 트리거로 호출되는지 명확화.
- 명령 인자와 플래그 조합을 구체화.
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

- 새 기능이 사용자 요청 → agent skill → script/helper → 산출물 흐름의 어디에 들어가는지 한 줄 시퀀스로.
- 알림 발송 시점 (시작/완료/실패).
- 잠금이 필요한 경우 `data/runtime/locks/` 사용 명시.

`docs/flow.md` 갱신 필수.

### 6단계: 코드 구조 영향 분석

- 새 스킬 디렉터리가 필요한가, 기존 스킬을 확장하는가?
- 새 script helper가 필요한가, 기존 helper를 확장하는가?
- skill에서 다른 skill을 위임할 때 CLI 하드코딩 없이 `/<skill> [args]` 의도 표현을 쓰는가?
- 워크스페이스 격리: 다른 워크스페이스 자산을 참조하는가? 참조해야 한다면 정당화.

`docs/code-architecture.md` 갱신 필수.

### 7단계: docs 영향 종합 + ADR 작성

| 변경 유형 | 갱신할 docs |
|---|---|
| 제품 가치 / 범위 / 기능 추가 | `prd.md` 제품 가치·skill 자산·성공 기준 |
| 데이터 / 스키마 / 산출물 형식 | `data-schema.md` |
| 호출 시나리오 / 데이터 흐름 | `flow.md` |
| 디렉터리 / 계층 / 외부 의존 | `code-architecture.md` |
| 기술 결정 (왜) | 워크스페이스 ADR 구조에 맞춰 기록 |
| 회고·학습 | 행동 규칙으로 굳어지면 ADR, skill, AGENTS 중 책임 문서에 직접 흡수 |
| 인수인계 메모 | `docs/hand-off/` |

**문서 책임 표 (단일 소스 원칙)**:
- 같은 정보를 두 문서에 적지 않는다. 다른 문서가 참조해야 하면 ADR 번호로 링크.
- 새 결정 기록 방식은 워크스페이스에 따라 다르다:
  - **ai-nodes 루트**: 새 ADR은 `docs/adr/ADR-NNN-slug.md` 새 파일 생성 + `docs/adr/INDEX.md` 행 추가.
  - **career-os**: 새 ADR은 `docs/adr/ADR-NNN-slug.md` 새 파일 생성 + `docs/adr/INDEX.md` 행 추가 (ai-nodes ADR-015 파일럿).
  - **그 외 워크스페이스**: `docs/adr.md` 맨 아래 *append* (개별 ADR 파일 신설 금지).
- 자명한 결정(예: "버그 수정 위치를 한 줄 옮긴다")은 ADR로 기록하지 않는다.

**ADR 작성 원칙**: 자세한 규칙은 [`references/adr-writing.md`](references/adr-writing.md)를 **반드시** Read 도구로 로드 후 적용.

**문서 작성 원칙**:
- 대상 워크스페이스에 `<workspace>/docs/README.md`가 있으면 먼저 로드해 문서별 책임을 확인한다.
- 공통 보조 규칙은 [`references/5docs-policy.md`](references/5docs-policy.md)를 **반드시** Read 도구로 로드 후 적용한다.

### 8단계: task 파일 생성 + 커밋

`<workspace>/tasks/plan{N}-<kebab-slug>/` 아래:
```
index.json
phase-01.md
phase-02.md
...
```

상세 규칙은 [`task-create.md`](task-create.md) 참조 (index.json 스키마 / model 라우팅 / phase 작성 체크리스트 / 마지막 phase 표준).

`common-pitfalls/INDEX.md`에서 관련 pattern file을 고르고 self-check한 뒤 사용자에게 제출.
task phase를 작성할 때 docs-first materialization phase와 구현 phase를 분리한다.
구현 phase의 범위에는 docs/ADR/정책 문서를 넣지 않는다.
구현 중 문서 수정이 필요할 가능성이 보이면 열린 결정으로 되돌리고 task를 확정하지 않는다.

## 중간 의사결정 시 즉시 docs 반영 (필수)

각 단계에서 사용자와 의사결정이 완료되면, 8단계를 기다리지 않고 **즉시 docs에 반영**한다. 결정 사항이 논의 중 유실되는 것을 방지.

## 완료 후 (필수 수행 절차)

8단계가 끝나면 항상 아래 순서를 수행 — 사용자의 별도 지시를 기다리지 않는다.

1. **docs 반영 완료 확인** — 7단계 표의 해당 문서에 이번 결정이 기록됐는지 점검.
2. **task 파일 생성 완료 확인** — `<workspace>/tasks/plan{N}-<slug>/` 디렉터리 + index.json + phase 파일들.
3. **`common-pitfalls/INDEX.md` 기반 사전 해소** — task 제출 전 관련 pattern file self-check.
4. **branch 확인** — `git branch --show-current`가 `main`이어야 함.
5. **HUD 갱신** — OpenClaw career 세션에서 task 파일을 생성했다면 `task files completed` 상태로 HUD를 갱신한다. 긴 task materialization 시작 전에는 `task materializing` 상태로 먼저 갱신한다.
6. **git commit** — docs 변경과 task 파일을 **별도 커밋** 두 개로 분리 (docs-first 원칙, ADR-015):
   - 첫 커밋: `docs(<workspace>): <기능명> 관련 ADR + 명세 갱신`
   - 두 번째 커밋: `task(<workspace>): plan{N} <기능명> task 생성`
7. **git push origin main** — 둘 다 푸시.
8. 사용자 보고 + 실행 안내:

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
| 대 (신규 skill, 새 script helper, 새 데이터 흐름) | 전체 8단계 |

소·중 규모에서도 7단계 docs 영향 분석은 **항상** 수행 — 5문서 drift 방지.

## plan 네이밍 규칙

### 번호 충돌 방지 (필수)

**plan/ADR 번호를 부여하기 전에 반드시 기존 번호를 확인한다.** 다른 세션이 번호를 추가했을 수 있다.

```bash
# cwd: ai-nodes root
ls <workspace>/tasks/ | grep "plan{후보번호}"
grep "^## ADR-{후보번호}" <workspace>/docs/adr.md        # career-os 제외
ls docs/adr/ | grep "^ADR-{후보번호}"                    # ai-nodes root
ls career-os/docs/adr/ | grep "^ADR-{후보번호}"          # career-os 전용
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
- **ADR 저장 위치 혼용**: ai-nodes root와 career-os는 `docs/adr/` 개별 파일 + `INDEX.md` 구조를 사용한다.
  그 외 워크스페이스는 `docs/adr.md` 단일 파일 *append*다.
  워크스페이스 방식을 섞지 않는다.
- **데이터 파일을 docs/ 아래 둠**: 데이터는 항상 `<workspace>/data/` (ADR-015).
- **외부 의존성 무비판 도입**: 신규 라이브러리는 1단계·2단계에서 정당화 + 사용자 동의 필수.
- **워크스페이스 간 자산 참조**: 다른 워크스페이스 코드를 import / read / write 금지.
- **chat에서 끝나는 결정**: 결정은 즉시 docs에. chat은 휘발.
