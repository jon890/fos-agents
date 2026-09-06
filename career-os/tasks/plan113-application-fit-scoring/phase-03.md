# Phase 03 검토 화면에 점수 원을 그린다

**Execution profile**: standard

---

## 목표

적합도 총점과 구분별 소계를 색이 있는 원으로 검토 화면에 표시한다.
표를 읽지 않고도 지원 여부와 준비할 범위를 눈으로 판단하게 하는 것이 목적이다.

**범위 외**: 점수 계산은 phase 02가 이미 만들었다. 이 phase는 계산 결과를 그린다.

---

## 컨텍스트

plan112 phase 03이 검토 화면을 네 탭으로 바꾸고 HTML 골격과 CSS를 템플릿 파일로 분리했다.
템플릿은 `career-os/.claude/skills/application-package-writer/templates/` 에 있고 치환 이름은 `{{NAME}}` 형식이다.
상단 고정 영역의 치환 이름은 `{{STATUS_BADGES}}`, `{{CONCLUSION}}`, `{{PRIMARY_FILES}}` 셋이다.

점수와 색 구간은 `career-os/docs/data-schema.md`의 「적합도 판정과 점수」가 소유한다.
`fitScoreColor`는 phase 02가 이미 만들었다. 색 구간을 화면에서 다시 정하지 않는다.

**근거 문서**: `career-os/docs/data-schema.md`의 「적합도 판정과 점수」, `career-os/docs/flow.md`의 「지원 준비와 검증」 8번, `career-os/docs/adr/ADR-110-지원-적합도를-가중-점수로-판정한다.md`

---

## 의도 메모

- 원을 이미지나 외부 아이콘으로 그리지 않는다. 이 화면은 외부 의존이 없고 로컬 파일로 열린다.
- 총점 원 옆에 항상 경계 문구를 둔다. 숫자만 크게 두면 합격 확률로 읽힌다.
- 색만으로 구분하지 않는다. 색을 구별하지 못해도 숫자와 이름으로 읽을 수 있어야 한다.

---

## 작업 항목

### 1. `career-os/.claude/skills/application-package-writer/templates/application-package.html`에 점수 자리를 만든다

상단 고정 영역에 치환 이름 `{{FIT_SCORE}}`를 더한다.
위치는 `{{STATUS_BADGES}}`와 `{{CONCLUSION}}` 사이다.

### 2. `career-os/.claude/skills/application-package-writer/templates/application-package.css`에 원 규칙을 더한다

총점 원 하나와 구분별 소계 원 셋을 그리는 규칙을 둔다.

- 원은 `border-radius: 50%`와 고정 크기로 만든다. 총점 원이 소계 원보다 크다.
- 색은 CSS 변수 다섯으로 선언한다. 이름은 `--fit-excellent`, `--fit-good`, `--fit-fair`, `--fit-weak`, `--fit-none`이다.
- 원 안에 숫자를 넣고 원 아래에 구분 이름을 둔다.
- 인쇄할 때도 색이 남도록 `print-color-adjust: exact`를 준다.
- 화면이 좁으면 원 넷이 줄바꿈되게 한다.

### 3. `career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts`에서 원을 그린다

`renderFitScore(score: FitScore): string`을 만든다.
총점 원 하나와 구분별 소계 원 셋을 그리고 `{{FIT_SCORE}}`에 넣는다.

- 각 원에 `aria-label`을 준다. 구분 이름, 점수와 색 이름을 담는다.
- 소계가 `null`인 구분은 원 안에 `해당 없음`을 쓰고 `--fit-none` 색을 준다.
- 총점이 `null`이면 총점 원 자리에 판정이 아직 없다는 문구를 쓴다.
- 총점 원 옆에 경계 문구를 둔다. 이 점수가 합격 확률이 아니라 공고 요구와 현재 근거가 맞닿은 정도라는 내용이다.

호출부는 phase 02의 `parseFitTable`과 `calculateFitScore`로 점수를 얻는다.
적합도 절이 없는 문서는 `{{FIT_SCORE}}`를 빈 문자열로 채우고 화면을 만든다. 오류로 중단하지 않는다.

### 4. `career-os/applications/tossplace/server-developer-ai-platform/application-package.html`을 다시 만든다

렌더러를 실행해 화면을 다시 만들고 원 넷이 나오는지 아래 「검증」으로 확인한다.

`career-os/applications`는 홈서버와 동기화되는 비공개 작업본이다.
`career-os/docs/flow.md`의 「skill이 실행하는 명령」을 `SKILL_NAME=application-package-writer`로 실행해 최신 판을 받고, 마친 뒤 같은 이름으로 완료 단계를 실행한다.

### 5. `career-os/.claude/skills/application-package-writer/SKILL.md`에서 화면 서술을 맞춘다

「사용자에게 주는 결과」 절에 상단 고정 영역이 적합도 총점을 포함한다는 것을 적는다.
색 구간과 계산식은 `career-os/docs/data-schema.md`가 소유하므로 가리키기만 하고 복제하지 않는다.

### 6. 이 phase를 검증하는 테스트를 더한다

`career-os/.claude/skills/application-package-writer/scripts/render_application_package.test.ts`에 다음을 더한다.

- 정상: 총점 원 하나와 소계 원 셋이 나오고 각 원에 `aria-label`이 있다.
- 정상: 점수 구간에 맞는 CSS 변수 이름이 원에 적용된다. 90점은 `--fit-excellent`, 60점은 `--fit-fair`를 쓴다.
- 정상: 총점 원 옆에 합격 확률이 아니라는 경계 문구가 있다.
- 빈 상태: 한 구분의 소계가 `null`이면 그 원에 `해당 없음`이 있다.
- 빈 상태: 적합도 절이 없는 문서도 오류 없이 화면이 만들어지고 `{{FIT_SCORE}}` 자리가 빈 채로 남지 않는다.

모든 검증이 통과하면 `career-os/tasks/plan113-application-fit-scoring/index.json`의 `status`를 `completed`로, `current_phase`를 `3`으로 바꾼다.

---

## 검증

```bash
# cwd: 저장소 루트 (fos-agents)
bun test ./career-os/.claude/skills/
bunx tsc --noEmit
```

두 명령이 모두 종료 코드 0이어야 한다.

토스플레이스 화면을 다시 만든다.

```bash
# cwd: 저장소 루트 (fos-agents)
bun career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts \
  career-os/applications/tossplace/server-developer-ai-platform
```

원 넷이 있는지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
grep -c 'class="fit-circle' \
  career-os/applications/tossplace/server-developer-ai-platform/application-package.html
```

`4`가 나와야 한다.

치환 이름이 남아 있지 않아야 한다.

```bash
# cwd: 저장소 루트 (fos-agents)
grep -c '{{' career-os/applications/tossplace/server-developer-ai-platform/application-package.html
```

`0`이 나와야 한다.

경계 문구가 있는지 확인한다.

```bash
# cwd: 저장소 루트 (fos-agents)
grep -c "합격 확률" \
  career-os/applications/tossplace/server-developer-ai-platform/application-package.html
```

`1` 이상이어야 한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/application-package-writer/templates/application-package.html` | 수정 |
| `career-os/.claude/skills/application-package-writer/templates/application-package.css` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/render_application_package.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/scripts/render_application_package.test.ts` | 수정 |
| `career-os/.claude/skills/application-package-writer/SKILL.md` | 수정 |
| `career-os/applications/tossplace/server-developer-ai-platform/application-package.html` | 재생성 |
