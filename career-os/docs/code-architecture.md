# Code Architecture — career-os

career-os의 디렉터리 구조·계층 책임·외부 의존성. 새 스킬·러너를 추가하거나 파이프라인을 바꿀 때 이 문서를 기준으로 한다.

## 계층

```
┌─────────────────────────────────────────────────────────────┐
│ 진입점 (dispatcher)                                          │
│   scripts/command-router/run_now.sh                         │
│   - 14개 case 분기 (plan006 이후, ADR-019)                   │
│   - run_tracked() 헬퍼: tracker 래핑 + 알림 + cost summary  │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│ 트래커 (외부 의존)                                            │
│   _shared/bin/track_task.sh                                  │
│   - openclaw status 캡처                                     │
│   - usage file path env로 export                             │
│   - logs/task-runs.jsonl + logs/token-usage.jsonl append     │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│ Runner (스킬별)                                              │
│   scripts/<skill-name>/run_*.sh                              │
│   - 입력 수집: config + sources/fos-study + candidate-profile│
│   - claude --print --output-format json 호출                 │
│   - extractor/renderer 호출                                  │
│   - claude_persist_usage 호출 (ADR-014)                      │
│   - 출력 저장 + (선택) fos-study commit/push                 │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│ Extractor / Renderer (스킬별 또는 공용)                      │
│   - 공용: _shared/bin/extract_claude_result.py              │
│   - 자체: scripts/<skill-name>/extract_*.py | render_*.py    │
│   - 단일 책임: Claude JSON → 검증된 마크다운/JSON           │
│   - usage 전파 책임은 외부(claude_lib.sh)에 위임            │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────────────┐
│ 외부 동기 저장소                                              │
│   sources/fos-study/  (jon890/fos-study git repo)            │
│   - study-pack / question-bank / master가 commit + push      │
│   - .claude/skills/docs-audit/SKILL.md는 진실 출처           │
└─────────────────────────────────────────────────────────────┘
```

## 디렉터리 책임

```
career-os/
├── AGENTS.md (= CLAUDE.md 심볼릭 링크)
│     모든 에이전트용 정식 가이드. 워크스페이스 정책·진입점·외부 의존성.
├── TOOLS.md
│     도구 메모. 짧음.
├── docs/                                  ← 5 종합 문서 + 보조 영역
│   ├── prd.md            제품 범위·MVP·기능 목록
│   ├── data-schema.md    config/logs/runtime 스키마
│   ├── flow.md           사용자/데이터 플로우
│   ├── code-architecture.md  이 문서
│   ├── adr.md            모든 아키텍처 결정 누적 기록 (단일 출처, ADR-015/018)
│   ├── learn/            짧은 회고. 결정 굳어지면 adr.md 로 흡수 후 삭제 (ADR-018)
│   ├── hand-off/         외부 위임·인수인계 일회성 노트
│   └── prep/             회사·이벤트별 운영 자산. 이벤트 종료 후 archive
│
├── tasks/                                 ← planning 산출물 (실행 대기 또는 실행 중)
│   └── plan{N}-<kebab-slug>/
│       ├── index.json                    task 메타데이터 + phase 목록 (run-phases.py가 검증)
│       └── phase-NN.md                   각 phase의 자기완결 프롬프트
│   ↑ skills/planning이 생성, skills/plan-and-build가 실행. 완료된 plan도 history 보존 위해 삭제 X.
│
├── config/                                ← 사람이 큐레이션한 입력 (ADR-016 통합 후)
│   ├── mvp-target.json                현재 active 타깃 단일 출처
│   ├── candidate-profile.md           이력 (prose, 의도적으로 JSON 아님)
│   ├── topics.json                    5 topic configs 통합 (plan002)
│   ├── sources.json                   3 source configs 통합 (plan002)
│   ├── baseline-core-files.json       baseline 분석 대상 파일 목록 (txt → JSON, plan002)
│   ├── topic-file-map.json            daily용 토픽 → 파일
│   ├── live-coding-seed-pool.json
│   ├── live-coding-seed-candidates.json
│   └── .env                           비밀 (GITHUB_TOKEN, DISCORD_WEBHOOK_URL 등)
│
├── data/
│   ├── study-progress.json       후보자 학습 진도 (ADR-002)
│   ├── generated-artifacts.json  fos-study 푸시 산출물 인덱스
│   ├── reports/
│   │   ├── baseline/YYYY-MM-DD/  baseline 실행 결과
│   │   └── daily/YYYY-MM-DD/     daily / position / foodville 실행 결과
│   ├── runtime/                  ← 가변 상태 (gitignore 대부분)
│   │   ├── topic-inventory.json
│   │   ├── topic-inventory-history.jsonl
│   │   ├── topic-replenishment.json
│   │   ├── morning-topic-recommendation.md
│   │   ├── position-recommendation.md
│   │   ├── feed-cache/<sha1>.json    6h TTL (ADR-013)
│   │   ├── locks/                    flock 잠금 파일들
│   │   ├── freeform-study-pack-topic.json   (deferred runner용)
│   │   └── live-coding-generated-topic.json (deferred runner용)
│   ├── normalized/               fos-study 정규화 캐시 (현재 비어 있음)
│   └── source/                   외부 수집 노트
│
├── logs/                                  ← gitignore. 운영 데이터 단일 출처
│   ├── task-runs.jsonl           run_now.sh 모든 실행
│   ├── token-usage.jsonl         (위와 동일 스키마)
│   └── .usage-status/            track_task 임시 상태 파일
│
├── scripts/                              ← 실행 파일 영역 (plan006 후, ADR-019). career-os 한정 컨벤션.
│   ├── command-router/
│   │   ├── run_now.sh                  디스패처 본체 (14개 case)
│   │   └── setup_env.sh                (Discord 알림은 _shared/lib/notify_discord.ts 직접 호출 — plan004/ADR-020)
│   ├── knowledge-gap-analyzer/
│   │   ├── run_baseline.sh
│   │   ├── run_daily.sh
│   │   ├── run_smoke_test.sh
│   │   ├── build_target_file_list.py     ADR-001
│   │   ├── select_topic.py
│   │   └── update_study_progress.py
│   ├── study-topic-recommender/
│   │   ├── run_topic_recommendation.sh
│   │   ├── run_live_coding_dispatch.sh
│   │   ├── refresh_topic_inventory.py    ADR-009/010/012/013 종합 엔진
│   │   └── feed_discovery.py             ADR-013 RSS/Atom 파서
│   ├── topic-pool-replenisher/
│   │   ├── run_topic_replenishment.sh
│   │   ├── replenish_topic_reservoir.py  ADR-011 보충 엔진
│   │   └── promote_candidate_topics.py
│   ├── study-pack-batch/run_bootcamp_batch.sh
│   ├── study-pack-writer/{run_study_pack.sh, extract_and_validate_study_pack.py, ...}
│   ├── study-pack-maintainer/{run_maintainer.sh, resolve_maintainer_topic.py}
│   ├── experience-question-bank-writer/{run_question_bank.sh, run_question_bank_auto.sh,
│   │                                    render_question_bank.py, resolve_question_bank_topic.py}
│   ├── interview-master-writer/{run_master.sh, resolve_master_topic.py}
│   ├── position-recommender/{run_position_recommendation.sh, extract_position_report.py,
│   │                          collect_live_postings.py (deferred), publish_job_analysis.sh (deferred)}
│   ├── cj-foodville-coffeechat-prep/{run_foodville_coffeechat_prep.sh, collect_foodville_sites.py}
│   └── fos-study-pack/run_from_request.sh   (deferred — dispatcher 미연결)
│
├── skills/                               ← Claude 컨텍스트 자산만 (plan006 후, ADR-019)
│   ├── command-router/SKILL.md
│   ├── knowledge-gap-analyzer/
│   │   ├── SKILL.md
│   │   └── references/{baseline,daily}-prompt.md
│   ├── study-topic-recommender/SKILL.md
│   ├── topic-pool-replenisher/
│   │   ├── SKILL.md
│   │   └── references/topic-replenishment-prompt.md
│   ├── study-pack-batch/SKILL.md
│   ├── study-pack-writer/{SKILL.md, references/}
│   ├── study-pack-maintainer/{SKILL.md, references/}
│   ├── experience-question-bank-writer/
│   │   ├── SKILL.md
│   │   └── references/question-bank-schema.json
│   ├── interview-master-writer/{SKILL.md, references/}
│   ├── position-recommender/
│   │   ├── SKILL.md
│   │   └── references/   company-upside-reference.md, position-context-index.md,
│   │                     position-decision-criteria.md, verified-company-research-targets.json
│   │                     (plan002 이후 config/에서 이동)
│   ├── cj-foodville-coffeechat-prep/{SKILL.md, references/}
│   ├── fos-study-pack/{SKILL.md, references/}   (deferred dispatcher 미연결)
│   └── docs-audit/
│       ├── SKILL.md → sources/fos-study/.claude/skills/docs-audit/SKILL.md (심링크)
│       └── references/{audit-rubric, report-template}.md   (사용처 없음 — fos-study 측 PR 흡수 대상)
│
└── sources/
    └── fos-study/                ← 외부 동기 git repo (jon890/fos-study)
        ├── .claude/skills/docs-audit/SKILL.md  (career-os 측 심링크의 진실 출처)
        ├── interview/, database/, java/, kafka/, architecture/, ...
        └── (study-pack / question-bank / master 산출물이 여기로 push됨)
```

## 외부 의존성 (`_shared/`)

career-os 워크스페이스 바깥, ai-nodes 루트의 `_shared/` 에 모든 워크스페이스가 공유하는 헬퍼. (ADR-020)

```
~/ai-nodes/
├── package.json                              # Bun 프로젝트 루트
├── tsconfig.json
├── .gitignore                                # node_modules 포함
└── _shared/                                  ← 모든 워크스페이스 공용 코드 (ADR-020)
    ├── bin/                                  ← shell 계열. 점진 폐기 대상.
    │   └── track_task.sh                     # 트래커 (당분간 shell 유지)
    ├── lib/                                  ← TS(Bun) 헬퍼. plan004 이후 추가.
    │   ├── notify_discord.ts                 # Discord webhook 알림
    │   ├── invoke_claude_skills.ts           # Claude CLI 호출 + usage capture + retry
    │   └── format_cost_summary.ts            # logs/task-runs.jsonl → 한 줄 cost 요약
    └── types/                                ← TS 공통 타입.
        └── (ClaudeUsage / TaskRunEntry / NotificationPayload 등)
```

| 파일 | 책임 |
|---|---|
| `_shared/bin/track_task.sh` | 모든 runner 래퍼. JSONL 로그 + openclaw status diff + usage file 전달. **누락 시 모든 실행 실패**. |
| `_shared/lib/invoke_claude_skills.ts` | Bun. Claude CLI 호출 + usage 전파 + 재시도 + 검증 통합 헬퍼. `claude_lib.sh` + `extract_claude_result.py` 의 후속. |
| `_shared/lib/notify_discord.ts` | Bun. `openclaw message send --channel discord` subprocess 호출. `DISCORD_CHANNEL_ID` env 필수. `--media <path>` 옵션 지원. 워크스페이스별 `notify_discord.sh` / `notify_discord_media.sh` 의 후속 (ADR-021). |
| `_shared/lib/format_cost_summary.ts` | Bun. logs/task-runs.jsonl 최신 항목 → 한 줄 cost 요약. `format_cost_summary.py` 의 후속. |
| `_shared/bin/update_artifacts.py` | `data/generated-artifacts.json` upsert (당분간 Python 유지, 별도 plan). |
| `_shared/types/` | TS 공통 타입 디렉터리. ClaudeUsage / TaskRunEntry / NotificationPayload 등. |

## Runner 패턴 (ADR-014 이후 표준)

```bash
#!/usr/bin/env bash
set -euo pipefail

source "$HOME/ai-nodes/_shared/bin/claude_lib.sh"

TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/career-os}"
# ... env 설정

# 1. 입력 수집
cat > "$INPUT_NOTE" <<EOF
... prompt + context ...
EOF

# 2. Claude 호출
attempt() {
  run_once || return 1
  claude_persist_usage "$RAW_RESULT_JSON"    # ← retry 전에 persist
  extract_and_validate || return 1
}

run_once() {
  timeout 900s claude --permission-mode bypassPermissions --print \
    --output-format json --no-session-persistence \
    "$(cat "$INPUT_NOTE")" > "$RAW_RESULT_JSON"
}

extract_and_validate() {
  python3 "$EXTRACTOR" "$RAW_RESULT_JSON" "$OUTPUT_MD"
}

if ! attempt; then
  # 재시도 1회 (stricter prompt)
  echo "재시도..." >&2
  cat >> "$INPUT_NOTE" <<'EOF'
... 검증 실패 시 추가 지시 ...
EOF
  attempt || exit 1
fi

# 3. (선택) fos-study commit + push
# 4. (선택) update_artifacts.py upsert
```

## Dispatcher 패턴 (`run_now.sh`)

```bash
run_tracked() {
  local task_name="$1"; shift
  local label="$1"; shift
  set +e
  "$TRACKER" "$TASK_ROOT" "$task_name" "$@"
  local code=$?
  set -e
  local cost_line
  cost_line="$(python3 "$FORMAT_COST" "$TASK_ROOT" "$task_name" 2>/dev/null || true)"
  if (( code == 0 )); then
    "$NOTIFY_SCRIPT" "[완료] ${label}${cost_line}" || true
  else
    "$NOTIFY_SCRIPT" "[실패] ${label} (exit ${code})${cost_line}" || true
  fi
  exit "$code"
}

case "$MODE" in
  baseline)
    run_tracked "career-os:baseline" "baseline gap analysis" \
      "$TASK_ROOT/scripts/knowledge-gap-analyzer/run_baseline.sh"
    ;;
  # ... 13개 더
esac
```

## 인근 워크스페이스와의 관계

- **다른 워크스페이스 자산 참조 금지** — apartment/, stock-investment/, travel/는 별개 격리 영역.
- ai-nodes 루트의 `_shared/bin/`만 모든 워크스페이스가 공유.
- ai-nodes 루트의 `skills/`는 전역 공용 스킬 (`workspace-audit`, `agent-browser`).
- career-os 워크스페이스 audit은 `bash skills/workspace-audit/scripts/run_audit.sh career-os`로 실행. 산출물은 `/tmp/workspace-audit-career-os/`에 stash (영구화 X — 보존 가치는 ADR로 lift).

## 변경 시 영향 범위

| 변경 종류 | 같이 갱신해야 할 파일 |
|---|---|
| 새 dispatch 명령 추가 | `run_now.sh` case + 본 문서의 디스패처 표 + `flow.md` 명령별 흐름 + `prd.md` 기능 표 |
| 새 자체 extractor 추가 | runner의 `attempt()`에서 `claude_persist_usage` 호출 보장 + `data-schema.md`에 입출력 스키마 |
| 새 config 추가 | `data-schema.md` config 섹션 + `prd.md` (사용자 가시 자산이면) |
| 새 외부 의존 (`_shared/bin/`) | 본 문서의 외부 의존성 표 + ADR 추가 |
| dispatcher 우회 직접 호출 도입 | 원칙 위반. 새 ADR로 정당화 필요. |
