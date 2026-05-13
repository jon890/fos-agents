---
name: workspace-audit
description: Interactive Claude-driven audit of an ~/ai-nodes workspace — surfaces orphan configs, dead scripts, broken symlinks, doc-code drift, and stale runs, then runs an analyst subagent for cross-finding pattern analysis, and walks the user through findings in chat. Triggered by `/workspace-audit`. No background claude CLI calls; the active session drives all judgment and dispatches an oh-my-claudecode:analyst subagent for Phase 2 pattern analysis.
---

# Workspace Audit

ai-nodes 아래 각 AI 에이전트 워크스페이스가 시간이 지나면서 코드가 썩고 있는지 점검한다. 결정적인 정적 분석은 파이썬 스크립트가 즉시 돌고, 휴먼 판단이 필요한 부분은 현재 Claude 세션이 사용자와 대화하면서 진행한다.

다른 워크스페이스 스킬들(apartment-daily-report, career-os run_now.sh 등)은 openclaw cron → connected model → `claude --print` 구조이기 때문에 `track_task.sh` 래핑이 필요하지만, 이 스킬은 사용자가 현재 세션에서 직접 호출하므로 그런 wrapping은 **하지 않는다**.

## 호출 형태

- `/workspace-audit` — 인자 없이 호출. **반드시 먼저 `AskUserQuestion`으로 대상 워크스페이스 확인**.
- `/workspace-audit <workspace>` — 지정 워크스페이스 즉시 분석.
- `/workspace-audit --all` — 감지된 모든 워크스페이스 순차 분석 후 통합 요약.

## 워크플로 (Claude가 따라야 할 순서)

### 1. 대상 결정
- 인자가 있으면 그대로 사용.
- 인자 없으면 후보 추출:
  ```bash
  python3 skills/workspace-audit/scripts/discover_workspaces.py /home/bifos/ai-nodes
  ```
  결과를 `AskUserQuestion`으로 사용자에게 제시. "전체"도 옵션에 포함.

### 2. 정적 분석 실행
```bash
bash skills/workspace-audit/scripts/run_audit.sh <workspace>
# 또는
bash skills/workspace-audit/scripts/run_audit.sh --all
```

이 스크립트는 LLM 호출 없이 빠르게 3단계 결정적 분석을 돌리고 산출물을 `/tmp/workspace-audit-<workspace>/` 에 둔다 (세션 한정, 다음 실행 시 덮어씀). 워크스페이스 트리에 영구 파일을 만들지 **않는다** — 보존 가치 있는 발견은 본 세션에서 사용자가 `docs/decisions/`에 ADR로 옮긴다.

- `audit_static.py` — 고아 config, dead 스크립트, 깨진 심링크, 문서가 가리키는 부재 경로
- `audit_health.py` — `logs/task-runs.jsonl` 분석 (staleness, failure rate, token outlier, data/ 갭). 1회성으로 한 번만 돈 태스크는 staleness 대상에서 제외.
- `audit_consistency.py` — 폐기 ADR 잔존 참조, `run_*.sh`의 case 디스패처 분기 검증

### 2.5. 패턴 분석 (Phase 2 — analyst 서브에이전트)

결정적 분석이 끝나면 **즉시(항상)** analyst 서브에이전트를 호출해 cross-finding 패턴을 분석한다.
이 단계는 opt-in 플래그 없이 always-on이며, 워크스페이스당 Opus 호출 1회가 발생한다.
이 스킬에서 LLM을 호출하는 유일한 지점이다 (나머지는 모두 결정적).

#### 절차

1. **JSON 읽기** — `run_audit.sh`가 세션 한정 stash에 남긴 3개 파일을 읽는다:
   ```
   /tmp/workspace-audit-<workspace>/static.json
   /tmp/workspace-audit-<workspace>/health.json
   /tmp/workspace-audit-<workspace>/consistency.json
   ```

2. **워크스페이스 문서 수집** — 다음 파일이 존재하면 읽어서 하나의 텍스트로 합친다:
   - `<workspace>/AGENTS.md`
   - `<workspace>/CLAUDE.md`
   - `<workspace>/skills/*/SKILL.md` (첫 300줄까지)

3. **프롬프트 구성** — `references/analyst-prompt.md`를 읽고 플레이스홀더를 치환한다:
   - `{{WORKSPACE_NAME}}` → 워크스페이스 이름 (예: `career-os`)
   - `{{STATIC_JSON}}` → `static.json` 전체 내용
   - `{{HEALTH_JSON}}` → `health.json` 전체 내용
   - `{{CONSISTENCY_JSON}}` → `consistency.json` 전체 내용
   - `{{WORKSPACE_DOCS}}` → 2단계에서 합친 문서 텍스트 (없으면 `"(문서 없음)"`)

4. **서브에이전트 호출** — Agent 도구로 analyst를 호출한다:
   ```
   subagent_type: oh-my-claudecode:analyst
   prompt: <위에서 구성한 프롬프트>
   ```
   analyst는 read-only다. 파일 수정 지시는 하지 않는다.

5. **리포트에 추가** — analyst가 반환한 마크다운을 stash 안의 리포트 파일 끝에 추가한다:
   ```
   /tmp/workspace-audit-<workspace>/report.md
   ```
   추가 형식:
   ```markdown

   ---

   ## Meta-findings (analyst)

   > 이 섹션은 `oh-my-claudecode:analyst`(Opus)가 cross-finding 패턴을 분석한 결과다.
   > 개별 finding의 재진술이 아닌, 여러 finding을 가로지르는 패턴 가설을 제시한다.
   > 각 항목은 **가설**이므로 사용자 검증이 필요하다.

   <analyst 반환 내용>
   ```

6. **사용자에게 패턴 요약** — analyst 결과 중 HIGH/MED 가설만 chat에 한 줄씩 나열한다.
   전체 내용은 stash 안 리포트 파일 경로로 안내.

7. **보존 가치 평가** — chat 상에서 사용자와 함께 어떤 발견이 일회성 정보가 아니라 *영구 기록 가치*가 있는지 판단한다. 가치 있는 항목만 `<workspace>/docs/decisions/`에 ADR로 옮긴다. stash 파일들은 워크스페이스 트리에 영구화하지 않는다 — 다음 audit 실행 시 덮어씀.

### 3. Chat에 요약 제시
리포트 파일을 `Read`로 다시 읽어, 사용자에게 다음만 짧게 보여준다:

- 워크스페이스별 Summary (severity 카운트)
- HIGH / MED 항목만 나열 (LOW/INFO는 카운트만)
- 리포트 파일 절대 경로

리포트의 전체 내용을 chat에 덤프하지 말 것. 사용자가 필요하면 직접 파일을 열어볼 수 있도록 경로만 정확히 안내.

### 4. 사용자 지시 대기
"이 중 어떤 걸 더 파볼까요?" 식으로 묻는다. 사용자가 특정 finding을 지목하면 finding 유형에 맞는 행동을 **제안**한다. 사용자가 명시적으로 OK 하기 전에는 서브에이전트를 자동 소환하지 않는다.

| Finding 유형 | 권장 행동 |
|---|---|
| `static.dead_script` | `Explore` 서브에이전트로 진짜 어디서도 안 쓰이는지 깊게 확인 제안 |
| `static.orphan_config` | `Explore` 또는 직접 `grep` |
| `static.doc_path_missing` | 직접 `Read`로 문맥 확인 — 진짜 누락인지 placeholder인지 판단은 사용자와 함께 |
| `static.broken_symlink` | 타깃 확인 후 `ln -snf` 제안 |
| `consistency.deprecated_adr_refs` | `Explore`로 잔존 참조 추적 후 청소안 |
| `consistency.dispatcher_missing_target` | `oh-my-claudecode:debugger` 또는 직접 수리 |
| `health.stale` / `health.failure_rate` | 해당 태스크의 최근 로그 직접 `Read`. 필요하면 `debugger` |
| `health.token_outlier` | 직접 로그 비교. 대개 INFO 수준 |
| `health.data_gap` / `health.empty_data_dir` | 디스패처/cron 상태 점검 제안 |

### 5. 반복
사용자가 "다음", "끝", "다른 워크스페이스" 등을 지시할 때까지 4단계를 반복한다. `/workspace-audit --all`로 시작한 경우 워크스페이스 단위로 같은 사이클을 반복.

## Severity 규칙

- `[HIGH]`: 깨진 심링크, 디스패처가 가리키는 스크립트 부재, 반복 태스크 7일+ 무성공.
- `[MED]`: 고아/dead 의심, 윈도우 실패율 ≥30%, 3일+ 무성공.
- `[LOW]`: 정보성 — 데이터 갭 1-2일, 토큰 이상치, 문서 경로 누락.
- `[INFO]`: 카운트/메타 정보.

## 파일

- `scripts/run_audit.sh` — 단일 진입점 (3개 결정적 분석 → 마크다운 리포트 → 모두 `/tmp/workspace-audit-<ws>/`에 stash)
- `scripts/discover_workspaces.py` — 워크스페이스 마커(AGENTS.md 또는 skills/) 기반 탐색
- `scripts/audit_static.py`
- `scripts/audit_health.py`
- `scripts/audit_consistency.py`
- `scripts/render_report.py`
- `references/analyst-prompt.md` — Phase 2 analyst 서브에이전트에 전달하는 프롬프트 템플릿
- `/tmp/workspace-audit-<workspace>/` — 세션 한정 stash. `static.json`, `health.json`, `consistency.json`, `report.md` 모두 여기. 워크스페이스 트리에는 영구화하지 않음 (보존 가치 있는 항목만 사용자가 ADR로 lift).

## 의도적으로 안 하는 것

- 백그라운드 `claude --print` 호출 — 블랙박스 회피. Phase 2 analyst는 Agent 도구로 명시적으로 호출되며, `run_audit.sh`가 셸에서 Claude CLI를 부르지 않는다.
- `_shared/bin/track_task.sh` 래핑 — 현재 세션이 이미 토큰 회계 책임.
- 자동 수정 — finding 제시까지만. 정리는 사용자 승인 후 본 세션이 진행하거나 OMC 서브에이전트로 위임.
- 크로스 워크스페이스 비교 — 워크스페이스 격리 원칙 존중.
- 신규 컨벤션(AUDIT.md 등) 강요 — 기존 AGENTS.md / SKILL.md / CLAUDE.md / docs/decisions만 사용.
- `sources/` 디렉터리 스캔 — career-os의 fos-study처럼 외부 동기 저장소는 제외.

## 외부 의존

- `python3` ≥ 3.10
- 워크스페이스 마커: `<workspace>/AGENTS.md` 또는 `<workspace>/skills/`
