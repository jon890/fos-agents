# Phase 03 — TossPlace Applied AI Engineer fixture 생성

**Model**: sonnet
**Status**: pending

---

## 목표

TossPlace `Applied AI Engineer` 공고를 첫 application agent 검증 fixture로 저장한다.

**범위 외**:

- 실제 지원, 로그인, 지원 페이지 입력, 제출 자동화는 절대 하지 않는다.
- `sources/fos-study/`를 수정하거나 commit/push하지 않는다.
- `docs/`는 수정하지 않는다. docs 반영은 Phase 01~02에서 완료됐다.

---

## 사전 cwd 설정

run-phases.py는 cwd를 `career-os/`로 잡지만, 본 phase 검증 명령은 ai-nodes 루트 기준 path를 사용한다. 첫 Bash에서 반드시 루트로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs / 파일

실행 전 반드시 읽는다.

- `career-os/tasks/plan029-application-agent-mvp/phase-01.md` — D1~D5 결정
- `career-os/tasks/plan029-application-agent-mvp/phase-02.md` — ledger schema 결정
- `career-os/docs/data-schema.md` — `data/applications/` 스키마
- `career-os/scripts/application-agent/ledger_schema.ts` — ledger validator

---

## 입력

- URL: `https://toss.im/career/job-detail?gh_jid=7746700003`
- Official API: `https://api-public.toss.im/api/v3/ipd-eggnog/career/jobs/7746700003`
- 목적: MVP 검증용 샘플. 실제 지원 목적 아님.

## 작업 항목

### 1. 공식 공고 JSON 수집

Bash로 official API를 fetch한다. 실패하면 공개 페이지를 fallback으로 fetch한다.

저장 위치:

- raw 임시 파일: `/tmp/tossplace-applied-ai-engineer-7746700003.json`

### 2. private fixture 디렉터리 생성

다음 디렉터리를 만든다.

```text
career-os/data/applications/tossplace/applied-ai-engineer/
```

주의: 루트 `.gitignore`의 `**/data/` 규칙 때문에 이 산출물은 git 추적 대상이 아니다. 의도된 private data다.

### 3. posting.md 작성

`career-os/data/applications/tossplace/applied-ai-engineer/posting.md`를 작성한다.

필수 포함:

- source URL
- fetchedAt
- company
- role
- employment type
- location
- source status 또는 active 판단 근거
- key responsibilities
- requirements
- preferred qualifications
- keywords/tags
- "MVP fixture only; not an actual submission target."
- Toss 계열 쿨다운 주의

### 4. ledger.jsonl record 추가

`career-os/data/applications/ledger.jsonl`을 생성 또는 갱신한다.

record 필수값:

- `id`: `tossplace-applied-ai-engineer-7746700003`
- `company`: `TossPlace`
- `role`: `Applied AI Engineer`
- `source`: `toss-careers`
- `url`: `https://toss.im/career/job-detail?gh_jid=7746700003`
- `status`: `discovered` (공고가 명확히 closed이면 `blocked`)
- `applicationDir`: `data/applications/tossplace/applied-ai-engineer`
- `postingPath`: `data/applications/tossplace/applied-ai-engineer/posting.md`
- `needsUserReview`: `true`
- `userDecision`: `pending`
- `riskFlags`: `["toss_group_cooldown", "mvp_fixture_only"]`
- `nextActions`: `["fit_analysis"]`

기존 같은 `id` record가 있으면 중복 append하지 말고 교체한다.

### 5. tracked audit summary 작성

private data는 gitignore라 commit되지 않는다. 대신 sanitized audit summary를 생성해 phase commit을 남긴다.

생성:

```text
career-os/tasks/plan029-application-agent-mvp/audit/phase-03-tossplace-fixture-summary.md
```

포함:

- fetchedAt
- source URL
- private output paths
- ledger validation 결과
- 실제 제출/로그인/지원 자동화 미수행 확인

지원 전략, 맞춤 이력서, 개인정보는 쓰지 않는다.

## 검증 기준

- `test -s career-os/data/applications/tossplace/applied-ai-engineer/posting.md`
- `test -s career-os/data/applications/ledger.jsonl`
- `bun career-os/scripts/application-agent/ledger_schema.ts career-os/data/applications/ledger.jsonl`
- `grep -q "MVP fixture only" career-os/data/applications/tossplace/applied-ai-engineer/posting.md`
- `grep -q "toss_group_cooldown" career-os/data/applications/ledger.jsonl`
- `test -s career-os/tasks/plan029-application-agent-mvp/audit/phase-03-tossplace-fixture-summary.md`
- `git diff --name-only --cached` 또는 `git diff --name-only HEAD`에 `career-os/sources/fos-study/`가 없어야 한다.

## 산출물

- `data/applications/tossplace/applied-ai-engineer/posting.md`
- `data/applications/ledger.jsonl`
- `tasks/plan029-application-agent-mvp/audit/phase-03-tossplace-fixture-summary.md`

## commit

private data는 commit되지 않으므로 audit summary만 commit한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/tasks/plan029-application-agent-mvp/audit/phase-03-tossplace-fixture-summary.md
git commit -m "test(career-os): add TossPlace application fixture audit"
```

commit할 staged 파일이 audit summary 외에 있으면 `PHASE_BLOCKED: unexpected staged files` 출력 후 exit 2.

## PHASE_BLOCKED / PHASE_FAILED 조건

- official API와 공개 페이지 fetch가 모두 실패하면 `PHASE_BLOCKED: TossPlace posting fetch failed` 후 exit 2.
- ledger validator 실패 시 `PHASE_FAILED: ledger validation failed` 후 exit 1.
- `sources/fos-study/` 변경 감지 시 `PHASE_FAILED: public repo boundary violated` 후 exit 1.
- 실제 제출/로그인/지원 자동화 시도 흔적이 있으면 `PHASE_FAILED: submission automation attempted` 후 exit 1.
