---
name: study-topic-recommender
description: backend 면접 준비용 morning 학습 토픽 추천 + RSS feed 기반 풀 보충 + 학습 완료 토픽 자동 promote + live-coding seed 선택까지 통합 처리하는 native skill. "오늘 뭐 공부할까" / "morning recommend" / "토픽 풀 갱신" / "live-coding 1개 골라줘" 같은 자연어 요청 또는 `/study-topic-recommender` 슬래시 호출. 호출 시마다 replenish + recommend + promote 자동 진행. 트리거 시점 정책은 외부 (openclaw 스케줄러).
---

# Study Topic Recommender

backend 면접 준비용 morning 토픽 추천 통합 skill. replenish + recommend + promote 흐름을 단일 호출로 자동 처리.

## When to use

슬래시 호출:
- `/study-topic-recommender`

자연어 패턴:
- "오늘 뭐 공부할까", "morning recommend", "오늘 학습 추천"
- "토픽 풀 갱신해줘", "추천 갱신", "study topic 추천"
- "live-coding 1개 골라줘", "live-coding seed 선택"
- "recommend-topics 실행", "morning 추천 돌려줘"
- "아침 학습 추천", "공부 주제 추천해줘", "토픽 추천해줘", "오늘 토픽 뭐야"

fos-study publish 안 함 — 토픽 추천만. 실제 문서 작성은 `/study-pack-writer` 로 위임.
promote 후보 안내는 사용자 확인 후 수동 적용 — 자동 config 수정 안 함.

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/sources/fos-study/**/*.md` — 학습 문서 inventory 정본. exclude `.git/**`, `.claude/**`, `private/**`.
2. `career-os/config/study-pack-topics.json` — 선택 사항. 전체 목록 정본이 아니라 사람이 고른 override/fallback 후보.
3. `career-os/config/study-pack-candidates.json` — 선택 사항. 전체 reservoir 정본이 아니라 seed/fallback 후보.
4. `career-os/config/sources.json` — `techBlog / ai / geek` reservoir items (feedUrl, filterKeywords 포함)
5. `career-os/config/live-coding-seed-pool.json` — primary live-coding seed pool
6. `career-os/config/live-coding-seed-candidates.json` — candidate live-coding seeds
7. `career-os/config/study-progress.json` — 이미 공부한 주제와 현재 보강 영역
8. `career-os/config/study-preferences.json` — 사용자의 관심 축과 추천 철학. 현재 target 중복값은 요구하지 않음.
9. `career-os/data/runtime/topic-inventory-history.jsonl` — 최근 추천 history (cooldown 계산, 없으면 skip)

fos-study 산출물 진실원 (ADR-033): `career-os/sources/fos-study/` 트리의 `**/*.md` 직접 스캔.
promote 판단 기준도 이 스캔 결과 기반 — 외부 아티팩트 목록 파일 불필요.
config 일부가 없거나 JSON parse에 실패해도 실제 fos-study inventory와 deterministic fallback 후보로 추천을 계속한다.

## Recommendation philosophy

The TypeScript inventory script is a candidate generator and diversity guardrail, not the final brain.
After inventory generation, use LLM reasoning to choose and explain what matters today:

- reflect already studied topics and generated fos-study artifacts
- reflect the current target, interview date, and first-round readiness
- reflect the user's interest axes in `study-preferences.json`
- avoid stale weak-area assumptions, especially generic DB tuning, unless the specific topic is useful for today's interview context
- do not merely rotate a fixed pool when another topic better fits the current learning arc

## Workflow

### 1. Promote 자동 detect

`data/runtime/topic-inventory-history.jsonl`의 최근 history entry에서 `study-pack-candidates` namespace에 있는 key 중 `sources/fos-study/<item.promotionTarget.outputPath>.md`가 실제로 존재하면 candidate → override 후보 승격 대상으로 판단한다.

승격 후보가 있으면 사용자에게 안내 후 `config/study-pack-topics.json` / `config/study-pack-candidates.json` 수정 권유. 자동 수정은 하지 않는다 (사람 확인 필요). 안내 후 Step 2로 계속 진행 (사용자 응답 대기 X).

승격 후보가 없으면 이 단계를 건너뛴다.

### 2. Candidate refresh decision (ADR-070)

`config/study-pack-candidates.json`과 최근 history를 읽어 후보 refresh 필요 여부를 판단한다.

**Cron 경로 하루 1회 제한 (ADR-070 D10):**
스킬 호출 args에 새 관심사·면접 맥락이 없는 cron 자동 실행의 경우,
`data/runtime/study-topic-candidate-refresh.json`의 `generatedAt`이 오늘 날짜(YYYY-MM-DD)이면 이 단계를 건너뛰고 Step 3으로 진행한다.
on-demand (스킬 args에 관심사 포함) 경우 이 제한을 적용하지 않는다.
`refresh_candidate_pool.ts`를 `--trigger-kind cron-health-check`로 직접 호출하는 경우에도 동일하게 오늘 이미 실행됐으면 자동으로 skip한다 (exit 0).

**Trigger 조건 — 다음 중 하나라도 해당하면 refresh 실행:**

- `config/study-pack-candidates.json`의 active 자동 후보(`source: "llm-candidate-refresh"`, `status: "active"`)가 5개 이하
- `data/runtime/topic-inventory-history.jsonl` 최근 7회 entries에서 같은 domain/tag 반복이 과도함
- 스킬 호출 args에 새 관심사 또는 새 지원·면접 맥락이 포함됨
- 기존 fos-study 문서가 현재 active 후보와 많이 겹침

Trigger 조건이 없으면 이 단계를 건너뛰고 Step 3으로 진행한다.

**Refresh 실행 (trigger 조건 해당 시):**

1. `config/study-preferences.json`, `config/study-progress.json`, `data/runtime/topic-inventory-history.jsonl`을 Read한다.
2. Claude가 위 입력과 호출 context를 바탕으로 10-20개 신규 후보를 제안하고 `/tmp/study-topic-candidate-proposals.json`에 Write한다.

   각 후보 필드:
   ```json
   {
     "key": "kebab-case-unique-key",
     "title": "후보 제목",
     "domain": "backend|infra|...",
     "tag": "new|deepen|interview|live-coding",
     "difficulty": "beginner|intermediate|advanced",
     "estMinutes": 60,
     "whyNow": ["이유 1"],
     "promotionTarget": { "outputPath": "domain/topic-slug" },
     "sourceSignals": ["study-preferences", "history-gap"]
   }
   ```

3. `refresh_candidate_pool.ts`를 Bash로 호출한다:
   ```bash
   bun --env-file=career-os/.env \
     career-os/scripts/study-topic-recommender/refresh_candidate_pool.ts \
     --proposals /tmp/study-topic-candidate-proposals.json \
     --trigger-kind recommendation-needs-refresh \
     --trigger-reason "<trigger 조건 요약>" \
     [--context "<on-demand 관심사 요약 — 민감 본문 제외>"]
   ```

4. 성공 시: stdout의 `decisions.new` 수를 확인하고 진행 상황을 간략히 출력한다.
5. 실패 시: 오류를 기록하고 Step 3으로 계속 진행한다. **refresh 실패로 전체 추천을 중단하지 않는다.**

**Context와 config 반영 구분:**

- 호출 args에 on-demand 관심사·맥락이 있으면 trigger 판단에 반영하고, `--context`에는 공개 가능한 요약만 전달한다.
  민감 본문(지원 회사명·비공개 답변 등)은 포함하지 않는다.
- `--context`는 runtime JSON(`study-topic-candidate-refresh.json`)에만 저장되며 SKILL.md 예시나 Discord 메시지에 그대로 남기지 않는다.
- Step 3.6의 `refresh_topic_inventory.ts --render-only`는 이 단계와 별개로 morning markdown만 재생성하며 config를 변경하지 않는다.

### 3. Replenish + Recommend

ts script를 `Bash` 도구로 직접 호출:

```bash
bun --env-file=career-os/.env \
  career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts
```

script 내부 흐름 (알고리즘 상수 참고용):
- **점수 계산**: `RECENT_PENALTY_PER=3 / RECENT_KEY_PENALTY_PER=8 / WEAK_AREA_BONUS=1 / CARRYOVER_PENALTY=2`
- **mix target**: backend 3 (new:1 + deepen:1 + live-coding:1) / tech-blog 3 / AI 3 / geek 1
- **cooldown**: backend key 7 history entries / secondary 3 history entries
- **RSS feed**: feed-cache TTL 6h 활용 — 반복 호출 시 네트워크 부담 없음
- **산출물**:
  - `data/runtime/topic-inventory.json` — fos-study sourceOfTruth + override/seed/fallback pool + 추천 결과 + 통계 (`excluded.possibleDuplicates` 배열 포함 — Step 3.5 입력)
  - `data/runtime/morning-topic-recommendation.md` — 사람이 읽는 마크다운 (10픽 + 오늘의 3선)
  - `data/runtime/topic-inventory-history.jsonl` — 오늘 추천 history append

### 3.5 Claude duplicate review (ADR-033)

`data/runtime/topic-inventory.json`을 Read하고 `excluded.possibleDuplicates` 배열을 의미 판정한다.

각 후보를 다음 4 decision label 중 하나로 분류:
- `new` — 의미적으로 다른 주제. 새 study-pack 추천 가능.
- `update-existing` — 같은 핵심 주제. 기존 문서 보강 후보.
- `skip` — visible recommendation에서 제외.
- `needs-user-confirmation` — 애매. 사용자 확인 필요.

판정 결과를 inventory의 `claudeDuplicateReview` 객체에 Write:

```json
{
  "status": "ok",
  "reviewedAt": "ISO-8601 now",
  "items": [
    { "key": "...", "candidatePath": "...", "matchedPath": "...", "decision": "...", "reason": "..." }
  ]
}
```

판정 입력 최소화: candidate.candidatePath / matched.matchedPath / 옵션으로 matched 파일의 첫 30줄만. 본문 전체는 비용 큼.

review 실행 자체가 실패하면 (Claude 호출 자체가 안 되거나 schema 위반):
- `claudeDuplicateReview.status = "failed"` + `reviewedAt = now` + `items = []`로 Write
- 추천 전체는 실패시키지 않음 — 다음 단계로 진행
- morning markdown에 warning 표시 책임은 rendering 단계 (Step 3.6)

`possibleDuplicates`가 0개이면 review skip. inventory의 `claudeDuplicateReview.status = "skipped"` 그대로 유지하고 다음 단계로 진행.

### 3.6 morning markdown 재생성

`claudeDuplicateReview`를 inventory에 반영한 뒤 markdown을 재생성한다. **주의: 일반 `refresh_topic_inventory.ts` 재호출은 inventory를 다시 계산하면서 Claude review 결과를 덮어쓸 수 있으므로 금지한다.**

render-only 모드로 재생성:

```bash
bun --env-file=career-os/.env \
  career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts --render-only
```

`--render-only` 모드는 기존 `topic-inventory.json`을 읽고 markdown만 다시 쓴다. `claudeDuplicateReview` 결과가 반영된 "기존 문서 보강 후보 (최대 5)" 섹션과 (status=failed이면) 상단 warning 라인이 출력된다.

### 4. LLM 큐레이션

Read `data/runtime/topic-inventory.json`, `data/runtime/morning-topic-recommendation.md`,
`config/study-progress.json`, and `config/study-preferences.json`.

Use them to produce a concise recommendation with:

- today's recommended 3 backend study topics
- 1-3 external reading picks if useful
- why these fit the current interview arc
- one explicit note on what was avoided because it was already studied or recently repeated
- pool health only as a diagnostic, not as the main answer

### 5. 결과 출력

Do not paste the full markdown by default. Summarize the LLM-curated picks and include the path to `morning-topic-recommendation.md`.

### 6. Live-coding seed 선택 (옵션)

자연어에 "live-coding" 키워드가 있으면 추가 처리:

1. `data/runtime/topic-inventory.json`의 `pools.remainingLiveCodingSeeds` 확인. 비어 있으면 `pools.remainingLiveCodingCandidateSeeds` 확인.
2. 가장 우선도 높은 seed 1개 선택 → 제목 + slug + difficulty + outputPath 출력
3. 사용자 승인 시 `claude -p "/study-pack-writer <seed-slug>"` 명령 안내 (study-pack-writer로 위임)

## Self-check

`Bash` 호출 종료 후 Claude가 직접 검증한다. 검증 명령을 반드시 실행할 것 — prose로 추정 보고하면 PHASE_FAILED:

```bash
# A. topic-inventory.json 존재 및 필수 키
python3 -c "
import json, sys
data = json.load(open('career-os/data/runtime/topic-inventory.json'))
keys = ['generatedAt', 'recommendations', 'techBlogRecommendations', 'aiRecommendations', 'todayPick']
missing = [k for k in keys if k not in data]
if missing:
    print('SELF_CHECK_FAIL: topic-inventory.json 누락 키', missing)
    sys.exit(1)
print('[ok] topic-inventory.json 필수 키 존재')
"

# B. morning-topic-recommendation.md 비어있지 않음
LINES=$(wc -l < career-os/data/runtime/morning-topic-recommendation.md 2>/dev/null || echo 0)
echo "[lines] morning-topic-recommendation.md: $LINES"
[ "$LINES" -ge 10 ] || { echo "SELF_CHECK_FAIL: morning-topic-recommendation.md $LINES 줄 (expected ≥10)"; exit 1; }

echo "[self-check] OK"
```

검증 실패 시 오류 원인을 진단하고 사용자에게 보고한다. silent 성공 금지.

## Error handling

| 상황 | 처리 |
|---|---|
| RSS fetch 실패 | feed-cache TTL 범위 내면 캐시 사용. 캐시도 없으면 해당 항목 skip, 나머지 정상 진행 |
| `bun` 미설치 | stderr 출력 + 설치 안내 (`brew install bun` 또는 공식 설치) + exit 1 |
| ts script exit code ≠ 0 | stderr 내용 그대로 사용자에게 보고. silent 실패 금지 |
| topic-inventory.json 미생성 | 오류 원인 진단 후 사용자 보고 |
| candidate 없음 (pool 고갈) | 경고 메시지 + inventory는 정상 기록 + 사용자에게 `replenish` 필요 안내 |
| live-coding seed pool 비어있음 | 단계 4 skip + "seed pool 비어 있음 — live-coding seed 후보 갱신 필요" 안내 |
| history.jsonl 부재 | 빈 history로 처리 (첫 실행 시 정상 상태) |
| Claude duplicate review 호출 실패 | `claudeDuplicateReview.status = "failed"`, items = []. 추천 전체는 계속. `--render-only`로 markdown warning 표시 |
| possibleDuplicates 0개 | review skip. `status = "skipped"` 그대로. 보강 후보 섹션 "없음" 표시 |
| review 결과 schema 위반 | "failed" 처리 + stderr 로그. 추천 계속 |

## Why this design

ADR-026 결정 요약 (3줄):

1. **Python → TypeScript**: 모노레포 ts 표준 (_shared/lib, plan004 ADR-020) 일관성. 외부 RSS XML 파싱은 `fast-xml-parser`로 대체.
2. **알고리즘 결정론 보존**: 점수(RECENT_PENALTY/WEAK_AREA_BONUS/CARRYOVER) + mix target + cooldown 로직을 ts에 동등 이식. Python·ts 출력 diff=0 검증은 phase-02에서 별도 진행.
3. **replenish + promote + live-coding 흡수**: 이전 topic-pool-replenisher + dispatcher 3 case(recommend-topics / live-coding-dispatch / replenish-topics)를 단일 native 진입점으로 통합 — `claude -p "/study-topic-recommender"` 한 줄로 전체 아침 추천 흐름 완결.

## 호출 예시

```bash
# 일반 morning 추천
claude -p "/study-topic-recommender"

# live-coding seed 선택 포함
claude -p "/study-topic-recommender live-coding 1개 골라줘"

# openclaw 스케줄러 경유 (트리거 시점 정책은 외부)
openclaw schedule run study-topic-recommender
```
