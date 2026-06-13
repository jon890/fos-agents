# Phase 04 — 통합 검증과 plan 완료

**Model**: haiku
**Status**: pending

---

## 목표

plan071 변경을 통합 검증한다.
source별 수집량, AI 관련 공고 수, stale/drop diagnostics, active/open direct posting guard, `--source all` snapshot, daily runner validate path를 확인하고 plan 완료 상태를 기록한다.

**범위 외**: adapter 신규 구현, docs/ADR/정책 문서 수정, daily 기본값 확대, 외부 제출 또는 Discord 전송.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs와 입력

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-079
- `career-os/docs/flow.md`의 position-recommender daily 흐름
- `career-os/docs/data-schema.md`의 position runtime/report schema
- `career-os/tasks/plan071-position-discovery-hardening/index.json`
- `career-os/tasks/plan071-position-discovery-hardening/artifacts/discovery-audit.md`

---

## 작업 항목

### 1. TypeScript와 grep 검증

`position-recommender` live postings 관련 TypeScript를 check한다.
개별 공고 URL seed 후보가 남았는지 grep으로 확인한다.
허용되는 root/listing/API/sitemap URL은 출력에 주석으로 분리해 보고한다.

### 2. source별 snapshot 검증

지원되는 CLI 옵션을 확인한 뒤 source별 dry-run 또는 temp output snapshot을 실행한다.
source별 총 수집량, AI 관련 공고 수, stale/drop diagnostics를 stdout 또는 artifact에 남긴다.

### 3. active/open direct posting guard 검증

validator와 render 결과에서 닫힌 공고가 active/open으로 승격되지 않는지 확인한다.
검증용 명령이 없으면 기존 validator 함수나 collector 출력으로 반증 가능한 smoke를 구성한다.

### 4. daily runner validate path 검증

`REPORT_DATE`와 `POSITION_RECOMMENDER_NOTIFY=0`를 사용해 existing report validation 경로를 확인한다.
실제 Discord 전송은 금지한다.
실행이 외부 호출을 과도하게 유발하거나 runtime 파일을 오염시키면 `PHASE_BLOCKED`로 보고한다.

### 5. plan 완료 상태 기록

검증 통과 뒤 `career-os/tasks/plan071-position-discovery-hardening/index.json`의 `status`를 `completed`로 바꾼다.
`updated_at`은 UTC ISO-8601로 갱신한다.
`phases[3].status`도 `completed`로 맞춘다.
run-phases.py가 후기록을 남길 수 있으므로 최종 `git status --short`를 확인한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan071-position-discovery-hardening/index.json` | 완료 상태 기록 |
| `career-os/tasks/plan071-position-discovery-hardening/artifacts/discovery-audit.md` | 필요 시 검증 결과 보강 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

bun --check career-os/scripts/position-recommender/collect_live_postings.ts
find career-os/scripts/position-recommender/live-postings -name '*.ts' -print0 \
  | xargs -0 -n1 bun --check
bun --check career-os/scripts/position-recommender/run_daily_with_claude.ts
bun --check career-os/scripts/position-recommender/render_report_html.ts

echo "[posting-like url candidates]"
rg -n "greetinghr\\.com/.*/o/[0-9]+|job_posting/[A-Za-z0-9]+|wanted\\.co\\.kr/wd/[0-9]+|jobs/[0-9]+|requisitionId=|gh_jid=" \
  career-os/scripts/position-recommender/live-postings || true

echo "[source all smoke]"
tmp="$(mktemp)"
bun career-os/scripts/position-recommender/collect_live_postings.ts --source all --output "$tmp"
wc -l "$tmp"
rg -n "source_counts|source_diagnostics|source_errors|source:" "$tmp" || true
rm -f "$tmp"

echo "[daily validate existing]"
REPORT_DATE=2026-06-13 POSITION_RECOMMENDER_NOTIFY=0 \
  bun career-os/scripts/position-recommender/run_daily_with_claude.ts --validate-existing

git -C career-os diff --check
git -C career-os status --short
```

`collect_live_postings.ts`는 `--help` / `--dry-run` 전용 모드가 아니므로 temp output 명령만 사용한다.
실제 runtime 파일이나 Discord 알림을 건드릴 위험이 있으면 실행하지 말고 `PHASE_BLOCKED`로 보고한다.

---

## 성공 기준

- TypeScript check가 통과한다.
- 개별 공고 URL seed 후보가 남지 않거나, 남은 값이 root/listing/API/sitemap entrypoint임을 설명했다.
- `--source all` snapshot 또는 동등한 temp snapshot에서 source별 수집량과 diagnostics를 확인했다.
- AI 관련 공고 수와 stale/drop 사유를 확인할 수 있다.
- active/open direct posting guard가 닫힌 공고 승격을 막는다.
- `--validate-existing` daily path가 Discord 전송 없이 통과한다.
- `index.json` 완료 상태가 기록된다.
- docs/ADR/정책 문서는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- dry-run 또는 temp output 없이 snapshot 검증이 runtime 파일을 오염시킨다.
- daily validate path가 Discord 전송 또는 외부 제출을 유발할 위험이 있다.
- docs/ADR/정책 문서 변경 없이는 성공 기준을 판단할 수 없다.
- 공식 source 접근 실패가 일시 장애인지 정책 변경인지 판단할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- `bun --check`, `git diff --check`, daily validate path가 실패한다.
- 개별 공고 URL seed가 설명 없이 남는다.
- closed/stale 공고가 active/open으로 승격된다.
- `index.json` 완료 상태를 기록하지 않았다.
- docs/ADR/정책 문서를 수정했다.
- Discord 또는 외부 서비스로 개인정보나 지원서 원문을 보냈다.

---

## common-pitfalls self-check

- [ ] source별 수집량과 AI 관련 공고 수는 실측 stdout 또는 artifact로 남겼다.
- [ ] 성공 기준은 `bun --check`, `rg`, runner validate 명령, `git diff --check`로 검증 가능하다.
- [ ] 이 phase는 이전 phase의 코드 결과와 artifact 경로만 입력으로 가정한다.
- [ ] 다른 워크스페이스 경로를 수정하지 않는다.
- [ ] docs/ADR/정책 문서를 수정하지 않는다.
- [ ] 새 외부 의존성을 추가하지 않는다.
- [ ] first bash에서 ai-nodes 루트로 이동한다.
- [ ] PHASE_BLOCKED와 PHASE_FAILED는 Bash 도구로 직접 실행한다.
