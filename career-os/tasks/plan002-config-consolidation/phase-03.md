# Phase 03 — sources.json 통합 + refresh_topic_inventory.py 갱신

**Model**: sonnet
**Status**: pending

---

## 목표

3개 source configs를 단일 `config/sources.json`으로 통합하고, 유일한 caller `refresh_topic_inventory.py`가 새 파일을 읽도록 갱신.

**범위 외**: topics.json (phase-02), baseline (phase-04), position 자산 이동 (phase-05), 옛 파일 삭제 (phase-05).

---

## 관련 docs (실행 전 필수 읽기)

- `career-os/docs/data-schema.md` — "통합 config 스키마 (plan002 이후)"의 `sources.json` 명세.
- `career-os/docs/adr.md` — ADR-016.

## 마이그레이션 매핑

| 원본 파일 | 카테고리 키 |
|---|---|
| `career-os/config/tech-blog-sources.json` | `techBlog` |
| `career-os/config/ai-topic-sources.json` | `ai` |
| `career-os/config/geek-news-sources.json` | `geek` |

각 원본은 이미 `{"_meta": ..., "items": [...]}` 형태 — 그 구조를 카테고리 값으로 그대로 복사.

새 `config/sources.json`:

```json
{
  "_meta": {
    "purpose": "career-os 보조 카테고리(tech-blog/ai/geek) reservoir 단일 출처 (ADR-016)",
    "schema_version": "1",
    "categories": ["techBlog", "ai", "geek"]
  },
  "techBlog": { /* tech-blog-sources.json 내용 그대로 */ },
  "ai": { /* ai-topic-sources.json 내용 */ },
  "geek": { /* geek-news-sources.json 내용 */ }
}
```

## 작업 항목

### 1. `config/sources.json` 마이그레이션

```bash
cd /home/bifos/ai-nodes
python3 - <<'PY'
import json
from pathlib import Path

mapping = {
    "techBlog": "career-os/config/tech-blog-sources.json",
    "ai":       "career-os/config/ai-topic-sources.json",
    "geek":     "career-os/config/geek-news-sources.json",
}

merged = {
    "_meta": {
        "purpose": "career-os 보조 카테고리 reservoir 단일 출처 (ADR-016)",
        "schema_version": "1",
        "categories": list(mapping.keys()),
    },
}
for cat, src_path in mapping.items():
    src = Path(src_path)
    if not src.exists():
        raise SystemExit(f"PHASE_FAILED: 원본 누락 {src}")
    merged[cat] = json.loads(src.read_text(encoding="utf-8"))

out = Path("career-os/config/sources.json")
out.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {out}")
PY
```

옛 3 파일은 phase-05까지 보존.

### 2. `refresh_topic_inventory.py` 갱신

이 스크립트가 sources를 읽는 부분을 grep으로 정확히 찾고 갱신:

```bash
cd /home/bifos/ai-nodes
grep -n "tech-blog-sources\|ai-topic-sources\|geek-news-sources" \
  career-os/skills/cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py
```

찾은 위치에서 3개 파일을 각각 읽던 로직을 `sources.json` 한 번 읽고 카테고리별로 슬라이스하도록 변경:

```python
# Before (예시 — 실제 코드는 위 grep 결과 확인)
tech_blog = json.load(open(TASK_ROOT / "config/tech-blog-sources.json"))
ai_topic  = json.load(open(TASK_ROOT / "config/ai-topic-sources.json"))
geek_news = json.load(open(TASK_ROOT / "config/geek-news-sources.json"))

# After
sources = json.load(open(TASK_ROOT / "config/sources.json"))
tech_blog = sources["techBlog"]
ai_topic  = sources["ai"]
geek_news = sources["geek"]
```

변수 이름은 기존 그대로 유지해서 *아래쪽 로직 변경 없도록*. 각 카테고리 값이 `{_meta, items}` 구조라 후속 코드 호환.

만약 코드가 카테고리별 별도 파일 경로를 함수 인자나 상수로 분리해 둔 패턴이면, 그 상수만 `sources.json + 카테고리 키`로 바꾸면 됨.

### 3. 다른 참조 확인 (방어)

```bash
cd /home/bifos/ai-nodes
for old in tech-blog-sources ai-topic-sources geek-news-sources; do
  echo "=== $old ==="
  grep -rln "$old\.json" career-os/skills/ 2>/dev/null | grep -v sources/fos-study
done
```

다른 caller가 등장하면(예상치 못한 곳에서 읽고 있음) 그것도 같이 갱신. 모두 `sources.json + 카테고리 키` 패턴.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/config/sources.json` | 신규 (3 파일 통합) |
| `career-os/skills/cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py` | 3 파일 읽기 → sources.json + 카테고리 슬라이스 |

옛 3 파일은 보존 (phase-05 cleanup).

## 검증

```bash
cd /home/bifos/ai-nodes

# 1. sources.json 생성 + 3 카테고리 모두 존재
python3 - <<'PY'
import json
data = json.load(open("career-os/config/sources.json"))
cats = data["_meta"]["categories"]
assert set(cats) == {"techBlog", "ai", "geek"}
for c in cats:
    assert c in data
    if isinstance(data[c], dict) and "items" in data[c]:
        print(f"  {c}: {len(data[c]['items'])} items")
print("sources.json OK")
PY

# 2. 옛 3 파일 코드 참조 0건
for old in tech-blog-sources ai-topic-sources geek-news-sources; do
  count=$(grep -rln "$old\.json" career-os/skills/ 2>/dev/null | grep -v sources/fos-study | wc -l)
  echo "  $old.json → $count code refs"
done

# 3. refresh_topic_inventory.py 문법 + 새 경로 사용
python3 -m py_compile career-os/skills/cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py
grep -c "sources.json" career-os/skills/cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py
# 기대: 1 이상

# 4. refresh smoke (선택 — 실제 실행, 네트워크 없을 수도 있어 best-effort)
# python3 career-os/skills/cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py 2>&1 | head -20
# 실패해도 phase는 통과로 처리하지만 stdout에 로그 남김
```

검증 1~3 모두 통과해야 success.

## 커밋

```
refactor(career-os): sources.json 통합 (3 configs → 1) + refresh_topic_inventory 갱신

ADR-016. 3개 source configs(tech-blog/ai-topic/geek-news)를 단일 config/sources.json + techBlog/ai/geek 카테고리 키로 통합. 유일한 caller refresh_topic_inventory.py가 새 파일을 읽고 카테고리별 슬라이스. 옛 3 파일은 phase-05에서 일괄 삭제.
```

push는 phase-05에서.

## Blocked 조건

**중요 — exit code 명시**: 아래 어느 마커든 출력만 하지 말고 반드시 `sys.exit(1)` (FAILED) 또는 `sys.exit(2)` (BLOCKED) — shell에서는 `exit 1` / `exit 2` — 비-0 exit code로 종료한다. 마커만 출력하고 정상 종료하면 `run-phases.py`가 success로 잘못 처리한다 (plan001-adr-cleanup 1차 실행 사례).

- 원본 3 파일 누락 → `PHASE_BLOCKED: 원본 source 누락` + `exit 2`
- 검증 2번에서 옛 파일 코드 참조 잔존 → `PHASE_FAILED: caller 잔존` + `exit 1`
- 검증 3번 문법 실패 → `PHASE_FAILED: refresh syntax` + `exit 1`
