# PRD — career-os

career-os 워크스페이스의 **제품 범위·MVP 기능 명세**. 현재 active 워크플로의 단일 출처. 새 기능을 추가하거나 우선순위를 정할 때 이 문서가 기준.

런타임 상태(어느 명령이 최근에 잘 도는지, 무엇이 멈췄는지)는 여기에 박지 않는다 — `logs/task-runs.jsonl`이 단일 출처이고 `skills/workspace-audit`가 그때그때 보고한다.

## 목적

면접 준비·커리어 분석 자동화. 단일 후보자(=본인)의 면접 대비 사이클을 매일 재실행 가능한 로컬 워크플로로 묶는다.

## 현재 MVP 타깃

`config/mvp-target.json`이 **단일 출처**. `primary`가 현재 집중 타깃, `history`가 폐기된 과거 타깃. 회사명·팀명·면접 일자를 이 문서나 다른 markdown에 박지 않는다 — JSON 한 곳만 수정해서 전환.

## 사용자

후보자 본인 1인. 매일 아침 모닝 추천을 받고, 그 안에서 골라 study-pack / question-bank 같은 학습·면접 자산을 만든다.

## 기능 목록

**dispatcher 폐기 완료 (plan023, ADR-031)** — 모든 진입점이 native skill `claude -p "/<skill>"` 직접 호출로 단일화됨.

| 명령 | 산출물 | 외부 git push | 빈도 |
|---|---|---|---|
| `/position-recommender` (native) | 선택적 활성 공고 자동 수집 + 후보자 프로필 매칭 추천. 강력 추천 / 도전 추천 / 보류·주의 3 티어. (`data/runtime/position-recommendation.md` + `data/reports/daily/YYYY-MM-DD/position-recommendation/report.md`) (ADR-030, plan022) | 없음 (비공개) | 매일 (36회/30일) |
| `/interview-coffeechat-prep [mode]` (native) | mvp-target.json `primary.interview.<mode>` 기업 사이트 자동 수집 + 후보자 프로필 결합 + Claude 분석 → 비공개 + public-safe 리포트 두 파일 (`data/reports/daily/YYYY-MM-DD/<report_slug>/{report.md, report-public.md}`). mode = coffeechat / first-round / final-round / offer-chat. default coffeechat (ADR-029, ADR-034 — plan021 → plan026) | 없음 | 면접 단계별 |
| `/interview-prep-analyzer` (native) | 면접 준비 갭 분석. baseline 모드: 큐레이션 10파일 + 7섹션 고위험 영역 도출 (`data/reports/baseline/YYYY-MM-DD/report.md`). daily 모드: 토픽 1개 3-5파일 + 5섹션 + study-progress.json 갱신 (`data/reports/daily/YYYY-MM-DD/report.md`). 자연어 분기 (ADR-027, plan017) | 없음 | baseline: 면접 시즌 시작 시. daily: 매일 |
| `/study-topic-recommender` (native) | 아침 토픽 추천 10픽 + 오늘의 3선 + **기존 문서 보강 후보** 섹션(최대 5개, ADR-033) (`data/runtime/morning-topic-recommendation.md`) + replenish + live-coding seed 선택 (ADR-026, plan016) | 없음 | 매일 |
| `/study-pack-writer <topic>` (native) | 토픽 1개 풀 마크다운 스터디팩 → fos-study 푸시. **duplicate guard(ADR-033)로 high/medium 중복은 새 파일 차단 → update-existing 전환** + self-check 내장 (plan014에서 옛 `maintain-study-pack` 흡수) | ✓ | 토픽별 1회 또는 갱신 |
| `/interview-asset-writer <topic>` (native) | 후보자 이력 중심 Q&A 질문 은행 + 마스터 플레이북 → fos-study 푸시 (plan015) | ✓ | 토픽별 1회 또는 갱신 |
| `/candidate-baseline-suggester` (native) | fos-study 학습 이력 기반으로 candidate-profile.md · baseline-core-files.json · study-progress.json weak_spots를 Append + 주석 마킹으로 갱신. audit trail → `data/runtime/profile-refresh-suggestions/YYYY-MM-DD/` (ADR-028, plan020) | 없음 | study-pack 5회 이상 누적 후 / 면접 시즌 시작 시. 최소 2주 1회 |

### 계획 중: application agent MVP (plan029)

`plan029-application-agent-mvp`는 기존 native skill들을 조립해 공고 탐색부터 지원 패키지 작성, evidence/drift 검토, daily digest, 제출 후 면접 대비까지 이어지는 지원 전후 케어 루프를 만든다.

MVP 원칙:

- 수집/분석/초안 작성/검토/daily digest는 자동화한다.
- 단계 전환에는 사용자 승인 게이트를 둔다.
- 각 단계 내부에서는 agent가 `draft -> review -> revise` 루프를 최대 3회 수행한다.
- 실제 제출 자동화는 MVP 범위 밖이다. 최종 제출 버튼은 수동 승인 필수.
- 공고별 지원 전략은 `data/applications/` 비공개 산출물로 저장한다.
- 공개 가능한 순수 기술 학습 자료만 기존 `study-pack-writer` 정책으로 `sources/fos-study/`에 발행한다.

첫 fixture는 TossPlace `Applied AI Engineer` 공고다. 이 공고는 Toss 계열 쿨다운을 고려해 실제 지원 목적이 아니라 MVP 검증용 샘플로 사용한다.

## 산출물 경로 정책

- 외부 공유용 (블로그·인터뷰 자산): `sources/fos-study/` (git 동기 외부 저장소). study-pack / question-bank가 즉시 commit + push.
- 내부 실행 로그·중간 산출물: `data/reports/`, `data/runtime/`.
- 공고별 지원 전략·맞춤 이력서·검토 결과: `data/applications/` (plan029, 비공개)
- 정규화 데이터: `data/normalized/` (fos-study 덤프 캐시 등).

ADR-005 참조 — 외부 공유 문서의 제목에 `[초안]` 표시, commit 메시지는 `docs(<domain>): add|update draft <topic> study pack` 형식.

## 비기능 요구사항

- **재실행 가능성**: 같은 날 같은 명령을 여러 번 돌려도 정합성 깨지지 않음 (날짜별 멱등).
- **토큰 회계**: `logs/task-runs.jsonl`의 cost_usd / model / tokens_* 필드로 비용 추적 (ADR-014).
- **알림**: 모든 task의 완료/실패는 Discord 알림 + cost summary (ADR-008 + ADR-014).
- **격리**: 다른 워크스페이스(apartment, stock-investment, travel)와 자산 교차 참조 없음.
- **비밀**: `config/.env`에 GitHub token, Discord webhook 등.

## 의도적으로 안 하는 것

- 광범위 풀-리포 분석. baseline은 큐레이션된 10개로 제한 (ADR-003).
- 사용자 개입 없는 fos-study 자동 publish. study-pack 종류만 commit/push, baseline/daily는 로컬에만.
- 토픽 자동 promotion에 사용자 검토 우회 — Claude는 제안만, 로컬 validator가 게이트 (ADR-011).
- 회사명·면접일을 docs/code에 박기 — `config/mvp-target.json`이 단일 출처.

## 성공 기준

- 매일 morning 추천 + 오늘의 3선이 4축(백엔드/기술블로그/AI/geek)에서 새 내용으로 나옴 (ADR-012/013).
- 면접 직전 baseline / daily 사이클이 약점 갱신을 반영.
- 비용·모델 추이가 `logs/task-runs.jsonl`로 추적 가능 (ADR-014).
- 모든 study-pack / question-bank 산출물이 fos-study에 자동 push되어 외부에서 바로 열람 가능.

> **후보자 약점·강점 정보 위치**: 본 prd.md(제품 문서)에서는 다루지 않는다. 후보자 데이터는 `config/candidate-profile.md` "입증된 강점" / "약점 / 학습 중인 영역" 섹션 + `data/study-progress.json` `weak_spots` 맵이 단일 출처.

## 미연결 / 보류 항목

워크플로 그래프에 진입점이 없는 자산(deferred features). 다음 사이클에서 wire-up 또는 폐기 결정:

(옛 `live-coding-dispatch`는 plan016에서 study-topic-recommender native skill로 흡수됨. `bootcamp-batch`는 plan014, `auto-question-bank`는 plan015에서 폐기 — 사용자가 직접 `claude -p "/study-pack-writer <topic>"` 또는 `claude -p "/interview-asset-writer <topic>"` 반복 호출하는 흐름으로 대체. `collect_live_postings.py` + `publish_job_analysis.sh` + `run_position_recommendation.sh` + `extract_position_report.ts`는 plan022에서 폐기 — /position-recommender native skill로 흡수)

## 분해 대기 작업

현재 분해 대기 항목 없음. 새 백로그는 GitHub issue (`jon890/fos-claw`) 또는 본 섹션에 추가.

(이전 항목들은 plan006/plan018/plan023에서 모두 처리됨 — workspace scripts/ 분리(ADR-019), adr.md Quick Index, drift된 ADR Status 표기 컨벤션, ADR-007 단일 번호 정리. plan023 post-merge cleanup 시 본 섹션 정리.)
