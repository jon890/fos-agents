# plan093 결정 — config/state 재구조화 + 용어 정리

career-os의 폴더 구조와 용어를 사용자와 walkthrough로 재정의한 결과다.
plan093의 실행 계약이며, Phase 01에서 이 결정을 ADR로 고정한 뒤 구현한다.

## 핵심 원칙 — config vs state 구분 기준

"누가 타이핑했나"가 아니라 **"이 파일이 바뀌는 트리거가 무엇인가"**로 가른다.
(모든 config 값도 LLM 대화로 작성되므로 타이핑 주체로는 안 갈린다.)

- **config** — 바뀌는 계기가 **사용자의 의도·결정**. 드물게 변경, 사람이 검토·승인, 프롬프트 주입 대상. (소스코드/설정에 해당)
- **state** — 바뀌는 계기가 **시스템 실행·이벤트**. 자주·자동 갱신, 매번 검토 안 함, 실행 산물. 프롬프트에 통째 주입하지 않음. (DB row/로그에 해당)

## Top-level 구조 (data/ 해체)

| 버킷 | 성격 | 대표 내용 |
|---|---|---|
| `config/` | 사용자 의도·정책·사실 | candidate-profile(+detail+provenance), position-collection, verified-company(priorityCompanies·preferenceExcluded), external-reading-sources, study-preferences, study-pack-topics, topic-profiles, question-bank-topics, live-coding-seed-*, baseline-core-files, resume-design, candidate-config |
| `state/` | 시스템 실행·이벤트 산물 | positions-queue.jsonl(옛 ledger), study-progress, drill-progress, mvp-target, topic-inventory(+history), study-pack-candidates, drill-log-*, company-cooldown.json(verified에서 분리) |
| `applications/` | 지원 건별 작업 문서 | `<company>/<role>/{posting,fit-analysis,application-package,resume-draft,cover-letter,submission-checklist,review}.md` |
| `reports/` | 인간용 생성물 | daily 리포트, `reports/latest/`(옛 mirror), `reports/downloads/`, morning-topic-recommendation.md, job-fit-*.md, baseline |
| `cache/` | 재생성 캐시(gitignore) | live-position-postings.md(snapshot), feed-cache/ |

## 용어 변경

| 옛 표현 | 새 표현 | 이유 |
|---|---|---|
| `ledger` / `ledger.jsonl` | `positions-queue` / `state/positions-queue.jsonl` | ledger가 과하게 넓음. 내가 밀고 있는 포지션들의 지속 큐. |
| `ledger_io.ts`·`ledger_schema.ts` + `ledger*` 심볼 | `positions_queue_io.ts`·`positions_queue_schema.ts` + `positionsQueue*` 심볼 | 코드 식별자도 함께 rename(M2=A). 데이터 파일명과 코드 심볼을 한 용어로 통일. |
| "승격(promote)" | "등록" | frontdoor-queue(대기열) 폐기로 승격 맥락 사라짐. 추천 후보를 positions-queue에 등록. |
| `frontdoor-queue.jsonl` + `frontdoor_queue_*.ts`·`promote_frontdoor_candidate.ts` | 제거(legacy 확정) | 대기열 단계 없앰. 추천 → 선택 → positions-queue 등록. 코드까지 제거(M2=A). |

## 코드 rename 범위 — 이 plan 포함 (2026-07-08 사용자 결정 M2=A)

용어 변경이 데이터 경로·산문뿐 아니라 **코드 심볼·파일명까지** 미친다.

- **하는 것**: `ledger_io.ts`·`ledger_schema.ts` → `positions_queue_*` git mv + 심볼(`Ledger`→`PositionsQueue` 계열) rename + import 참조 갱신. frontdoor 코드(`frontdoor_queue_builder.ts`·`frontdoor_queue_io.ts`·`frontdoor_queue_schema.ts`·`promote_frontdoor_candidate.ts`) git rm + application-agent flow에서 frontdoor 의존 제거. 승격→등록 용어를 코드 식별자·주석·docs 산문 전반에서 교체.
- **주의**: frontdoor는 `apply_position_action_request`·`apply_priority_request`·`priority_recommendation`·`priority_view`·`run.ts` 등 8+ 파일에 얽혀 있다(단순 파일 삭제 아님). 호출 흐름을 끊고 `bun --check` + application-agent smoke로 검증한다.
- **원자적 분리**: Phase 06(ledger rename) / Phase 07(frontdoor 제거 + 등록 용어)로 관심사를 나눠 각각 commit.

## 애매 항목 확정

- `verified-company-research-targets.json`: **cooldown만 `state/company-cooldown.json`으로 분리**(지원 결과 이벤트로 갱신 = state). priorityCompanies·preferenceExcluded는 config 유지. → ADR-095 재검토 필요.
- `morning-topic-recommendation.md`: **reports/** (사람이 읽는 생성물).
- `study-pack-candidates.json`: **state/** (시스템이 replenish로 채우는 풀).
- `mvp-target.json`: **state/** (탈락 시 루프가 primary→history 자동 갱신).

## 파일 이동표 (초안 — Phase 01에서 전수 확정)

| 현재 | → 새 위치 |
|---|---|
| `data/applications/ledger.jsonl` | `state/positions-queue.jsonl` |
| `data/applications/<co>/<role>/*.md` | `applications/<co>/<role>/*.md` |
| `config/study-progress.json`·`drill-progress.json`·`mvp-target.json`·`study-pack-candidates.json` | `state/` |
| `verified-company-research-targets.json` cooldown 항목 | `state/company-cooldown.json` |
| `data/runtime/topic-inventory.json`·`topic-inventory-history.jsonl`·`drill-log-*.jsonl` | `state/` |
| `data/reports/daily/**`·`job-fit-*.md`·`baseline` | `reports/` |
| `data/runtime/morning-topic-recommendation.md` | `reports/` |
| `data/runtime/position-recommendation.{json,md,html}` (mirror) | `reports/latest/` |
| `data/runtime/downloads/**` | `reports/downloads/` |
| `data/runtime/live-position-postings.md`·`feed-cache/` | `cache/` |
| `data/runtime/data/reports`(stray)·`position-recommendation-items.json`(ADR-101 폐기) | 삭제 |

## 스코프 주의

- 경로가 SKILL·scripts·docs·ADR·.gitignore 수십 곳에 박혀 있다. config만 고치면 나머지가 깨진 참조로 남는다(plan092에서 겪음).
- 파괴적 이동 전 Phase 01에서 ADR로 결정을 고정하고, 파일별 전수 이동표를 완성한다.

## runtime 데이터 마이그레이션 — 이 plan 범위 밖 (2026-07-08 사용자 결정)

실측: `.gitignore:16` 의 `**/data/` 로 `data/` 전체가 untracked runtime이다.
`data/applications/`·`data/reports/`·`data/runtime/` 의 실파일은 git 밖이고, worktree에는 존재하지 않는다(main 워킹 디렉터리에만 있음).
따라서 이 plan은 **경로 규약(convention)과 tracked 자산만** 바꾼다. untracked 실데이터의 물리 이동은 하지 않는다.

- **하는 것**: 신규 ADR·5 live docs 갱신, `.gitignore` 재작성(`**/data/` → `state/`·`reports/`·`cache/`·`applications/` 경계), tracked `config/*.json` → `state/` git mv + cooldown 분리, SKILL·scripts·docs의 경로/용어 참조 갱신.
- **하지 않는 것**: `data/**` untracked 실파일의 물리 이동, 마이그레이션 스크립트 실행. 옛 실데이터는 사용자가 이후 직접 이전하거나 다음 실행 시 새 경로로 재생성된다.
- **이동표의 "git mv" 문구 해석**: tracked 파일(config/*.json 등)에만 git mv를 적용한다. untracked `data/**` 항목은 물리 이동 대신 **참조 갱신 + gitignore 경계 반영**으로만 실현한다.
- **성공 기준 조정**: 구현 phase의 "새 경로로 실행 성공"은 worktree에서 `bun --check` + 스크립트가 새 경로 파일 부재를 graceful 처리(크래시 없음) + 옛 경로 참조 0 grep으로 대체한다. 실런타임 데이터 검증은 이 plan 밖.
- **ADR 반영**: Phase 01의 5버킷 ADR에 "runtime 실데이터 마이그레이션은 별도 후속" 을 명시한다.
