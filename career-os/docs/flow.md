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
  study-pack <topic>     → sources/fos-study/<domain>/<topic>.md
  ↓ (또는)
  question-bank <topic>  → sources/fos-study/interview/experience-based/<topic>.md
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

각 명령은 `run_now.sh <command>` → `run_tracked()` 헬퍼 → `_shared/bin/track_task.sh` → 실제 runner 스크립트 순으로 흐른다. 완료/실패 시 자동으로 Discord 알림 + cost summary 부착.

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

### `study-pack <topic>` (외부 publish)

```
config/topics.json (study-pack 또는 study-pack-maintainer namespace)에서 topic 정보 조회
  - study-pack-maintainer namespace에 있으면: maintainer 경로 (기존 갱신, ADR 미정 — 라우팅 결정)
  - study-pack namespace에 있으면: writer 경로 (신규 생성)
  - 둘 다 없으면: candidate auto-promotion 시도 (ADR-011)
  ↓
data/runtime/locks/study-pack-<topic>.lock 잠금 (중복 실행 방지)
  ↓
Discord [시작] 알림
  ↓
sources/fos-study git pull (또는 clone)
  ↓
references/study-pack-prompt.md + writing-rules + candidate-profile + topic-specific append
  ↓
claude --print --output-format json (재시도 1회 — strict prompt 추가)
  ↓
extract_and_validate_study_pack.py (검증: '#' 시작, ≥80줄, 금지 prefix, 코드 펜스 언어 명시)
  ↓
claude_persist_usage (ADR-014)
  ↓
sources/fos-study/<outputPath>에 copy
  ↓
git commit (ADR-005 메시지 규칙) + push
  ↓
data/generated-artifacts.json upsert
  ↓
Discord [완료] 알림 + cost summary
```

### `maintain-study-pack <topic>`

```
config/topics.json (study-pack-maintainer namespace)에서 topic 조회
  ↓
sources/fos-study/<outputPath>의 기존 문서 + 관련 문서들 읽기
  ↓
maintainer-prompt.md로 update-vs-new-file 판단을 Claude에게 위임
  ↓
study-pack과 유사하게 commit + push
```

### `question-bank <topic>`

```
config/topics.json (question-bank namespace)에서 topic + inputFiles 조회
  ↓
candidate-profile + 선택된 task/resume 파일 결합
  ↓
references/question-bank-prompt.md + question-bank-schema.json
  ↓
claude --print --output-format json --json-schema (구조 검증)
  ↓
render_question_bank.py (5 main Q + 5 follow-up + answer points + 1분 답변 + 압박 방어)
  ↓
claude_persist_usage
  ↓
sources/fos-study/interview/experience-based/<topic>.md
  ↓
commit + push (ADR-007a)
```

### `master [topic]`

study-pack과 유사한 흐름이지만 extractor는 `extract_and_validate_study_pack.py`를 공유. 출력은 시니어 백엔드 마스터 플레이북 (자기소개·커리어 narrative·기술 결정 스타일·역질문·최종 체크리스트).

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

### `bootcamp-batch` (plan005 wire-up — ADR-017)

```
config/topics.json (bootcamp namespace, plan002 이후)
  ↓
skills/study-pack-batch/scripts/run_bootcamp_batch.sh:
  - dailyRecommendCount 만큼 추천 큐 산출
  - 미생성 토픽 우선, dailyGenerateCount 개만큼 study-pack-writer 위임
  ↓
study-pack-writer가 토픽별 study-pack 생성 + fos-study commit/push (기존 흐름)
  ↓
data/runtime/bootcamp-summary.md (사람용)
data/reports/daily/YYYY-MM-DD/bootcamp/ (날짜별 사본)
```

### `live-coding-dispatch` (plan005 wire-up — ADR-017)

```
config/live-coding-seed-pool.json (primary)
config/live-coding-seed-candidates.json (reservoir)
data/generated-artifacts.json (이미 만든 outputPath 제외)
  ↓
skills/study-topic-recommender/scripts/run_live_coding_dispatch.sh:
  - 미커버 seed 1개 선택 (primary → candidate 순)
  - data/runtime/live-coding-generated-topic.json에 임시 topic 작성
  - lock: data/runtime/locks/live-coding-dispatch.lock
  ↓
TOPIC_CONFIG_OVERRIDE 환경변수로 run_now.sh study-pack 위임
  ↓
기존 study-pack 흐름 (notify [시작] · writer · validator · commit · push)
```

### `auto-question-bank` (plan005 wire-up — ADR-017)

```
QUESTION_BANK_TOPIC_OVERRIDE 또는 기본값 experience-qbank-ai-service-team
  ↓
skills/experience-question-bank-writer/scripts/run_question_bank_auto.sh:
  - Discord [시작] 알림
  - run_now.sh question-bank <topic> 위임
  ↓
기존 question-bank 흐름 (Claude --json-schema · render · fos-study push)
  ↓
Discord [완료]/[실패] 알림 (cost summary는 run_tracked 경유로 부착)
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
- study-pack / question-bank / master / maintain-study-pack: fos-study에 commit + push 강제.
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
