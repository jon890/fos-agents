# Common Pitfalls — ai-nodes plan-and-build

phase 작성 직후 self-check 패턴 누적. critic 반복 지적 회피용.

각 항목은 **증상 / 왜 / Self-check** 3 요소로 짧게 정리한다. 실제 발생 사례는 *변경 이력* 섹션 단일 출처 — 본문에 중복하지 않는다.

## 축적 규칙

- 새 사고 타입 발견 시 해당 카테고리에 추가 (증상 1줄 + Self-check 1-2줄).
- 같은 사고 재발 시 self-check 강화 (조건 엄격화 / 검증 명령 추가).
- 사고 사례는 변경 이력 섹션에 시간순 1줄로 누적 — 본문 *실제 발생* 중복 금지.

## 빠른 인덱스

| 번호 | 카테고리 | 항목 | 핵심 self-check |
|---|---|---|---|
| 1-1 | plan 작성 | 수치 추측 | 수치 옆 `find/wc/grep` 명령 동반 |
| 1-2 | plan 작성 | 모호한 성공 기준 | `bash -n` / `py_compile` / `[ -f ]` exit code |
| 1-3 | plan 작성 | phase 간 컨텍스트 가정 | 각 phase 첫 줄부터 독립 실행 가능 |
| 1-4 | plan 작성 | 범위 / 검증 충돌 | 다른 phase "범위 외" ↔ 검증 통과 조건 일치 |
| 1-5 | plan 작성 | ADR 단일 책임 위반 | 결정 2개 이상이면 trade-off 축 동일성 확인 |
| 2-1 | 워크스페이스 격리 | 다른 워크스페이스 자산 참조 | path가 `<workspace>/` / `_shared/` / `skills/`로 시작 |
| 2-2 | 워크스페이스 격리 | config 새로 만들기 | `data-schema.md` 스키마 섹션 동반 |
| 3-1 | docs/data 라우팅 | 데이터 파일 docs/에 둠 | `*.json/jsonl/csv` → `<workspace>/data/` |
| 3-2 | docs/data 라우팅 | ADR 저장 방식 혼용 | career-os: `docs/adr/` 개별 파일 + `INDEX.md` / 그 외: `docs/adr.md` append |
| 3-3 | docs/data 라우팅 | phase에서 docs 수정 | task 생성 전 별도 commit |
| 4-1 | runner 경계 | dispatcher 우회 직접 호출 | `run_now.sh <command>` 경유 |
| 4-2 | runner 경계 | claude_persist_usage 누락 | 새 runner는 `attempt()` 안에 호출 |
| 4-3 | runner 경계 | webhook 직접 호출 | `notify_discord.sh` 경유 |
| 5-1 | git 운영 | force push / hooks skip | `--no-verify` / `--force` / `--no-edit` 0건 |
| 5-2 | git 운영 | 한 phase 여러 무관 commit | commit별 단일 관심사 |
| 5-3 | git 운영 | sources/fos-study 직접 commit | study-pack-class runner 경유 또는 정당화 |
| 5-4 | git 운영 | 병렬 task main worktree 혼선 | active task 2개 이상이면 worktree + branch |
| 5-5 | git 운영 | unrelated dirty files stage | `git diff --cached --name-only`가 intended files만 |
| 6-1 | 하네스 계약 | PHASE_FAILED 마커만 출력 | `exit 1/2` 명시 + "Bash 도구로 직접 실행" 강제 주의문 |
| 6-2 | 하네스 계약 | trailing working tree | 마지막 phase 후 trailing cleanup commit 사후 단계 |
| 6-3 | 하네스 계약 | JSON trailing newline 누락 | `json.dumps(...) + "\n"` |
| 6-4 | 하네스 계약 | 검증 명령 미실행 success | 실측 값 stdout raw echo 강제 |
| 6-5 | 하네스 계약 | destructive→additive 바꿔치기 | 본문 / 라인 anchor / 반증 검증 (`grep -c=0`) |
| 6-6 | 하네스 계약 | Write 위장 + commitSha false | draft 별도 파일 + commit 개수 self-check |
| 6-7 | 하네스 계약 | references/ 파일 audit 누락 | SKILL.md 재작성 시 references 본문 옛 패턴 grep |
| 6-8 | 하네스 계약 | cwd=workspace path 불일치 | 첫 bash에 `cd "$(git rev-parse --show-toplevel)"` |
| 6-9 | 하네스 계약 | sigil 자체 인용 self-positive | `printf '\xc2\xa7'` escape 변수 사용 |

---

## 1. plan 작성 (critic 회피)

### 1-1. 수치 추측 (파일 수 / 줄 수)

**증상**: 수치를 실측 없이 추정 ("약 30개 파일", "100줄 줄어듦").
**왜**: critic이 가장 먼저 검증. 추측은 즉시 REVISE 사유.
**Self-check**: 모든 수치 옆에 실측 명령 (`find <path> -name '*.py' | wc -l`, `wc -l <file>`, `git ls-files <pattern> | xargs wc -l`) 동반. 추정치는 `~` / `약` 명시.

### 1-2. 모호한 성공 기준 ("동작한다" 수준)

**증상**: 성공 기준이 "정상 동작 확인" 같은 모호한 동사로 끝남.
**왜**: run-phases.py는 exit code만 본다. 사람 판정 phase는 자동화 불가.
**Self-check**: 한 줄 실행 명령 (`bash -n script.sh`, `python3 -m py_compile file.py`, `[ -f path ]`)으로 exit 0/그외 단정 가능.

### 1-3. phase 간 컨텍스트 공유 가정

**증상**: phase-N이 phase-M 결정을 "위에서 결정"이라 가정.
**왜**: run-phases.py는 phase마다 새 Claude 프로세스. 이전 대화 없음.
**Self-check**: 각 phase-NN.md 첫 줄부터 다른 phase 안 보고 실행 가능. 이전 phase 출력 파일은 정확한 경로 명시.

### 1-4. 범위 외 명시와 검증 충돌

**증상**: phase-N "범위 외" 항목이 다른 phase 검증식 통과 조건에 등장.
**왜**: phase 간 기대값 불일치 = 자기모순. run-phases.py는 phase 간 일관성 검사 안 함.
**Self-check**: "범위 외" / "이번 phase에서 안 함" 항목이 다른 phase 검증식에 등장하지 않음. 정량 검증 기준이 실제 작업 범위와 align.

### 1-5. ADR 단일 책임 위반

**증상**: 한 plan에서 발생한 *여러 독립 결정*을 한 ADR에 묶음. "결정" 섹션에 trade-off 축 다른 항목 4-5개.
**왜**: 후속에서 "ADR-N의 어느 부분을 supersede하나" 모호. planning SKILL.md "한 ADR = 한 의사결정" 위반.
**Self-check**: 결정 2개 이상이면 trade-off 축 동일성 자문. 독립 supersede 가능하면 분리. *모호하면 분리가 default*.

---

## 2. ai-nodes 워크스페이스 규약 위반

### 2-1. 다른 워크스페이스 자산 참조

**증상**: 한 워크스페이스 task가 다른 워크스페이스 (`apartment/`, `career-os/` 등) path를 import / read / write.
**왜**: ai-nodes/CLAUDE.md 워크스페이스 격리 원칙. 다른 워크스페이스는 별도 세션.
**Self-check**: phase path가 `<workspace>/` / `_shared/bin/` / `skills/`로 시작. 다른 워크스페이스 디렉터리명 등장 시 정당화 ADR 또는 제거.

### 2-2. 새 config 만들면서 스키마 명세 누락

**증상**: phase가 `<workspace>/config/<new>.json`을 신설하지만 `docs/data-schema.md` 미갱신.
**왜**: `data-schema.md`가 config 단일 출처. drift 방지.
**Self-check**: 새 config 도입 시 `data-schema.md` 스키마 섹션 추가가 phase에 포함 (또는 docs-first 커밋 단계에 처리).

---

## 3. docs / data 라우팅 위반

### 3-1. 데이터 파일 docs/에 둠

**증상**: phase가 `<workspace>/docs/<some>.json` / `.jsonl` 생성.
**왜**: ai-nodes 정책 — `docs/` 의사결정·학습 누적, 데이터는 `data/` (ADR-015).
**Self-check**: 산출물이 `*.json/jsonl/csv` 등 데이터면 `<workspace>/data/`. 의사결정·회고·이력 마크다운이면 `<workspace>/docs/{adr,learn,hand-off}`.

### 3-2. ADR 저장 방식 혼용

**증상**: 워크스페이스 방식을 착각해 career-os에서 `docs/adr.md`에 append하거나, 다른 워크스페이스에서 개별 ADR 파일을 신설.
**왜**: career-os는 ai-nodes ADR-015 파일럿으로 `docs/adr/` 개별 파일 + `INDEX.md` 구조를 사용한다. 다른 워크스페이스는 `docs/adr.md` 단일 파일 누적 컨벤션 (5문서 표준).
**Self-check**:
- career-os: 새 ADR은 `career-os/docs/adr/ADR-NNN-slug.md` 새 파일 생성 + `career-os/docs/adr/INDEX.md` 행 추가.
- 그 외 워크스페이스: `<workspace>/docs/adr.md` 맨 아래 append (개별 파일 신설 X).

### 3-3. phase 안에서 docs 갱신

**증상**: phase가 `docs/code-architecture.md` 등을 수정.
**왜**: docs-first 원칙 — task 생성 전 별도 커밋. phase 실패 시 docs도 잃음.
**Self-check**: 모든 docs 변경이 task 생성 전 별도 커밋에 포함. phase 본문 docs 수정이 있다면 의도된 docs-update phase인지 확인.

---

## 4. dispatcher / runner 경계 위반

### 4-1. dispatcher 우회 직접 호출

**증상**: phase가 `bash <workspace>/skills/*/scripts/run_*.sh` 직접 호출.
**왜**: `run_now.sh` 우회 시 `track_task.sh` 래핑 빠져 logs / Discord / 잠금 회피.
**Self-check**: 실행 명령이 `bash <workspace>/skills/.../run_now.sh <command>` 형태. 직접 호출 시 정당화 한 줄 명시.

### 4-2. claude_persist_usage 호출 누락

**증상**: 새 runner가 `claude --print --output-format json` 호출하지만 `claude_persist_usage` 누락.
**왜**: ADR-014. usage 전파 누락 시 logs/task-runs.jsonl `cost_usd` / `model` null.
**Self-check**: `attempt()` 함수에 `claude_persist_usage "$RAW_RESULT_JSON"`이 `run_once` 직후 (extractor 호출 전). runner 상단 `source "$HOME/ai-nodes/_shared/bin/claude_lib.sh"`.

### 4-3. webhook 직접 호출

**증상**: phase가 `curl`로 Discord webhook 직접 호출.
**왜**: 알림은 `notify_discord.sh` 단일 진입점 (ADR-008).
**Self-check**: 알림은 `<workspace>/skills/.../notify_discord.sh` 또는 `run_now.sh`의 `run_tracked` 헬퍼 경유.

---

## 5. git 운영 위반

### 5-1. force push / hooks skip

**증상**: phase가 `--no-verify` / `--force` / `--no-edit` / `--no-gpg-sign` 시도.
**왜**: ai-nodes/CLAUDE.md git 안전 규약. user 승인 없는 destructive 금지.
**Self-check**: phase 안에 위 플래그 없음. 있으면 정당화 또는 제거.

### 5-2. 한 phase 여러 무관 commit

**증상**: phase가 docs 수정 + 코드 수정 + 새 ADR을 한 commit에 묶음.
**왜**: history 섞이고 revert 어려움. docs-first 원칙 위반.
**Self-check**: 각 commit이 단일 관심사. 메시지 헤더는 conventional commits 형식 (`<type>[(scope)]: <subject>`).

### 5-3. sources/fos-study 직접 commit

**증상**: phase가 `git -C sources/fos-study ...` 임의 commit.
**왜**: fos-study는 외부 동기 저장소. study-pack-class runner 검증된 출력만 push.
**Self-check**: `sources/fos-study/` 작업이 study-pack-class runner를 경유. 아니면 명시 정당화.

### 5-4. 병렬 task를 main worktree에서 구현

**증상**: 다른 task가 active거나 dirty state가 있는데 background 구현자가 main worktree에서 직접 Edit/Write.
**왜**: 단순한 "구현해줘" 요청은 main worktree가 안전하다는 허가가 아니다. 병렬 작업은 git add/commit/push 범위가 섞인다.
**Self-check**: phase 시작 전에 `git status --porcelain`, `git branch --show-current`, active task 여부를 확인. active task가 2개 이상이면 별도 worktree + branch를 사용. main worktree 직접 편집은 단일 active task, 작은 docs/process-only 변경, 또는 사용자 명시 허용에 한정.

### 5-5. unrelated dirty files를 stage

**증상**: phase commit에 이전 작업의 dirty file, format-on-save, 다른 워크스페이스 변경이 같이 들어감.
**왜**: phase 경계는 commit/push 경계다. unrelated file이 섞이면 review와 rollback이 어려워진다.
**Self-check**: commit 직전 `git diff --cached --name-only`와 `git status --short`를 확인. intended files만 stage하고, unrelated dirty files는 수정하지 않는다. background worker 최종 보고에 사용한 worktree/branch와 stage 범위를 적는다.

---

## 6. run-phases.py 하네스 계약

### 6-1. PHASE_FAILED / PHASE_BLOCKED 마커만 출력하고 정상 종료

**증상**: phase Claude가 PHASE_FAILED 마커만 stdout에 흘리고 exit 0 종료. shell 블록 안 `exit 1/2`이 *Bash 도구로 실행 안 되고 prose 응답으로 우회*.
**왜**: run-phases.py는 exit code만으로 성공/실패 판정. stdout 마커는 알림용. prose 응답 경로가 token 적어 모델이 선호.
**Self-check**: PHASE_FAILED / BLOCKED 트리거 직후 `sys.exit(1)` (failed) / `sys.exit(2)` (blocked) 또는 `echo '...' && exit 1` 명시. BLOCKED 블록 위에 **"반드시 Bash 도구로 직접 실행하라. prose만 출력하면 success로 잘못 처리"** 강제 주의문.

### 6-2. 마지막 phase 끝 trailing working tree 변경

**증상**: 모든 phase commit/push 마쳤는데 `git status` 1줄 남음 (`commitSha`, `updated_at` 등).
**왜**: run-phases.py는 phase 자체 commit 후 index.json에 그 SHA를 working tree에만 후기록 (자기가 commit 안 함).
**Self-check**: plan 마지막에 `git status --porcelain | wc -l` 확인. 0 아니면 trailing cleanup commit + push 사후 단계 포함.

### 6-3. JSON 산출물에 trailing newline 누락

**증상**: `Path(...).write_text(json.dumps(data, indent=2))` → `\ No newline at end of file` git 표시.
**왜**: POSIX text file 관례.
**Self-check**: JSON write 시 `json.dumps(...) + "\n"`. 기존 JSON 수정 시 원본 trailing newline 보존.

### 6-4. 검증 명령 미실행 success 보고

**증상**: phase 본문에 검증 명령 명시했는데 실행 Claude가 *명령 실행 없이* "✓ 12개 정확" 식 추정 보고.
**왜**: phase Claude가 종료 직전 success 메시지로 마무리하는 경향 (특히 haiku / timeout 임박).
**Self-check**: 검증 명령 직전 "보고 직전 반드시 본 bash 블록 실행" 명시. 검증 결과를 stdout raw value echo로 강제 (`echo "[count] $count"` 후 비교). "✅ 모든 검증 명령 실행 완료" 명시 stdout 강제 표지.

### 6-5. destructive→additive 바꿔치기

**증상**: phase가 "본문 제거 / 본문 삭제" 명시했는데 실행 Claude가 옛 본문 유지 + 안내 quote만 추가 (additive).
**왜**: Claude는 destructive edit보다 additive edit 선호 (안전 본능).
**Self-check**: destructive 표현 ("제거" / "본문 삭제") 있다면 본문 / 라인 anchor / 반증 검증 (`grep -c '본문 키워드' file.md = 0`) 명시.

### 6-6. Write 위장 + commitSha false 기록

**증상**: phase 본문이 draft를 prose 안 코드 블록으로 박음. 실행 Claude가 Write 호출 없이 prose 응답으로 "다 작성했다" 출력 + 정상 exit 0. run-phases.py가 직전 plan HEAD를 commitSha로 박아 false history.
**왜**: prose 안 draft 코드 블록은 모델에게 두 해석 (Write 실제 / prose만) 허용 → token 적은 prose 경로 선호.
**Self-check**: Write/Edit 전면 재작성 요구 시 (1) draft 별도 파일 분리 (`<plan>/draft/<basename>.md`) 또는 (2) "본 phase는 반드시 Write 1회 이상 호출. prose만 끝내면 PHASE_FAILED" 강제 주의문. phase 끝에 `git rev-list HEAD ^<base> --count` commit 개수 self-check (0이면 exit 1).

### 6-7. SKILL.md 재작성 시 references/ 파일 audit 누락

**증상**: SKILL.md를 native 패턴으로 재작성하며 references/ path만 인용. references 본문이 옛 외부 subprocess 시대 지시문 (`Output only valid JSON`, `Do not output markdown`) 그대로.
**왜**: SKILL.md가 references를 Read하면 native 패턴과 충돌. 사용자 발견 전까지 critical bug push.
**Self-check**: SKILL.md 재작성 시 references/ 안 모든 파일 본문 동시 audit. 옛 subprocess 키워드 grep (`Output only valid JSON`, `Do not output markdown`, `--output-format json`, `valid JSON that matches the schema`). 잔재 시 references 폐기 또는 SKILL.md에 흡수.

### 6-8. run-phases.py cwd=workspace path 불일치

**증상**: phase 본문 bash 명령이 `<workspace>/...` ai-nodes 루트 기준 path 사용. run-phases.py는 cwd=workspace로 실행 → `<workspace>/<workspace>/path` 부재.
**왜**: run-phases.py line 355 `cwd=workspace`. phase 본문 path 컨벤션이 ai-nodes 루트 기준이라 충돌. task-create.md에 cwd 정책 명시 부재 시 작성자가 매번 헤맴.
**Self-check**: phase 본문 bash 명령에 `<workspace>/...` path 등장하면 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"` 명시. Claude Code Bash 도구 cwd 보존 — 첫 호출에만 박으면 후속 자동. Edit 도구는 absolute path라 cwd 무관.

### 6-9. sigil 자체 인용 self-positive / directive 위반

**증상**: phase 본문 강제 주의문에 sigil 문자 (section mark U+00A7, tilde) literal 인용. 검증 bash가 target에 phase 파일 포함하면 self-positive PHASE_FAILED. 또한 사용자 directive (CLAUDE.md sigil 미사용) 위반.
**왜**: "sigil 미사용 강제" 박을 때 자연히 문자 직접 인용 → phase 본문 자체에 sigil. 의도는 검증 강조인데 결과는 self-positive + directive 위반.
**Self-check**: phase 본문에 sigil 직접 인용 시 평문 표기로 교체 (`section mark (U+00A7)`, `tilde (U+007E)`). 검증 bash는 escape 변수 사용 (`SIGIL_CHAR=$(printf '\xc2\xa7'); grep -c "$SIGIL_CHAR" target`).

---

## 변경 이력

각 항목 실제 발생 사례는 시간순 1줄로 누적. 본문 self-check 강화 트리거.

- 2026-05-13: 초안 — fos-blog `_shared/common-pitfalls.md` 1 패턴 + ai-nodes 워크스페이스 규약 2~5 추가.
- 2026-05-13: plan001-adr-cleanup — 1-4 (phase 간 범위/검증 align) + 6 신설 (run-phases.py 하네스 계약).
- 2026-05-13: plan002-config-consolidation — 6-4 (검증 우회 추정 success), 6-5 (destructive→additive) 신설.
- 2026-05-13: plan004-shared-helpers-ts — 6-1 강화 (exit code 명시만으론 부족, "Bash 도구로 직접 실행" 강제 주의문).
- 2026-05-14: plan013-study-pack-writer-native — 6-6 신설 (Write 위장 + commitSha false 기록). phase-02가 SKILL.md ~130줄 재작성을 prose 응답으로 종료.
- 2026-05-15: plan015 — 6-7 신설 (references/ 파일 audit 누락). interview-asset-writer SKILL.md 재작성 시 references 옛 subprocess 지시문 잔재.
- 2026-05-19: plan024 / plan002 1차 실행 전 hotfix — 6-8 (cwd=workspace path 불일치), 6-9 (sigil self-positive) 신설.
- 2026-05-19: apartment plan003 ADR-005 1차 작성 — 1-5 신설 (ADR 단일 책임 위반). 4 결정 통합 → 사용자 점검 후 ADR-005/006/007 분할.
- 2026-05-19: 전면 재구성 — 표 인덱스 + 본문 슬림화 (327→195줄). AI agent 참고 효율 + 사람 가독성 양립. 실제 발생 사례는 본 섹션 단일 출처.
- 2026-06-07: background 구현 worktree 정책 강화 — 5-4, 5-5 신설. 병렬 active task는 별도 worktree/branch를 기본값으로 하고, phase commit/push 경계와 intended files staging을 명시.
