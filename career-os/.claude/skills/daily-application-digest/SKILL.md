---
name: daily-application-digest
description: 지원 현황 일일 요약 skill. ledger.jsonl과 오늘 변경된 application 산출물을 읽어 상태 변화·사용자 승인 필요 항목·agent-only 작업·부족 역량·오늘의 공부/면접 대비 액션을 정리하고 report.md를 생성한다. Discord 전송은 하지 않음 — cron/runner에서 별도 전송. '오늘 지원 현황 요약', '지원 digest', 'application 일일 리포트', '/daily-application-digest' 슬래시 호출.
---

# Daily Application Digest

application ledger 전체를 읽어 오늘의 지원 현황을 요약하는 비공개 career-os skill.
사용자 승인 필요 항목과 agent-only 작업을 분리하고, 직무별 부족 역량과 오늘의 액션을 제안한다.

## When to use

- 슬래시 호출: `/daily-application-digest [YYYY-MM-DD]`
- 자연어 요청: "오늘 지원 현황 요약해줘", "지원 digest 만들어줘", "application 일일 리포트", "지원 상태 어때"
- 매일 아침 또는 저녁 review 시점에 호출

실제 지원서 제출·로그인·채용 사이트 접속 자동화 안 함 — 사용자 승인 필요 항목으로만 안내.
Discord 전송 안 함 — cron/runner에서 `_shared/lib/notify_discord.ts`로 별도 전송.
`sources/fos-study/`에 아무것도 쓰지 않음.

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/data/applications/ledger.jsonl` — 전체 지원 이력 원장 (필수)
2. 각 applicationDir의 파일 (존재하는 것만):
   - `posting.md` — 공고 본문
   - `fit-analysis.md` — fit 분석 + Gap 항목
   - `application-package.md` — 지원 패키지 초안 + needs_evidence 목록
   - `review.md` — 심사 판정 (pass/revise/blocked)
3. `career-os/data/runtime/position-recommendation.md` — 선택. 새 공고 후보 확인 시 참조.
4. `career-os/data/runtime/morning-topic-recommendation.md` — 선택. 오늘의 학습 추천 연계 시 참조.

## Workflow

### 1. 날짜 결정

자연어에서 날짜를 추출한다.

- 예: `/daily-application-digest 2026-05-22` → date = `2026-05-22`
- 날짜 없으면 오늘 날짜(`YYYY-MM-DD`)를 사용.

출력 경로: `career-os/data/reports/daily/<date>/application-digest/report.md`

### 2. ledger 로드 및 applicationDir 목록 수집

`career-os/data/applications/ledger.jsonl`을 Read한다.

각 줄을 JSON 파싱해 다음 필드를 수집:

| 필드 | 용도 |
|---|---|
| `id` | 식별자 |
| `company` / `role` | 표시용 |
| `status` | 현재 단계 |
| `statusUpdatedAt` | 상태 변경 시각 |
| `applicationDir` | 산출물 경로 루트 |
| `needsUserReview` | 사용자 검토 필요 여부 |
| `userDecision` | pending/approved/rejected |
| `riskFlags` | 리스크 플래그 배열 |
| `nextActions` | 다음 예정 작업 |
| `revisionCount` / `maxRevisionCount` | 수정 횟수 제한 |

### 3. 각 applicationDir 파일 확인

각 entry의 `applicationDir` 기준으로 다음 파일을 Read한다:

```
career-os/<applicationDir>/posting.md
career-os/<applicationDir>/fit-analysis.md
career-os/<applicationDir>/application-package.md
career-os/<applicationDir>/review.md
```

존재하지 않는 파일은 skip (stderr warn). 모든 파일이 없어도 ledger 정보만으로 요약 진행.

각 파일에서 추출:

- **posting.md**: company, role, riskFlags, 공고 마감일(있으면)
- **fit-analysis.md**: Gap 분석 항목 + `needs_evidence` 개수 + Risk Flags
- **application-package.md**: needs_evidence 항목 목록 + Ledger Update Suggestion 섹션
- **review.md**: Verdict (result / confidence) + User Approval Gate 항목 + Revision Requests

### 4. 오늘 변경 파일 식별

오늘 날짜(`date`)를 기준으로 `statusUpdatedAt`이 오늘인 항목을 "오늘 상태 변경"으로 표시.

파일 시스템 mtime 확인은 하지 않는다 — ledger `statusUpdatedAt` 필드로만 판단.

### 5. 사용자 승인 필요 항목 분리

다음 조건 중 하나라도 해당하면 `Needs User Approval` 섹션에 포함:

- `needsUserReview: true`
- `userDecision: pending` + 실제 제출 가능 상태(`status`가 `ready_for_user_review` 이상)
- `riskFlags`에 `toss_group_cooldown` / `duplicate_application` 등 사용자 판단 필요 플래그 존재
- review.md Verdict `blocked`이고 차단 해제가 사용자 확인 사항인 경우
- 외부 제출 / 채용 사이트 로그인 / 쿨다운 수용 여부 결정이 필요한 경우

다음은 `Agent-Only Next Work` 섹션에 포함:

- `nextActions`에 `fit_analysis` / `review_application_package` / `run_application_reviewer` 등 내부 skill 연계 작업
- review.md의 `revise` 판정에서 agent 수정 가능 항목
- evidence 수집 자동화 가능 항목 (draft revise, study-pack 후보 생성 등)
- `revisionCount < maxRevisionCount`이면 재시도 가능 판단

### 6. 공개/비공개 분리

다음은 `Public-Safe Study Candidates`에 포함:

- fit-analysis.md Gap 분석에서 추출한 **순수 기술 학습 주제** (LangGraph, Evaluation Framework 설계 패턴 등)
- application-package.md의 면접 대비 포인트에서 추출한 기술 토픽
- 특정 회사 이름·지원 전략·이력서 문구는 절대 포함하지 않음

다음은 `Private Strategy Notes`에 포함:

- 포지셔닝 전환 전략 (요약만 — Discord 요약에 길게 노출 금지)
- 쿨다운 리스크 + 지원 우선순위 판단
- needs_evidence 항목 보강 전략
- 이력서 맞춤 문구 초안

### 7. Gap Focus + 오늘의 액션 제안

fit-analysis.md의 Gap 분석에서 **해당 공고 기준 부족 역량 상위 3개**를 추출한다.

우선순위 기준:
1. 필수 요건 직접 충족 실패 (`needs_evidence` 항목 중 필수 요건)
2. `production_agent_gap` 등 riskFlag로 명시된 Gap
3. 우대 사항 Gap (필수보다 낮은 우선순위)

오늘의 공부/면접 대비 액션 1~3개 제안:

- Gap Focus에서 도출한 보강 가능한 항목
- 당장 학습 가능한 기술 토픽 (study-pack-writer로 연계 가능한 것)
- interview-prep-analyzer로 심화 분석 가능한 항목

### 8. report.md 작성

저장 경로: `career-os/data/reports/daily/<date>/application-digest/report.md`

**필수 섹션 10개:**

```markdown
# <date> Application Digest

## Executive Summary

## Application Status

## New / Updated Artifacts

## Needs User Approval

## Agent-Only Next Work

## Gap Focus

## Study / Interview Actions

## Public-Safe Study Candidates

## Private Strategy Notes

## Discord Summary Draft
```

작성 규칙:

- `Needs User Approval`: 외부 제출, 로그인, 채용 계정 작업, 쿨다운 판단, 실제 지원 여부 결정만. 항목별 근거(riskFlag / review.md 섹션) 명시.
- `Agent-Only Next Work`: 리뷰 재실행, evidence 수집, skill 연계, draft revise 같은 내부 작업만. 실행 예시 커맨드 병기 권장.
- `Public-Safe Study Candidates`: 기술 학습 주제만. 회사명·이력서 문구·맞춤 지원 전략 제외.
- `Private Strategy Notes`: 비공개 전략 메모 (짧게). Discord 요약에 길게 노출 금지.
- `Discord Summary Draft`: 6줄 내외. 오늘 상태 변화 + 승인 필요 항목 요약 + 오늘의 액션 1줄. 민감한 이력서 문구 노출 금지.
- 총 20줄 이상.
- `sources/fos-study/`에 쓰지 않음.

### 9. Self-check (최대 3회)

report.md 작성 후 아래 항목 검증. 실패 시 해당 섹션 재작성:

1. `report.md` 줄 수 ≥ 20
2. 필수 10개 섹션 헤더 모두 존재
3. `Needs User Approval`과 `Agent-Only Next Work` 섹션이 각각 존재하고 내용이 있음
4. `Public-Safe Study Candidates`에 회사명 / 이력서 문구가 없음
5. `Discord Summary Draft`가 6줄 이내이고 민감한 맞춤 문구를 포함하지 않음
6. `sources/fos-study/` 아래 어떤 파일도 쓰지 않았는지 확인
7. 외부 Discord 전송 실행 지시가 없음 확인

실패 항목 있으면 수정 후 재작성. **최대 3회**. 4회째도 실패 시 `stderr: daily-application-digest 검증 실패: <항목>` + exit 1.

## Error handling

| 상황 | 처리 |
|---|---|
| `ledger.jsonl` 부재 | stderr + exit 1 |
| applicationDir 내 모든 파일 부재 | stderr warn + ledger 정보만으로 요약 진행 |
| fit-analysis.md / review.md 부재 | stderr warn + 해당 섹션 "파일 없음" 표시 |
| 출력 디렉터리 생성 실패 | stderr + exit 1 |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |

## Discord 전송 연계

Discord 전송은 이 skill에서 직접 수행하지 않는다.

cron/runner에서 아래 패턴으로 별도 전송:

```bash
# report.md 생성 후 Discord 전송 (runner 책임)
SUMMARY=$(grep -A 10 "## Discord Summary Draft" \
  career-os/data/reports/daily/$(date +%Y-%m-%d)/application-digest/report.md \
  | tail -n +2)

bun --env-file=career-os/.env \
  _shared/lib/notify_discord.ts \
  --channel "$DISCORD_CHANNEL_ID" \
  --message "$SUMMARY"
```

`DISCORD_CHANNEL_ID` env는 `career-os/.env`에서 로드 (ADR-021).

## Why this design

- **생성·검토·요약 3단 분리**: application-package-writer(생성) → application-reviewer(검토) → daily-application-digest(요약). 각 skill은 단일 책임.
- **승인 게이트 명시**: 외부 제출·로그인처럼 agent가 자동 처리할 수 없는 항목을 `Needs User Approval` 섹션으로 격리 — 사용자가 한 섹션만 보면 오늘 결정해야 할 것을 파악.
- **공개/비공개 분리 강제**: `Public-Safe Study Candidates`와 `Private Strategy Notes`를 별도 섹션으로 강제 — 회사 맞춤 전략이 fos-study 같은 공개 채널로 흘러들어가는 것을 구조적으로 차단.
- **Discord 전송 분리**: skill이 외부 전송까지 책임지면 dry-run / 테스트 시 실수로 전송되는 리스크 발생. cron/runner가 전송 책임 — skill은 report만 생성.
- **ledger 직접 갱신 금지**: 상태 업데이트 제안은 `Ledger Update Suggestion` 패턴으로 (ADR-032). report.md 안에서 제안만 — 직접 수정은 사용자 확인 후.

## References

- `career-os/docs/adr.md` — ADR-032 (ledger 직접 갱신 금지), ADR-021 (Discord notify_discord.ts)
- `career-os/docs/data-schema.md` — ledger.jsonl 스키마
- `career-os/data/applications/ledger.jsonl` — 지원 이력 원장
- `career-os/.claude/skills/application-package-writer/SKILL.md` — 생성 단계 (Phase 04)
- `career-os/.claude/skills/application-reviewer/SKILL.md` — 검토 단계 (Phase 05)
- `_shared/lib/notify_discord.ts` — Discord 전송 유틸리티 (cron/runner에서 사용)
