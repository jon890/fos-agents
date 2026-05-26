# audit trail 명령 + 형식 상세

candidate-baseline-suggester SKILL.md의 bash 명령·형식 상세 참조.

---

## Bash — 4-1 Backup

```bash
DATE=$(date +%F)
AUDIT_DIR=career-os/data/runtime/profile-refresh-suggestions/$DATE
mkdir -p "$AUDIT_DIR/before" "$AUDIT_DIR/after" "$AUDIT_DIR/diff"

# 현재 자산 snapshot
cp career-os/config/candidate-profile.md "$AUDIT_DIR/before/candidate-profile.md"
cp career-os/config/baseline-core-files.json "$AUDIT_DIR/before/baseline-core-files.json"
cp career-os/config/study-progress.json "$AUDIT_DIR/before/study-progress.json"
```

`mkdir -p` 실패 시 즉시 중단 — audit trail 없이 자산 갱신 금지.

---

## 4-2.D 이력서 탐지

```bash
find career-os/sources/fos-study/resume -maxdepth 3 -type f
```

**형식 우선순위**: md > html > pdf.

**후보 선택 기준** (우선순위 순):
1. `config/mvp-target.json primary` 키워드와 파일명 매칭 (예: `cj-foodville-...`)
2. 최신 mtime
3. 형식 우선순위 (md > html > pdf)

**마크다운 / HTML / PDF 동등 인정** — Claude 멀티모달 모델은 HTML/PDF 직접 흡수. 마크다운 강요 X.

candidate-profile.md `Source provenance` 표 + baseline-core-files.json `files[]`가 가리키는 resume path 중 4-2.B 에서 부재로 확인된 항목 식별.

발견된 후보 중 가장 적합한 1건을 changes.md `## 이력서 매핑 후보`에 기록.
모든 종류 부재 시: changes.md에 "이력서 자산 전무 — resume-writer skill로 신규 생성 필요" 명시. (HTML/PDF 있으면 resume-writer 권장 문구 생략.)

---

## Bash — 4-4 After/Diff

`$AUDIT_DIR`는 SKILL.md 4-1 에서 정의된 변수 (`career-os/data/runtime/profile-refresh-suggestions/$DATE`).

```bash
# after/ 스냅샷
cp career-os/config/candidate-profile.md "$AUDIT_DIR/after/candidate-profile.md"
cp career-os/config/baseline-core-files.json "$AUDIT_DIR/after/baseline-core-files.json"
cp career-os/config/study-progress.json "$AUDIT_DIR/after/study-progress.json"

# diff/ 파일별
for f in candidate-profile.md baseline-core-files.json study-progress.json; do
  diff -u "$AUDIT_DIR/before/$f" "$AUDIT_DIR/after/$f" \
    > "$AUDIT_DIR/diff/$f.diff" 2>/dev/null || true
done
```

---

## changes.md 구조

`$AUDIT_DIR/changes.md`를 다음 구조로 작성:

```markdown
# Profile Refresh — YYYY-MM-DD

## 강점 추가 (N건)
- <강점 항목>: 근거 fos-study/<path> (commit <sha>)

## 약점 outdated 마킹 (N건)
- <약점 항목>: 근거 fos-study/<path>, study_count=N

## baseline-core-files 추가 (N건)
- <path>: <추가 이유>

## weak_spots 상태 갱신 (N건)
- <topic>: stale → improving (근거: <fos-study path>)

## 이력서 매핑 후보
- <후보 path> (mtime: YYYY-MM-DD, 형식: md|html|pdf) — mvp-target 매칭 사유

## 미반영 / skip
- <자산명>: <사유>
```

변경 없을 때도 각 섹션 `(0건)`으로 작성.
