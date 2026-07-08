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
| "승격(promote)" | "등록" | frontdoor-queue(대기열) 폐기로 승격 맥락 사라짐. 추천 후보를 positions-queue에 등록. |
| `frontdoor-queue.jsonl` | 제거(legacy 확정) | 대기열 단계 없앰. 추천 → 선택 → positions-queue 등록. |

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
