---
name: interview-coffeechat-prep
description: 면접 커피챗 준비 — 현 active 타깃 기업(mvp-target.json `primary.coffeechat`)의 회사 사이트 자동 수집 + 후보자 프로필 결합 + Claude 분석으로 비공개 전략 리포트 생성. 회사 불가지론 — 회사명은 mvp-target.json에서만 받음. "커피챗 준비", "회사 리서치", "면접 회사 분석" 같은 자연어 요청 또는 `/interview-coffeechat-prep` 슬래시. fos-study가 아닌 비공개 career-os 리포트 생성.
---

# Interview Coffeechat Prep

현 active 타깃 기업의 커피챗 전략 보고서를 자동 생성하는 비공개 career-os skill.

**회사 불가지론**: 회사명·사이트 URL·슬러그는 `config/mvp-target.json`의 `primary.coffeechat` 객체에서만 읽는다. 이 SKILL.md 어디에도 특정 회사명을 박지 않는다.

스키마 검증: `career-os/scripts/interview-coffeechat-prep/mvp_target_schema.ts`의 `parseMvpTarget()` + zod로 진입 시점에 설정 오류를 조기 차단한다.

## When to use

- 사용자가 `/interview-coffeechat-prep` 슬래시 호출
- 자연어 요청: "커피챗 준비해줘", "회사 리서치 해줘", "면접 회사 분석해줘", "커피챗 전략 보고서 만들어줘"
- 호출 빈도: 커피챗 일정 전 1회 이상, 신규 타깃 전환 후 첫 번째 실행
- "회사 분석해줘", "기업 조사해줘", "타깃 기업 준비해줘", "인터뷰 전 회사 공부"

회사명 직접 입력 불필요 — `mvp-target.json primary.coffeechat` 에서 자동 추출.
단일 active 타깃 기준 실행 — 복수 기업 동시 비교 분석 아님.

## Inputs

Claude는 다음을 `Read` 도구로 직접 로드:

1. `career-os/config/mvp-target.json` → zod parse (`career-os/scripts/interview-coffeechat-prep/mvp_target_schema.ts` `parseMvpTarget()`) → `primary.coffeechat` 객체 추출
   - `coffeechat.sites` — fetch 대상 사이트 배열 (key, url, label)
   - `coffeechat.source_dir` — 수집 결과 저장 경로 (`data/source/<source_dir>/`)
   - `coffeechat.report_slug` — 리포트 경로 슬러그
   - `coffeechat.prep_dir` — 전략 노트 경로 (`data/prep/<prep_dir>/`)
   - `coffeechat.strategy_filename` — 기본값 `strategy.md`
   - `coffeechat.checklist_filename` — 기본값 `checklist.md`
2. `career-os/config/candidate-profile.md` — 후보자 프로필 (11섹션)
3. `career-os/data/prep/<coffeechat.prep_dir>/<strategy_filename>` — 커피챗 전략 노트 (선택)
4. `career-os/data/prep/<coffeechat.prep_dir>/<checklist_filename>` — 준비 체크리스트 (선택)
5. `career-os/data/source/<coffeechat.source_dir>/` — 사이트 수집 결과 `.txt` 파일들
6. `references/coffeechat-prompt.md` — 분석 프롬프트 가이드

## Workflow

### 1. mvp-target.json 파싱

```
Read career-os/config/mvp-target.json
→ primary.coffeechat 객체가 없으면 "coffeechat 설정 없음" + exit 1
→ primary.company, primary.team, primary.role 도 추출 (리포트 헤더용)
```

mvp-target.json이 구버전 flat 필드(`coffeechat_skill_dir` 등)를 가지면 `primary.coffeechat` 블록이 없어 즉시 실패. 사용자에게 `primary.coffeechat` 객체 마이그 안내.

### 2. 사이트 수집 (Bash)

```bash
bun career-os/scripts/interview-coffeechat-prep/collect_company_sites.ts \
  --outdir career-os/data/source/<coffeechat.source_dir>/
```

수집 완료 시 `data/source/<source_dir>/manifest.json` 자동 생성 — 수집된 사이트 목록 + 성공/실패 상태.
수집 일부 실패 (exit 2) 시 경고만 출력하고 계속 진행. 전체 실패 (exit 1) 시 리포트 생성 중단.

### 3. 컨텍스트 조립 (Read)

- candidate-profile.md
- `data/prep/<prep_dir>/<strategy_filename>` (없으면 "전략 노트 없음" 표시)
- `data/prep/<prep_dir>/<checklist_filename>` (없으면 "체크리스트 없음" 표시)
- `data/source/<source_dir>/manifest.json` — 수집 결과 요약
- `data/source/<source_dir>/<key>.txt` (sites 배열의 각 key)
- `references/coffeechat-prompt.md`

### 4. Claude 분석 + 리포트 작성

`references/coffeechat-prompt.md` 가이드에 따라 회사 분석 + 후보자 포지셔닝 전략 + 커피챗 대화 흐름 + 백엔드 관심 포인트 통합 리포트 작성.

리포트 구조:
- `# <primary.company> 커피챗 준비 리포트`
- 회사 서비스 인사이트 (수집 사이트 기반)
- 후보자 포지셔닝 전략
- 커피챗 대화 흐름 + 예상 Q&A
- 백엔드 기술 스택 관심 포인트
- 준비 체크리스트 확인

### 5. 리포트 저장 (Write)

```
Write → career-os/data/reports/daily/YYYY-MM-DD/<coffeechat.report_slug>/report.md
Write → career-os/data/runtime/<coffeechat.report_slug>.md  (런타임 미러)
```

날짜는 `new Date().toISOString().slice(0, 10)` 기준.

### 6. Discord 알림

```bash
bun --env-file=career-os/.env ../_shared/lib/notify_discord.ts \
  "[완료] interview-coffeechat-prep: data/reports/daily/YYYY-MM-DD/<report_slug>/report.md"
```

알림 실패는 비치명적 — stderr warn만, skill은 success 종료.

## Self-check

리포트 작성 후 다음 항목 검증:

1. `report.md` 총 줄 수 ≥ 50 (내용 충분성)
2. 회사명이 `primary.company` 값과 일치하는지 확인 (hard-coded 단어 아닌지)
3. `data/source/<source_dir>/manifest.json`의 각 site entry가 리포트에 언급됐는지
4. `data/runtime/<report_slug>.md` 파일 존재 확인

실패 항목 있으면 해당 섹션 보완 후 재작성. 최대 2회 (리포트 분량 특성상 재작성 비용이 큼).

## Error handling

| 상황 | 처리 |
|---|---|
| `primary.coffeechat` 없음 | "mvp-target.json에 coffeechat 설정 없음" + exit 1 |
| zod parse 실패 | 스키마 불일치 필드 명시 + exit 1 |
| 사이트 수집 전체 실패 | "사이트 수집 실패" + exit 1 |
| 사이트 수집 일부 실패 | stderr warn + 수집된 파일로 계속 진행 |
| strategy.md 없음 | "전략 노트 없음" 표시 + 리포트 생성 계속 |
| report.md 줄 수 < 50 | 내용 보완 후 재작성 (최대 2회) |
| Discord notify 실패 | stderr warn, skill은 success |

## Why this design

- **ADR-029**: Python 수집기 → TypeScript 마이그, 회사명 hard-coded 제거. mvp-target.json `primary.coffeechat` 객체가 단일 진실 출처. 회사 전환 시 JSON 한 곳만 수정.
- **zod 파싱 first**: `mvp_target_schema.ts` `parseMvpTarget()`로 runner 진입 시점 스키마 검증 → 회사 설정 오류를 수집/분석 전에 조기 실패.
- **사이트 수집 분리**: `collect_company_sites.ts` 독립 실행 가능. skill 밖에서도 재실행·디버깅 용이.

## References

- `references/coffeechat-prompt.md` — 분석 프롬프트 가이드
- `career-os/config/mvp-target.json` — 타깃 기업 + coffeechat 설정 단일 출처
- `career-os/scripts/interview-coffeechat-prep/mvp_target_schema.ts` — zod 스키마 + parseMvpTarget() 함수
- `career-os/docs/adr.md` ADR-029 — 본 설계 결정 근거
