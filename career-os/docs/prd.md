# PRD — career-os

career-os 워크스페이스의 **제품 범위·MVP 기능 명세**. 현재 active 워크플로의 단일 출처. 새 기능을 추가하거나 우선순위를 정할 때 이 문서가 기준.

런타임 상태(어느 명령이 최근에 잘 도는지, 무엇이 멈췄는지)는 여기에 박지 않는다 — `logs/task-runs.jsonl`이 단일 출처이고 `skills/workspace-audit`가 그때그때 보고한다.

## 목적

면접 준비·커리어 분석 자동화. 단일 후보자(=본인)의 면접 대비 사이클을 매일 재실행 가능한 로컬 워크플로로 묶는다.

## 현재 MVP 타깃

`config/mvp-target.json`이 **단일 출처**. `primary`가 현재 집중 타깃, `history`가 폐기된 과거 타깃. 회사명·팀명·면접 일자를 이 문서나 다른 markdown에 박지 않는다 — JSON 한 곳만 수정해서 전환.

## 사용자

후보자 본인 1인. 매일 아침 모닝 추천을 받고, 그 안에서 골라 study-pack / question-bank 같은 학습·면접 자산을 만든다.

## 기능 목록 (14개 dispatch 명령)

`scripts/command-router/run_now.sh`가 단일 진입점(plan006 후, ADR-019). 모든 명령은 `_shared/bin/track_task.sh`로 래핑되어 토큰·비용·duration이 `logs/task-runs.jsonl`에 자동 기록됨.

| 명령 | 산출물 | 외부 git push | 빈도 |
|---|---|---|---|
| `baseline` | 큐레이션된 10개 파일 기반 약점 진단 리포트 (`data/reports/baseline/`) | 없음 | 면접 시즌 시작 시 1회 |
| `daily [topic]` | 일일 집중 리포트, 토픽 미지정 시 가장 오래된 약점 자동 선택 (`data/reports/daily/YYYY-MM-DD/`) | 없음 | 매일 (현재 정체) |
| `recommend-positions` | 활성 채용 공고 + 후보자 프로필 매칭 추천 (`data/runtime/position-recommendation.md`) | 없음 | 매일 |
| `recommend-topics` | 오전 학습 토픽 추천 (`data/runtime/morning-topic-recommendation.md`) | 없음 | 매일 |
| `replenish-topics` | 피드 소스로부터 토픽 풀 보충 (Python 내부 Claude 호출) | 없음 | 매일 |
| `study-pack <topic>` | 토픽 1개 풀 마크다운 스터디팩 → fos-study 푸시. overlap 점검 + update vs new 판단 + self-check 내장 (plan014에서 옛 `maintain-study-pack` 흡수) | ✓ | 토픽별 1회 또는 갱신 |
| `foodville-coffeechat` | CJ 푸드빌 커피챗 준비 + 백엔드 사이트 인사이트 리포트 | 없음 | 면접 단계별 |
| `smoke` | 최소 smoke 점검 (실행 검증용) | 없음 | 워크플로 변경 후 |
| `live-coding-dispatch` | live-coding seed pool에서 1개 선택 → study-pack 위임 | ✓ | 매일 (라이브 코딩 대비 시즌) |

## 산출물 경로 정책

- 외부 공유용 (블로그·인터뷰 자산): `sources/fos-study/` (git 동기 외부 저장소). study-pack / question-bank가 즉시 commit + push.
- 내부 실행 로그·중간 산출물: `data/reports/`, `data/runtime/`.
- 정규화 데이터: `data/normalized/` (fos-study 덤프 캐시 등).

ADR-005 참조 — 외부 공유 문서의 제목에 `[초안]` 표시, commit 메시지는 `docs(<domain>): add|update draft <topic> study pack` 형식.

## 비기능 요구사항

- **재실행 가능성**: 같은 날 같은 명령을 여러 번 돌려도 정합성 깨지지 않음 (날짜별 멱등).
- **토큰 회계**: 모든 Claude 호출 runner는 `_shared/bin/claude_lib.sh`의 `claude_persist_usage` 헬퍼로 usage 전파 (ADR-014). `logs/task-runs.jsonl`의 cost_usd / model 필드로 비용 추적.
- **알림**: 모든 task의 완료/실패는 Discord 알림 + 한 줄 cost summary (ADR-008 + ADR-014의 `format_cost_summary.py`).
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

## 알려진 후보 약점·강점 (현재)

면접 준비 일반에 유효 (타깃 회사 무관):

**보강 필요한 영역**: JPA N+1 처리, EXPLAIN 플랜 해석, 복합·커버링 인덱스 설계, Redis 캐싱 패턴, Kafka 실전 설계.

**이미 갖춘 강점**: B+Tree·인덱스 구조, InnoDB MVCC·잠금, Spring 트랜잭션 함정, 분산 트랜잭션 개념.

## 미연결 / 보류 항목

워크플로 그래프에 진입점이 없는 자산(deferred features). 다음 사이클에서 wire-up 또는 폐기 결정:

- `skills/position-recommender/scripts/collect_live_postings.py` — Wanted/Toss 공개 채용 수집기.
- `skills/position-recommender/scripts/publish_job_analysis.sh` — position 분석 결과 → fos-study 퍼블리시.

plan005(ADR-017)로 wire-up되는 항목 — `live-coding-dispatch` 명령으로 등재. (옛 `bootcamp-batch`는 plan014, `auto-question-bank`는 plan015에서 폐기 — 사용자가 직접 `claude -p "/study-pack <topic>"` 또는 `claude -p "/interview-asset <topic>"` 반복 호출하는 흐름으로 대체)

## 분해 대기 작업

- ADR 007 번호 충돌 (007a · 007b) 정리.
- workspace-level `scripts/` 구조 재편 — 모든 skill의 실행 파일을 `career-os/scripts/<name>/`로 이전, `skills/<name>/`은 SKILL.md + references만 (plan006 예정).
