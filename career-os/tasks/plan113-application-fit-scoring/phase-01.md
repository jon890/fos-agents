# Phase 01 스킬 목표와 실행 절차를 다시 쓴다

**Execution profile**: deep

---

## 목표

`application-package-writer/SKILL.md`의 첫 줄에 이 스킬의 목표를 선언하고, 산문으로 흩어진 실행 흐름을 단계 표로 바꾼다.
스킬을 처음 읽는 실행 주체가 첫 줄에서 무엇을 판정해야 하는지 알게 하는 것이 목적이다.

**범위 외**: 점수 계산과 검증기는 phase 02, 화면 표시는 phase 03이 맡는다.

단계 사이를 되돌아가는 규칙도 이 phase에서 다루지 않는다.
「사용자와 검토」가 앞 단계를 다시 실행시키는 구조라 단방향 통과 모델과 맞지 않지만,
단계 표 도입과 되돌아오기 규칙을 한 phase에서 같이 바꾸면 무엇이 결함을 고쳤는지 판정할 수 없다.
세션을 넘겨 누적되는 상태에서 이미 통과한 단계를 어떻게 알아보는지도 같은 이유로 별도 plan에서 다룬다.

---

## 컨텍스트

지금 SKILL.md의 첫 절은 「사용자에게 주는 결과」이며 검토 화면 구성을 설명한다.
공고 요구와 후보자 근거를 연결하는 일은 「실행 흐름」의 세 번째 절에 있다.
이 배치 때문에 실행 주체가 이 스킬을 화면 만드는 일로 읽었고, 토스플레이스 건에서 공고 항목 16개가 표 6줄로 요약됐다.

`~/.claude/skills/planning/SKILL.md`와 그 `references/step-*.md`가 이번에 따를 구조다.
그 스킬은 다섯 가지를 한다. 구현하기 전에 열어 확인한다.

- 첫 줄에 목표를 한 문장으로 굵게 선언한다.
- 본문이 단계 표다. 단계, 이름, 정할 것, reference를 나란히 둔다.
- 각 단계의 상세 판단 기준은 `references/step-N.md`가 소유하고 SKILL.md는 순서만 담는다.
- 각 단계에 통과 조건을 둔다.
- 각 reference에 「통과시키지 않는 것」을 둔다.

plan112가 같은 파일의 동기화 경로와 화면 서술을 이미 바꿨다.
그 변경 위에서 작업한다.

**근거 문서**: `career-os/docs/adr/ADR-110-지원-적합도를-가중-점수로-판정한다.md`, `career-os/docs/prd.md`의 「지원 문서와 검증」, `career-os/docs/flow.md`의 「지원 준비와 검증」

---

## 의도 메모

- 목표를 「지원 준비를 한다」처럼 넓게 쓰지 않는다. 무엇을 판정하는지가 목표에 들어가야 실행 주체가 그것을 먼저 한다.
- 부합하지 않는다는 판정도 결론이다. 지원을 권하는 방향으로만 쓰면 스킬이 판정 도구가 아니라 설득 도구가 된다.
- 기존 references 셋은 지우지 않는다. 어느 단계에서 읽는지를 단계 표가 가리키게 한다.

---

## 작업 항목

### 1. `career-os/.claude/skills/application-package-writer/SKILL.md`에서 목표를 선언한다

제목 `# 지원 준비` 바로 아래의 두 문장을 목표 선언으로 바꾼다.

목표 한 문장을 굵게 쓴다.
이 공고가 찾는 사람과 후보자의 경험, 이력, 방향성이 부합하는지 판정한다는 내용이다.

그 아래에 세 문장을 둔다.

- 부합한다고 판정하면 그 근거로 제출 문서와 면접 준비를 만든다.
- 부합하지 않는다는 판정도 결론이며 그때는 지원하지 않는 이유를 남긴다.
- 총점은 합격 확률이 아니라 공고 요구와 현재 근거가 맞닿은 정도다.

### 2. 같은 파일에서 실행 흐름을 단계 표로 바꾼다

「실행 흐름」 절의 산문 다섯 덩어리를 단계 표 하나와 단계별 절로 나눈다.
표의 열은 `단계`, `이름`, `정할 것`, `reference` 넷이다.

| 단계 | 이름 | 정할 것 | reference |
| --- | --- | --- | --- |
| 1 | 공고 해체 | 공고 항목을 컴포넌트 단위로 쪼갠 목록과 각 항목의 구분 | `references/fit-judgment.md` |
| 2 | 근거 수집 | 각 항목에 연결할 후보자 근거와 그 근거를 확인한 위치 | `references/fit-judgment.md` |
| 3 | 적합도 판정 | 항목별 판정과 구분별 소계, 총점 | `references/fit-judgment.md` |
| 4 | 후보자 인터뷰 | 후보자만 확정할 수 있는 동기, 역할, 제약과 결과 범위 | `references/candidate-interview-questions.md` |
| 5 | 지원 전략 작성 | 승부처, 지원동기, 기여 시나리오와 공백 보완 계획 | `references/application-quality-rubric.md` |
| 6 | 사용자 검토 | 동기, 역할 구분, 핵심 사례, 공백과 기여 시나리오의 사용자 확인 | `references/full-document-review.md` |
| 7 | 제출 문서 연결 | `resume-preparer` 호출과 준비 상태 | `../resume-preparer/SKILL.md` |

단계 6은 지원동기가 본인 생각과 같은지, 본인 역할과 팀 역할이 구분됐는지 확인한다.
가장 강한 사례가 공고의 핵심 문제와 연결되는지, 약한 영역을 숨기지 않았는지,
기여 시나리오가 제품 사용자에게 닿는지도 확인한다.

단계 1부터 3까지가 이 스킬의 목표를 직접 수행하는 구간이다.
단계 3의 판정이 나오기 전에 지원동기와 승부처를 쓰지 않는다.

### 3. 같은 파일에서 각 단계에 통과 조건을 둔다

단계 표 바로 아래에 전 단계 공통 통과 조건 둘을 먼저 세운다.
그 단계에서 확인하기로 한 것이 남지 않았고, 사용자만 답할 결정이 남지 않았을 때 다음 단계로 간다.

그다음 각 단계 절 끝에 그 단계에만 붙는 조건을 적는다.
아래 셋은 반드시 포함한다.

- 단계 1: 공고 원문의 모든 항목이 목록에 있고, 한 항목에 컴포넌트가 둘 이상 남아 있지 않다.
- 단계 3: 모든 항목에 판정이 있고, `사용자 확인`이 아닌 항목에는 근거가 있다.
- 단계 4: 제출 문구를 바꿀 미확인 항목이 없거나, 남았다면 `human-confirmation`을 `needs_input`으로 둔다.

### 4. `career-os/.claude/skills/application-package-writer/references/fit-judgment.md`를 새로 만든다

단계 1부터 3까지의 판단 기준을 담는다.
SKILL.md는 이 파일을 단계 표의 reference 열에서 가리킨다.

다음을 담는다.

- 공고 항목을 쪼개는 기준. 한 문장에 표준화 대상이나 기술 이름이 여럿 나열되면 각각을 항목으로 둔다. 실측으로 토스플레이스 공고 16개 항목이 28행이 됐고, 쪼갤수록 공백이 드러나 총점이 60.8에서 54.0으로 내려갔다.
- 판정 값 다섯과 각 값의 기준. 값과 점수는 `career-os/docs/data-schema.md`의 「적합도 판정과 점수」가 소유하므로 여기서는 판단 기준만 적고 숫자를 복제하지 않는다.
- 관심을 묻는 항목과 경험을 묻는 항목을 구분한다. 관심을 묻는 항목은 `공백`으로 분류하지 않는다.
- 처음부터 만들지 않은 경험을 포지션과 대조한다. 인수받아 운영한 경험은 그 자체로 약점이 아니다. 여러 팀이 만든 것을 프로덕션에서 돌게 만드는 자리면 직접 근거이고, 제품을 처음부터 설계하는 자리면 약점이다. 같은 사실이 포지션에 따라 다른 판정을 받는다.
- 담당 계층을 제품 이름과 함께 쓴다. 제품 이름만 쓰면 전체를 만든 것으로 읽히고, 계층만 쓰면 그것이 무엇의 일부인지 사라진다.
- 소유를 보이는 축은 인원이 아니라 결정이다. 혼자 했다고 쓰지 않아도 내가 내린 결정과 의견이 갈렸던 지점을 쓰면 정직성과 소유가 함께 선다.

「통과시키지 않는 것」 절을 둔다.

- 공고 항목을 요약해 합친 표
- 근거 없이 `인접 경험` 이상으로 올린 판정
- 관심을 묻는 항목을 `공백`으로 분류한 것
- 학습 계획을 근거로 삼은 `인접 경험`
- 팀 성과를 단독 성과로 바꾼 근거
- 수치가 붙어 있다는 이유로 핵심으로 고른 사례. 측정된 것을 승부처로 고르는 편향이 실측으로 확인됐다
- 사용자가 말한 핵심 문제와 다른 문제를 고른 것
- 잴 수 없는 것을 잰 것처럼 쓴 결과
- 단계 수치를 전체 수치처럼 쓴 결과

「물어야 하는 신호」 절을 둔다.
아래 중 하나에 걸리면 문장을 다듬지 않고 사용자에게 묻는다.

- 프로젝트의 첫 문장이 「무엇을 운영했다」로 끝나고 해결한 문제가 없다
- 수치는 있는데 그 수치가 왜 중요했는지가 없다
- 중요성을 `핵심적인`, `중요한`, `복잡한` 같은 평가어로 대체했다
- 당시 제약이 한 프로젝트에도 없다
- 근거가 공고의 어느 항목과도 연결되지 않는다
- 사용자가 말한 문제와 고른 문제가 다르다

대표 사례를 고를 때는 사례마다 한 질문을 반드시 던진다.
「이 프로젝트에서 당시 가장 크게 막고 있던 것이 무엇이었나. 그리고 그것을 왜 쉽게 못 고쳤나.」
답을 받기 전에는 그 사례의 문장을 쓰지 않는다.
실측으로 이 질문 하나가 서사의 중심을 바꿨다.

### 5. 같은 파일에서 「만들지 않는 자료」 절에 잘못 들어간 산출물 계약을 꺼낸다

`### 만들지 않는 자료` 절 안에 이 스킬의 산출물 계약이 들어 있다.
제목만 훑는 실행 주체는 그 절을 건너뛰므로, 안에 있는 「공고 항목을 요약해 합치지 않는다」를 읽지 못한다.
토스플레이스 공고 16개 항목이 표 6줄로 요약된 실측 결함의 직접 원인이다.

절을 둘로 나눈다.

- `## 산출물 계약` 이라는 h2 를 새로 만들어 단계 표 뒤에 둔다. `evidence/application-package.md` 의 섹션 목록, 「공고 항목별 적합도」 표 계약, `evidence/interview-questions.json` 의 출처 셋과 검증 명령, 첫 10줄의 상태 머리를 여기로 옮긴다.
- `### 만들지 않는 자료` 에는 만들지 않을 것만 남긴다. evidence audit, 공고별 design 문서, 이전 제출 PDF, 반복되는 중간 설명 문서 넷이다.

옮기면서 문장을 다시 쓰지 않는다. 위치만 바꾼다.

### 6. 같은 파일에서 판정 값 목록을 지우고 단일 출처를 가리킨다

지금 `SKILL.md` 는 판정을 넷으로 적고 `career-os/docs/data-schema.md` 의 「적합도 판정과 점수」는 다섯으로 정의한다.
`강한 인접` 이 스킬 본문에 없어, 실행 주체가 `SKILL.md` 만 읽으면 그 값을 영원히 쓰지 않는다.

두 자리를 고친다.

- 「근거와 적합성 분석」 단계의 판정 값 정의 네 줄을 지운다.
- 「공고 항목별 적합도」 표 계약의 `판정은 ... 넷 중 하나만 쓴다` 문장을 지운다.

두 자리 모두 `career-os/docs/data-schema.md` 의 「적합도 판정과 점수」와 `references/fit-judgment.md` 를 가리키는 한 줄로 대체한다.
값과 점수를 두 곳에 두지 않는다.

### 7. 같은 파일의 frontmatter description 을 목표 문장으로 바꾼다

지금 `description` 은 준비할 산출물 일곱을 명사로 나열하고 `판정` 을 담지 않는다.
스킬을 고를 때 실행 주체가 처음 읽는 문장이므로 목표가 거기 있어야 한다.

첫 문장을 본문의 목표 선언과 같은 내용으로 바꾼다.
트리거 표현과 `resume-preparer` 로 연결한다는 경계, 실제 제출을 하지 않는다는 경계는 그대로 둔다.

### 8. 같은 파일에 역할을 한 줄로 선언한다

목표 선언 바로 아래에 역할을 둔다.
내용은 이렇다. 이 스킬을 수행하는 주체는 채용 심사자이며, 공고가 찾는 사람과 후보자가 부합하는지 먼저 판정하고 부합할 때만 제출 문서를 만든다.

역할이 없으면 실행 주체가 기본으로 잡는 자세는 사용자를 돕는 조력자다.
그러면 판정 도구가 아니라 설득 도구가 된다.

### 9. 같은 파일에서 나머지 절의 순서를 목표에 맞춘다

「사용자에게 주는 결과」를 목표 선언과 단계 표 뒤로 옮긴다.
「입력」은 단계 표 앞에 둔다. 무엇을 읽고 시작하는지가 순서보다 먼저다.
「안전 경계」는 맨 뒤에 그대로 둔다.
references 파일과 스크립트 경로를 끝에 목록으로 나열하는 절은 만들지 않는다. 본문이 필요한 자리에서 각 파일을 직접 가리킨다.

### 10. `career-os/.claude/skills/application-package-writer/evals/evals.json`의 낡은 판정 값을 고친다

지금 eval 하나가 기대값을 `확인됨, 인접 경험, 공백` 셋으로 적고 있다.
판정은 다섯이므로 그 기대값을 고친다.

적합도 판정을 확인하는 eval 이 없으면 하나 더한다.
공고 항목을 컴포넌트 단위로 쪼갰는지, 모든 항목에 판정이 있는지를 본다.

### 11. 이 phase를 검증하는 테스트를 더한다

`career-os/.claude/skills/application-package-writer/scripts/validate_application_package.test.ts`에 SKILL.md 구조를 확인하는 검사는 두지 않는다.
대신 이 phase는 문서 검사로 판정한다. 아래 「검증」의 grep 조건이 이 phase의 완료 조건이다.

phase 02가 만들 점수 계산 함수의 자리를 미리 잡는다.
`career-os/.claude/skills/application-package-writer/scripts/fit_score.ts`를 만들고 `FitJudgment` 타입과 `FIT_JUDGMENT_SCORES`, `FIT_SECTION_WEIGHTS` 상수만 선언한다.
값은 `career-os/docs/data-schema.md`의 「적합도 판정과 점수」와 일치해야 한다.
`career-os/.claude/skills/application-package-writer/scripts/fit_score.test.ts`에 상수 값이 문서와 같은지 확인하는 테스트를 둔다.

---

## 검증

```bash
# cwd: 저장소 루트 (fos-agents)
bun test ./career-os/.claude/skills/
bunx tsc --noEmit
```

두 명령이 모두 종료 코드 0이어야 한다.

목표 선언이 첫 절에 있는지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
head -20 career-os/.claude/skills/application-package-writer/SKILL.md | grep -c "^\*\*목표:"
```

`1`이 나와야 한다.

산출물 계약이 「만들지 않는 자료」 밖으로 나왔는지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
grep -c "^## 산출물 계약" career-os/.claude/skills/application-package-writer/SKILL.md
fit_contract_count=$(sed -n '/^### 만들지 않는 자료/,/^#/p' career-os/.claude/skills/application-package-writer/SKILL.md | grep -c "공고 항목별 적합도" || true)
echo "$fit_contract_count"
test "$fit_contract_count" -eq 0
```

첫 명령은 `1`, 둘째 명령은 `0` 이어야 한다.

판정 값 목록이 스킬 본문에 남아 있지 않은지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
old_verdict_count=$(grep -c "넷 중 하나만 쓴다" career-os/.claude/skills/application-package-writer/SKILL.md || true)
echo "$old_verdict_count"
test "$old_verdict_count" -eq 0
grep -c "^\*\*역할:" career-os/.claude/skills/application-package-writer/SKILL.md
```

첫 명령은 `0`, 둘째 명령은 `1` 이어야 한다.

단계 표와 reference 파일이 있는지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
grep -c "^| 1 | 공고 해체\|^| 3 | 적합도 판정" career-os/.claude/skills/application-package-writer/SKILL.md
ls career-os/.claude/skills/application-package-writer/references/fit-judgment.md
grep -c "통과시키지 않는 것" career-os/.claude/skills/application-package-writer/references/fit-judgment.md
```

첫 명령은 `2`, 마지막 명령은 `1` 이상이어야 한다.

한국어 검사를 통과해야 한다.

```bash
# cwd: 저장소 루트 (fos-agents)
~/.claude/scripts/korean-style-check.sh career-os/.claude/skills/application-package-writer/SKILL.md career-os/.claude/skills/application-package-writer/references/fit-judgment.md
python3 ~/.claude/scripts/check-readability.py career-os/.claude/skills/application-package-writer/SKILL.md career-os/.claude/skills/application-package-writer/references/fit-judgment.md
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 수정 |
| `career-os/.claude/skills/application-package-writer/references/fit-judgment.md` | 신규 |
| `career-os/.claude/skills/application-package-writer/scripts/fit_score.ts` | 신규 |
| `career-os/.claude/skills/application-package-writer/scripts/fit_score.test.ts` | 신규 |
| `career-os/.claude/skills/application-package-writer/evals/evals.json` | 수정 |
