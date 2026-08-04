# Phase 01 — 공용 report-publisher를 Hermes/Codex 공통 계약으로 전환

**Execution profile**: standard
**Status**: pending

---

## 목표

공개 HTML 리포트 게시의 정본을 Codex 전용 설명에서 runtime-neutral 계약으로 바꾸고,
Hermes가 같은 skill을 읽을 수 있는 환경 변수 계약을 명시한다.

**범위 외**: `position-recommender`의 호출 흐름, career-os 추천 로직, Cloudflare 계정 자체 설정 변경.

---

## 작업 항목 (3)

### 1. `.agents/skills/report-publisher/SKILL.md` — Hermes 로드 가능한 frontmatter 보강

- `required_environment_variables`에 `CLOUDFLARE_API_TOKEN`을 선언한다.
- 설명 문구에서 Codex 전용처럼 읽히는 표현을 runtime-neutral하게 바꾼다.
- 무인 실행에서 필요한 인증 경계를 짧게 보강한다.

### 2. `docs/adr/ADR-020-cloudflare-pages-report-publishing.md` — 공유 게시 계약 갱신

- 게시 workflow가 Hermes와 Codex 모두에서 동일한 shared skill directory를 읽는다는 점을 기록한다.
- `wrangler` 직접 업로드와 배포 검증을 유지하되, 실행 surface를 특정 에이전트로 한정하지 않는다.
- Cloudflare API token은 자동 실행/비대화형 실행에서 사용되는 비밀 값임을 남긴다.

### 3. `docs/code-architecture.md` — skill discovery와 publish 책임 재서술

- `report-publisher`를 runtime-neutral shared skill로 설명한다.
- Hermes가 외부 skill directory를 스캔할 수 있는 경우 같은 계약을 재사용한다는 점을 적는다.
- 저장소 루트/워크스페이스 전체 게시 금지와 Pages 검증 절차는 유지한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `.agents/skills/report-publisher/SKILL.md` | Hermes용 secret/env 계약 추가, runtime-neutral 문구 정리 |
| `docs/adr/ADR-020-cloudflare-pages-report-publishing.md` | Codex 전용 표현 제거, Hermes 공통 계약 명시 |
| `docs/code-architecture.md` | report-publisher 책임과 skill discovery 경로 설명 정리 |

## 검증

```bash
# cwd: ai-nodes root
cd "$(git rev-parse --show-toplevel)"
rg -n "required_environment_variables|Hermes|runtime-neutral|external skill directories|CLOUDFLARE_API_TOKEN" \
  .agents/skills/report-publisher docs/adr/ADR-020-cloudflare-pages-report-publishing.md docs/code-architecture.md
git diff --check -- .agents/skills/report-publisher docs/adr/ADR-020-cloudflare-pages-report-publishing.md docs/code-architecture.md
```

## 의도 메모 (왜)

- Hermes 공식 문서는 `required_environment_variables`와 shared skill directory를 지원하지만,
  현재 저장소의 generic skill validator는 아직 그 키를 허용하지 않는다.
- 그래서 이 phase는 validator 통과가 아니라, 실제 수정된 문서와 skill 본문이 runtime-neutral 계약을 정확히 반영했는지 확인하는 데 초점을 둔다.
- 이 phase는 공용 게시 skill의 계약을 먼저 넓혀야 다음 phase에서 career-os skill이 `/report-publisher`를 안정적으로 호출할 수 있다.

## Blocked 조건 (선택)

- `rg` 또는 `git diff --check`가 실패하면 `PHASE_BLOCKED: report-publisher contract validation failed`로 종료한다.
