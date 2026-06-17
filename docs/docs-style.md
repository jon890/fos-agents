# docs / ADR 작성 형식 — ai-nodes 모노레포

ai-nodes 안 모든 docs · CLAUDE.md · SKILL.md · task phase 파일의 **형식 단일 출처**.
목표는 두 가지 — 작성자 가독성 ↑, AI 에이전트 컨텍스트 비용 ↓.
두 목표가 충돌하면 가독성을 우선한다.

본 정책의 dooray-cli mirror 출처: `https://github.com/jon890/dooray-cli/blob/main/CLAUDE.md` "docs / ADR 작성 형식" 섹션.

## 적용 범위

- `CLAUDE.md` (모노레포 + 각 워크스페이스)
- `<workspace>/docs/*.md` (5문서)
- `<workspace>/AGENTS.md`
- `docs/*.md` (모노레포 레벨)
- `.claude/skills/*/SKILL.md`
- `.claude/skills/*/references/*.md`
- `tasks/**/*.md`
- `README.md`

각 워크스페이스도 같은 정책 따른다 — 본 문서가 단일 출처.

## 8가지 형식 패턴

### 1. semantic line break (문장당 1줄)

한 단락 안의 문장은 줄바꿈으로 분리.
markdown 렌더링 결과는 동일 — 소스 가독성 ↑, git diff 정밀화, 토큰 동일.

**금지**: 한 단락에 2 문장 이상 같은 줄에 이어쓰기.

```markdown
나쁨: A 채택. B 가 더 빠르지만 C 위험. D 보류.

좋음:
A 채택.
B 가 더 빠르지만 C 위험.
D 보류.
```

### 2. enumerated inline 금지

`① ... ② ... ③ ...` / `1) ... 2) ... 3) ...` / 슬래시 나열 (`A / B / C` 3개 이상) 형식은
markdown bullet list 로 변환.

```markdown
나쁨: 정책 ① X 적용, ② Y 검증, ③ Z 제외.

좋음:
- X 적용
- Y 검증
- Z 제외
```

### 3. 괄호 중첩 2겹 이상 금지

`(... (...) ...)` 발생 시 단락 분리 또는 bullet 분리로 평탄화.

```markdown
나쁨: 본 결정은 (A 채택 (B 거절 + C 보류) 이후) 적용된다.

좋음:
본 결정은 A 채택 이후 적용된다.
A 채택 = B 거절 + C 보류.
```

### 4. `=` / `→` 동치·인과 압축 한 단락 1회만

여러 동치/인과 관계를 한 문장에 압축 X. 같은 단락 안에 `=` 두 번 또는 `→` 두 번이면 분리.

```markdown
나쁨: 정책 = 컨벤션 = 단일 출처 → 검출 명령 → 정정.

좋음:
정책은 컨벤션의 단일 출처.
적용 흐름: 검출 명령 → 정정.
```

### 5. 한 문장 길면 의미 단위 분할

다음 조건 중 하나라도 충족하면 의미 단위로 분할:
- 80자 초과
- 백틱 인용 3개 이상
- 괄호 다수

```markdown
나쁨: `apartment/skills/.../scripts/run_report.sh:21-25` 의 `TARGET_*` 5개 env default (예: `TARGET_NAME`, `TARGET_LOCATION`) 가 하드코딩됨.

좋음:
`apartment/skills/.../scripts/run_report.sh:21-25` 에 5개 env default 가 하드코딩됨.
대상: `TARGET_NAME`, `TARGET_ALIAS`, `TARGET_LOCATION`, `TARGET_UNIT_LABEL`, `TARGET_UNIT_EXCLUSIVE_AREA_M2`.
```

### 6. 한 bullet 다중 속성 sub-bullet 분리

bullet 1개가 *무엇 / 어떻게 / 예외 / 조건 / 근거* 중 2개 이상을 마침표·콤마·`+`·슬래시로 압축한다면 sub-bullet 으로 분리.

```markdown
나쁨:
- ADR-002 — 단일 출처 정책 채택, shell 폐기, env override 보존, FAIL 정책 명시

좋음:
- ADR-002 — 단일 출처 정책 채택
  - shell 하드코딩 폐기
  - env override 우선순위 보존
  - 부재 시 FAIL (하드코딩 fallback 미수용)
```

### 7. 표 셀 안 정보 4개 이상이면 `<br>` 분리

표 한 셀에 정보 항목이 4개 이상 압축되면 GitHub markdown `<br>` 줄바꿈으로 sub-bullet 처럼 분리.
가독성 ↑ + 셀 내부 줄바꿈으로 grep·diff 정밀도도 유지.

```markdown
나쁨:
| 패턴 | 대응 |
|---|---|
| heredoc escape | (a) body-file 사용, (b) escape 박지 않기, (c) backslash 0개 검증 |

좋음:
| 패턴 | 대응 |
|---|---|
| heredoc escape | (a) `--body-file <path>` 사용<br>(b) quoted heredoc 안에 escape 박지 않기<br>(c) 생성 직후 backslash 0개 검증 |
```

### 8. 헤더 + 본문 구조

섹션은 `## 제목` → 1줄 요약 → 본문(리스트·표) 순.
헤더 바로 다음 줄에 긴 줄글 박지 않는다 — 한 줄 요약이 섹션 의도를 즉시 전달.

```markdown
나쁨:
## 정책 영역 분리

본 문서는 ai-nodes 모노레포 안 모든 docs 의 형식 단일 출처이며 글로벌 directive 와 영역이 다르고 워크스페이스 한정 ...

좋음:
## 정책 영역 분리

글로벌 directive 와 ai-nodes 한정 정책을 분리한다.

- 글로벌: ...
- ai-nodes: ...
```

## Markdown 생성 함정

생성한 markdown (GitHub 이슈/PR, Dooray 댓글, 위키 본문, ADR 본문 등) 은 작성 직후 아래 패턴을 점검.
글로벌 directive `documentation_style` 의 `§` 금지 + 한글 unicode escape 금지 정책과 함께 운영.

| 패턴 | 증상 | 대응 |
|---|---|---|
| `~ ... ~` (한 단락에 짝수개) | 두 `~` 사이가 취소선 (`<del>`) 으로 렌더 — 범위 표기 (`60~100`, `2026-04-27 ~ 05-03`) 에서 자주 발생 | (a) `\~` 이스케이프<br>(b) `-` 또는 "부터/까지" 표기<br>(c) 코드 블록 (\`...\`) 으로 보호 |
| heredoc 안에서 `` \` `` / `\"` escape 가 본문에 리터럴로 남음 | quoted heredoc (`'EOF'`) 안에서는 `$`·`` ` ``·`\` 모두 비활성화 → escape 불필요.<br>그런데 안전하다고 escape 를 박으면 backslash 가 본문에 그대로 남아 markdown 깨짐.<br>예: `` \`/metrics\` `` → `\`/metrics\`` 로 렌더 | (a) **`gh pr create/edit --body-file <path>`** 로 파일 경로 전달 — heredoc·quoting 함정 자체 회피<br>(b) quoted heredoc 안에서는 escape 박지 않기<br>(c) 작성 직후 `gh pr view <N> --json body -q .body \| tr -cd '\\\\' \| wc -c` 가 0 인지 확인 |

본문 생성 직후 의심 문자 등장 횟수가 짝수이면 한 번 더 검토.

## 거울 구조 원칙

같은 정의를 두 docs 에 "본문"으로 쓰지 않는다.

- 단일 출처 한 곳에 본문.
- 다른 docs 는 *역참조* — ADR 번호 / 파일 path / 섹션 번호로 link.

예: ADR-002 본문은 `apartment/docs/adr.md` 단독.
`apartment/AGENTS.md` 가 그 정보를 인용해야 하면 "타깃 메타 단일 출처 정책은 ADR-002 참조" 한 줄.

## 한국어 표현 정책 — 어색한 한자어 회피

docs 를 한국어로 작성할 때 **한국인이 자연스럽게 읽히는 표현 우선**.
영어 단어를 한자/한글 음차한 외래어 합성은 사용 금지.

| 금지 | 권장 대체 |
|---|---|
| 매트릭스 (matrix) | 표 / 영향 표 / 분류 표 |
| 트리아지 (triage) | 분류 / 우선순위 분류 |
| 베이스라인 (baseline) | 기준선 / 기준값 |
| 스파이크 (spike) | 사전 조사 / API 검증 |
| 게이트 (gate) | 점검 / 사전 점검 |
| 사전 소진 | 사전 해소 |
| 단일 진실원 | 단일 소스 |
| 변질 의심 | 변질 우려 |
| 답습 | 동일 패턴 적용 / 그대로 적용 |
| 자명성 게이트 | ADR 작성 전 점검 |

**기술 용어 그대로 쓰는 게 표준인 경우** (`rebase`, `merge`, `commit`, `endpoint`, `payload`) 는 그대로 유지 — 한국어 대체가 오히려 어색.

표에 없는 외래어라도 같은 원칙으로 자체 판단.

## 적용 정책

### 새 작성물 우선

새 docs / phase / SKILL.md 작성 시 본 정책 준수.

### 기존 작성물

현재 편집 중인 파일이면 함께 정리.
작업 외 파일이면 사용자에게 알려 별도 정리 여부 묻는다 (일괄 교체 PR 등).

전수 정정은 별도 plan 으로 진행 (한 plan 에 너무 많은 정리 변경을 섞지 않음).

## 검출 명령

### 패턴 2 (enumerated inline)

```bash
grep -rnE "①|②|③|④|⑤|⑥|⑦|⑧|⑨" docs/ CLAUDE.md
```

### 패턴 5 (한 줄 200자 초과)

코드 블록·표는 수동 제외.

```bash
awk '{if (length($0) > 200) print FILENAME":"NR" ("length($0)" chars)"}' \
  docs/*.md CLAUDE.md
```

### 글로벌 directive (sigil `§` 사용)

`~/.claude/CLAUDE.md` `documentation_style` 정책 정합.

```bash
grep -rn "§" docs/ CLAUDE.md
```

## 글로벌 directive 와의 관계

`~/.claude/CLAUDE.md` `documentation_style` 섹션은 *모든 프로젝트 공통* 정책.
ai-nodes 한정 정책은 본 문서가 단일 출처.

| 정책 영역 | 단일 출처 |
|---|---|
| `§` 미사용 | 글로벌 `~/.claude/CLAUDE.md` |
| 한글 unicode escape 금지 | 글로벌 `~/.claude/CLAUDE.md` |
| 위험 한글 단어 영문 대체 ("옛"·"짐") | 글로벌 `~/.claude/CLAUDE.md` |
| AskUserQuestion native UTF-8 강제 | 글로벌 `~/.claude/CLAUDE.md` |
| 8 형식 패턴 (1~8) | 본 문서 (ai-nodes/docs/docs-style.md) |
| Markdown 생성 함정 (`~` 취소선·heredoc escape) | 본 문서 |
| 한자어 회피 표 | 본 문서 |
| 거울 구조 원칙 | 본 문서 |

## 참고

- dooray-cli mirror — 본 정책의 출처
- 글로벌 directive — `~/.claude/CLAUDE.md` `documentation_style`
- planning SKILL.md — 5문서 공통 작성 원칙 (의미·내용 정책, 본 문서와 영역 분리)
- `common-pitfalls/harness/6-9-sigil-self-positive.md` — sigil 검증 대상 escape 패턴
