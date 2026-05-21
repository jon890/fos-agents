# Phase 01 — stock-investment 3 skill 한국어화 + skill-creator 강화

## 목표

stock-investment 의 3 skill SKILL.md + references/*.md 를 ai-nodes ADR-007 표준 따라 전면 한국어화하고, `/skill-creator:skill-creator` 4축 검토 결과를 동시 적용한다. 3 skill 모두 ~1.5KB 작아서 단일 phase 처리, 단 commit 은 skill 별 분리.

## 사전 조건

- ai-nodes/docs/adr.md ADR-007 채택.
- ai-nodes/docs/docs-style.md "8가지 형식 패턴" 숙지.
- 참조 패턴: `career-os/.claude/skills/interview-coffeechat-prep/SKILL.md` 또는 apartment plan008 phase-01 산출물 (선행 작업 시).

## 대상 skill

| 순번 | skill | 현재 크기 | 비고 |
|---|---|---|---|
| A | current-issue-analysis | 1111 bytes | 일회성/스케줄 심층 리포트 (CLARITY Act, 스테이블코인 등) |
| B | daily-stock-analysis-note | 1568 bytes | 일일 블로그 노트 (cron 09:00 트리거) |
| C | stock-investing-morning-brief | 1886 bytes | 일일 모닝 브리프 (cron 08:00 트리거) |

## 단계 (3 skill 각각 반복)

### 공통 절차 (skill A → B → C 순)

#### 1. 현 상태 파악

- 대상 SKILL.md 본문 + frontmatter 정독.
- references/ 안 파일 확인 (있으면).
- 영문 trigger keyword 추출 — 한국어 매핑 준비.
- cron 트리거 (`stock-investing-morning-brief`, `daily-stock-analysis-note`) 가 있는 skill 은 openclaw jobs.json 의 payload 와 정합 보존 — payload 가 명시한 trigger 와 description trigger phrase 일치 유지.

#### 2. skill-creator 4축 검토

Skill 도구로 `/skill-creator:skill-creator` invoke. 산출물을 `stock-investment/tasks/plan005-skill-korean-rewrite/audit/phase-01-<skill-name>-skill-creator-report.md` 에 저장.

#### 3. 한국어화 + 강화 적용

- frontmatter `description` 한국어 본문 + 따옴표 trigger phrase + 슬래시 명령. 미국 주식·암호화폐 종목 코드 (CRCL, BTC, GOOGL, QQQ 등) 는 영문 유지.
- 본문 H2 헤더 한국어.
- prose 한국어, 기술 식별자 영문 유지.
- docs-style.md 8 패턴 적용.

#### 4. commit

skill 별 분리:

- A: `docs(stock-investment): current-issue-analysis SKILL.md 한국어화 + skill-creator 강화 (plan005 phase-01-A)`
- B: `docs(stock-investment): daily-stock-analysis-note SKILL.md 한국어화 + skill-creator 강화 (plan005 phase-01-B)`
- C: `docs(stock-investment): stock-investing-morning-brief SKILL.md 한국어화 + skill-creator 강화 (plan005 phase-01-C)`

## 검증 기준 (성공 조건)

- 3 skill SKILL.md frontmatter `name` 만 영문, `description` 한국어 (종목 코드 영문 보조).
- 본문 + references/*.md 한국어 prose.
- skill-creator 4축 리포트 3개 audit/ 에 저장됨.
- skill discovery 매칭 — `claude -p "/stock-investing-morning-brief"` 슬래시 명령 동작 확인.
- openclaw cron payload (87efe34a `stock-investing-morning-brief-0800`, b88e9a4d `daily-ai-tech-stock-blog-note`) 와의 trigger 정합 유지.
- git: 3 commit 분리.

## 산출물

- `stock-investment/.claude/skills/current-issue-analysis/SKILL.md` (한국어 + 강화)
- `stock-investment/.claude/skills/daily-stock-analysis-note/SKILL.md` (한국어 + 강화)
- `stock-investment/.claude/skills/stock-investing-morning-brief/SKILL.md` (한국어 + 강화)
- (각 skill 의) references/*.md 한국어
- audit/phase-01-{current-issue-analysis, daily-stock-analysis-note, stock-investing-morning-brief}-skill-creator-report.md 3 파일

## 차단 조건 (block)

- skill-creator 가 *cron payload 변경* 권장 → 본 plan 범위 밖, 별도 task 로 이관.
- 종목 코드 / 영문 기술 용어 한국어화 권장 → 거절 (기술 식별자 보존 원칙).

## critic / verify 사전 해소

common-pitfalls.md 섹션 1~5:

- 1 모호한 명세 X — 3 skill 동일 패턴 + cron 정합 명시.
- 2 산출물 위치 명시 ✓.
- 3 검증 기준 명시 ✓.
- 4 ADR-007 / docs-style.md / cron 정합 의존성 명시 ✓.
- 5 종목 코드 보존 명시 — 한국어화 함정 회피.

## 의도적으로 안 하는 것

- 다른 워크스페이스 영향 X.
- openclaw cron payload 변경 X (별도 task 책임).
- 외부 npm 의존 추가 X.
- skill 본문 의미·정책 변경 X.
- 종목 코드 / API 식별자 한국어화 금지.
