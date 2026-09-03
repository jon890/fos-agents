# Phase 01 누적 추천 이력과 중복 차단

**Execution profile**: standard

---

## 목표

검증된 아침 공부 추천 이력을 `career-os/state/morning-study-history.json`에 누적하고, 이전에 추천한 같은 글과 영상을 다음 선택에서 코드로 거부한다.

**범위 외**: 공부 주제 중심 화면 변경, YouTube 채널 추가, Google Sheets 연동과 Cloudflare Pages 실제 게시를 수행하지 않는다.

---

## 작업 항목 (5)

### 1. 원문 식별자 정규화

`scripts/study-topic-recommender/`에 HTTPS URL을 정규화하고 `contentKey`를 만드는 모듈을 추가한다.
YouTube 영상은 `youtube:<videoId>`, 일반 글은 추적 query와 fragment를 제거한 canonical URL의 SHA-256을 사용한다.
같은 실행에서 canonical URL 또는 `contentKey`가 겹치는 후보는 한 건만 유지한다.

### 2. 누적 이력 스키마와 원자적 저장

`reading_contracts.ts`에 `schemaVersion: 1`과 `entries` 배열을 가진 이력 스키마를 추가한다.
각 entry는 `contentKey`, `canonicalUrl`, `sourceKey`, `category`, `title`, `studyTopic`, `careerValue`, `recommendedAt`, `reportId`를 가진다.
`persistence/history.ts`는 파일이 없을 때만 빈 이력을 반환하고, JSON 손상과 중복 `contentKey`는 실패로 처리한다.
저장은 같은 디렉터리의 임시 파일을 rename하는 방식으로 기존 파일을 원자적으로 교체한다.

### 3. 후보와 선택 중복 차단

후보의 `recentlyRecommended`를 `contentKey`와 `previouslyRecommended`로 교체한다.
수집기는 전체 누적 이력을 읽어 값을 정하며 최근 N개 실행만 보는 상수를 제거한다.
`validateReadingSelection`은 `previouslyRecommended: true`인 후보가 선택되면 오류를 반환한다.
명시적으로 전달한 후보풀에도 같은 검증을 적용한다.

### 4. 검증 뒤 이력 반영

실행기는 영구 이력 경로를 명시적으로 받아 읽고, 리포트 생성 중에는 영구 파일을 수정하지 않는다.
출력 검증 뒤 호출하는 완료 동작이 임시 실행의 검증된 추천 JSON을 읽어 이력 entry를 만들고 기존 이력에 추가한다.
같은 `reportId`를 다시 완료하거나 이미 존재하는 `contentKey`를 추가하면 실패로 처리한다.

### 5. 홈서버 release 연결

`scripts/career-workspace/cli.ts`의 관리 skill에 `study-topic-recommender`를 추가한다.
시작 단계가 최신 `state/` release를 준비하고 완료 단계가 검증된 이력 변경만 발행하는지 fixture로 검증한다.
충돌과 전송 실패에서는 기존 원격 release가 유지되고 로컬 이력은 보존돼야 한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/scripts/study-topic-recommender/reading_contracts.ts` | 누적 이력과 후보 식별 계약 |
| `career-os/scripts/study-topic-recommender/persistence/history.ts` | 이력 읽기와 원자적 갱신 |
| `career-os/scripts/study-topic-recommender/reading_candidate_pool.ts` | 정규화와 이전 추천 표시 |
| `career-os/scripts/study-topic-recommender/reading_selection.ts` | 이전 추천 재선택 거부 |
| `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` | 영구 이력 읽기와 완료 동작 |
| `career-os/scripts/career-workspace/cli.ts` | 관리 skill 확장 |
| `career-os/scripts/study-topic-recommender/**/*.test.ts` | 이력과 중복 차단 회귀 테스트 |
| `career-os/scripts/career-workspace/cli.test.ts` | 추천 이력 release 회귀 테스트 |

## 검증

```bash
# cwd: fos-agents root
bun test ./career-os/scripts/study-topic-recommender ./career-os/scripts/career-workspace
bunx tsc --noEmit --pretty false
git diff --check
```

테스트는 같은 YouTube 영상의 다른 URL, 추적 query가 다른 같은 글, 손상된 이력, 중복 entry, 이전 추천 선택, 같은 report 재완료와 release 충돌을 포함해야 한다.

## 의도 메모

- 중복 차단은 모델 지시가 아니라 결정적인 코드 검증이 소유한다.
- 이력은 사용자에게 전달한 추천을 복원하는 상태이므로 재생성 가능한 임시 리포트와 분리한다.
- 홈서버 release의 revision 충돌 계약을 재사용해 별도 저장 시스템을 추가하지 않는다.

## Blocked 조건

- 홈서버 관리 root에서 `state/`를 동기화하지 않으면 `PHASE_BLOCKED: state release 계약 미충족`으로 끝낸다.
