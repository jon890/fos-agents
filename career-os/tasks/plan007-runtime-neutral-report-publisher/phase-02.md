# Phase 02 — position-recommender에 Hermes 게시 경로 연결 및 검증

**Execution profile**: standard
**Status**: pending

---

## 목표

`position-recommender`가 HTML을 만든 뒤, 사용자가 명시적으로 공개 업로드를 원할 때만
공용 `/report-publisher` skill로 Cloudflare Pages 게시를 넘기도록 만든다.

**범위 외**: 추천 스키마 변경, live-postings 수집 변경, Cloudflare 인증 자체 수정.

---

## 작업 항목 (3)

### 1. `career-os/.claude/skills/position-recommender/references/report-publishing.md` — 게시 절차 분리

- 공개 HTML 게시에 필요한 입력과 가드만 짧은 reference 로 분리한다.
- `reports/downloads/position-recommendation-all-YYYY-MM-DD.html`을 게시 대상으로 사용한다.
- `Use skill: /report-publisher`와 slug 규칙을 적는다.

### 2. `career-os/.claude/skills/position-recommender/SKILL.md` — 게시 단계 연결

- HTML 생성 뒤의 optional publish 분기를 추가한다.
- Hermes/Cloudflare 환경에서 `report-publisher` skill을 호출하는 문장을 넣는다.
- 공개 업로드가 사용자 승인 전에는 실행되지 않는다는 경계를 유지한다.

### 3. `career-os/docs/flow.md` — 사용자 흐름과 외부 게시 연결

- `/position-recommender` 흐름에 선택적 Cloudflare Pages 게시 단계를 추가한다.
- 최종 공유 링크는 `report-publisher`가 반환한 검증된 URL을 사용한다고 명시한다.
- 공개 업로드가 아닌 내부 리포트 생성만 수행하는 경우 기존 흐름을 유지한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/position-recommender/references/report-publishing.md` | Hermes/Codex 공통 게시 절차 분리 |
| `career-os/.claude/skills/position-recommender/SKILL.md` | publish handoff 추가 |
| `career-os/docs/flow.md` | 선택적 Cloudflare Pages 게시 단계 추가 |

## 검증

```bash
# cwd: ai-nodes root
cd "$(git rev-parse --show-toplevel)"
python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/position-recommender
python3 /Users/nhn/.claude/skills/planning/scripts/verify-task.sh plan007-runtime-neutral-report-publisher
rg -n "report-publishing|/report-publisher|Cloudflare Pages|사용자 승인" \
  career-os/.claude/skills/position-recommender career-os/docs/flow.md
git diff --check -- career-os/.claude/skills/position-recommender career-os/docs/flow.md
```

성공하면 `tasks/plan007-runtime-neutral-report-publisher/index.json`의 `status`와 마지막 phase 상태를 `completed`로 마킹한다.

## 의도 메모 (왜)

- 게시 절차를 별도 reference로 분리해야 `position-recommender` 본문이 길어지지 않고, Hermes와 Codex가 같은 upload contract를 공유할 수 있다.
- 공개 업로드는 기존 정책상 사용자 승인 경계가 있으므로, 생성과 게시를 분리해야 자동 실행이 과도하게 확장되지 않는다.

## Blocked 조건 (선택)

- publish handoff가 다른 위치와 충돌하면 `PHASE_BLOCKED: report publishing contract drift`로 종료한다.
- `verify-task.sh`가 실패하면 먼저 task 형식을 고친 뒤 다시 검증한다.
