# Code Architecture — career-os

career-os의 디렉터리 구조·계층 책임·외부 의존성. 새 스킬·러너를 추가하거나 파이프라인을 바꿀 때 이 문서를 기준으로 한다.

## 계층

```
┌─────────────────────────────────────────────────────────────┐
│ 진입점 (dispatcher)                                          │
│   skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh │
│   - 11개 case 분기                                            │
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
│   skills/<skill-name>/scripts/run_*.sh                       │
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
│   - 자체: skills/<skill-name>/scripts/extract_*.py | render_*.py│
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
├── docs/                                  ← 5 종합 문서 (fos-blog 패턴)
│   ├── prd.md            제품 범위·MVP·기능 목록
│   ├── data-schema.md    config/logs/runtime 스키마
│   ├── flow.md           사용자/데이터 플로우
│   ├── code-architecture.md  이 문서
│   ├── adr.md            모든 아키텍처 결정 누적 기록
│   ├── decisions/        (legacy) 개별 ADR 파일들 — adr.md로 통합 후 archive 예정
│   ├── hand-off/         타 에이전트/사람에게 넘기는 인수인계 메모
│   ├── prep/             회사별·이벤트별 준비 노트
│   ├── learn/            세션·실험 회고
│   └── audit/            (legacy) 과거 docs-audit 출력
│
├── config/                                ← 사람이 큐레이션한 입력
│   ├── mvp-target.json           현재 active 타깃 단일 출처
│   ├── candidate-profile.md      이력 (prose, 의도적으로 JSON 아님)
│   ├── baseline-core-files.txt   baseline 분석 대상 파일 목록
│   ├── study-pack-topics.json    primary 토픽
│   ├── study-topic-candidates.json reservoir
│   ├── study-pack-maintainer-topics.json
│   ├── experience-question-bank-topics.json
│   ├── interview-master-topics.json
│   ├── topic-file-map.json       daily용 토픽 → 파일
│   ├── tech-blog-sources.json    보조 카테고리 1
│   ├── ai-topic-sources.json     보조 카테고리 2
│   ├── geek-news-sources.json    보조 카테고리 3
│   ├── cj-foodville-bootcamp-topics.json  (deferred)
│   └── .env                      비밀 (GITHUB_TOKEN, DISCORD_WEBHOOK_URL 등)
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
├── skills/                                ← Claude Skills 표준 구조
│   ├── cj-oliveyoung-java-backend-prep/   (디렉터리명 잔재 — 분해 보류)
│   │   ├── SKILL.md
│   │   ├── references/{baseline,daily,topic-replenishment}-prompt.md
│   │   └── scripts/
│   │       ├── run_now.sh         ← 디스패처
│   │       ├── run_baseline.sh
│   │       ├── run_daily.sh
│   │       ├── run_smoke_test.sh
│   │       ├── run_morning_topic_recommendation.sh
│   │       ├── run_replenish_topic_reservoir.sh
│   │       ├── run_morning_live_coding.sh         (deferred)
│   │       ├── run_cj_foodville_bootcamp.sh       (deferred)
│   │       ├── notify_discord.sh
│   │       ├── refresh_topic_inventory.py    ADR-009/010/012/013 종합 엔진
│   │       ├── replenish_topic_reservoir.py  ADR-011 보충 엔진
│   │       ├── promote_candidate_topics.py
│   │       ├── feed_discovery.py             ADR-013 RSS/Atom 파서
│   │       ├── build_target_file_list.py     ADR-001
│   │       ├── select_topic.py
│   │       ├── update_study_progress.py
│   │       ├── collect_fos_study.py
│   │       └── setup_env.sh
│   ├── study-pack-writer/
│   │   └── scripts/{run_study_pack.sh, extract_and_validate_study_pack.py, ...}
│   ├── study-pack-maintainer/
│   │   └── scripts/{run_maintainer.sh, resolve_maintainer_topic.py}
│   ├── experience-question-bank-writer/
│   │   ├── references/question-bank-schema.json
│   │   └── scripts/{run_question_bank.sh, render_question_bank.py, resolve_question_bank_topic.py}
│   ├── interview-master-writer/
│   │   └── scripts/{run_master.sh, resolve_master_topic.py}
│   ├── position-recommender/
│   │   └── scripts/{run_position_recommendation.sh, extract_position_report.py,
│   │                collect_live_postings.py (deferred), publish_job_analysis.sh (deferred)}
│   ├── cj-foodville-coffeechat-prep/
│   │   └── scripts/{run_foodville_coffeechat_prep.sh, collect_foodville_sites.py}
│   ├── fos-study-pack/
│   │   └── scripts/run_from_request.sh   (deferred — dispatcher 미연결)
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

## 외부 의존성 (`_shared/bin/`)

career-os 워크스페이스 바깥, ai-nodes 루트의 `_shared/bin/`에 모든 워크스페이스가 공유하는 헬퍼.

| 파일 | 책임 |
|---|---|
| `track_task.sh` | 모든 runner 래퍼. JSONL 로그 + openclaw status diff + usage file 전달. **누락 시 모든 실행 실패**. |
| `claude_lib.sh` | sourceable. `claude_persist_usage <raw-json-path>` — raw Claude JSON envelope을 `$TRACK_TASK_CLAUDE_USAGE_FILE`로 cp (ADR-014). |
| `format_cost_summary.py` | logs/task-runs.jsonl 최신 항목 → 한 줄 cost summary. run_now.sh의 알림에 부착. |
| `extract_claude_result.py` | Claude `--output-format json` → `.result` 추출 + usage 인자 전달. **gold standard**. baseline/daily/smoke/foodville 사용. |
| `update_artifacts.py` | `data/generated-artifacts.json` upsert. study-pack/question-bank/master publish 후. |

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
      "$TASK_ROOT/skills/cj-oliveyoung-java-backend-prep/scripts/run_baseline.sh"
    ;;
  # ... 10개 더
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
