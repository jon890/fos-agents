# Phase 01 — 5 워크스페이스 AGENTS.md brain 연동 역참조 + 산출물 라우팅

**Model**: sonnet
**Status**: pending

---

## 목표

5개 워크스페이스(`apartment` / `career-os` / `stock-investment` / `travel` / `health-care`) 각각의 `AGENTS.md`에 "fos-brain 연동" 섹션을 추가한다.
각 섹션은 모노레포 단일 정책(루트 `AGENTS.md` 13번 + ADR-009/010)을 **역참조**하고, 그 워크스페이스의 **자기 산출물 종류 → 네임스페이스 매핑**만 명시한다(거울 구조).

**범위 외**:

- 루트 `AGENTS.md` 13번 섹션 + `docs/adr.md` ADR-009/010 작성 — 본 plan의 docs-first 커밋에서 이미 완료. 다시 쓰지 않는다.
- 워크스페이스 SKILL.md 트리거 지점 하드와이어 — 본 plan 범위 아님(필요 시 후속 plan).
- brain 클론 / symlink / brain repo 경로 통일 — 사용자 환경 설치(전제조건). phase가 하지 않는다.

**워크스페이스 격리 예외 정당화**: 본 phase가 5개 워크스페이스 디렉터리를 한 번에 건드리는 것은 모노레포 공유 의존성 정책 롤아웃이며, ADR-009가 명문화한 워크스페이스 격리의 *의도된 예외*다. 워크스페이스끼리 서로의 자산을 참조하는 것이 아니라, 각자 동일한 외부 brain 정책을 역참조하는 것.

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

run-phases.py는 cwd=workspace로 phase 실행. 본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 cwd=ai-nodes 루트로 변경. Claude Code Bash 도구 cwd 보존 → 후속 자동 유지.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽을 단일 소스:

- `AGENTS.md` 13번 "fos-brain 외부 지식 기반 연동" — 위치·thin caller·라우팅 표·cron 정책·전제조건.
- `docs/adr.md` ADR-009(구조) + ADR-010(쓰기 안전·프라이버시).

---

## 작업 항목 (5)

각 워크스페이스 `AGENTS.md`를 Read한 뒤, 적절한 위치(끝부분, "참고 문서"류 섹션이 있으면 그 앞)에 아래 템플릿을 워크스페이스에 맞춰 추가한다.
섹션 번호는 그 파일의 기존 마지막 번호 + 1로 매긴다(파일마다 다름 — Read 후 결정).

공통 템플릿:

```markdown
## N. fos-brain 연동

이 워크스페이스 agents의 brain 읽기/쓰기 규약.
단일 정책은 ai-nodes 루트 `AGENTS.md` 13번 + ADR-009(구조) / ADR-010(쓰기 안전·프라이버시).

- 접근: thin caller — brain-search(읽기) / brain-add(쓰기). brain 로직 재구현 금지.
- cron 무인 실행: brain-search 읽기만. brain-add 적재는 discord 대화 세션에서 사람 검토 후.
- 산출물 네임스페이스 라우팅:
  <워크스페이스별 매핑 — 아래 표 참조>
```

워크스페이스별 라우팅 매핑(템플릿의 마지막 bullet 자리에 sub-bullet으로):

### 1. `apartment/AGENTS.md`

- 매물·인테리어 결정·계약 정보 → private.

### 2. `career-os/AGENTS.md`

- fos-study 파생 study/면접 지식 → public-OK.
- 개인 baseline·면접 자산·커리어 데이터 → private.

### 3. `stock-investment/AGENTS.md`

- 투자·재무·포트폴리오 데이터 → private.

### 4. `travel/AGENTS.md`

- 여행 노트·일정·예약 정보 → private (게시 적정성 확인된 여행기는 public opt-in).

### 5. `health-care/AGENTS.md`

- 무릎 재활·건강 데이터 → private.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `apartment/AGENTS.md` | fos-brain 연동 섹션 추가 |
| `career-os/AGENTS.md` | fos-brain 연동 섹션 추가 |
| `stock-investment/AGENTS.md` | fos-brain 연동 섹션 추가 |
| `travel/AGENTS.md` | fos-brain 연동 섹션 추가 |
| `health-care/AGENTS.md` | fos-brain 연동 섹션 추가 |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 stdout 값을 그대로 echo한다(추정 금지).

```bash
cd "$(git rev-parse --show-toplevel)"
# 5개 워크스페이스 AGENTS.md 모두 fos-brain 연동 섹션 보유 (기대: 5)
COUNT=$(grep -lr "fos-brain 연동" apartment/AGENTS.md career-os/AGENTS.md stock-investment/AGENTS.md travel/AGENTS.md health-care/AGENTS.md | wc -l)
echo "[fos-brain 섹션 보유 파일 수] $COUNT"
[ "$COUNT" -eq 5 ] || { echo "PHASE_FAILED: fos-brain 연동 섹션이 5개 미만"; exit 1; }

# 각 파일이 ADR-009 역참조 보유 (기대: 5)
ADRREF=$(grep -lr "ADR-009" apartment/AGENTS.md career-os/AGENTS.md stock-investment/AGENTS.md travel/AGENTS.md health-care/AGENTS.md | wc -l)
echo "[ADR-009 역참조 파일 수] $ADRREF"
[ "$ADRREF" -eq 5 ] || { echo "PHASE_FAILED: ADR-009 역참조 누락"; exit 1; }
echo "OK"
```

PHASE_FAILED 트리거 시 반드시 위 bash 블록을 Bash 도구로 실행해 `exit 1`로 종료한다. prose만 출력하면 success로 잘못 처리된다.

## 커밋 (검증 통과 후)

**중요**: working tree에 본 plan과 무관한 미커밋 작업이 존재한다(apartment·career-os 등).
`git add -A` / `git add .` 절대 금지 — 아래처럼 **편집한 5개 AGENTS.md만** 명시 add한다.
push는 하지 않는다(마지막 phase 이후 오케스트레이터가 처리).

```bash
cd "$(git rev-parse --show-toplevel)"
git add apartment/AGENTS.md career-os/AGENTS.md stock-investment/AGENTS.md travel/AGENTS.md health-care/AGENTS.md
# 방어: 정확히 5개만 staged (무관 파일 혼입 차단)
STAGED=$(git diff --cached --name-only | wc -l)
echo "[staged 파일 수] $STAGED"
[ "$STAGED" -eq 5 ] || { echo "PHASE_FAILED: staged가 5개 아님 — 무관 파일 혼입 위험"; git reset; exit 1; }
git commit -m "$(cat <<'EOF'
docs(ai-nodes): plan003 phase-01 5 워크스페이스 brain 연동 역참조

- apartment·career-os·stock-investment·travel·health-care AGENTS.md에 fos-brain 연동 섹션 추가
- 단일 정책(루트 AGENTS.md 13번 + ADR-009/010) 역참조 + 산출물 종류별 네임스페이스 라우팅

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

## 의도 메모 (왜)

- 거울 구조(ADR-005) — 정책 본문은 루트 `AGENTS.md` 13번 단일 소스, 워크스페이스는 역참조 + 자기 라우팅만. 같은 정의를 5곳에 복제하지 않는다.
- 산출물 종류별 라우팅(ADR-010) — career-os는 study(public-OK)와 개인 baseline(private)이 섞이므로 워크스페이스 단위가 아닌 종류 단위.
