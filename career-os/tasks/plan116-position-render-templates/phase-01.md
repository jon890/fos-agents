# Phase 01. 포지션 추천 템플릿 분리와 HTML 전용 생성

**Execution profile**: standard

## 목표

기존 두 추천 화면의 동작을 보존하면서 화면 수정 위치를 템플릿과 전용 자산으로 옮긴다.
포지션 추천 Markdown 생성은 사용자가 승인한 범위에서 제거한다.

**범위 외**: 지원 자료와 아침 읽을거리, 실제 수집, LLM, S3, private 파일과 동기화, 외부 게시와 원격 반영.

## 컨텍스트

근거는 [코드 아키텍처](../../docs/code-architecture.md#포지션-추천-렌더)와 [산출물 계약](../../docs/data-schema.md#임시-산출물과-cache)이다.
기존 두 CLI의 옵션 처리와 출력 순서를 보존한다.
현재 스킬은 `render_candidate_preview.ts`로 `index.html`을 만든다.
`sourceDiagnosticsHtml`은 기존 기본 템플릿 소비 근거가 있으므로 빈 슬롯 호환을 유지한다.

## 의도 메모

반복·조건 템플릿 언어와 다른 리포트용 공통 프레임워크는 도입하지 않는다.
의존성 추가는 사용자가 별도로 요청한 Prettier 개발 의존성만 허용한다.
`ai-slop-cleaner`는 이 범위의 죽은 Markdown 경로와 IO 혼합을 제거하는 데만 적용한다.
기존 날짜 오류 표시, 기술 정보 없음, limit 기본값과 배지 기본값은 표시 계약으로 보존한다.
슬롯 조회에는 상속 키를 허용하지 않으며 누락 값을 자동으로 빈 문자열로 채우지 않는다.

## 설계 단계 기록

| 단계           | 결과                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1. 구현 가능성 | 완료. 기존 escape와 Zod 검증을 재사용하며 네트워크 없이 구현 가능                                                      |
| 2. 기술 스택   | 완료. Bun·TypeScript와 단일 슬롯 치환 사용. 추가 승인으로 Prettier 개발 의존성만 고정 버전 도입                        |
| 3. 흐름        | 완료. 검증→조립→파일 생성 유지. 빈 추천, 실패 시 출력 보존과 동시 호출 독립성 유지                                     |
| 4. 인터페이스  | 완료. 두 화면과 CLI 유지, `--format md`만 사용법 오류로 변경                                                           |
| 5. 함수 계약   | 완료. 기존 모듈 책임 문서에 순수 렌더와 호환 함수 시그니처 기록                                                        |
| 6. 데이터·구조 | 완료. JSON 스키마와 상태 변경 없음. 템플릿, 자산, 렌더, IO 분리                                                        |
| 7. 문서 영향   | 완료. code-architecture와 data-schema 갱신. flow·PRD는 이미 HTML 흐름이고 변화 없음. 기존 ADR-035 준수로 새 ADR 불필요 |
| 8. task 생성   | 완료. 원격 두 브랜치와 로컬 마지막 번호 115 확인 후 116 사용. verify_task.py가 없어 스키마와 경로를 수동 검증          |

## 작업 항목

### 1. 출력 회귀 테스트

`career-os/scripts/position-recommender/render_recommendation.test.ts`와 기존 preview 테스트에서
정상·empty·hold·stretch·메타·이스케이프·custom template·검색을 기존 코드로 검증한다.
기존 HTML 구조와 CSS·JS 출력을 고정하고, Markdown 테스트는 제거 작업 시 HTML 전용 계약으로 변경한다.

### 2. 템플릿과 실행 책임 분리

`career-os/scripts/position-recommender/render/templates/`에 두 화면 골격과 화면별 `parts.html`, CSS와 검색 JS를 둔다.
조각은 표준 HTML `template` 요소에 모으고 설명 주석과 Prettier 줄바꿈을 허용한다.
`template.ts`는 일반 텍스트와 신뢰된 raw 조각을 구분해 한 번 치환한다.
`render/recommendation-html.ts`, `render/candidate-preview-html.ts`는 주입한 자산과 시각으로 조립한다.
`render/assets.ts`와 기존 두 CLI 파일은 파일 IO와 날짜 표시·현재 시각을 맡는다.
기존 IO형 export는 얇은 호환 함수로 유지한다.

### 3. HTML 전용 계약 반영

`render_recommendation.ts`의 `toMarkdown`과 생성 분기를 제거하고
`career-os/scripts/lib/cli-contract.test.ts`에서 md 오류와 신규 출력 없음·기존 출력 보존을 검증한다.
`career-os/.claude/skills/position-recommender/SKILL.md`의 관리 원본에 HTML 전용 계약을 명시한다.
tracked 숨김 스킬, 설정과 검사기를 검색하며 외부 실행 계약은 읽기 확인 결과만 보고한다.
개인 report.md는 삭제하지 않는다.

### 4. 포맷 적용

루트 `package.json`과 `bun.lock`에 Prettier 개발 의존성을 정확한 버전으로 추가한다.
`.prettierrc.json`에 최소 설정을 두고 `format:position-render`와 검사 명령을 제공한다.
이번 수정 TS·HTML·CSS·JS만 포맷하고 함수 사이 빈 줄 하나를 유지한다.
포맷 전후 로직 변경 여부는 회귀 테스트와 브라우저 구조·스타일 비교로 확인한다.

### 5. 공용 날짜 표시

추가 승인으로 `career-os/scripts/lib/date-format.ts`에 날짜 표시 함수를 모은다.
함수 계약은 코드 아키텍처의 포지션 추천 렌더 절을 따른다.
추천의 한국어 현재 시각·수집 시각 표시와 아침 읽을거리 두 호출부의 ISO 날짜 변환을 재사용한다.
`study-topic-recommender/render/html.ts`, `study-library/recommendations.ts`의 날짜 함수만 교체한다.
새 유틸과 테스트는 Prettier 대상에 포함하고 다른 공고·이력 날짜 정책은 변경하지 않는다.
한국 자정, offset, 빈값·invalid 오류를 기존 호출부에서 먼저 고정한 뒤 전환한다.

### 6. 독립 검토와 테스트

슬롯 누락·unknown·상속 키 실패, 값의 재치환 방지, `</script>` 입력,
연속 렌더 동일성, 주입 시각과 자산 변경 반영을 검증한다.
스크립트 전체와 관련 숨김 스킬 테스트를 S3 환경값 네 개를 제거한 채 실행한다.
`/tmp`의 상세 추천 HTML과 후보 미리보기 HTML을 browser-driver로 열어 검색, 필터, 키보드, 모바일과 링크를 검증하고 임시 파일을 삭제한다.
별도 검토자가 계획과 최종 변경을 읽고 판정하며 발견한 문제는 수정 후 재검증한다.

## 검증

```bash
bun test career-os/scripts/position-recommender/render*.test.ts career-os/scripts/lib/cli-contract.test.ts career-os/scripts/lib/date-format.test.ts
bun run format:position-render:check
env -u CAREER_STORAGE_S3_ENDPOINT -u CAREER_STORAGE_S3_BUCKET -u CAREER_STORAGE_S3_ACCESS_KEY -u CAREER_STORAGE_S3_SECRET_KEY bun test career-os/scripts
bunx tsc --noEmit
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/position-recommender
git diff --check
```

각 명령 종료 코드 0과 브라우저 검증·독립 검토 PASS가 완료 조건이다.
변경 Markdown은 한국어·가독성 검사기도 통과해야 한다.
실제 S3 연동 테스트는 건너뛰고 private 경로와 외부 상태에 쓰지 않는다.

## Critical Files

| 파일                                                                                                                            | 변경                                       |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `career-os/scripts/position-recommender/render_recommendation.ts`, `render_candidate_preview.ts`                                | 실행 경계와 호환 함수                      |
| `career-os/scripts/position-recommender/render/template.ts`, `assets.ts`, `recommendation-html.ts`, `candidate-preview-html.ts` | 신규 렌더 지원 모듈                        |
| `career-os/scripts/position-recommender/render/templates/`                                                                      | 두 화면 템플릿과 자산                      |
| `career-os/scripts/position-recommender/recommendation/schema.ts`                                                               | HTML 전용 설명 주석. 스키마 내용은 유지    |
| `career-os/scripts/position-recommender/render/*.test.ts`                                                                       | 회귀 테스트                                |
| `career-os/scripts/lib/cli-contract.test.ts`                                                                                    | HTML 전용 CLI 계약                         |
| `career-os/.claude/skills/position-recommender/SKILL.md`                                                                        | HTML 전용 계약                             |
| `career-os/docs/code-architecture.md`, `data-schema.md`                                                                         | 구현 책임과 산출물 계약                    |
| `package.json`, `bun.lock`, `.prettierrc.json`                                                                                  | Prettier 개발 의존성과 범위 한정 포맷 명령 |
| `career-os/scripts/lib/date-format.ts`, `date-format.test.ts`                                                                   | 공용 한국 날짜·시각 표시와 회귀 테스트     |
| `career-os/scripts/study-topic-recommender/render/html.ts`, `study-library/recommendations.ts`                                  | 동일 날짜 함수 재사용                      |

## 실행 결과

| 검사                               | 결과                                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 변경 전 렌더와 CLI 회귀            | 26개 통과                                                                                                                                     |
| 날짜 공용화 전 기존 두 호출부 회귀 | 2개 통과                                                                                                                                      |
| 변경 후 대상 렌더·날짜·CLI         | 39개 통과                                                                                                                                     |
| 스크립트 전체                      | 343개 통과, 실제 S3 연동 1개 제외, 실패 0개                                                                                                   |
| 숨김 스킬 테스트                   | 126개 통과, 실패 0개                                                                                                                          |
| Prettier·TypeScript·diff 검사      | 모두 통과                                                                                                                                     |
| 스킬·한국어·가독성 검사            | 모두 통과                                                                                                                                     |
| 계획 독립 검토                     | critic PASS                                                                                                                                   |
| 최종 독립 검증                     | 코드 리뷰 PASS. verifier가 테스트·정적 검사를 재실행하고 브라우저 비교 결과와 검사 스크립트를 확인. 실제 키 입력 미검증으로 종합 판정 PARTIAL |
| 브라우저 구조·스타일 비교          | 상세 500개, 미리보기 316개 요소의 구조·속성·텍스트·좌표가 1100px와 390px에서 변경 전후 동일                                                   |
| 브라우저 동작                      | 검색 11건, 복합 필터 7건, 빈 검색 0건, 전체 11건 복원, 포커스와 링크 확인                                                                     |
| 모바일                             | 390px에서 카드 1열, 가로 넘침 없음, 공고 링크 높이 44px                                                                                       |

키보드는 입력 포커스와 기본 `summary`·`input`·`button` 구조의 보존을 확인했다.
드라이버에 키 입력 명령이 없어 실제 Tab·Enter 타건은 수행하지 않았다.
코디네이터가 이 한계를 수용했으며 별도 OS 조작이나 브라우저 도구 확장은 하지 않았다.
최종 code-reviewer는 서비스 용량 오류로 실행되지 못했고 verifier가 독립 테스트와 코드 검사를 수행했다.
작성자가 브라우저를 직접 검증했고 코디네이터도 날짜 테스트·포맷·diff 검사를 별도로 실행했다.
검증용 JSON·HTML·이미지는 시스템 임시 경로에서만 만들고 검증 후 삭제한다.

추천 진입점은 311줄에서 82줄로, 미리보기 진입점은 281줄에서 66줄로 줄었다.
Markdown 생성 함수와 두 아침 읽을거리 모듈의 중복 날짜 함수를 제거했다.
HTML 골격과 표시 코드는 템플릿으로 이동했으므로 전체 줄 수 감소로 해석하지 않는다.
스키마와 필드, 개인 파일, 동기화 상태는 변경하지 않았다.
원격 push·PR·배포·게시와 실제 수집·LLM·S3 쓰기는 수행하지 않았다.
tracked 스킬·설정·검사기에는 포지션 추천 Markdown 생성이나 freshness 소비자가 없다.
외부 cron·홈서버 설정은 수정하지 않았으며, 저장소 밖 실행자가 `--format md`를 사용하면 HTML로 전환해야 한다.

## 변경 파일 목록

- [.prettierrc.json](../../../.prettierrc.json)
- [bun.lock](../../../bun.lock)
- [career-os/.claude/skills/position-recommender/SKILL.md](../../../career-os/.claude/skills/position-recommender/SKILL.md)
- [career-os/docs/code-architecture.md](../../../career-os/docs/code-architecture.md)
- [career-os/docs/data-schema.md](../../../career-os/docs/data-schema.md)
- [career-os/scripts/lib/cli-contract.test.ts](../../../career-os/scripts/lib/cli-contract.test.ts)
- [career-os/scripts/lib/date-format.test.ts](../../../career-os/scripts/lib/date-format.test.ts)
- [career-os/scripts/lib/date-format.ts](../../../career-os/scripts/lib/date-format.ts)
- [career-os/scripts/position-recommender/render/candidate-preview-html.ts](../../../career-os/scripts/position-recommender/render/candidate-preview-html.ts)
- [career-os/scripts/position-recommender/render/recommendation-html.ts](../../../career-os/scripts/position-recommender/render/recommendation-html.ts)
- [career-os/scripts/position-recommender/recommendation/schema.ts](../../../career-os/scripts/position-recommender/recommendation/schema.ts)
- [career-os/scripts/position-recommender/render/assets.test.ts](../../../career-os/scripts/position-recommender/render/assets.test.ts)
- [career-os/scripts/position-recommender/render/assets.ts](../../../career-os/scripts/position-recommender/render/assets.ts)
- [career-os/scripts/position-recommender/render/render-candidate-preview.test.ts](../../../career-os/scripts/position-recommender/render/render-candidate-preview.test.ts)
- [career-os/scripts/position-recommender/render_candidate_preview.ts](../../../career-os/scripts/position-recommender/render_candidate_preview.ts)
- [career-os/scripts/position-recommender/render/fixture.ts](../../../career-os/scripts/position-recommender/render/fixture.ts)
- [career-os/scripts/position-recommender/render/render-recommendation.test.ts](../../../career-os/scripts/position-recommender/render/render-recommendation.test.ts)
- [career-os/scripts/position-recommender/render_recommendation.ts](../../../career-os/scripts/position-recommender/render_recommendation.ts)
- [career-os/scripts/position-recommender/render/template.ts](../../../career-os/scripts/position-recommender/render/template.ts)
- [career-os/scripts/position-recommender/render/templates/preview-parts.html](../../../career-os/scripts/position-recommender/render/templates/preview-parts.html)
- [career-os/scripts/position-recommender/render/templates/preview.css](../../../career-os/scripts/position-recommender/render/templates/preview.css)
- [career-os/scripts/position-recommender/render/templates/preview.html](../../../career-os/scripts/position-recommender/render/templates/preview.html)
- [career-os/scripts/position-recommender/render/templates/preview.js](../../../career-os/scripts/position-recommender/render/templates/preview.js)
- [career-os/scripts/position-recommender/render/templates/report-parts.html](../../../career-os/scripts/position-recommender/render/templates/report-parts.html)
- [career-os/scripts/position-recommender/render/templates/report.css](../../../career-os/scripts/position-recommender/render/templates/report.css)
- [career-os/scripts/position-recommender/render/templates/report.html](../../../career-os/scripts/position-recommender/render/templates/report.html)
- [career-os/scripts/study-topic-recommender/render/html.ts](../../../career-os/scripts/study-topic-recommender/render/html.ts)
- [career-os/scripts/study-topic-recommender/study-library/recommendations.ts](../../../career-os/scripts/study-topic-recommender/study-library/recommendations.ts)
- [career-os/tasks/plan116-position-render-templates/index.json](../../../career-os/tasks/plan116-position-render-templates/index.json)
- [career-os/tasks/plan116-position-render-templates/phase-01.md](../../../career-os/tasks/plan116-position-render-templates/phase-01.md)
- [package.json](../../../package.json)
