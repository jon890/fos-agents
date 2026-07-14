# planning 오버레이 — fos-agents

공용 코어(`~/.claude/skills/planning`)에 fos-agents(ai-nodes) 특화를 주입한다.
코어의 8단계 skeleton 을 이 레포의 도메인(멀티 워크스페이스 CLI/agent 스킬)·docs 컨벤션·검증에 맞춰 채운다.

## 도메인: ai-nodes 멀티 워크스페이스 CLI

- 이 레포는 여러 워크스페이스(`apartment`, `career-os`, `health-care`, `ji-yoon-blog`, `stock-investment`, `travel`, `_shared` 등)로 구성된 모노레포다. 각 워크스페이스는 독립 `docs/`·`tasks/`·`data/`를 가진다.
- **3단계 (호출 시나리오)**: 시니어 워크플로 디자이너 관점. 새 기능이 어떤 skill·script·env 변수·cron 트리거로 호출되는지, 명령 인자/플래그 조합을 구체화. 정상/에러/빈 상태/권한·잠금 충돌 점검.
- **4~5단계 (인터페이스/API)**: 화면이 아니라 CLI 시그니처와 script helper 인터페이스로 구체화. 새 config 파일이면 정확한 JSON 스키마, 새 runtime 상태면 `<workspace>/data/runtime/` 위치 + 스키마.
- **6단계 (코드 구조)**: 새 스킬 디렉터리 vs 기존 스킬 확장, 새 script helper vs 기존 helper 확장. skill 이 다른 skill 을 위임할 때 CLI 하드코딩 없이 `/<skill> [args]` 의도 표현 사용.
- **워크스페이스 격리 (필수)**: 다른 워크스페이스의 코드·데이터를 import/read/write 하지 않는다. 참조가 필요하면 정당화를 명시하고 사용자 확인을 받는다. `_shared/lib/`는 예외(공용 helper).
- **ADR-015 데이터/문서 분리**: 데이터는 항상 `<workspace>/data/`, docs 는 의사결정·학습만 (데이터를 docs/ 아래 두지 않는다).
- **구현 중 문서 수정 금지 설계**: 구현 phase 가 docs/ADR/정책 문서를 고치지 않아도 될 만큼 계획 단계에서 계약을 닫는다. 구현 중 문서 수정이 필요할 가능성이 보이면 task 를 확정하지 말고 열린 결정으로 되돌린다.

## docs 컨벤션

5문서 체계 — `prd.md` / `data-schema.md` / `flow.md` / `code-architecture.md` / ADR.

| 변경 유형 | 갱신할 docs |
|---|---|
| 제품 가치 / 범위 / 기능 추가 | `prd.md` |
| 데이터 / 스키마 / 산출물 형식 | `data-schema.md` |
| 호출 시나리오 / 데이터 흐름 | `flow.md` |
| 디렉터리 / 계층 / 외부 의존 | `code-architecture.md` |
| 기술 결정 (왜) | ADR (아래 위치 규칙) |
| 인수인계 메모 | `docs/hand-off/` |

**단일 소스 원칙**: 같은 정보를 두 문서에 적지 않는다. 다른 문서가 참조해야 하면 ADR 번호로 링크.
형식 정책(semantic line break·괄호 중첩 금지 등)은 `docs/docs-style.md`(ADR-005) 가 단일 출처.

### ADR 저장 위치 (워크스페이스별 상이 — 필수 확인)

- **ai-nodes 루트 / career-os**: `docs/adr/ADR-NNN-slug.md` 새 파일 + `docs/adr/INDEX.md` 행 추가.
- **그 외 워크스페이스**: `<workspace>/docs/adr.md` 맨 아래 *append* (개별 파일 신설 금지).
- 워크스페이스 방식을 섞지 않는다 (혼용은 `common-pitfalls/docs-data/3-2-adr-storage-mix.md` 패턴).

### ADR 가치 판단 점검 (작성 전 필수 자문)

"이 결정을 *왜* 다른 대안 대신 선택했나"에 한 문단 이상의 정당화가 필요하면 ADR, 한 줄로 끝나면 ADR 아님.

- **ADR감**: 워크스페이스 표준 변경(언어 도입/폐기, 디렉터리 패턴 신설) · 대안 중 거절 사유가 있는 선택 · 격리 원칙의 의도적 비대칭 · 외부 시스템 통합 방식 · 운영/비용/보안 trade-off.
- **ADR감 아님**: 단순 중복 제거 · 단일 키/필드 추가(`data-schema.md` 책임) · 디렉터리 한 개 추가(`code-architecture.md` 책임) · 흐름 한 단계 변경(`flow.md` 책임) · 단일 버그 수정(commit message 로 충분).
- **단일 책임**: 한 plan 에서 나온 독립 결정 2개 이상을 한 ADR 에 묶지 않는다. 모호하면 분리가 기본값(`common-pitfalls/plan/1-5-adr-single-responsibility.md`).
- **폐기 결정**: 미래 결정에 계속 가이드가 되는 정책 변경(외부 의존성 폐기+대체 등)만 ADR. git rm 으로 끝나는 dead code 정리는 commit message 로 충분.

### ADR 구조 (5섹션만)

`## ADR-N — 제목` + Status/Date → 맥락 → 결정(거절한 대안 한 줄씩) → 결과 → (선택) 적용(포인터만, 코드 블록 금지).
**금지**: 코드 블록(1-2줄 인용 예외) · 파일 3개 이상 나열 · 변경 이력 · 검증 수치 · TODO.

## index.json 스키마 (레포 특화 — `run-phases.py` `validate_task` 강제)

코어 task-create.md 의 스키마와 필드명·enum 값이 다르다. 이 레포는 아래를 따른다:

```jsonc
{
  "name": "plan{N}-{kebab-slug}",
  "description": "한 줄 요약 — 무엇을 / 왜",
  "created_at": "2026-05-13T00:00:00+00:00",   // ISO-8601 UTC
  "updated_at": "2026-05-13T00:00:00+00:00",
  "status": "pending",                // pending | running | blocked | failed | completed
  "current_phase": 1,
  "total_phases": 3,
  "error_message": null,
  "blocked_reason": null,
  "related_docs": [],                 // 선택
  "depends_on": [],                   // 선택
  "phases": [
    {
      "number": 1,
      "title": "phase 제목",
      "file": "phase-01.md",
      "status": "pending",
      "allowedTools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "model": "sonnet",
      "timeout": 600                 // 선택, 기본 600
    }
  ]
}
```

### phase 본문 path·cwd 강제 (필수)

phase 본문의 모든 path 는 *ai-nodes 루트 기준* (`<workspace>/...`) 이지만 `run-phases.py` 는 `cwd=workspace` 로 phase 를 실행한다.
모든 phase 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"` 로 루트 강제 후 `pwd` 확인 — 누락 시 실행 첫 phase 에서 hotfix commit 이 필요해진다 (`common-pitfalls/harness/6-7-cwd-workspace-mismatch.md`).
Edit/Write 도구는 absolute path 를 받아 cwd 와 무관하게 동작하므로 이 강제는 bash 명령(test/grep/git 등)에만 해당한다.

### Sigil 문자 escape (검증 대상 자기 오탐 방지)

phase 검증 bash 에서 검증 대상 sigil(section mark U+00A7, tilde 등) 을 그대로 인용하면 self-positive grep 이 된다.
강제 주의문은 평문 명시(`section mark (U+00A7) 사용 금지`), 검증 bash 는 `printf`로 escape 변수를 만들어 grep (`common-pitfalls/harness/6-8-sigil-self-positive.md`).

## 검증

- **common-pitfalls**: `.claude/skills/_shared/common-pitfalls/INDEX.md`. task 파일 제출 전 현재 작업 trigger 와 맞는 pattern file 을 골라 self-check.
- 코어 `verify-task.sh` 5 패턴에 추가로 위 phase cwd 강제·sigil escape 도 self-check 대상.

## plan 네이밍 (번호 충돌 확인)

```bash
# cwd: ai-nodes root
ls <workspace>/tasks/ | grep "plan{후보번호}"
grep "^## ADR-{후보번호}" <workspace>/docs/adr.md        # career-os 제외
ls docs/adr/ | grep "^ADR-{후보번호}"                    # ai-nodes root
ls career-os/docs/adr/ | grep "^ADR-{후보번호}"          # career-os 전용
```

다음 가용 번호 사용. plan/ADR 번호는 워크스페이스별로 독립적.
서브넘버(`plan003-2-...`)는 동일 스킬 확장/동일 도메인 후속만 묶는다.

## branch / 커밋 / 핸드오프

- **branch**: `main`.
- **커밋 분리 (docs-first, ADR-015)**: docs 변경과 task 파일을 **별도 커밋 두 개**로 분리.
  - 첫 커밋: `docs(<workspace>): <기능명> 관련 ADR + 명세 갱신`
  - 두 번째 커밋: `task(<workspace>): plan{N} <기능명> task 생성`
- **push**: `git push origin main` 둘 다.
- **HUD 갱신**: OpenClaw career 세션에서 task 파일 생성 시 `task files completed` 상태로 갱신(긴 materialize 시작 전엔 `task materializing`).
- **핸드오프**: 별도 세션에서 `/build-with-teams <workspace>/tasks/plan{N}-<slug>` 실행 안내. 본 세션에서 phase 실행 금지 — 컨텍스트 격리가 핵심.
- **원격 branch protection 으로 main 직접 push 차단**: PR 경로로 우회.
