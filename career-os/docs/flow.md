# Flow — career-os 사용자/데이터 플로우

career-os의 일상적 사용 패턴과 각 명령의 데이터 흐름. 새 워크플로를 추가하거나 기존 흐름을 변경할 때 여기를 같이 갱신한다.

## 일상 사이클 (가장 자주 도는 흐름)

```
[매일 아침]
  ↓
  recommend-topics       → data/runtime/morning-topic-recommendation.md
  ↓ (10픽 + 오늘의 3선)
  사용자가 1개 토픽 선택
  ↓
  claude -p "/study-pack <topic>"      → sources/fos-study/<domain>/<topic>.md
  ↓ (또는)
  claude -p "/interview-asset <topic>" → sources/fos-study/interview/<형식별 경로>/<topic>.md
  ↓
  fos-study git commit + push (자동)
  ↓
  Discord 알림: [완료] <topic> · $0.27 · sonnet-4-6 · 24k→6k 토큰 · 105s
```

```
[정기 백그라운드 — cron]
  ↓
  replenish-topics       → config/topics.json의 study-pack-candidates namespace 보충 + primary promotion
  ↓
  recommend-positions    → data/runtime/position-recommendation.md
  ↓
  recommend-topics가 갱신된 inventory를 읽음
```

## 명령별 데이터 흐름

각 명령은 `run_now.sh <command>` → `run_tracked()` 헬퍼 → `_shared/bin/track_task.sh` → 실제 runner 스크립트 순으로 흐른다. 완료/실패 시 자동으로 Discord 알림 + cost summary 부착. 알림은 `bun --env-file=career-os/.env _shared/lib/notify_discord.ts` 경유 (ADR-021).

### `baseline`

```
config/baseline-core-files.json
  ↓
build_target_file_list.py → data/reports/baseline/YYYY-MM-DD/target-files.txt
  ↓
sources/fos-study/<core-files>.md 읽기
  ↓
config/candidate-profile.md 결합
  ↓
claude --print --output-format json (단일 호출, ADR-003)
  ↓
extract_claude_result.py + claude_persist_usage (ADR-014)
  ↓
data/reports/baseline/YYYY-MM-DD/report.md
  ↓
실패 시: report.fallback.md (90s 타임아웃 등)
```

### `daily [topic]`

```
DAILY_TOPIC 또는 data/study-progress.json에서 가장 오래된 약점 토픽 선택 (ADR-001)
  ↓
config/topic-file-map.json에서 토픽 → 파일 목록 조회
  ↓
build_target_file_list.py → 3-5개 파일 선별 (ADR-001)
  ↓
claude --print --output-format json
  ↓
extract_claude_result.py + claude_persist_usage
  ↓
data/reports/daily/YYYY-MM-DD/report.md
  ↓
data/study-progress.json 자동 업데이트 (ADR-002)
```

### `recommend-positions`

```
config/candidate-profile.md
  ↓
(POSITION_POSTINGS_FILE env) — 활성 채용 공고 입력
  ↓
references/position-recommendation-prompt.md + 컨텍스트 index
  ↓
claude --print --output-format json
  ↓
extract_position_report.py + claude_persist_usage
  ↓
data/reports/daily/YYYY-MM-DD/position-recommendation/report.md
  ↓
data/runtime/position-recommendation.md (cat-able 사본)
```

### `recommend-topics` (모닝 추천 — ADR-009/010/012/013)

```
config/topics.json (study-pack / study-pack-candidates namespaces)
config/live-coding-seed-pool.json (primary)
config/live-coding-seed-candidates.json (reservoir)
config/sources.json (techBlog / ai / geek categories)
  ↓
refresh_topic_inventory.py:
  - 점수 계산 (ADR-010): recent penalty + weak area bonus + carry-over penalty
  - mix target 강제 (ADR-012): 백엔드 3 + 기술블로그 3 + AI 3 + geek 1 = 10
  - feed_discovery.py 호출 (ADR-013): feedUrl 있는 항목에 최신 글 부착
  - 오늘의 3선 추출: 각 카테고리 1순위 1개
  ↓
data/runtime/topic-inventory.json (구조화)
data/runtime/topic-inventory-history.jsonl (carry-over 추적용 append)
data/runtime/morning-topic-recommendation.md (사람용)
```

### `replenish-topics` (자동 보충 — ADR-011)

```
config/topics.json (study-pack-candidates namespace) 정리:
  - primary key/outputPath 충돌 후보 제거
  - 최근 생성 주제와 유사한 후보 제거
  ↓
candidate reservoir가 목표치 이하면:
  - replenish_topic_reservoir.py가 직접 claude subprocess 호출
  - JSON 출력 받아 로컬 validator로 key/domain/tag/outputPath/prompt 검증
  - TRACK_TASK_CLAUDE_USAGE_FILE env로 usage 전파 (ADR-014)
  ↓
검증 통과 후보만 config/topics.json (study-pack-candidates namespace)에 append
  ↓
primary 미생성 재고 부족 시 candidate 일부 auto-promotion
  ↓
refresh_topic_inventory.py 재실행 (inventory 갱신)
  ↓
data/runtime/topic-replenishment.json (실행 요약)
```

### `study-pack <topic>` (native skill — ai-nodes ADR-002, plan013)

native skill 패턴: `claude -p "/study-pack <topic>"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

상세 동작: `career-os/.claude/skills/study-pack-writer/SKILL.md` Workflow 섹션 참조.

이전 외부 subprocess 흐름 (dispatcher → run_study_pack.sh → claude --print → extractor → publish)은 plan013 phase-03에서 폐기됨.

### `interview-asset <topic>` (native skill — plan015, Q&A + master playbook 두 형식)

native skill 패턴: `claude -p "/interview-asset <topic>"` → SKILL.md 자동 로드 → Claude가 도구로 직접 처리.

두 산출물 형식 자동 분기 (topic-key 또는 자연어 키워드로 판단):
- Q&A 질문 은행 (옛 question-bank)
- 마스터 플레이북 (옛 master)

상세 동작: `career-os/.claude/skills/interview-asset-writer/SKILL.md` Workflow 섹션 참조.

이전 외부 subprocess 흐름 (dispatcher → run_question_bank.sh → claude --json-schema → render_question_bank.ts → publish)은 plan015에서 폐기됨. JSON schema 강제는 native self-check 7항목으로 대체.

### `foodville-coffeechat`

```
collect_foodville_sites.py → data/source/cj-foodville-sites/manifest.json
  ↓
references/coffeechat-review-prompt.md + 전략 노트 + 사이트 스냅샷
  ↓
claude --print --output-format json
  ↓
_shared/bin/extract_claude_result.py (generic, usage 인자 포함)
  ↓
data/reports/daily/YYYY-MM-DD/cj-foodville-coffeechat/report.md
data/runtime/cj-foodville-coffeechat-prep.md (사본)
```

### `smoke`

최소 동작 점검. `_shared/bin/extract_claude_result.py` gold 경로를 따른다. baseline의 축소판.

### `live-coding-dispatch` (plan005 wire-up — ADR-017)

```
config/live-coding-seed-pool.json (primary)
config/live-coding-seed-candidates.json (reservoir)
data/generated-artifacts.json (이미 만든 outputPath 제외)
  ↓
scripts/study-topic-recommender/run_live_coding_dispatch.sh:
  - 미커버 seed 1개 선택 (primary → candidate 순)
  - data/runtime/live-coding-generated-topic.json에 임시 topic 작성
  - lock: data/runtime/locks/live-coding-dispatch.lock
  ↓
TOPIC_CONFIG_OVERRIDE 환경변수로 run_now.sh study-pack 위임
  ↓
기존 study-pack 흐름 (notify [시작] · writer · validator · commit · push)
```

## 통과 시점에 항상 일어나는 일

모든 명령 (`run_tracked()` 통과):

1. `track_task.sh`가 `openclaw status` 캡처 (시작 + 종료, openclaw 토큰 추정).
2. 실제 runner 실행.
3. Claude 호출 runner는 `claude_persist_usage` 호출 → raw JSON envelope을 `$TRACK_TASK_CLAUDE_USAGE_FILE`로 cp.
4. `track_task.sh`가 usage 파일 + file metrics + openclaw delta를 합쳐 `logs/task-runs.jsonl` + `logs/token-usage.jsonl`에 한 줄 append.
5. `format_cost_summary.py`가 logs의 최신 항목 → 한 줄 cost 요약.
6. Discord 알림 발송 ([완료]/[실패] + cost line).

## 의도적 비대칭

- baseline / daily / smoke: 외부 publish 안 함. 내부 학습용.
- study-pack / question-bank: fos-study에 commit + push 강제.
- recommend-positions / foodville-coffeechat: data/runtime 또는 data/reports에만, 외부 publish X.
- recommend-topics / replenish-topics: 산출물이 사람이 읽고 다음 단계로 가는 입력.

## 실패 시 동작

- Claude 타임아웃 (대부분 900s): runner가 비-zero exit, Discord [실패] 알림. baseline은 추가로 `report.fallback.md` 생성해 부분 정보 보존.
- fos-study git push 실패: study-pack-class runner는 exit non-zero. push 실패는 silent 처리 금지.
- validator 실패: runner가 stricter prompt로 재시도 1회. 그래도 실패하면 [실패] 알림.

## 워크플로 우회 (dispatcher 미경유)

`run_now.sh`를 안 거치고 `skills/*/scripts/run_*.sh`를 직접 호출하면:

- `track_task.sh` 래핑이 빠져 `logs/task-runs.jsonl`에 기록 안 됨.
- Discord 알림 + cost summary 빠짐.
- `data/runtime/locks/` 잠금 회피.

**원칙: 일상 운영에선 항상 `run_now.sh`로 진입한다.** 직접 호출은 디버깅·단발 테스트용으로만.
