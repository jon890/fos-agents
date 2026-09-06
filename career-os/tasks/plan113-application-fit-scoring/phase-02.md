# Phase 02 적합도 점수를 계산하고 검증한다

**Execution profile**: standard

---

## 목표

적합도 표에서 총점과 구분별 소계를 계산하는 함수를 만들고, 검증기가 표의 판정 값과 계산 결과를 확인하게 한다.
사람이 표를 세어 집계하지 않게 하는 것이 목적이다.

**범위 외**: 화면 표시는 phase 03이 맡는다. 스킬 목표와 단계 표는 phase 01이 이미 바꿨다.

---

## 컨텍스트

판정 값, 점수, 가중치와 계산식은 `career-os/docs/data-schema.md`의 「적합도 판정과 점수」가 소유한다.
구현하기 전에 그 절을 읽는다. 숫자를 이 phase에서 새로 정하지 않는다.

phase 01이 `career-os/.claude/skills/application-package-writer/scripts/fit_score.ts`에 타입과 상수를 이미 선언했다.
이 phase는 그 위에 파싱과 계산을 얹는다.

적합도 표는 `evidence/application-package.md`의 「공고 항목별 적합도」 절에 있다.
표의 열은 `공고 항목`, `공고 구분`, `근거`, `판정` 넷이다.

plan112 phase 02가 이 표의 존재와 머리행, 판정 값을 검사하는 코드를 이미 넣었다.
그 검사를 지우지 말고 점수 계산을 더한다.

**근거 문서**: `career-os/docs/data-schema.md`의 「적합도 판정과 점수」, `career-os/docs/adr/ADR-110-지원-적합도를-가중-점수로-판정한다.md`

---

## 의도 메모

- 점수를 문서에 미리 적어 두고 검증기가 그 숫자를 믿는 방식을 기각했다. 표가 바뀌면 숫자가 어긋난다. 표에서 매번 계산한다.
- `사용자 확인` 행은 분자와 분모 양쪽에서 뺀다. 분모에만 남기면 아직 판정하지 않은 항목이 공백처럼 점수를 깎는다.
- 반올림은 소수 첫째 자리까지만 한다. 그 이상은 표가 한 행 바뀔 때마다 흔들려 읽는 사람이 변화를 오해한다.

---

## 작업 항목

### 1. `career-os/.claude/skills/application-package-writer/scripts/fit_score.ts`에서 표를 읽고 점수를 계산한다

`parseFitTable(markdown: string): FitRow[]`를 만든다.
「공고 항목별 적합도」 절의 표를 찾아 각 행을 `{ item, section, evidence, judgment }`로 만든다.
절이 없거나 표가 없으면 빈 배열이 아니라 오류를 낸다.

`calculateFitScore(rows: FitRow[]): FitScore`를 만든다.
반환값은 총점, 구분별 소계 셋, 판정별 개수, 계산에서 제외한 항목 수를 담는다.

- 총점과 소계는 소수 첫째 자리까지 반올림한다.
- `사용자 확인` 행은 분자와 분모 양쪽에서 뺀다.
- 어느 구분에도 행이 없으면 그 소계는 숫자가 아니라 `해당 없음`으로 표시할 수 있게 `null`을 반환한다.
- 모든 행이 `사용자 확인`이면 총점도 `null`이다.

`fitScoreColor(score: number): FitColor`를 만든다.
색 구간은 문서가 소유하므로 상수로 선언하고 구간 경계를 하드코딩하지 않는다.

### 2. `career-os/.claude/skills/application-package-writer/scripts/validate_application_package.ts`에서 표를 더 검사한다

plan112가 넣은 검사에 다음을 더한다.

판정 값 목록의 실제 소유 파일은 `scripts/package_contract.ts`의 `FIT_TABLE_VERDICTS`다.
이 목록이 phase 01의 `FIT_JUDGMENT_SCORES`에서 다섯 값을 가져오게 연결해 중복 정의를 피한다.

- `공고 구분` 열의 값이 `주요 업무`, `기대 경험`, `우대 경험` 중 하나여야 한다.
- `판정`이 `사용자 확인`이 아닌 행에는 `근거` 열이 비어 있으면 안 된다.
- 같은 `공고 항목` 문구가 두 행에 있으면 거부한다.
- `parseFitTable`과 `calculateFitScore`가 오류 없이 끝나야 한다.

검증 결과에 계산한 총점과 구분별 소계를 담아 호출자가 쓸 수 있게 한다.

### 3. `career-os/.claude/skills/application-package-writer/SKILL.md`에서 점수 확인 명령을 적는다

단계 3 절에 검증 명령을 적는다.
판정을 마친 뒤 이 명령으로 총점을 확인하고 그 값을 사용자에게 보여준다는 것을 명시한다.

총점을 합격 확률로 설명하지 않는다는 경계도 같은 절에 둔다.

### 4. `career-os/applications/tossplace/server-developer-ai-platform/evidence/application-package.md`에서 표를 계약에 맞춘다

plan112 phase 02가 만든 적합도 표에 `공고 구분` 열이 없거나 판정 값이 다섯 값과 다르면 맞춘다.
「합류하면 함께할 업무」 첫 항목처럼 컴포넌트가 여럿인 줄은 각각을 별도 행으로 쪼갠다.

`career-os/applications`는 홈서버와 동기화되는 비공개 작업본이다.
`career-os/docs/flow.md`의 「skill이 실행하는 명령」을 `SKILL_NAME=application-package-writer`로 실행해 최신 판을 받고, 마친 뒤 같은 이름으로 완료 단계를 실행한다.

### 5. 이 phase를 검증하는 테스트를 더한다

`career-os/.claude/skills/application-package-writer/scripts/fit_score.test.ts`에 다음을 더한다.

- 정상: 세 구분에 행이 섞인 표에서 총점과 소계가 문서의 계산식과 같은 값이 나온다.
- 정상: `사용자 확인` 행이 총점을 깎지 않고 분모에서도 빠진다.
- 빈 상태: 한 구분에 행이 없으면 그 소계가 `null`이다.
- 빈 상태: 모든 행이 `사용자 확인`이면 총점이 `null`이다.
- 실패: 「공고 항목별 적합도」 절이 없으면 오류를 낸다.
- 색: 각 구간 경계값에서 기대한 색이 나온다. 85, 84.9, 65, 44.9, 25, 24.9를 확인한다.

`career-os/.claude/skills/application-package-writer/scripts/validate_application_package.test.ts`에 다음을 더한다.

- 정상: `강한 인접` 판정이 있는 표를 허용하고 75점으로 계산한다.
- 실패: `공고 구분`에 `있으면 좋음`처럼 계약에 없는 값이 있으면 거부한다.
- 실패: 판정이 `확인됨`인데 `근거` 열이 비어 있으면 거부한다.
- 실패: 같은 공고 항목 문구가 두 행에 있으면 거부한다.

---

## 검증

```bash
# cwd: 저장소 루트 (fos-agents)
bun test ./career-os/.claude/skills/
bunx tsc --noEmit
```

두 명령이 모두 종료 코드 0이어야 한다.

토스플레이스 표의 총점을 계산해 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
bun career-os/.claude/skills/application-package-writer/scripts/validate_application_package.ts \
  career-os/applications/tossplace/server-developer-ai-platform
```

종료 코드 0이며 출력에 총점과 구분별 소계가 있어야 한다.

적합도 표에 구분 열이 있는지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
grep -c "공고 구분" \
  career-os/applications/tossplace/server-developer-ai-platform/evidence/application-package.md
```

`1` 이상이어야 한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/application-package-writer/scripts/fit_score.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/fit_score.test.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/validate_application_package.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/package_contract.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/validate_application_package.test.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 수정 |
| `career-os/applications/tossplace/server-developer-ai-platform/evidence/application-package.md` | 수정 |
