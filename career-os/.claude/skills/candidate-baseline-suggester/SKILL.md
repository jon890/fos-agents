---
name: candidate-baseline-suggester
description: career-os/config/ hand-crafted 자산(candidate-profile.md, baseline-core-files.json, config/study-progress.json weak_spots)을 fos-study 전체 commit history, study-progress, interview-prep-analyzer baseline 산출물 기반으로 갱신 제안하는 비공개 career-os skill. "후보자 프로필 갱신", "baseline 약점·강점 평가 업데이트", "프로필 업데이트", "baseline 갱신", "학습 내용 반영", "weak_spots 갱신", `/candidate-baseline-suggester`처럼 후보자 기준선과 학습 약점 자산을 업데이트해야 할 때 사용. Append + 주석 마킹 패턴으로 기존 본문을 보존하고 audit trail(data/runtime/profile-refresh-suggestions/YYYY-MM-DD/ before/after/diff/changes)을 반드시 남긴다.
---

# Candidate Baseline Suggester

fos-study 학습 이력을 기반으로 career-os 자산(프로필·baseline·진도)을 Append + 주석 마킹으로 자동 갱신하는 skill.

## 호출 후 입력 해석

- study-pack 5회 이상 누적, 면접 시즌 시작, 타깃 회사 변경 뒤 실행하면 효과가 크다.
- 기존 본문은 직접 덮어쓰지 않고 Append + 주석 마킹으로 변경한다.
- audit trail 없이 자산을 갱신하지 않는다.

## Inputs

현재 에이전트는 다음 파일과 명령 출력을 직접 로드:

1. `career-os/config/candidate-profile.md` — 현재 본문 전체
2. `career-os/config/baseline-core-files.json` — 현재 `files` 배열 전체
3. `career-os/config/study-progress.json` — `sessions` 배열 + `weak_spots` 맵 전체
4. (선택) `career-os/data/reports/baseline/<latest>/report.md` — 존재 시 읽고, 없으면 skip
5. fos-study 전체 commit history — `git -C career-os/sources/fos-study log --all --pretty=format:'%h %ad %s' --date=short` + 최근 30개 commit path

## Workflow

### 4-1. Backup — audit trail before/

```bash
DATE=$(date +%F)
AUDIT_DIR=career-os/data/runtime/profile-refresh-suggestions/$DATE
```

디렉터리 생성 + before/ 스냅샷 셸 명령은 `references/audit-trail-format.md` `## 셸 명령 — 4-1 Backup` 참조.

audit trail 디렉터리 생성 실패 시 즉시 중단 — **audit trail 없이 자산 갱신 금지**.

### 4-2. fos-study 분석 (현재 에이전트의 자연어 추론)

다음을 수행해 갱신 근거를 수집:

**A. 최근 학습 토픽 매핑 + 실측 path 추출**
- `git -C career-os/sources/fos-study log --all --pretty=format:'%h %ad %s' --date=short` 전체 출력 + 후보 commit의 `git show <sha> --name-only --pretty=format:""`로 **실제 변경 path** 추출.
- commit message의 `docs(<domain>): ...` 패턴은 분류 힌트로만. **path 추정은 절대 금지** — commit message domain이 fos-study sub-dir과 1:1 대응 안 함 (예: `docs(database): ...`이 `database/...` 평면 또는 `database/mysql/...` 둘 다 가능). 실측 path만 사용.
- `config/study-progress.json sessions[]`의 topics 배열과 교차 확인.
- 최근 90일 이내 commit의 실측 path → 강점 근거 목록 작성.

**B. baseline-core-files.json 미포함·부재 점검 (사전 `test -f` 검증)**
- A의 `git show --name-only` 실측 path를 그대로 후보로 사용.
- **추가 후보 사전 검증**: 각 후보 path에 `test -f career-os/sources/fos-study/<path>` 검증 — 부재면 후보에서 제외 (후속 commit rename / git rm 가능성).
- 현재 `baseline-core-files.json files[].path` 목록과 diff → 미포함 + 실재 path만 추가 후보.
- 후보 파일이 면접 고위험 영역(DB · JPA · Redis · Kafka · K8s · 트랜잭션 · MyBatis · Spring · Observability)에 해당하면 추가 대상.
- **기존 entry 부재 점검**: 현재 `files[]`의 모든 path를 `test -f`로 점검. 부재 entry 목록을 4-3 baseline-core-files Append 단계로 전달 (제거 X, `_missing_note` 마킹).

**C. weak_spots 평가**
- `study-progress.json weak_spots` 각 항목의 `last_studied` · `study_count` 확인
- fos-study commit 중 해당 topic 학습 근거(outputPath path) 매핑
- study_count ≥ 2 이거나 최근 30일 내 학습 완료된 약점 → outdated 후보로 분류

**D. 이력서 자동 탐지 + 매핑 후보 제시**
- `find career-os/sources/fos-study/resume -maxdepth 3 -type f` 스캔. 상세 알고리즘(우선순위·형식·mvp-target 매핑 방법)은 `references/audit-trail-format.md` `## 4-2.D 이력서 탐지` 참조.
- **자동 교체 X — 사용자 결정**. 발견된 후보 1건을 changes.md `## 이력서 매핑 후보`에 기록.

### 4-3. 자산 갱신 — Append + 주석 마킹

아래 4개 자산을 순서대로 갱신. **기존 본문 줄 삭제 절대 금지** — Append와 주석 추가만.

#### candidate-profile.md "입증된 강점 (with evidence)" 섹션

새로 확인된 강점 항목만 섹션 끝에 append:

```markdown
<N+1>. **<강점 항목>** — <한 줄 설명>. `<fos-study path>`
<!-- suggester: added YYYY-MM-DD -->
```

이미 존재하는 강점과 중복이면 append 생략.

#### candidate-profile.md "약점 / 학습 중인 영역" 섹션

학습 완료 판단된 약점 항목 바로 아래에 주석 마킹 줄 추가 (기존 줄 보존):

```markdown
<기존 약점 줄 그대로>
<!-- suggester: outdated since YYYY-MM-DD, 근거 fos-study/<path>, study_count=N -->
```

주석이 이미 있으면 덮어쓰지 않고 skip.

#### baseline-core-files.json `files` 배열

**Append 전 사전 검증 (필수)**: 추가하려는 모든 path에 `test -f career-os/sources/fos-study/<path>` 검증. 통과 path만 append. 미통과 시 changes.md `## 추가 skip`에 사유 기록.

신규 후보 append 형식: `{"path": "<실재 path>", "note": "suggester: added YYYY-MM-DD, 근거 <sha>"}` 배열 끝에 추가.

**기존 부재 entry 마킹**: 기존 `files[]` 중 `test -f` 실패 entry는 **제거 절대 금지**. `"_missing_note": "suggester: missing since YYYY-MM-DD — <사유 + 대체 후보 path>"` 필드 추가. 이미 `_missing_note` 있으면 skip. resume 관련 부재면 4-2.D 탐지 결과(이력서 후보 path) 포함.

JSON 파싱 실패 시 이 자산만 skip + stderr warn.

#### config/study-progress.json `weak_spots`

각 weak_spot 항목의 `last_evaluated` 필드(없으면 추가)와 `status` 필드 갱신:

```json
"<topic>": {
  "last_studied": "<기존 값 그대로>",
  "study_count": "<기존 값 그대로>",
  "last_evaluated": "YYYY-MM-DD",
  "status": "improving|mastered|stale"
}
```

`status` 판단 기준:
- `study_count >= 3` + 최근 60일 내 학습 → `"mastered"`
- `study_count >= 1` + 최근 90일 내 학습 → `"improving"`
- 그 외 → `"stale"`

변경 사항이 없더라도 audit trail (changes.md `변경 없음 (0건)`)은 반드시 생성.

### 4-4. audit trail — after/ + diff/ + changes.md

after/ 스냅샷, diff/ 생성 셸 명령 및 changes.md 작성 구조는 `references/audit-trail-format.md` `## 셸 명령 — 4-4 After/Diff` 및 `## changes.md 구조` 참조.

## Self-check

갱신 완료 후 아래 7항목 검증. 실패 항목이 있으면 해당 갱신을 되돌리고 stderr에 실패 사유 출력:

1. **라인 수 감소 없음**: `wc -l candidate-profile.md` 갱신 후 ≥ 갱신 전. 감소 시 즉시 실패
2. **baseline-core-files.json valid JSON**: `python3 -c "import json,sys; json.load(sys.stdin)" < baseline-core-files.json`
3. **files 배열 길이 보존**: 갱신 후 `files` 배열 길이 ≥ 갱신 전
4. **audit trail 완결**: `before/`, `after/`, `diff/`, `changes.md` 모두 존재
5. **주석 마킹 형식**: `<!-- suggester: outdated since` 패턴이 기존 본문 줄 *아래*에만 존재 (기존 줄 대체 없음)
6. **`files[].path` 전수 실재 검증**: 모든 path가 `test -f career-os/sources/fos-study/<path>` 통과 또는 `_missing_note` 부착. 부재 path에 `_missing_note` 없으면 즉시 stderr + changes.md 미반영 기록 (자동 롤백 X — 기존 부재는 본 skill 책임 아님, 마킹만 보장).
7. **resume entry 매핑 보장**: `^resume/` 시작 path 중 부재 entry는 `_missing_note`에 대체 후보 path 또는 "resume-writer skill 권장" 문구 포함. 미포함 시 stderr warn.

## Error handling

| 상황 | 처리 |
|---|---|
| audit trail mkdir 실패 | 즉시 중단 + stderr. 자산 갱신 시작 전 차단 |
| fos-study git log 실패 (경로 없음·권한) | stale data로 진행 + stderr warn "fos-study 접근 불가, 부분 갱신" |
| baseline-core-files.json JSON 파싱 실패 | 해당 자산 skip + stderr warn. 나머지 자산 정상 진행 |
| study-progress.json 파싱 실패 | 해당 자산 skip + stderr warn |
| self-check 라인 수 감소 감지 | 갱신 파일 before/ 복원 + stderr "candidate-profile 라인 감소 — 롤백" + exit 1 |
| audit trail 쓰기 실패 (disk full 등) | exit 1. 자산은 이미 갱신된 경우 경고만 — after/ 없으면 수동 복원 안내 |

## Why this design

ADR-028 핵심 3줄:

- **Append + 주석 마킹**: hand-crafted 자산은 사용자 판단이 최종 권위 — skill은 제안만 추가하고 삭제는 사용자 몫.
- **audit trail 필수**: git revert로 잡히지 않는 의미 단위 변경을 before/after/diff/changes.md로 추적해 언제든 수동 rollback 가능.
- **self-check 라인 감소 트랩**: Append 모드를 보장하는 최소 불변식 — 실수로 본문 삭제 시 즉시 감지·롤백.

결과물: `career-os/data/runtime/profile-refresh-suggestions/YYYY-MM-DD/changes.md` (갱신 요약).
갱신된 자산을 git에 commit할지 여부는 사용자가 결정 — skill은 자동 commit 하지 않음.
