---
name: interview-prep-analyzer
description: 후보자의 면접 준비를 진단·점검하는 skill. baseline 전체 진단, daily 집중 점검, stage interview prep(first-round/final-round/offer-chat) 자동 분기. 자연어 호출 — "면접 준비 진단", "오늘 갭 점검", "1차 면접 준비", "최종 면접 준비", "오퍼 단계 준비" 또는 `/interview-prep-analyzer`. 후보자 코드/문서 갭 분석이나 단계별 면접 준비면 이 skill을 호출.
---

# Interview Prep Analyzer

후보자의 fos-study 학습 노트와 회사/직무 컨텍스트를 읽고 면접 준비 갭을 분석하는 workflow. baseline(전체 진단), daily(집중 점검), stage interview prep(면접 단계별 준비) 세 갈래로 자동 분기한다.

## 생성 산출물 품질 계약

interview prep 보고서는 비공개 내부 분석이지만 사용자가 바로 다음 행동을 정할 수 있어야 한다.
공개용 글이나 제출용 문구와 섞이지 않게 비공개 리포트 경계를 유지한다.

- 한국어 우선 섹션 제목과 자연스러운 한국어 문장을 사용한다.
  영어 label은 단계명, 코드 식별자, 공식 역할명처럼 필요한 경우에만 유지한다.
- 첫 10줄 안에 결론, 준비 우선순위, 또는 권장 행동 중 하나를 둔다.
- 내부 분석에는 후보자 근거, 회사/면접 맥락, 리스크 판단을 유지한다.
  공개용 study pack이나 제출용 문구가 필요하면 별도 승인 흐름으로 분리한다.
- 근거가 부족한 항목은 `needs_evidence` raw label로 남기지 않는다.
  발견한 순간 `보강 필요 / 선택지 / 권장 행동` 구조로 바꾼다.
- 공개 fos-study 발행, 외부 제출, 비정형 면담 요청, candidate-profile 수정은 사용자 승인 전에는 실행하지 않는다.
  필요한 경우 `사용자 승인 필요` 항목으로만 안내한다.

## When to use

- 슬래시 호출: `/interview-prep-analyzer [baseline|daily|<topic-key>|first-round|final-round|offer-chat]`
- 자연어 요청 (baseline): "면접 준비 전체 진단", "baseline 갭 분석", "전반적인 학습 상태 점검", "진단해줘"
- 자연어 요청 (daily): "오늘 갭 점검", "daily 분석", "MySQL 인덱스 약점 분석", "오늘 공부할 내용 갭 확인"
- 자연어 요청 (stage): "1차 면접 준비", "first-round 준비", "최종 면접 준비", "오퍼 단계 준비", "면접 예상 질문 뽑아줘", "면접 답변 연습"
- 학습 노트 기반 면접 갭 분석이 필요한 모든 경우
- 회사/직무 맥락과 후보자 이력을 엮어 예상 질문, 답변 리스크, 역질문을 정리해야 하는 경우
- "학습 갭 분석해줘", "갭 점검해줘", "준비 현황 분석해줘", "오늘 학습 분석", "면접 연습"

fos-study publish 안 함 — 비공개 career-os 리포트만 생성.
학습 문서 작성 아님 — 갭 진단·분석 전담. 실제 문서 생성은 `/study-pack-writer` 로 위임.

일반 학습 문서 생성은 study-pack-writer, 이력서 기반 면접 자산은 interview-asset-writer 사용.

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

### 공통

1. `career-os/config/mvp-target.json` — `primary.company`, `primary.team`, `primary.role`, `primary.data_root`
2. `career-os/config/candidate-profile.md` — 11섹션 prose, 후보자 이력·약점 (필수)

### baseline 모드 추가

3. `career-os/config/baseline-core-files.json` — 큐레이션된 파일 경로 목록 (`files[].path`)
4. `career-os/sources/fos-study/<path>` — baseline-core-files에 나열된 10개 파일 (각 Read)

### daily 모드 추가

3. `career-os/config/study-progress.json` — 토픽별 학습 진도 (토픽 자동 선택 시)
4. `career-os/sources/fos-study/` inventory — 실제 파일 존재 여부와 유사 topic/path 선택의 우선 기준
5. `career-os/config/topic-file-map.json` — 선택 사항. topic-key → fos-study 파일 경로 fallback 매핑. 실제 파일 존재 여부보다 우선하지 않음.
6. `career-os/sources/fos-study/<path>` — 선택된 topic의 3-5개 파일 (각 Read)

### stage 모드 추가

3. `career-os/config/mvp-target.json` — `primary.data_root`, `primary.interview.first_round|final_round|offer_chat`
4. `career-os/<primary.data_root>/interview/prep.md` — 사람이 보는 면접 준비 단일 정본 (있으면 Read)
5. `career-os/data/source/<source_dir>/manifest.json`와 사이트 `.txt` 파일 — 수집된 회사/서비스 맥락 (있으면 Read)
6. `career-os/sources/fos-study/`의 관련 학습 문서 — 역할/약점과 직접 연결되는 범위만 선별 Read

## Workflow

### 1. 모드 판단

다음 신호로 baseline / daily / stage 분기:

**stage** 모드 → 다음 중 하나:
- 인자 또는 자연어에 `first-round`, `1차`, `실무 면접`, `final-round`, `최종`, `offer-chat`, `오퍼` 포함
- 자연어에 "회사 면접 준비", "예상 질문", "역질문", "답변 연습"이 있고 특정 회사/직무 타깃이 필요한 경우

**baseline** 모드 → 다음 중 하나:
- 인자에 `baseline` 또는 인자 없음
- 자연어에 "전체" / "진단" / "baseline" / "전반적" 포함

**daily** 모드 → 다음 중 하나:
- 인자에 topic-key (kebab-case) 또는 `daily`
- 자연어에 "오늘" / "매일" / "daily" / 특정 토픽명 포함

모호하면 사용자에게 확인 요청 (기본값 daily).

stderr에 결정 근거 1줄 로그 (예: `[interview-prep] mode=daily topic=jpa-n+1`, `[interview-prep] mode=stage stage=first-round`).

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
2. `study-progress.json` 없으면 → `sources/fos-study` inventory에서 최근 학습 흐름과 맞는 파일을 먼저 추론
3. 추론이 어렵고 `topic-file-map.json`이 있으면 실제 존재하는 파일만 fallback으로 선택
4. topic-file-map.json에 해당 topic-key가 없거나 파일이 사라졌으면 → freeform 모드 (fos-study에서 관련 파일 자연어 추론)

**stage 준비**:
1. stage를 `first_round`, `final_round`, `offer_chat` 중 하나로 정규화한다.
2. `primary.interview.<stage>`가 null이면 사용자에게 해당 단계 설정이 없다고 알리고, 회사/역할/면접 단계만으로 가능한 범위의 freeform 준비 메모를 작성할지 확인한다.
3. 설정이 있으면 필요 시 다음 수집기를 실행한다.

```bash
bun career-os/scripts/interview-prep-analyzer/collect_interview_sites.ts --mode <first-round|final-round|offer-chat>
```

4. 수집 실패가 일부면 manifest와 기존 파일로 계속한다. 전체 실패면 사이트 수집 실패를 보고서에 명시하고 candidate-profile + prep note + fos-study 근거로 진행한다.
5. 비정형 면담 요청은 표준 면접 단계로 추정하지 않는다. 회사, 상대/맥락, 목적이 확인되지 않았으면 확인 필요 항목으로 남긴다.

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

#### 4-C. stage 준비 정본

저장 경로: `career-os/<primary.data_root>/interview/prep.md`

첫 줄: `# <company> <stage-title> 면접 준비`

8개 섹션 (모두 필수):
1. 오늘의 면접 준비 요약
2. 예상 질문 드릴
3. 추천 시작 질문
4. 1차 면접 전략
5. 1차 면접 체크리스트
6. 단기 Java 준비
7. 이미 정리된 주제와 낮은 우선순위 주제
8. 다음 액션

`예상 질문 드릴` 작성 규칙:

- 1-3번은 반드시 독립적으로 답변 가능한 핵심 질문으로 둔다.
- 특정 후보자 경험을 이미 안다는 전제의 질문은 첫 질문 후보로 두지 않는다.
  예: "`<경험명>`을 `<회사 상황>`으로 설명해보세요" 형태.
- 후보자 경험 연결이 필요하면 질문 본문은 독립 질문으로 쓰고, 연결 힌트는 전략/체크리스트에 둔다.
- 압박 질문, 경험 번역 질문, 상황 적용 질문은 4-5번에만 배치한다.
- `추천 시작 질문`은 항상 1-3번 중 하나만 고른다.

#### 공통 출력 규칙

- 한국어 작성
- mvp-target.json의 `primary.company` · `primary.team` · `primary.role` 명시
- stage 준비 정본은 `primary.data_root` 아래 `interview/prep.md`에 쓰고 여러 report, drill, strategy, checklist 파일로 중복 저장하지 않음
- 답변 기록과 상세 피드백은 `interview/answers/`, `interview/feedback/`에 별도 보존하고 `prep.md`에 누적하지 않음
- 공개 study pack이나 interview asset을 만들 때는 `prep.md`의 개인 답변, 지원 전략, 회사별 민감 맥락을 그대로 복사하지 않고 public-safe 주제로 재작성함
- 후보자 실제 이력 인용 필수 (candidate-profile.md 근거, generic advice 금지)
- DB는 약점 가능성이 높은 영역으로 다루고 학습 노트 뒷받침 여부 검증
- Kotlin 현재 MVP 제외 — 분석 범위 언급 불필요
- 비정형 면담의 형식, 대화 상대의 역할, referral 이후 절차, 평가 방식은 사용자가 명시하지 않으면 가정하지 않는다
- 근거가 부족한 항목은 raw `needs_evidence` 대신 `보강 필요 / 선택지 / 권장 행동`으로 쓴다
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
  "[완료] interview-prep-analyzer <mode> <topic-key>: primary.data_root 기반 report 생성"
```

알림 실패는 비치명적 — stderr warn만, skill 자체는 success 종료.

## Self-check

보고서 작성 후 자기 점검 (재작성 ≤3회):

1. 첫 줄 `# ` 시작 (`## ` 아닌)
2. baseline: 7개 섹션 헤더 모두 존재 ("목표", "강점", "부족", "고위험", "우선순위", "면접질문", "정리주제" 포함)
3. daily: 5개 섹션 헤더 모두 존재 ("부족", "학습목표", "면접질문", "주의", "추가하면" 포함)
4. stage: 8개 섹션 헤더 모두 존재 ("오늘의 면접 준비 요약", "예상 질문 드릴", "추천 시작 질문", "1차 면접 전략", "1차 면접 체크리스트", "단기 Java 준비", "이미 정리된 주제와 낮은 우선순위 주제", "다음 액션" 포함)
5. mvp-target.json 회사·롤 명시 여부 확인
6. 후보자 이력 인용 1건 이상 (candidate-profile 구체 근거)
7. 한국어 작성 확인
8. 확인되지 않은 비정형 면담 전제나 참석자/평가 방식 추정이 없는지 확인
9. 첫 10줄 안에 결론, 준비 우선순위, 또는 권장 행동이 있음
10. 섹션 제목은 한국어 우선이며 자연스러운 한국어 문장으로 작성됨
11. raw `needs_evidence`가 남아 있지 않고 필요한 경우 `보강 필요 / 선택지 / 권장 행동`으로 바뀌어 있음
12. 공개 발행, 외부 제출, 비정형 면담 요청, candidate-profile 수정은 `사용자 승인 필요`로만 표현됨
13. stage `예상 질문 드릴` 1-3번은 독립 질문이며, `추천 시작 질문`은 1-3번 중 하나임

실패 항목이 있으면 수정 후 재작성. **최대 3회 시도**. 4회째도 실패 시 stderr에 `interview-prep 검증 실패: <항목>` + exit 1.

## Error handling

| 상황 | 처리 |
|---|---|
| 모드 판단 불가 (자연어·인자 모두 모호) | stderr + 사용자에게 baseline/daily 확인 요청 (기본값 daily) |
| fos-study git pull 실패 | stderr warn + 로컬 캐시로 분석 계속 |
| topic 자동 선택 실패 (study-progress 없음 + 실제 fos-study 파일 추론 실패) | freeform 모드 — Claude가 fos-study에서 적절한 파일 추론 |
| stage 설정 없음 | 사용자에게 설정 없음 명시. 확인 없이 다른 면담 상황으로 대체하지 않음 |
| baseline-core-files.json 없음 | stderr + exit 1 |
| candidate-profile.md 없음 | stderr + exit 1 |
| self-check 3회 실패 | stderr + exit 1, 실패 항목 명시 |
| Discord notify 실패 | stderr warn, skill success |

## Why this design

- **단일 면접 준비 skill (ADR-027, ADR-048)**: baseline + daily + stage는 입력 셋·섹션 수가 다르지만 mvp-target + candidate-profile + 필요한 학습/회사 context Read → Claude 분석 → report Write 흐름이 공통이다. 분리 시 SKILL.md drift 위험 — 통합이 native 패턴에 맞다.
- **실행 확인 폐기 (ADR-027)**: native 패턴에서 Claude 호출 sanity는 다른 skill 사용 중에 자연 확인됨. 별도 실행 확인은 overhead 대비 가치 약함.
- **Python 6개 폐기 (ADR-027)**: build_target_file_list / select_topic / update_study_progress 알고리즘은 단순 (점수 없음, cooldown 단순) — Claude 자연어 추론으로 동등 대체. 외부 Python 의존 제거로 실행 경로 단순화.
- **Self-check 본 skill 안에 박는 이유**: 옛 외부 validator를 Claude 자체 검증으로 대체. SKILL.md 단일 진실 출처.
