# Phase 03 — 나머지 6 skill skill-creator 4축 강화 (skill 별 commit 분리)

## 목표

career-os 의 나머지 6 skill (12KB 미만, 한국어 완료) 에 `/skill-creator:skill-creator` 4축 검토를 적용하여 강화. 한국어 본문 보존, 압축은 *권장만 도출* (실제 압축 X — 모두 12KB 미만이라 즉각 압축 불요).

## 사전 조건

- phase-01 + phase-02 완료 (docs-audit + candidate-baseline-suggester 강화 패턴 정착).
- ai-nodes ADR-007 채택.

## 대상 skill

| 순번 | skill | 크기 |
|---|---|---|
| A | study-topic-recommender | 9300 bytes |
| B | study-pack-writer | 8113 bytes |
| C | interview-asset-writer | 8041 bytes |
| D | interview-prep-analyzer | 7483 bytes |
| E | position-recommender | 7037 bytes |
| F | interview-coffeechat-prep | 6552 bytes |

## 단계 (6 skill 각각 반복)

### 공통 절차 (skill A → B → C → D → E → F 순)

#### 1. 현 상태 파악

- 대상 SKILL.md 본문 + frontmatter 정독.
- references/ 안 파일 확인.

#### 2. skill-creator 4축 검토

Skill 도구로 invoke. 산출물 `career-os/tasks/plan028-skill-creator-audit/audit/phase-03-<skill-name>-skill-creator-report.md`.

#### 3. 강화안 적용

- trigger keyword 보강 (누락된 자연어 trigger 추가).
- workflow 명확도 — sub-step 명료화.
- boundary 누락 — do/don't 명시.
- 압축은 *권장만 audit 에 기록*, 실제 적용 X (12KB 미만이라 즉각 압축 불요).

#### 4. commit

skill 별 분리:

- A: `docs(career-os): study-topic-recommender SKILL.md skill-creator 강화 (plan028 phase-03-A)`
- B: `docs(career-os): study-pack-writer SKILL.md skill-creator 강화 (plan028 phase-03-B)`
- C: `docs(career-os): interview-asset-writer SKILL.md skill-creator 강화 (plan028 phase-03-C)`
- D: `docs(career-os): interview-prep-analyzer SKILL.md skill-creator 강화 (plan028 phase-03-D)`
- E: `docs(career-os): position-recommender SKILL.md skill-creator 강화 (plan028 phase-03-E)`
- F: `docs(career-os): interview-coffeechat-prep SKILL.md skill-creator 강화 (plan028 phase-03-F)`

## 검증 기준 (성공 조건)

- 6 skill 모두 skill-creator 4축 리포트 audit/ 에 저장됨.
- 강화안 적용 — trigger keyword / workflow / boundary 3축 중 *최소 1축* 개선.
- 한국어 본문 의미 보존 (drift 0).
- skill discovery 매칭 동작 확인 (각 슬래시 명령).
- git: 6 commit 분리.

## 산출물

- 6 skill `SKILL.md` (강화)
- 6 audit 리포트 (`audit/phase-03-<skill>-skill-creator-report.md`)

## 차단 조건 (block)

- skill-creator 가 *큰 구조 변경* 제안 (디렉터리 분리, mode 분기 등) → 사용자 확인 후 결정.
- interview-coffeechat-prep 의 description 패턴 (ADR-007 결정 1 의 *표준 사례*) 변경 권장 → 거절.

## critic / verify 사전 해소

common-pitfalls.md 섹션 1~5:

- 1 모호한 명세 X — 6 skill 동일 패턴 명시.
- 2 산출물 위치 명시 ✓.
- 3 검증 기준 명시 (최소 1축 개선) ✓.
- 4 phase-01 + phase-02 의존성 명시 ✓.
- 5 한국어 본문 보존 명시.

## 의도적으로 안 하는 것

- 한국어 본문 리라이트 X.
- skill 본문 의미·정책 변경 X.
- 압축 실제 적용 X — 권장만 audit 에 기록.
- skill 디렉터리 구조 변경 X.
- interview-coffeechat-prep 의 description 패턴 변경 X (ADR-007 표준 사례).
