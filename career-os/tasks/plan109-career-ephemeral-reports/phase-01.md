# Phase 01 읽을거리 실행 경로와 산출물 계약 변경

**Execution profile**: standard

---

## 목표

`study-topic-recommender`가 저장소의 `state/`와 `reports/`를 기본 출력 경로로 사용하지 못하게 하고, 검증된 시스템 임시 실행 경로에만 산출물을 만든다.

이 phase는 plan107이 만드는 `applications`, `library`, `state` 관리 경계와 임시 리포트 제외 계약을 전제로 한다.
plan107이 대상 브랜치의 base에 없으면 구현을 시작하지 않는다.

**범위 외**: 홈서버 release 발행, `applications/library/state` 동기화 활성화, 기존 `career-os/data/reports` 파일 삭제와 공개 게시를 수행하지 않는다.

---

## 작업 항목 (4)

### 1. 실행 경로 검증

`morning_reading_cli.ts`와 `validate_outputs.ts`는 `CAREER_OS_ROOT`가 없으면 저장소 루트로 대체하지 않고 사용 오류로 중단한다.

실행 경로는 `node:os`의 `tmpdir()` 아래에 있어야 하고 마지막 경로 이름이 `study-topic-recommender.`로 시작해야 한다.
경로 오류는 절대 경로나 stack trace를 출력하지 않고 종료 코드 `2`로 끝낸다.

### 2. 리포트 경로 평면화

`render/report.ts`의 입력을 `reportsDir`과 `downloadsDir` 대신 `outputDir` 하나로 바꾼다.
Markdown은 `<RUN_DIR>/morning-reading.md`, HTML은 `<RUN_DIR>/morning-reading-YYYY-MM-DD.html`에 만든다.

추천 JSON, 후보풀과 이력의 기존 실행별 경로는 이번 phase에서 바꾸지 않는다.

### 3. 검증기 계약 변경

`validate_outputs.ts`는 같은 실행 경로의 Markdown과 HTML을 검사한다.
리포트 내용, HTTPS URL과 공개 범위 검사는 유지한다.

### 4. 회귀 테스트

임시 경로의 정상 생성, `CAREER_OS_ROOT` 누락, 시스템 임시 디렉터리 밖 경로와 잘못된 접두사를 검증한다.
오류 출력에 stack trace와 환경 절대 경로가 없는지도 subprocess 테스트로 확인한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` | 명시적 임시 실행 경로와 출력 계약 적용 |
| `career-os/scripts/study-topic-recommender/render/report.ts` | 평면 출력 경로 적용 |
| `career-os/scripts/study-topic-recommender/validate_outputs.ts` | 평면 산출물 검증 |
| `career-os/scripts/study-topic-recommender/**/*.test.ts` | 실행 경로와 공개 경계 회귀 테스트 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/study-topic-recommender
bunx tsc --noEmit --pretty false
git diff --check
```

다음 검색은 저장소 기본 출력 경로와 `reports/` 생성 상수를 출력하지 않아야 한다.

```bash
# cwd: fos-agents root
rg -n 'REPORTS_DIR|DOWNLOADS_DIR|resolve\(ROOT, "reports"\)|join\(ROOT, "reports"\)' career-os/scripts/study-topic-recommender
```

## 의도 메모 (왜)

- 공개 리포트는 다시 만들 수 있으므로 홈서버 release와 로컬 영구 경로에 둘 이유가 없다.
- 실행 경로를 명시하게 하면 직접 CLI를 호출해도 저장소에 산출물이 남지 않는다.
- 기존 자료 삭제는 복구 가능성을 확인할 별도 작업으로 남겨 데이터 정리와 코드 계약 변경을 분리한다.

## Blocked 조건

- plan107의 임시 리포트 제외 계약이 base에 없으면 `PHASE_BLOCKED: plan107 base 미반영`으로 끝낸다.
