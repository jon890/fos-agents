# Data Schema — health-care

이 문서는 공개 config와 private data 책임을 설명한다.

## 공개 config

| 파일 | 책임 |
|---|---|
| `config/public-health-care-policy.md` | 공개 가능 정보와 금지 정보 경계 |
| `config/knee-running-recovery-plan.md` | 달리기 복귀 일반 단계와 중단 기준 |
| `config/knee-rehab-exercise-sets.md` | 단계별 재활 운동 세트 |
| `config/youtube-health-video-library.md` | 참고 영상 후보 |
| `config/health-profile.md` | 공개 가능한 건강 관리 프로필 템플릿 |

`config/`에는 개인 검사 수치, 진료 기록, 복약 정보, 정확한 개인 목표를 넣지 않는다.

## private data

`private/conditions/<track>/`는 민감정보 저장 영역이다.
git에 커밋하지 않는다.

권장 파일:

| 파일 | 내용 |
|---|---|
| `current-context.md` | 최신 요약 |
| `source-*.md` | 원본 보고, OCR, 진료 메모 |
| `progress-log.jsonl` | 증상과 운동 반응 누적 |
| `daily-checkins/YYYY-MM-DD.md` | 보존이 필요한 일일 안내 |
| `weekly-summaries/YYYY-MM-DD.md` | 병원 제출용 주간 요약 |

## `progress-log.jsonl`

각 줄은 JSON 객체다.

| 필드 | 값 |
|---|---|
| `date` | `YYYY-MM-DD` |
| `pain` | 문자열 또는 `null` |
| `instability` | 문자열 또는 `null` |
| `swelling_heat` | 문자열 또는 `null` |
| `range_of_motion` | 문자열 또는 `null` |
| `walking_stairs` | 문자열 또는 `null` |
| `actions` | 문자열 배열 |
| `next_day_reaction` | 문자열 또는 `null` |
| `red_flags` | 문자열 배열 |
| `source` | 출처 |
| `created_at` | ISO-8601 |

## reports

| 경로 | 용도 |
|---|---|
| `private/reports/` | 개인 건강 맥락이 포함된 리포트 |
| `reports/` | 완전 비식별 공개 산출물이 필요할 때만 예외적으로 사용 |

공개 또는 준공개 채널에 올릴 HTML은 개인 병력과 검사 수치를 제거한 뒤 별도 게시 절차를 따른다.
