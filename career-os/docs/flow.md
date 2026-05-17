# Flow — career-os 사용자/데이터 플로우

career-os의 일상적 사용 패턴과 각 명령의 데이터 흐름. 새 워크플로를 추가하거나 기존 흐름을 변경할 때 여기를 같이 갱신한다.

## 일상 사이클 (가장 자주 도는 흐름)

```
[매일 아침]
  ↓
  claude -p "/study-topic-recommender"  → data/runtime/morning-topic-recommendation.md
  ↓ (10픽 + 오늘의 3선)
  사용자가 1개 토픽 선택
  ↓
  claude -p "/study-pack-writer <topic>"      → sources/fos-study/<domain>/<topic>.md
  ↓ (또는)
  claude -p "/interview-asset-writer <topic>" → sources/fos-study/interview/<형식별 경로>/<topic>.md
  ↓
  fos-study git commit + push (자동)
  ↓
  Discord 알림: [완료] <topic> · $0.27 · sonnet-4-6 · 24k→6k 토큰 · 105s
```

```
[정기 백그라운드 — cron]
  ↓
  (replenish는 plan015에서 별도 명령 폐기 — plan016에서 study-topic-recommender native skill로 흡수 완료)
  ↓
  claude -p "/position-recommender"    → data/runtime/position-recommendation.md
  ↓
  study-topic-recommender (native)가 갱신된 inventory를 읽음
```

## 명령별 데이터 흐름

dispatcher 폐기 완료 (plan023, ADR-031) — 모든 명령은 native skill 직접 진입: `claude -p "/<skill>" [args]`. 완료/실패 시 Discord 알림 발송 (`bun --env-file=career-os/.env _shared/lib/notify_discord.ts` 경유, ADR-021).

### `/interview-prep-analyzer` (native skill — plan017, baseline + daily 두 모드 자연어 분기)

native skill 패턴: `claude -p "/interview-prep-analyzer [args]"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

호출 시그니처:

```
  /interview-prep-analyzer                  → baseline 자동 (인자 없음)
  /interview-prep-analyzer "오늘 점검"       → daily 자연어
  /interview-prep-analyzer "<topic>"        → daily, 명시 토픽
  /interview-prep-analyzer "전체 진단"       → baseline 명시
```

[모드 분기 — 자연어 추론]

```
  ┌────────────────────────────────────┐       ┌────────────────────────────────────┐
  │ baseline 모드                       │       │ daily 모드                          │
  │ ───────                             │       │ ───────                             │
  │ Read: config/baseline-core-files    │       │ Topic 선택:                         │
  │ Read: 10 파일 (큐레이션)            │       │  - 인자 명시 → 그대로               │
  │ Claude 분석 → 7 섹션                │       │  - 없으면 data/study-progress.json  │
  │ Write: data/reports/baseline/       │       │    → 가장 오래된 토픽 자연어 선택   │
  │  YYYY-MM-DD/report.md               │       │ Read: config/topic-file-map.json    │
  │                                     │       │ Read: 3-5 파일                      │
  │                                     │       │ Claude 분석 → 5 섹션                │
  │                                     │       │ Write: data/reports/daily/          │
  │                                     │       │  YYYY-MM-DD/report.md               │
  │                                     │       │ Edit: data/study-progress.json      │
  │                                     │       │  → 토픽 lastVisited = 오늘 갱신     │
  └────────────────────────────────────┘       └────────────────────────────────────┘
```

공통:
- Read: `config/mvp-target.json` + `config/candidate-profile.md`
- `fos-study git pull --rebase --autostash` (사전)
- Discord 알림 [완료] + cost

옛 외부 subprocess 흐름 (dispatcher → run_baseline/daily/smoke.sh → 6 Python script → claude --print → extract → 갱신)은 plan017에서 폐기됨. smoke 모드 자체도 폐기 — Claude 호출 sanity는 다른 skill 사용 중에 자연 확인.

상세 동작: `career-os/.claude/skills/interview-prep-analyzer/SKILL.md` Workflow 섹션 참조.

### `/candidate-baseline-suggester` (native skill — plan020, ADR-028)

native skill 패턴: `claude --permission-mode acceptEdits -p "/candidate-baseline-suggester"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

```
호출: claude --permission-mode acceptEdits -p "/candidate-baseline-suggester"
  ↓
Read: candidate-profile.md + baseline-core-files.json
      + data/study-progress.json + (선택) data/reports/baseline/<latest>/
      + fos-study git log (전체 history)
  ↓
Backup → data/runtime/profile-refresh-suggestions/YYYY-MM-DD/before/
  ↓
Claude 자연어 분석:
  - 강점 추가 후보 (fos-study 학습 증거)
  - 약점 outdated 후보 (학습 완료 → 주석 마킹)
  - baseline-core-files 추가 후보 (fos-study 새 핵심 파일)
  - weak_spots 평가 갱신
  ↓
Edit 적용 (Append + 주석 마킹):
  candidate-profile.md / baseline-core-files.json / prd.md / study-progress.json
  ↓
audit trail Write → after/ + diff/ + changes.md
  ↓
Discord 알림 [완료]
```

자동 commit 없음 — 갱신된 자산을 git에 추가할지 사용자가 결정.

상세 동작: `career-os/.claude/skills/candidate-baseline-suggester/SKILL.md` Workflow 섹션 참조.

### `/position-recommender` (native skill — plan022, ADR-030)

native skill 패턴: `claude -p "/position-recommender [자연어 컨텍스트] [채용공고 file path]"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

```
호출: claude -p "/position-recommender [자연어 컨텍스트] [채용공고 file path]"
  ↓
[선택적] Bash: bun career-os/scripts/position-recommender/collect_live_postings.ts
  → /tmp/live-postings-<date>.md (Wanted + Toss 자동 수집)
  ↓
Read:
  - config/candidate-profile.md
  - config/sources.json (techBlog 필드)
  - references/position-recommendation-prompt.md
  - references/position-context-index.md
  - references/position-decision-criteria.md
  - references/company-upside-reference.md
  - references/verified-company-research-targets.json
  - (선택) 사용자 자연어로 지정한 채용공고 file
  ↓
Claude 자연어 분석:
  - 강력 추천 / 도전 추천 / 보류·주의 3 티어
  - role title + posting 링크 + 지원 근거 + gap + first action
  ↓
Self-check: 첫 줄 # + 30줄+ + 3 티어 모두 존재 (재작성 최대 3회)
  ↓
Write: data/reports/daily/YYYY-MM-DD/position-recommendation/report.md
       data/runtime/position-recommendation.md (cp 사본)
  ↓
Discord 알림 [완료]
```

상세 동작: `career-os/.claude/skills/position-recommender/SKILL.md` Workflow 섹션 참조.

### `study-topic-recommender` (모닝 추천 — native skill, ADR-026)

native skill 패턴: `claude -p "/study-topic-recommender"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

내부 흐름: promote detect → `bun career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts` 호출 → 결과 출력 (+ 선택적 live-coding seed 선택).

알고리즘 (ADR-010/012/013): 점수 계산(recent penalty + weak area bonus + carry-over) + mix target(백엔드 3 + 기술블로그 3 + AI 3 + geek 1 = 10) + feed_discovery.ts(RSS 피드 최신 글 부착).

산출물:
- `data/runtime/topic-inventory.json`
- `data/runtime/morning-topic-recommendation.md`
- `data/runtime/topic-inventory-history.jsonl`

상세 동작: `career-os/.claude/skills/study-topic-recommender/SKILL.md` Workflow 섹션 참조.

이전 외부 subprocess 흐름 (dispatcher → run_topic_recommendation.sh → refresh_topic_inventory.py)은 plan016 phase-03에서 폐기됨.

### `study-pack <topic>` (native skill — ai-nodes ADR-002, plan013)

native skill 패턴: `claude -p "/study-pack-writer <topic>"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

상세 동작: `career-os/.claude/skills/study-pack-writer/SKILL.md` Workflow 섹션 참조.

이전 외부 subprocess 흐름 (dispatcher → run_study_pack.sh → claude --print → extractor → publish)은 plan013 phase-03에서 폐기됨.

### `interview-asset <topic>` (native skill — plan015, Q&A + master playbook 두 형식)

native skill 패턴: `claude -p "/interview-asset-writer <topic>"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

두 산출물 형식 자동 분기 (topic-key 또는 자연어 키워드로 판단):
- Q&A 질문 은행 (옛 question-bank)
- 마스터 플레이북 (옛 master)

상세 동작: `career-os/.claude/skills/interview-asset-writer/SKILL.md` Workflow 섹션 참조.

이전 외부 subprocess 흐름 (dispatcher → run_question_bank.sh → claude --json-schema → render_question_bank.ts → publish)은 plan015에서 폐기됨. JSON schema 강제는 native self-check 7항목으로 대체.

### `/interview-coffeechat-prep` (native skill — plan021, ADR-029)

native skill 패턴: `claude -p "/interview-coffeechat-prep"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

```
호출: claude -p "/interview-coffeechat-prep"
  ↓
Read: config/mvp-target.json (zod parse → primary.coffeechat 객체)
  ↓
Bash: bun career-os/scripts/interview-coffeechat-prep/collect_company_sites.ts
  → data/source/<coffeechat.source_dir>/ (sites HTML + txt + manifest.json)
  ↓
Read: candidate-profile.md + data/prep/<coffeechat.prep_dir>/{strategy,checklist}.md
      + 수집된 sites text + references/coffeechat-prompt.md
  ↓
Claude 분석 → report.md 작성
  ↓
Write: data/reports/daily/YYYY-MM-DD/<coffeechat.report_slug>/report.md
       data/runtime/<coffeechat.report_slug>.md (사본)
  ↓
Discord 알림 [완료]
```

회사 불가지론 — 회사명·URL은 `config/mvp-target.json`의 `primary.coffeechat` 객체에서만 읽음. 준비 자산(`strategy.md` + `checklist.md`)은 `data/prep/<coffeechat.prep_dir>/`에 위치 (ADR-029).

상세 동작: `career-os/.claude/skills/interview-coffeechat-prep/SKILL.md` Workflow 섹션 참조.

### live-coding seed 선택 (study-topic-recommender 흡수 — plan016)

`claude -p "/study-topic-recommender live-coding 1개 골라줘"` — study-topic-recommender가 live-coding seed 선택을 내부적으로 처리.

1. `data/runtime/topic-inventory.json`의 `pools.remainingLiveCodingSeeds` 확인
2. 가장 우선도 높은 seed 1개 선택 → 제목 + slug + difficulty 출력
3. 사용자 승인 시 `claude -p "/study-pack-writer <seed-slug>"` 위임

`config/live-coding-seed-pool.json` + `live-coding-seed-candidates.json`은 유지 (SKILL.md가 Read).

이전 dispatcher 흐름 (dispatcher → run_live_coding_dispatch.sh → TOPIC_CONFIG_OVERRIDE → study-pack)은 plan016 phase-03에서 폐기됨.

## 통과 시점에 항상 일어나는 일

모든 native skill 공통 흐름:

1. Claude가 SKILL.md 자동 로드 → 도구 직접 실행.
2. 완료/실패 시 `bun --env-file=career-os/.env _shared/lib/notify_discord.ts` 호출 → Discord 알림 ([완료]/[실패] + cost line).
3. study-pack / interview-asset는 fos-study commit + push 포함.

(옛 `run_tracked()` → `track_task.sh` → `format_cost_summary.py` 파이프라인은 plan023에서 career-os 흐름에서 제거됨. `track_task.sh`는 apartment 등 다른 워크스페이스에서 여전히 사용 중.)

## 의도적 비대칭

- interview-prep-analyzer (baseline + daily): 외부 publish 안 함. 내부 학습용. (plan017, ADR-027)
- study-pack / question-bank: fos-study에 commit + push 강제.
- position-recommender / interview-coffeechat-prep: data/runtime 또는 data/reports에만, 외부 publish X.
- study-topic-recommender (native): 산출물이 사람이 읽고 다음 단계로 가는 입력. replenish + recommend + live-coding seed 흡수 완료 (plan015/016, ADR-026).

## 실패 시 동작

- Claude 타임아웃 (대부분 900s): runner가 비-zero exit, Discord [실패] 알림. baseline은 추가로 `report.fallback.md` 생성해 부분 정보 보존.
- fos-study git push 실패: study-pack-class runner는 exit non-zero. push 실패는 silent 처리 금지.
- validator 실패: runner가 stricter prompt로 재시도 1회. 그래도 실패하면 [실패] 알림.

## 워크플로 우회

dispatcher 폐기 후 `run_now.sh`는 존재하지 않음. native skill(`claude -p "/<skill>"`)이 유일한 진입점 — 우회 경로 없음.

디버깅·단발 테스트 시에도 동일한 `claude -p "/<skill>"` 직접 호출 사용.
