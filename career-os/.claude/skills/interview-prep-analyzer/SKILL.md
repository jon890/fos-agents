---
name: interview-prep-analyzer
description: 후보자의 학습 갭을 진단·점검하는 면접 준비 분석 skill. 두 모드 자동 분기 — (1) baseline 전체 진단 (큐레이션 10 파일 + 7 섹션 면접 고위험 영역 도출, 면접 시즌 시작 시), (2) daily 집중 점검 (토픽 1개 3-5 파일 + 5 섹션 + study-progress.json 갱신, 매일). 자연어 호출 — "면접 준비 진단", "오늘 갭 점검", "<topic> 약점 분석" 또는 `/interview-prep-analyzer` 슬래시. 후보자 코드/문서 갭 분석이면 무조건 이 skill을 호출.
---

# Interview Prep Analyzer

후보자의 fos-study 학습 노트를 읽고 면접 준비 갭을 분석하는 workflow. baseline(전체 진단)과 daily(집중 점검) 두 모드 자동 분기.

## When to use

- 슬래시 호출: `/interview-prep-analyzer [baseline|daily|<topic-key>]`
- 자연어 요청 (baseline): "면접 준비 전체 진단", "baseline 갭 분석", "전반적인 학습 상태 점검", "진단해줘"
- 자연어 요청 (daily): "오늘 갭 점검", "daily 분석", "MySQL 인덱스 약점 분석", "오늘 공부할 내용 갭 확인"
- 학습 노트 기반 면접 갭 분석이 필요한 모든 경우
- "학습 갭 분석해줘", "갭 점검해줘", "준비 현황 분석해줘", "오늘 학습 분석"

fos-study publish 안 함 — 비공개 career-os 리포트만 생성.
학습 문서 작성 아님 — 갭 진단·분석 전담. 실제 문서 생성은 `/study-pack-writer` 로 위임.

일반 학습 문서 생성은 study-pack-writer, 이력서 기반 면접 자산은 interview-asset-writer 사용.

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

### 공통 (두 모드 모두)

1. `career-os/config/mvp-target.json` — `primary.company`, `primary.team`, `primary.role`
2. `career-os/config/candidate-profile.md` — 11섹션 prose, 후보자 이력·약점 (필수)

### baseline 모드 추가

3. `career-os/config/baseline-core-files.json` — 큐레이션된 파일 경로 목록 (`files[].path`)
4. `career-os/sources/fos-study/<path>` — baseline-core-files에 나열된 10개 파일 (각 Read)

### daily 모드 추가

3. `career-os/config/study-progress.json` — 토픽별 학습 진도 (토픽 자동 선택 시)
4. `career-os/config/topic-file-map.json` — topic-key → fos-study 파일 경로 배열 매핑
5. `career-os/sources/fos-study/<path>` — 선택된 topic의 3-5개 파일 (각 Read)

## Workflow

### 1. 모드 판단

다음 신호로 baseline / daily 분기:

**baseline** 모드 → 다음 중 하나:
- 인자에 `baseline` 또는 인자 없음
- 자연어에 "전체" / "진단" / "baseline" / "전반적" 포함

**daily** 모드 → 다음 중 하나:
- 인자에 topic-key (kebab-case) 또는 `daily`
- 자연어에 "오늘" / "매일" / "daily" / 특정 토픽명 포함

모호하면 사용자에게 확인 요청 (기본값 daily).

stderr에 결정 근거 1줄 로그 (예: `[interview-prep] mode=daily topic=jpa-n+1`).

### 2. fos-study git sync (Bash)

```bash
cd career-os/sources/fos-study
git pull --rebase --autostash
```

git pull 실패 시 → stderr warn + 로컬 캐시로 분석 계속 (이미 동기화된 상태면 진행 가능). 오프라인 분석 시 보고서 첫 줄 아래 "(오프라인 분석 — git sync 실패)" 경고 1줄 추가.

### 3. Context 로드 (Read)

Inputs 매트릭스대로 모두 Read.

**daily 토픽 자동 선택** (인자 없거나 `daily`만 지정):
1. `study-progress.json` Read → `weak_spots`에서 `last_studied`가 가장 오래되거나 null인 topic-key 선택
2. `study-progress.json` 없으면 → `topic-file-map.json` 첫 번째 키 선택
3. topic-file-map.json에 해당 topic-key 없으면 → freeform 모드 (fos-study에서 관련 파일 자연어 추론)

### 4. 분석 + 보고서 작성 (Write)

`Write` 도구로 마크다운 직접 작성. JSON 출력·JSON schema 불사용 — native skill 패턴.

#### 4-A. baseline 보고서

저장 경로: `career-os/data/reports/baseline/YYYY-MM-DD/report.md`

첫 줄: `# 면접 준비 baseline 진단 — YYYY-MM-DD`

7개 섹션 (모두 필수):
1. 목표와 분석 범위
2. 현재 강점
3. 부족한 부분
4. 면접 고위험 영역
5. 지원 전 우선순위 학습 계획
6. 예상 면접 질문
7. 바로 문서로 정리하면 좋은 주제

#### 4-B. daily 보고서

저장 경로: `career-os/data/reports/daily/YYYY-MM-DD/report.md`

첫 줄: `# <topic-title> 갭 점검 — YYYY-MM-DD`

5개 섹션 (모두 필수):
1. 오늘의 핵심 부족 영역
2. 오늘의 학습 목표 (30분 / 1시간 / 2시간)
3. 예상 면접 질문
4. 답변 시 주의할 포인트
5. 오늘 fos-study에 추가하면 좋은 문서 주제

#### 공통 출력 규칙

- 한국어 작성
- mvp-target.json의 `primary.company` · `primary.team` · `primary.role` 명시
- 후보자 실제 이력 인용 필수 (candidate-profile.md 근거, generic advice 금지)
- DB는 약점 가능성이 높은 영역으로 다루고 학습 노트 뒷받침 여부 검증
- Kotlin 현재 MVP 제외 — 분석 범위 언급 불필요
- 메타 보고 문구 금지 ("파일이 생성되었습니다" 등) — 보고서 본문만 작성

### 5. study-progress 갱신 (daily 모드만)

보고서 Write 완료 후 `career-os/config/study-progress.json` 갱신:
- `weak_spots[topic-key].last_studied`를 오늘 날짜(YYYY-MM-DD)로 갱신. entry 없으면 추가.
- `weak_spots[topic-key].study_count`를 +1.
- `sessions[]`에 `{ "date": "YYYY-MM-DD", "topics": ["<topic-key>"], "files": [<분석한 fos-study 파일 경로들>], "source": "daily-run" }` 추가.
- 파일 없으면 신규 생성.

### 6. Discord 알림 (Bash)

```bash
bun --env-file=career-os/.env _shared/lib/notify_discord.ts \
  "[완료] interview-prep-analyzer <mode> <topic-key>: data/reports/<mode>/YYYY-MM-DD/report.md"
```

알림 실패는 비치명적 — stderr warn만, skill 자체는 success 종료.

## Self-check

보고서 작성 후 자기 점검 (재작성 ≤3회):

1. 첫 줄 `# ` 시작 (`## ` 아닌)
2. baseline: 7개 섹션 헤더 모두 존재 ("목표", "강점", "부족", "고위험", "우선순위", "면접질문", "정리주제" 포함)
3. daily: 5개 섹션 헤더 모두 존재 ("부족", "학습목표", "면접질문", "주의", "추가하면" 포함)
4. mvp-target.json 회사·롤 명시 여부 확인
5. 후보자 이력 인용 1건 이상 (candidate-profile 구체 근거)
6. 한국어 작성 확인

실패 항목이 있으면 수정 후 재작성. **최대 3회 시도**. 4회째도 실패 시 stderr에 `interview-prep 검증 실패: <항목>` + exit 1.

## Error handling

| 상황 | 처리 |
|---|---|
| 모드 판단 불가 (자연어·인자 모두 모호) | stderr + 사용자에게 baseline/daily 확인 요청 (기본값 daily) |
| fos-study git pull 실패 | stderr warn + 로컬 캐시로 분석 계속 |
| topic 자동 선택 실패 (study-progress 없음 + topic-file-map 비어 있음) | freeform 모드 — Claude가 fos-study에서 적절한 파일 추론 |
| baseline-core-files.json 없음 | stderr + exit 1 |
| candidate-profile.md 없음 | stderr + exit 1 |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |
| Discord notify 실패 | stderr warn, skill success |

## Why this design

- **두 모드 단일 skill (ADR-027)**: baseline + daily는 입력 셋·섹션 수가 다르지만 mvp-target + candidate-profile + fos-study Read → Claude 분석 → report Write 흐름 80% 공통. 분리 시 SKILL.md drift 위험 — 통합이 native 패턴에 맞다.
- **smoke 폐기 (ADR-027)**: native 패턴에서 Claude 호출 sanity는 다른 skill 사용 중에 자연 확인됨. 별도 smoke는 overhead 대비 가치 약함.
- **Python 6개 폐기 (ADR-027)**: build_target_file_list / select_topic / update_study_progress 알고리즘은 단순 (점수 없음, cooldown 단순) — Claude 자연어 추론으로 동등 대체. 외부 Python 의존 제거로 실행 경로 단순화.
- **Self-check 본 skill 안에 박는 이유**: 옛 외부 validator를 Claude 자체 검증으로 대체. SKILL.md 단일 진실 출처.
