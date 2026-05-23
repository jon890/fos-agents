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
Bash: bun career-os/scripts/position-recommender/collect_live_postings.ts
  → data/runtime/live-position-postings.md (Wanted active 중심)
  ↓
Read:
  - config/candidate-profile.md
  - config/sources.json (techBlog 필드)
  - references/position-recommendation-prompt.md
  - references/position-context-index.md
  - references/position-decision-criteria.md
  - references/company-upside-reference.md
  - references/verified-company-research-targets.json
  - 최근 7일 data/reports/daily/*/position-recommendation/report.md
  - (선택) 사용자 자연어로 지정한 채용공고 file
  ↓
Claude 자연어 분석:
  - 강력 추천 / 도전 추천 / 보류·주의 3 티어
  - role title + posting 링크 + 지원 근거 + gap + first action
  - 최근 7일 반복 후보 감점 + 신규 후보/추가 수집 대상 최소 1개 포함
  ↓
Self-check: 첫 줄 # + 오늘 날짜 + 30줄+ + 3 티어 + 반복 점검 존재 (재작성 최대 3회)
  ↓
Write: data/reports/daily/YYYY-MM-DD/position-recommendation/report.md
       data/runtime/position-recommendation.md (cp 사본)
  ↓
Discord 알림 [완료]
```

daily cron은 `scripts/position-recommender/run_daily_with_claude.sh`를 통해 실행한다. 이 wrapper는 Claude native skill 호출 후 오늘 날짜 report/runtime이 실제로 생성됐는지 검증하고, stale runtime 재전송을 실패로 처리한 뒤 `_shared/lib/notify_discord.ts`로 Discord 알림을 보낸다. Claude native skill 내부에서는 외부 메시지 전송을 직접 수행하지 않는다.

상세 동작: `career-os/.claude/skills/position-recommender/SKILL.md` Workflow 섹션 참조.

### Application Agent MVP (planned — plan029)

plan029는 기존 position/study/interview native skill을 조립해 지원 전후 전체 루프를 만든다.

초기 MVP 흐름:

```text
공고 수집/추천
  -> 후보 공고 사용자 승인
  -> 공고별 fit/gap 분석
  -> 맞춤 지원 패키지 작성
  -> evidence/drift review
  -> 사용자 승인
  -> 제출 기록 또는 보류
  -> 제출 후 interview_prep / study loop
  -> daily application digest
```

상태 흐름:

```text
discovered
  -> analyzing
  -> preparing_application
  -> needs_revision
  -> ready_for_user_review
  -> approved
  -> submitted
  -> interview_prep
  -> interview_scheduled
  -> closed
  -> blocked
```

역할 분담:

- `/position-recommender`: 공고 수집/추천/초기 fit 분석
- `application-package-writer` (plan029 예정): 공고별 지원 패키지 생성
- `application-reviewer` (plan029 예정): 근거/과장/드리프트/쿨다운 검토
- `daily-application-digest` (plan029 예정): 매일 진행 상태와 다음 액션 요약
- `/study-topic-recommender` + `/study-pack-writer`: 해당 직무 gap 기반 공개 가능한 기술 학습 자료
- `/interview-asset-writer` + `/interview-prep-analyzer`: 제출 후 면접 대비

중요 경계:

- 실제 제출 자동화는 MVP 범위 밖이다.
- 공고별 맞춤 이력서, 지원동기, 지원 전략은 `data/applications/` 비공개 산출물로 둔다.
- `sources/fos-study/`에는 회사명/개인 지원 전략이 빠진 순수 기술 학습 자료만 발행한다.

### `study-topic-recommender` (모닝 추천 — native skill, ADR-026 + ADR-033)

native skill 패턴: `claude -p "/study-topic-recommender"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

내부 흐름 (ADR-033 이후):

```
호출: claude -p "/study-topic-recommender"
  ↓
1. Promote detect — history 기반 study-pack-candidates → study-pack 승격 후보 안내 (자동 수정 X)
  ↓
2. Bash: bun career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts
   ├─ Read: config (study-pack-topics / study-pack-candidates / sources / live-coding-*)
   ├─ Scan: sources/fos-study/**/*.md (exclude .git/.claude) — git pull 없음, 로컬 clone 기준
   ├─ Deterministic dedupe (provider-free):
   │    a. exact path match → excluded.exactPathMatches
   │    b. normalized path match (lower-case + slash normalize) → excluded.normalizedPathMatches
   │    c. slug/token overlap → excluded.possibleDuplicates (Claude review 후보)
   ├─ 추천 점수 계산 + mix target + feed discovery (ADR-010/012/013)
   └─ Write: data/runtime/topic-inventory.json (excluded.* + claudeDuplicateReview.status=skipped 초기값)
  ↓
3. Claude duplicate review (native skill 내부)
   ├─ Read: inventory.excluded.possibleDuplicates
   ├─ 각 후보를 의미 판정 → decision (new | update-existing | skip | needs-user-confirmation)
   ├─ 성공 시: inventory.claudeDuplicateReview.{status=ok, reviewedAt, items[]} 갱신
   └─ 실패 시: status=failed + warning, 추천 자체는 계속 (deterministic 결과만 반영)
  ↓
4. Write: data/runtime/morning-topic-recommendation.md
   ├─ 백엔드/기술블로그/AI/Geek 4축 + 오늘의 3선 (기존 ADR-012 구조)
   ├─ "기존 문서 보강 후보" 섹션 (최대 5개) — update-existing + needs-user-confirmation
   └─ Claude review 실패 시 상단 warning 라인 추가
  ↓
5. Append: data/runtime/topic-inventory-history.jsonl
  ↓
6. (선택) live-coding seed 선택 — 자연어에 "live-coding" 포함 시
  ↓
Discord 알림 [완료]
```

산출물:

- `data/runtime/topic-inventory.json` — ADR-033 스냅샷 스키마 (data-schema.md 참조)
- `data/runtime/morning-topic-recommendation.md` — 사람이 읽는 마크다운
- `data/runtime/topic-inventory-history.jsonl` — 매일 한 줄 append

상세 동작: `career-os/.claude/skills/study-topic-recommender/SKILL.md` Workflow 섹션 참조.

이전 흐름:

- 외부 subprocess (dispatcher → run_topic_recommendation.sh → refresh_topic_inventory.py)는 plan016 phase-03에서 폐기됨.
- `data/generated-artifacts.json` 의존은 ADR-033 / plan025에서 제거 — fos-study 직접 스캔으로 단일화.

### `study-pack <topic>` (native skill — ai-nodes ADR-002, plan013 + ADR-033)

native skill 패턴: `claude -p "/study-pack-writer <topic>"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

내부 흐름 (ADR-033 이후 duplicate guard 추가):

```
호출: claude -p "/study-pack-writer <topic-key-or-자연어>"
  ↓
1. Topic 해석 → topic-key / outputPath 확정
  ↓
2. Context 로드 (Read): study-pack-topics.json + candidate-profile.md + mvp-target.json + topic-profiles.json + references
  ↓
3. Duplicate guard (ADR-033 — recommender와 같은 decision schema)
   ├─ Scan: sources/fos-study/**/*.md → exact path / normalized path / slug overlap
   ├─ (선택) Claude 의미 판정 → decision (new | update-existing | skip | needs-user-confirmation)
   └─ 분기:
        - new                       → 새 markdown 작성 진행
        - update-existing           → 새 파일 생성 금지 + 기존 matchedPath update 모드
        - skip                      → 작성 중단 + 기존 문서 경로/사유 stderr 보고 + exit 1
        - needs-user-confirmation   → 사용자 확인 없이 진행 금지 (non-interactive면 stderr + exit 1)
  ↓
4. 마크다운 작성 (Write) — sources/fos-study/<outputPath>.md
  ↓
5. Self-check (재작성 ≤3회) — 첫 줄 / 줄 수 / 펜스 언어 / 금지 prefix / writing-rules
  ↓
6. Publish (Bash) — git pull --rebase --autostash → add → commit → push
  ↓
7. Discord 알림
```

writer는 recommender에서 선택한 보강 후보뿐 아니라 *사용자가 직접 호출한 주제*에도 같은 게이트를 적용한다 — recommender와 writer가 공유하는 단일 진실원.

상세 동작: `career-os/.claude/skills/study-pack-writer/SKILL.md` Workflow 섹션 참조.

이전 흐름:

- 외부 subprocess (dispatcher → run_study_pack.sh → claude --print → extractor → publish)는 plan013 phase-03에서 폐기됨.
- 옛 SKILL.md §3 overlap 점검은 자기 판단 의존이라 high/medium 중복을 지키지 못한 경우 발생 — ADR-033으로 duplicate decision schema 게이트로 격상.

### `interview-asset <topic>` (native skill — plan015, Q&A + master playbook 두 형식)

native skill 패턴: `claude -p "/interview-asset-writer <topic>"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

두 산출물 형식 자동 분기 (topic-key 또는 자연어 키워드로 판단):
- Q&A 질문 은행 (옛 question-bank)
- 마스터 플레이북 (옛 master)

상세 동작: `career-os/.claude/skills/interview-asset-writer/SKILL.md` Workflow 섹션 참조.

이전 외부 subprocess 흐름 (dispatcher → run_question_bank.sh → claude --json-schema → render_question_bank.ts → publish)은 plan015에서 폐기됨. JSON schema 강제는 native self-check 7항목으로 대체.

### `/interview-coffeechat-prep [mode]` (native skill — plan021 + plan026, ADR-029 + ADR-034)

native skill 패턴: `claude -p "/interview-coffeechat-prep [mode]"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

mode 분기 (ADR-034, plan026): coffeechat / first-round / final-round / offer-chat. default coffeechat.
mode 결정: slash arg 우선, 자연어 키워드 fallback (`1차 면접` / `first-round` → first_round 등).

```
호출: claude -p "/interview-coffeechat-prep <mode>"
  ↓
Read: config/mvp-target.json (zod parse → primary.interview.<mode> 객체)
  ↓
Bash: bun career-os/scripts/interview-coffeechat-prep/collect_company_sites.ts --mode <mode>
  → data/source/<mode_obj.source_dir>/ (sites HTML + txt + manifest.json)
  ↓
Read: candidate-profile.md + data/prep/<mode_obj.prep_dir>/{strategy,checklist}.md
      + 수집된 sites text + references/coffeechat-prompt.md (mode 분기 가이드)
  ↓
Claude 분석 → report.md (private) + report-public.md (sanitized) 두 파일 작성
  ↓
Write: data/reports/daily/YYYY-MM-DD/<mode_obj.report_slug>/{report.md, report-public.md}
       data/runtime/<mode_obj.report_slug>.md (private 사본)
  ↓
Discord 알림 [완료]
```

회사 불가지론 — 회사명·URL은 `config/mvp-target.json`의 `primary.interview.<mode>` 객체에서만 읽음. 준비 자산 (`strategy.md` + `checklist.md`) 은 `data/prep/<mode_obj.prep_dir>/`에 위치 (ADR-029 + ADR-034).

public-safe 마스킹 정책: Claude 가 `references/coffeechat-prompt.md` 가이드에 따라 개인명·추수 액수·내부 리서치를 `report-public.md` 에서 sanitize. private 자료는 `report.md` 에 그대로.

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
