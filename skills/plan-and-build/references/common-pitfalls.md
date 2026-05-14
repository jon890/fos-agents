# Common Pitfalls — ai-nodes plan-and-build

task / phase 파일 작성 직후 self-check. critic 또는 verify 단계에서 반복 지적되는 패턴을 누적한다. 시간이 갈수록 두꺼워지고 critic이 할 말은 줄어든다.

축적 규칙:

- 새 사고 타입 발견 시 해당 섹션에 **패턴 한 줄 + 실측 명령 + self-check** 추가.
- 같은 사고 재발 시 패턴 강화 (예시 / 체크 엄격화).
- "왜 이 가드가 필요한지" 1줄 단서는 반드시 — 미래 AI 가 의도 모르고 우회하지 않도록.
- 사고 사례는 1개로 충분, 복수 나열 금지.

| # | 카테고리 | 호출 시점 |
|---|---|---|
| 1 | plan 작성 (critic 회피) | task / phase 파일 작성 직후 self-check |
| 2 | ai-nodes 워크스페이스 규약 위반 | 같은 시점 |
| 3 | docs / data 라우팅 위반 | 같은 시점 |
| 4 | dispatcher / runner 경계 위반 | 같은 시점 |
| 5 | git 운영 위반 | 같은 시점 |
| 6 | run-phases.py 하네스 계약 | 같은 시점 |

---

## 1. plan 작성 (critic 회피)

### 1-1. 수치 추측 (파일 수 / 줄 수)

**증상**: "약 30개 파일", "100줄 줄어듦" 같은 수치를 실측 없이 적음.
**왜**: critic 이 가장 먼저 검증하는 것은 phase 약속 수치 ↔ 실제 코드 일치 여부. 추측은 즉시 REVISE 사유.

```bash
# 실측 — phase 작성 전에 돌려서 정확한 수치 확보
find <path> -name '*.py' | wc -l
wc -l <file>
git ls-files <pattern> | xargs wc -l
```

**Self-check**:
- 모든 수치 옆에 grep/find/wc 명령을 같이 적어 두었나?
- 추정치(`~`, `약`)를 쓸 거면 plan 안에 명시했나?

### 1-2. 성공 기준이 "동작한다" 수준

**증상**: phase 성공 기준이 "정상 동작 확인" 같이 모호한 동사로 끝남.
**왜**: 자동 실행 하네스(run-phases.py)는 명령어 종료 코드를 본다. 사람이 "동작한다"를 보고 판정하는 phase는 자동화 불가.

**Self-check**:
- 성공 기준이 한 줄 실행 명령으로 표현되는가? (`bash -n script.sh`, `python3 -m py_compile file.py`, `[ -f path/to/output ]` 등)
- exit 0 = pass, 그 외 = fail로 단정할 수 있는가?

### 1-3. phase 간 컨텍스트 공유 가정

**증상**: phase-02가 phase-01에서 결정된 변수를 "위에서 결정했다"고 가정.
**왜**: run-phases.py는 phase마다 새 Claude 프로세스. 이전 대화 없음. **phase 프롬프트는 자기완결적**이어야 한다.

**Self-check**:
- 각 phase-NN.md 첫 줄부터 읽어서 다른 phase 안 보고 실행 가능한가?
- 이전 phase의 출력 파일을 사용한다면 정확한 경로를 phase 본문에 명시했나?

### 1-4. 검증 기준이 다른 phase의 "범위 외" 명시와 충돌

**증상**: phase-01에 "ADR-007/ADR-023 리넘버링은 범위 외"라고 적어두고, phase-02 검증식은 `ADR 헤더 == 15`를 강제 → 충돌이라 검증 항상 실패. 또는 phase-01이 "줄 수 ≤250까지 욕심내지 않는다"라고 했는데 phase-02 검증이 ≤250 강제.
**왜**: phase 간 기대값 불일치는 자기모순. run-phases.py는 phase 간 일관성 검사 안 함. 작성 시점에 사람이 잡아야 한다. plan001-adr-cleanup 1차 실행에서 실제로 발생 — 결과 손상은 없었지만 1 사이클 낭비.

**Self-check**:
- phase-NN에 "범위 외" / "이번 phase에서 안 함" 명시 항목이 있다면, 그 항목이 다른 phase 검증식의 통과 조건으로 등장하지 않는가?
- 줄 수·파일 수 같은 정량 검증 기준이 phase-N 작업의 실제 슬림화 깊이와 align되는가? (욕심 ≠ 실제 범위)

---

## 2. ai-nodes 워크스페이스 규약 위반

### 2-1. 다른 워크스페이스 자산 참조

**증상**: career-os task가 `apartment/`, `stock-investment/`, `travel/` 경로를 import / read / write.
**왜**: ai-nodes/CLAUDE.md 워크스페이스 격리 원칙. 다른 워크스페이스는 별도 세션에서 독립적으로 다룬다.

**Self-check**:
- phase 파일 안의 모든 경로가 `<workspace>/` 또는 `_shared/bin/` 또는 `skills/`로 시작하는가?
- 다른 워크스페이스 디렉터리명이 phase 본문에 등장하는가? 등장하면 정당화 ADR 또는 제거.

### 2-2. config 파일을 어디서나 새로 만든다

**증상**: phase가 `<workspace>/config/<new>.json`을 새로 만들지만 docs/data-schema.md에 스키마 명세 없음.
**왜**: docs/data-schema.md가 config 파일의 단일 출처. drift 방지.

**Self-check**:
- 새 config 도입 시 `docs/data-schema.md`에 스키마 섹션 추가가 phase 안에 포함됐나? (또는 docs-first 커밋 단계에서 처리됐나?)

---

## 3. docs / data 라우팅 위반

### 3-1. 데이터 파일을 docs/ 에 둠

**증상**: phase가 `<workspace>/docs/<some>.json` 또는 `<workspace>/docs/<some>.jsonl`을 만든다.
**왜**: ai-nodes 정책 — **docs/ 는 의사결정·학습 누적**, **데이터는 반드시 `data/`** (ADR-015).

**Self-check**:
- phase 산출물이 `*.json`, `*.jsonl`, `*.csv` 등 데이터 형식인가? → `<workspace>/data/` 아래 경로로 강제.
- phase 산출물이 의사결정·회고·이력 마크다운인가? → `<workspace>/docs/{adr,learn,hand-off}` 아래.

### 3-2. 새 ADR을 개별 파일로 만든다

**증상**: phase가 `<workspace>/docs/decisions/NNN-<topic>.md` 새 파일을 만든다.
**왜**: 통합 후 `docs/adr.md` 단일 파일에 누적 (5문서 컨벤션). 개별 ADR 파일 신설 금지. legacy `decisions/` 디렉터리는 history 보존용.

**Self-check**:
- 새 결정을 기록한다면 `<workspace>/docs/adr.md` 맨 아래에 append하는 형태인가?

### 3-3. docs 갱신을 phase 안에서 한다

**증상**: phase-04가 docs/code-architecture.md를 수정한다.
**왜**: docs-first 원칙 — task 생성 *전*에 별도 커밋. phase에서 docs를 또 만지면 history가 섞이고 task 실패 시 docs도 같이 잃는다.

**Self-check**:
- 모든 docs 변경이 task 생성 전 별도 커밋에 들어가 있는가?
- phase 본문에 `docs/*.md` 파일 수정이 있다면 그 phase는 의도된 docs-update phase인가? 아니면 빼야 한다.

---

## 4. dispatcher / runner 경계 위반

### 4-1. dispatcher 우회 직접 호출

**증상**: phase가 `bash <workspace>/skills/*/scripts/run_*.sh`를 직접 호출한다.
**왜**: `run_now.sh` 우회 시 `track_task.sh` 래핑이 빠져 logs/task-runs.jsonl 기록 누락 + Discord 알림 빠짐 + 잠금 회피.

**Self-check**:
- task가 실행하는 명령이 `bash <workspace>/skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh <command>` 형태인가?
- 직접 호출이 필요하면 phase에 정당화 한 줄 명시.

### 4-2. 새 runner 추가하면서 claude_persist_usage 호출 누락

**증상**: 새 runner가 `claude --print --output-format json`을 호출하지만 `claude_lib.sh`의 `claude_persist_usage`를 안 부른다.
**왜**: ADR-014. usage 전파 누락 시 logs/task-runs.jsonl의 cost_usd / model이 null로 기록되어 비용 추적 불가.

**Self-check**:
- 새 runner의 `attempt()` 함수에 `claude_persist_usage "$RAW_RESULT_JSON"`이 `run_once` 직후 (extractor 호출 전)에 있는가?
- runner 상단에 `source "$HOME/ai-nodes/_shared/bin/claude_lib.sh"`가 있는가?

### 4-3. notify는 직접 webhook 부르기

**증상**: phase가 curl로 Discord webhook을 직접 부른다.
**왜**: 알림은 `<workspace>/skills/*/scripts/notify_discord.sh` 단일 진입점으로 통일 (ADR-008). 각 task의 webhook URL은 `<workspace>/config/.env`에서.

**Self-check**:
- 알림이 필요하면 `<workspace>/skills/cj-oliveyoung-java-backend-prep/scripts/notify_discord.sh` 또는 run_now.sh의 `run_tracked` 헬퍼 경유로?

---

## 5. git 운영 위반

### 5-1. force push / hooks skip

**증상**: phase가 `--no-verify`, `--force`, `git push --force`를 시도.
**왜**: ai-nodes/CLAUDE.md의 git 안전 규약. 명시적 user 승인 없이 destructive 금지.

**Self-check**:
- phase 안에 `--no-verify`, `--force`, `--no-edit`, `--no-gpg-sign`이 있는가? 있으면 정당화하거나 제거.

### 5-2. 한 phase에서 여러 무관한 커밋

**증상**: phase가 docs 수정 + 코드 수정 + 새 ADR을 한 커밋에 묶음.
**왜**: 변경 history가 섞이고 revert 어려움. docs-first 원칙 위반.

**Self-check**:
- phase가 생성하는 커밋들이 각각 단일 관심사인가?
- 커밋 메시지 헤더가 conventional commits 형식인가? (`<type>[(scope)]: <subject>`)

### 5-3. sources/fos-study에 임시 변경

**증상**: phase가 `sources/fos-study/`에 직접 git commit한다.
**왜**: fos-study는 외부 동기 저장소. study-pack-class runner들이 검증된 출력을 올리는 경로일 뿐, task가 임의로 만지면 안 된다.

**Self-check**:
- phase 안의 `git -C sources/fos-study ...` 작업이 study-pack-class runner를 거치는가? 아니면 명시적 정당화.

---

## 6. run-phases.py 하네스 계약

### 6-1. PHASE_FAILED / PHASE_BLOCKED 마커만 출력하고 정상 종료

**증상**: phase prompt에 "검증 실패면 `PHASE_FAILED: <reason>` 출력 후 종료"라고만 적혀 있어, 실행 Claude가 마커 출력만 하고 exit 0으로 끝남. **exit 코드를 본문에 명시해도** phase Claude가 그 shell 블록을 Bash 도구로 실행하지 않고 prose 응답으로 "PHASE_BLOCKED: ..." 메시지를 stdout에 흘리는 식으로 우회하면 같은 함정 재발.
**왜**: run-phases.py는 phase의 **exit code**만으로 성공/실패를 판정한다. `sys.exit(1)` = failed, `sys.exit(2)` = blocked, 그 외 = success. stdout의 PHASE_FAILED 마커는 알림 메시지용일 뿐 하네스 로직에 영향 없음.

**실제 발생**:
- plan001-adr-cleanup phase-02 (1차): 마커만 출력 → success로 잘못 마킹.
- plan004-shared-helpers-ts phase-02 (1차, exit 2 명시 보정 후에도 재발): Bun 미설치 → "PHASE_BLOCKED: Bun 미설치" prose만 응답으로 출력하고 정상 종료. shell 블록 안의 `exit 2`가 실행되지 않음 (Bash 도구 우회). phase-03이 같은 상태를 발견하고 정상 exit 2 처리.

**Self-check**:
- phase 본문에 PHASE_FAILED / PHASE_BLOCKED 트리거가 있다면 그 직후에 **`sys.exit(1)` (failed) 또는 `sys.exit(2)` (blocked)** 명령이 같이 적혀 있는가?
- "출력 후 종료"가 아닌 "출력 + 비-0 exit code"로 명시했나? (예: `print('PHASE_FAILED: ...'); sys.exit(1)`)
- shell phase면 `echo 'PHASE_FAILED: ...' && exit 1` 형태인가?
- BLOCKED 트리거(외부 의존성 누락 등) 블록 위에 **"반드시 Bash 도구로 아래 블록 전체를 직접 실행하라. prose로 마커만 출력하면 success로 잘못 처리된다"** 강제 주의문이 박혀 있는가? phase Claude가 prose 응답 경로를 택하지 못하게 차단.

### 6-2. 마지막 phase 끝의 trailing working tree 변경

**증상**: 모든 phase가 commit + push까지 마쳤는데 `git status --porcelain`이 1줄 남는다. diff를 보면 `commitSha`, `updated_at` 같은 metadata 변경.
**왜**: run-phases.py는 phase의 자체 commit이 끝난 뒤 index.json에 그 commit의 SHA를 후기록한다 (워킹 트리에만, 자기가 commit하지 않음). 마지막 phase 입장에선 자기 commit 직전엔 SHA를 모르므로 누락이 정상. 따라서 plan 마지막에 trailing cleanup commit이 필요할 수 있다.

**Self-check**:
- 마지막 phase가 끝난 뒤 `git status --porcelain | wc -l`을 한 번 더 확인하고 0이 아니면 trailing cleanup commit + push 처리하는 사후 단계가 plan 실행 회수에 포함됐나?
- 또는 마지막 phase 본문 자체에 "run-phases.py 후기록은 다음 plan 시작 전 정리"를 명시해 두었나?

### 6-3. JSON 산출물에 trailing newline 누락

**증상**: phase가 `Path(...).write_text(json.dumps(data, indent=2, ensure_ascii=False))`로 저장 → git이 `\ No newline at end of file` 표시 → 다음 commit diff가 noisy.
**왜**: POSIX text file 관례. trailing newline 한 글자만 추가하면 future diff가 깨끗.

**Self-check**:
- JSON write 시 `json.dumps(...) + "\n"`로 trailing newline을 명시했나?
- 기존 JSON 파일을 수정한다면 원본의 trailing newline 유무를 보존하는가?

### 6-4. phase가 검증 명령을 실제로 돌리지 않고 success 보고

**증상**: phase 본문에 `[[ "$count" -eq 12 ]] || { echo "PHASE_FAILED..."; exit 1; }` 같은 검증 명령이 명시되어 있는데, 실행 Claude가 그 명령을 실제로 돌리지 않고 보고 메시지만 "✓ 12개 (9파일 + 3 dotfile 정확함)" 식으로 추정 출력. exit 1 명시가 있어도 명령 자체를 우회하면 무용. plan002-config-consolidation phase-05에서 실제 발생 — 검증식의 expected 12 자체가 1 over 오타였고 실측은 11이었지만, phase가 검증을 안 돌리고 success로 종료.
**왜**: phase Claude가 작업 종료 시 검증 단계까지 안 가고 success 메시지로 마무리하는 경향이 있음. 특히 haiku 모델이나 timeout 임박 시. 6-1의 exit code 보정만으로는 막을 수 없음 — 명령 *실행* 자체가 안 되는 거라.

**Self-check**:
- 검증 명령을 phase 본문에 적을 때 "보고 메시지 직전에 반드시 이 bash/python 블록을 실행한다"는 명시가 있나?
- 검증 결과가 stdout에 raw 값으로 echo되어야 한다고 강제했나? (예: `echo "[count] $count"` 후 비교) — 실측이 보고에 명시적으로 드러나면 추정으로 메우기 어려움.
- 또는 phase 본문 끝에 "✅ 모든 검증 명령 실행 완료 / ❌ 검증 실행 누락" 둘 중 하나를 stdout에 명시하라는 강제 표지가 있나?

### 6-5. phase가 destructive edit을 additive edit으로 바꿔치기

**증상**: phase 본문이 "기존 X 섹션의 본문은 제거하고 'migrated to ...' 표시만 남긴다"처럼 *제거*를 명시했는데, 실행 Claude가 옛 본문을 그대로 둔 채 안내 quote만 *추가*함. 결과는 docs duplicate (옛 schema 본문 + 새 통합 schema 동시 존재) → drift 위험. plan002-config-consolidation phase-01에서 실제 발생 — data-schema.md의 옛 8개 config 섹션 본문이 quote 추가만 된 채 그대로 남아 별도 cleanup commit으로 -55줄 잔여 정리 필요.
**왜**: Claude는 destructive edit (delete, replace-with-shorter)보다 additive edit (append, insert)을 선호하는 경향. 특히 안전 본능이 작동해 "원본을 살려두면서 표시만 추가"하는 경로를 택함. 6-4와 별개 — 6-4는 검증 우회, 6-5는 작업 *동작 자체*가 의도와 어긋남.

**Self-check**:
- phase 본문에 "제거" / "본문 삭제" / "~만 남기고" / "본문 → quote 한 줄" 같은 destructive 표현이 있는가? 있다면 다음 중 하나를 phase에 박아 추정·회피 방지:
  - 정확한 before / after 마크다운 예시 한 블록 ("기존: ... → 변경 후: ...")
  - 정확한 라인 범위 anchor ("52-90행을 다음으로 대체")
  - phase 끝에 destructive 검증 ("`grep -c '본문 키워드' file.md` = 0")
- 검증 단계에서 wc -l이나 삭제 라인 수 같은 *반-증명* 검증을 포함했나? (단순히 "migrated quote 존재"만 확인하면 본문 잔존을 못 잡음)

### 6-6. phase의 Write/Edit 작업 자체를 prose 응답으로 위장 + commitSha false 기록

**증상**: phase 본문이 "다음 draft를 Write 도구로 SKILL.md에 전체 덮어쓰기"라고 지시하고 그 아래에 ```` ```markdown ... ``` ```` 코드 블록으로 130줄 draft를 박아둠. 실행 Claude가 **Write 도구를 호출하지 않고** prose 응답 안에 "다음과 같이 작성했다 / 검증 통과 / phase-02 OK"를 출력한 채 종료. 응답 본문 안에 draft markdown이 그대로 노출되어 있어 본인은 "다 작성했다"는 환상 — 실제 파일은 안 바뀜. 게다가 run-phases.py가 phase 종료 시 `git log -1 --format=%H`를 commitSha로 박는데, phase가 새 commit을 만들지 않았으므로 *직전 plan의 HEAD*가 phase.commitSha로 박혀서 **false history가 history로 굳어짐** (audit이 거꾸로 어려워짐). 결과: phase status=completed + commitSha 기록 + 다음 phase의 검증 bash도 prose로 위장 통과 → 전체 plan이 거짓 success.

**왜**: phase 본문에 draft를 *prose 안 markdown 코드 블록*으로 박는 형식은 모델에게 두 해석을 모두 허용한다 — (A) "Write 도구로 적용" / (B) "이건 reference 예시고 prose로 '적용했다'고 응답하면 끝". 후자 경로가 더 빠르고 token이 적게 들기 때문에 모델이 선호. 6-1/6-4는 *마커 위장* / *검증 우회*였지만 6-6은 **작업 동작 자체가 prose로 대체됨**이라 한 단계 더 근원적. commitSha 자동 기록 로직이 이 거짓을 history로 굳혀 audit을 방해.

**실제 발생**:
- plan013-study-pack-writer-native phase-02 (1차): SKILL.md ~130줄 native skill 재작성 지시. 실행 Claude가 Write 도구 호출 없이 prose 응답으로 종료. 결과 SKILL.md = 42줄 (옛 사람용 문서 그대로) + native 패턴 키워드 (Read/Bash/Self-check/Workflow) 0건. phase-02.commitSha는 직전 plan011 폐기 commit `850dcb1`이 박힘. phase-04 정적 검증 bash (wc -l ≥ 80, 7섹션 grep)는 진짜 실행됐다면 즉시 PHASE_FAILED여야 했으나 그것도 prose-only 위장 통과 (6-4 함정 동시 발생). 전체 plan013이 4 phase completed로 마킹된 채 종료.

**Self-check**:
- phase 본문이 Write/Edit으로 새 파일 생성·전면 재작성을 요구한다면 draft를 phase 본문에 *그대로 코드 블록으로 박지 말 것*. 대신 다음 중 하나:
  - **별도 파일**로 draft 분리: `<plan>/draft/<target-basename>.md` 생성 → phase 본문은 "Read draft → Write target" 명령형 한 단락으로
  - phase 본문에 박을 수밖에 없으면 그 직전에 **"본 phase는 반드시 Write 도구를 1회 이상 호출해 `<target path>`를 전면 갱신해야 한다. Write 호출 없이 prose 응답으로 끝내면 PHASE_FAILED"** 강제 주의문
- phase 본문 끝에 **commit 개수 self-check**가 있는가? — 예: `git rev-list HEAD ^<base> --count`로 자기 phase가 만든 commit 수가 기대치(보통 1)와 일치하는지. commit 0건이면 PHASE_FAILED + exit 1. (6-6의 진짜 방어선)
- 검증 bash가 같은 phase 안에 있다면 **그 phase는 prose 위장 위험이 두 배** — Write 위장 + 검증 위장이 함께 일어나면 검증 자체가 무력화. 가능하면 검증을 다음 phase로 분리.
- commitSha 기록을 신뢰하지 말 것 — `git log --format='%H %s'`로 실제 commit 메시지를 확인해서 phase가 의도한 변경을 만들었는지 audit. 같은 commit SHA가 두 phase에 박혀 있으면 즉시 의심.

---

## 변경 이력

- 2026-05-13: 초안 — fos-blog `_shared/common-pitfalls.md`의 1 패턴을 베이스로, ai-nodes 워크스페이스 규약(2~5)을 추가.
- 2026-05-13: plan001-adr-cleanup 1 사이클 회고 누적 — 1-4 (phase 간 범위/검증 align), 6 신설 (run-phases.py 하네스 계약: exit code 규약 / trailing working tree / JSON trailing newline).
- 2026-05-13: plan002-config-consolidation 1 사이클 회고 — 6-4 추가 (phase가 검증 명령을 우회하고 추정 success 보고). 6-1 exit code 보정만으로는 부족 — 명령 실측 강제가 필요.
- 2026-05-13: plan002 leftover cleanup 회고 — 6-5 추가 (phase가 destructive edit을 additive edit으로 바꿔치기). phase-01이 옛 8개 config 섹션 본문을 제거해야 했으나 quote만 추가하고 본문 보존 → 별도 cleanup commit 필요.
- 2026-05-13: plan004-shared-helpers-ts 1차 실행 회고 — 6-1 강화 (exit code 명시만으론 부족, BLOCKED 트리거 블록 위에 "Bash 도구로 직접 실행" 강제 주의문 필요). phase-02가 본문에 `exit 2` 명시했음에도 prose 응답으로 "PHASE_BLOCKED: Bun 미설치"만 출력하고 정상 종료 → success 잘못 처리 재발.
- 2026-05-14: plan013-study-pack-writer-native 1차 실행 회고 — 6-6 신설 (phase의 Write/Edit 작업 자체를 prose 응답으로 위장 + commitSha false 기록). phase-02가 SKILL.md ~130줄 재작성 지시를 받고 Write 도구를 호출하지 않은 채 prose-only 응답으로 종료. 결과 SKILL.md는 옛 사람용 문서 그대로 (42줄). phase-04 정적 검증도 6-4 위장으로 통과. plan 전체가 거짓 success 마킹. commitSha 자동 기록이 직전 plan011 폐기 commit을 phase-02에 박아 audit이 거꾸로 어려워짐. 방어선: draft를 별도 파일로 분리 + phase 끝에 commit 개수 self-check.
