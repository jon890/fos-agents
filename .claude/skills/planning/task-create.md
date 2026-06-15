# Task 생성 가이드 — ai-nodes

이 문서는 AI 에이전트가 ai-nodes 워크스페이스의 구현 task를 생성할 때 따르는 규칙이다. `/planning` 8단계 후 또는 단순 task 생성 시 참조.

## 디렉터리 구조

```
<workspace>/tasks/
  plan{N}-{kebab-slug}/
    index.json          # task 메타데이터 + phase 목록
    phase-01.md         # phase 1 프롬프트 (자기완결)
    phase-02.md
    ...
```

`plan{N}`의 N은 다음 가용 번호. 사전 확인:

```bash
# cwd: ai-nodes root
ls -d <workspace>/tasks/plan*/ 2>/dev/null | head -5
```

워크스페이스별 독립 번호 공간 — career-os의 plan003과 apartment의 plan003은 서로 무관.

## index.json 스키마

`skills/plan-and-build/scripts/run-phases.py`의 `validate_task` 함수가 강제하는 형식.

```jsonc
{
  "name": "plan{N}-{kebab-slug}",          // 디렉터리명과 일치
  "description": "한 줄 요약 — 무엇을 / 왜",
  "created_at": "2026-05-13T00:00:00+00:00",   // ISO-8601 UTC
  "updated_at": "2026-05-13T00:00:00+00:00",   // 동일
  "status": "pending",                      // pending | running | blocked | failed | completed
  "current_phase": 1,                       // 현재 진행 중인 phase 번호
  "total_phases": 3,                        // phases 배열 길이와 일치 (검증됨)
  "error_message": null,                    // 실패 시 채워짐
  "blocked_reason": null,                   // PHASE_BLOCKED 시 채워짐
  "related_docs": [                         // (선택) 관련 docs 경로
    "career-os/docs/adr.md",
    "career-os/docs/code-architecture.md"
  ],
  "depends_on": [                           // (선택) 선행 plan 번호
    "plan002-something"
  ],
  "phases": [
    {
      "number": 1,                          // 1부터 순차 증가
      "title": "phase 제목 (간결)",
      "file": "phase-01.md",
      "status": "pending",                  // pending | running | blocked | failed | completed
      "allowedTools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "model": "sonnet",                    // haiku | sonnet | opus | (생략 가능)
      "timeout": 600                        // (선택) 초 단위. 기본 600.
    }
  ]
}
```

### 검증 체크리스트

- [ ] `total_phases` == `phases` 배열 길이
- [ ] 모든 phase에 `number` / `title` / `file` / `status` / `allowedTools` 존재
- [ ] `number`가 1부터 순차 증가
- [ ] 각 `file`에 해당하는 `.md` 파일이 실제로 존재
- [ ] `name`이 `tasks/{name}/` 디렉터리명과 일치
- [ ] `error_message` / `blocked_reason`은 초기에 `null`

## Model 라우팅 (토큰 최적화)

| 모델 | 용도 |
|---|---|
| `haiku` | 사소한 수정 / lint / dead code 정리 / 마지막 phase의 검증·커밋 |
| `sonnet` | 표준 구현 — 다중 파일 수정·rename·리팩토링·새 runner / extractor |
| `opus` | 새 아키텍처 설계 / 복잡 알고리즘 — phase 안에 신규 도메인 핵심 설계가 있을 때만 |

**기계적 작업은 opus 금지**. rename / 경로 수정은 파일 수가 많아도 sonnet으로 충분.

## phase 파일 작성 규칙

### 핵심 원칙

1. **자기완결**: 각 phase 프롬프트는 이전 대화 컨텍스트 없이 독립 실행. 필요한 모든 맥락을 프롬프트 안에 포함.
2. **단일 책임**: 한 phase는 명확히 하나의 작업 단위. 작업 항목 5개 이하.
3. **검증 가능**: phase 마지막에 실행 가능한 성공 기준 명시 (`bash -n`, `python3 -m py_compile`, `grep`, `[ -f path ]` 등).

### Path 컨벤션 + cwd 정책 (필수)

**phase 본문의 모든 path는 *ai-nodes 루트 기준* (`<workspace>/...`)**. 하지만 `run-phases.py`는 cwd=workspace로 phase 실행 (line 355 `cwd=workspace`). 두 사실이 충돌 — phase 본문 bash 명령이 `apartment/config/...` 형태면 cwd=apartment에서 `apartment/apartment/config/...` 부재 처리 → PHASE_FAILED.

**모든 phase는 첫 bash 블록에 cwd=ai-nodes 루트 강제 cd 박는다**:

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

Claude Code Bash 도구는 *동일 phase 안 cwd 보존* — 첫 호출에 cd 박으면 후속 bash 명령 자동 유지. cd 강제는 *phase 본문 시작 강제 주의문 직후* 또는 *관련 docs 직전*에 새 섹션 "## 사전 cwd 설정"으로.

**Edit 도구는 absolute path 받음 → cwd 무관 동작**. cd 강제는 *bash 명령 중심* (test / grep / wc / git 등). Edit / Write는 *프롬프트 path만 절대경로화*하면 cwd와 무관.

이 패턴이 박혀있지 않으면 task 실행 첫 phase에서 hotfix commit이 별도로 필요 (common-pitfalls 6-8 참조 — plan024 / plan002 실측 사례).

### Sigil 문자 escape 정책

phase 본문 강제 주의문 + 검증 bash에서 *검증 대상 sigil 문자* (section mark U+00A7, tilde, 등) 자체 인용 회피:

- 강제 주의문: 평문 명시 (`section mark (U+00A7) 사용 금지`, `tilde (U+007E) 회피`)
- 검증 bash: escape 변수 사용

```bash
SIGIL_CHAR=$(printf '\xc2\xa7')
COUNT=$(grep -c "$SIGIL_CHAR" target.md)
```

phase 본문 자체에 sigil 박으면 *self-positive grep* + *사용자 directive 위반* (CLAUDE.md section mark 미사용 directive). common-pitfalls 6-9 참조.

### phase 파일 구조

```markdown
# Phase NN — {제목}

**Model**: sonnet
**Status**: pending

---

## 목표

이 phase에서 구현할 것을 명확히. 왜 필요한지 한 문장.

**범위 외**: 다른 phase 또는 다른 plan의 책임 명시 (혼동 방지).

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

run-phases.py는 cwd=workspace로 phase 실행. 본 phase는 ai-nodes 루트 기준 path 사용이므로 첫 bash에서 cwd=ai-nodes 루트로 변경. Claude Code Bash 도구 cwd 보존 → 후속 자동 유지.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽을 워크스페이스 docs:
- `<workspace>/docs/code-architecture.md` (특정 섹션)
- `<workspace>/docs/data-schema.md` (해당 스키마)

---

## 작업 항목 (N)

### 1. {파일/모듈} — 변경 요약

구체적 변경 — 함수 시그니처, env 변수, config 키, 경로 등.
기존 패턴 참조: `<workspace>/skills/.../...` 의 동일 패턴.

### 2. ...

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `<workspace>/skills/.../run_X.sh` | 신규 / 수정 / 삭제 |
| `<workspace>/config/X.json` | ... |

## 검증

```bash
# 문법
bash -n <workspace>/skills/.../scripts/run_X.sh
python3 -m py_compile <workspace>/skills/.../scripts/X.py

# 기능
bash <workspace>/skills/.../scripts/run_now.sh <command> [args]

# 잔재 grep (없어야 함)
! grep -rE "legacy-pattern" <workspace>/
```

## 의도 메모 (왜)

- 결정 X의 근거 — 다른 옵션을 기각한 이유 (`docs/adr.md` ADR-N 참조)
- 향후 이 phase가 다음 plan의 어떤 부분을 막아주는가

## Blocked 조건 (선택)

- 외부 의존성 부재 / 사용자 결정 필요 → `PHASE_BLOCKED: {이유}` 출력 후 종료
- 검증 통과 불가 → `PHASE_FAILED: {이유}` 출력 후 종료
```

### phase 작성 시 self-check (`common-pitfalls.md` 패턴 소진)

- [ ] **1-1 수치 추측 없음** — 모든 수치 옆에 실측 명령 명시.
- [ ] **1-2 성공 기준이 실행 가능 명령** — exit 0 / 그 외로 단정 가능.
- [ ] **1-3 phase 간 컨텍스트 격리** — 이전 phase 보지 않고 실행 가능.
- [ ] **2 워크스페이스 격리** — 다른 워크스페이스 경로 등장 없음.
- [ ] **3 docs/data 라우팅** — 데이터 파일이 docs/에, ADR이 개별 파일에 안 들어감.
- [ ] **4 dispatcher 경계** — runner는 `run_now.sh` 경유, `claude_persist_usage` 호출 보장.
- [ ] **5 git 운영** — `--no-verify`/`--force` 없음.
- [ ] **6-6 Write 위장 방어** — Write/Edit 강제 주의문 + commit 개수 self-check (`git rev-list HEAD ^<base> --count`).
- [ ] **6-7 references 파일 audit** — SKILL.md 재작성 시 references/ 안 본문 옛 컨벤션 잔재 grep.
- [ ] **6-8 cwd 정책** — phase 본문 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"` 박혀 있는가?
- [ ] **6-9 sigil escape** — phase 본문에 검증 대상 sigil 문자 (section mark U+00A7, tilde) 직접 사용 회피 + 검증 bash는 `printf '\xc2\xa7'` escape 사용.
- [ ] **1-5 ADR 단일 책임** — 본 plan에서 신설한 ADR이 *각각 단일 trade-off 축*인가? "결정" 섹션에 항목 2개 이상이면 trade-off 축 동일성 self-check. 두 결정이 *독립적으로 supersede 가능*하면 분리 ADR. (SKILL.md "한 ADR = 한 의사결정" 섹션 참조)

## ai-nodes 작업 유형별 phase 가이드

| 작업 유형 | 권장 phase 분해 |
|---|---|
| 새 dispatcher 분기 추가 | ① runner 스크립트 작성 ② `run_now.sh` case 추가 + AGENTS.md 표 갱신 ③ 검증 (`run_now.sh <new-command>` smoke) |
| 새 자체 extractor 추가 | ① extractor python 작성 ② runner에서 호출 + `claude_persist_usage` 보장 ③ 검증 (sample JSON → markdown 변환) |
| 새 config 도입 | ① config 파일 작성 + `docs/data-schema.md` 스키마 추가 (docs-first 커밋) ② config 사용하는 runner 수정 ③ 검증 |
| 스킬 디렉터리 분해 / 리네이밍 | ① 새 디렉터리 + 파일 이동 ② dispatcher / 참조 경로 갱신 ③ legacy 잔재 grep + 검증 |
| 토큰 회계 보정 | ① 누락된 runner에 `claude_persist_usage` 추가 ② logs/task-runs.jsonl 한 번 실측해서 검증 |

## 마지막 phase 표준

소규모 plan (1~2 phase)은 검증을 본 phase에 흡수. 중규모 이상 (3+ phase)은 마지막 phase를 **검증 전용**으로 분리:

| Phase | 제목 | 모델 | 내용 |
|---|---|---|---|
| 마지막 | 통합 검증 + legacy 잔재 grep + index.json status="completed" 마킹 | `haiku` | bash/python 문법 검증, 잔재 grep, smoke 실행, `<workspace>/tasks/<name>/index.json`의 `status="completed"` 자체 수정 |

마지막 phase에 **`index.json`의 `status="completed"` 마킹** 명시 — `run-phases.py`가 마지막에 자동 마킹하지만 phase 본문에서 명시적으로 한 번 더.

**커밋 정책**: phase마다 commit OK, push는 마지막 phase에서만. 여러 task가 working directory 충돌하지 않도록 worktree 또는 단일 직렬 실행 강제.

## Phase 묶기 vs 분리 기준

**묶기**:
- 동일 패턴 복제 (같은 runner를 여러 토픽에 적용)
- 동일 스키마 확장 (같은 config에 키 추가)
- 동일 기능의 다른 영역 확장

**별도 phase로 분리**:
- 서로 다른 도메인 (예: extractor 로직 vs config 스키마)
- 독립 실행 가능 + 의존 관계 없음
- 검증 단위가 다름 (예: 단일 함수 단위 vs end-to-end smoke)

## 별도 plan vs 같은 plan의 phase

같은 plan의 phase: 의존성 있음. PR 1개로 묶임.

별도 plan: 독립 실행 가능, PR 분리. 다음 기준일 때 별도:
- 사용자 검토 시점 분리 (예: 외부 결정 대기)
- 한쪽이 다른 쪽 머지 후에 시작해야 함
- 도메인이 분리됨 — 한쪽이 실패해도 다른 쪽 진행

`plan-2`, `plan-3` 같은 서브넘버는 동일 영역의 후속일 때 (예: `plan003-2-cj-rename-rollout`은 plan003 후속).

## 참조

- `../plan-and-build/references/common-pitfalls.md` — task 작성 self-check 패턴 누적
- `<workspace>/docs/code-architecture.md` — runner / dispatcher / extractor 표준 패턴
- `<workspace>/docs/adr.md` — 결정 이력
- `_shared/bin/claude_lib.sh` — 토큰 회계 헬퍼 (모든 새 runner 사용 필수)
