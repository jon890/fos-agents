# Phase 02. 스킬 연결과 비공개 자료 이전

**Execution profile**: standard

## 목표

지원 준비가 검증 장부를 먼저 사용하도록 연결하고 `library/resume-baselines/`의 현재 자료와 낡은 산출물을 책임 경로로 정리한다.

**범위 외**: 실제 외부 프로필 수정과 지원서 제출은 수행하지 않는다.

## 컨텍스트

비공개 `applications/`, `library/`, `state/`를 읽거나 쓰기 전에 career workspace 준비가 필요하다.
프로필 원고의 새 경로는 `docs/data-schema.md`의 「지원 패키지」 절을 따르고, 검증 장부는 같은 문서의 「state/verified-claims/」 절을 따른다.
삭제하는 과거 검토 산출물은 이전 S3 release와 로컬 백업이 복구 경로다.

**근거 문서**: `docs/code-architecture.md`의 「실행 환경 준비」와 「지원 패키지」, `docs/adr/ADR-058-data-cleanup은-private-boundary와-retention을-먼저-고정한다.md`, `docs/adr/ADR-116-검증한-주장은-근거-해시와-함께-state에서-재사용한다.md`

## 의도 메모

- 현재 쓰는 프로필 원고와 GitHub 이미지 자산은 보존한다.
- 공통 작성 원칙은 이미 스킬 참조로 이전됐으므로 안내용 복제 문서를 남기지 않는다.
- 공고별 원장은 현재 지원 디렉터리에 유지하며 중앙 상태로 이동하지 않는다.
- 비공개 작업본의 준비나 반영이 실패하면 파일 이전과 삭제를 진행하지 않는다.

## Blocked 조건

- `skill begin resume-preparer --json` 실패 시 `PHASE_BLOCKED: 비공개 작업본을 준비하지 못했습니다.`를 출력하고 종료한다.
- 현재 비공개 revision과 원격 revision이 충돌하면 로컬 변경을 덮어쓰지 않고 종료한다.

## 작업 항목

### 1. 비공개 작업본 준비

저장소 루트에서 다음 명령을 실행하고 성공 JSON의 시작 revision을 기록한다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill begin resume-preparer --json
```

### 2. 프로필 원고 이전

`library/resume-baselines/`의 `wanted-profile.md`, `linkedin-profile.md`, `github-profile.md`, `github-agent-usage.svg`를 `library/profiles/`로 옮긴다.
GitHub 원고의 상대 이미지 경로가 실제 파일명과 일치하도록 수정한다.
`.claude/skills/sync-profile/SKILL.md`, 공고별 근거 원장과 검색 가능한 문서의 옛 경로를 새 경로로 바꾼다.

### 3. 낡은 자료 삭제

`library/resume-baselines/2608-backend-ai/`, `resume-authoring-principles.md`와 참조가 없는 `tossplace-resume.css`를 삭제한다.
삭제 전에 저장소 전체 참조를 검색하고, 현재 실행 코드나 제출 문서가 참조하면 삭제하지 말고 보고한다.
정리 뒤 빈 `library/resume-baselines/` 디렉터리를 남기지 않는다.

### 4. 기존 검증 결과 반영

당근 부동산 백엔드 지원 디렉터리의 버전 3 원장을 `promote_verified_claims.ts`로 반영한다.
다른 application의 버전 2 원장은 자동 이전하지 않는다.

### 5. 스킬 계약 수정과 검증

`.claude/skills/resume-preparer/SKILL.md`에 검색, 재사용 판정, 변경된 주장 감사와 최종 반영 순서를 추가한다.
`.claude/skills/sync-profile/SKILL.md`의 원고 경로를 `library/profiles/`로 바꾼다.
두 스킬을 `skill-creator`의 `quick_validate.py`로 검증한다.

### 6. 비공개 작업본 반영과 이전 테스트

경로 참조 검사, 두 application 근거 원장 검증과 전체 스킬 테스트가 통과한 뒤 다음 명령으로 release를 반영한다.

```bash
bun career-os/scripts/career-workspace/cli.ts skill finish resume-preparer --json
```

`finish`가 실패하면 로컬 변경과 시작 revision을 보존하고 오류를 보고한다.

## 검증

저장소 루트에서 다음 명령을 실행한다.

```bash
test ! -e career-os/library/resume-baselines
test -f career-os/library/profiles/wanted-profile.md
test -f career-os/library/profiles/linkedin-profile.md
test -f career-os/library/profiles/github-profile.md
test -f career-os/library/profiles/github-agent-usage.svg
! rg -n "library/resume-baselines" career-os/AGENTS.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/.claude/skills career-os/applications career-os/library career-os/state
bun career-os/.claude/skills/resume-preparer/scripts/validate_claim_ledger.ts career-os/applications/daangn/backend-community-apartment/review/claim-ledger.json --artifact career-os/applications/daangn/backend-community-apartment/review/resume.html
bun career-os/.claude/skills/resume-preparer/scripts/validate_claim_ledger.ts career-os/applications/daangn/backend-real-estate/review/claim-ledger.json --artifact career-os/applications/daangn/backend-real-estate/review/resume.html
bun test career-os/.claude/skills/resume-preparer/scripts/*.test.ts career-os/.claude/skills/resume-preparer/scripts/verified-claims/*.test.ts
bunx tsc --noEmit
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/resume-preparer
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/sync-profile
git diff --check
```

버전 2 원장은 경로 이전 뒤 기존 정책대로 locator 경고만 허용하고, 경로 누락 오류는 없어야 한다.
ADR과 이 plan은 이전 이유와 삭제 대상을 설명하므로 옛 경로 문자열 검사에서 제외한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `library/profiles/*` | 이전 및 수정 |
| `library/resume-baselines/*` | 삭제 |
| `state/verified-claims/**/*` | 신규 |
| `applications/*/*/review/*claim-ledger.json` | 경로 수정 |
| `.claude/skills/resume-preparer/SKILL.md` | 수정 |
| `.claude/skills/sync-profile/SKILL.md` | 수정 |
