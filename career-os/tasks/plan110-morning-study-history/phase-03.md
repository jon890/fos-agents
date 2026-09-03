# Phase 03 YouTube 소스 확장과 실행 절차 정합성

**Execution profile**: standard

---

## 목표

사용자가 자주 보는 세 YouTube 채널을 공식 Atom feed로 추가하고, `study-topic-recommender` 스킬이 누적 이력과 공부 주제 흐름을 끝까지 실행하도록 갱신한다.

**범위 외**: Google Sheets 연동, YouTube Data API key 도입, 구독자·조회수 기반 순위, Cloudflare Pages 실제 게시와 개인 brain 변경을 수행하지 않는다.

---

## 작업 항목 (5)

### 1. YouTube Atom 우선 수집

`youtubeSourceAdapter`는 `feedUrl`이 있으면 기존 feed 수집기를 먼저 사용한다.
Atom feed가 없거나 읽지 못한 채널만 공개 `/videos` 페이지 파싱으로 보조 수집한다.
feed 결과와 페이지 결과는 공통 canonical URL과 `contentKey` 계약을 사용한다.

### 2. 사용자 지정 채널 추가

`config/external-reading-sources.ts`에 아래 세 채널을 `video` 카테고리로 추가한다.

- `BZCF | 비즈까페`: `https://www.youtube.com/@B_ZCF`, channel ID `UCWgXoKQ4rl7SY9UHuAwxvzQ`
- `조코딩 JoCoding`: `https://www.youtube.com/@jocoding`, channel ID `UCQNE2JmbasNYbjGAcuBiRRg`
- `양실장의 바이브코딩대학`: `https://www.youtube.com/@VibecodingUniversity`, channel ID `UCKdKdx5-eLZUmAgsdvxkKiA`

각 `feedUrl`은 `https://www.youtube.com/feeds/videos.xml?channel_id=<channelId>` 형식을 사용한다.

### 3. 영상 선별 기준

채널에 등록됐다는 이유만으로 모든 영상을 추천하지 않는다.
비즈까페는 AI와 산업 변화가 제품·조직·사업 판단에 연결될 때, 조코딩과 양실장 채널은 AI 제품 구현, 에이전트 운영, 업무 자동화와 실제 서비스·수익화 판단에 연결될 때만 선택한다.
뉴스 나열, 도구 기능 소개, 입문 문법과 홍보성 자료만 있는 영상은 제외한다.

### 4. 스킬 실행 절차 갱신

관리 원본 `career-os/.claude/skills/study-topic-recommender/SKILL.md`에 공통 workspace 시작·완료, 영구 이력 경로, 주제 선택 JSON, 출력 검증 뒤 이력 완료와 release 반영 순서를 명시한다.
실패 시 원격 release와 로컬 결과 보존, 빈 추천 허용, 외부 게시 승인 경계를 함께 적는다.
소스 관리 참고 문서는 Atom 우선과 channel ID 검증 절차를 설명한다.

### 5. 전체 정합성 검증과 task 완료

소스 설정, YouTube feed 우선과 fallback, 주제 선택, 이력 완료, workspace release를 함께 검증한다.
`career-os/tasks/plan110-morning-study-history/index.json`의 `status`를 `completed`, `current_phases`를 `3`으로 갱신한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `career-os/config/external-reading-sources.ts` | 세 YouTube 채널과 공식 Atom feed |
| `career-os/scripts/study-topic-recommender/source/adapters/youtube.ts` | Atom 우선과 페이지 fallback |
| `career-os/scripts/study-topic-recommender/source/adapters/youtube.test.ts` | feed와 fallback 회귀 테스트 |
| `career-os/.claude/skills/study-topic-recommender/SKILL.md` | 누적 이력과 주제 중심 실행 절차 |
| `career-os/.claude/skills/study-topic-recommender/references/source-management.md` | YouTube 채널 검증 절차 |
| `career-os/tasks/plan110-morning-study-history/index.json` | plan 완료 상태 |

## 검증

```bash
# cwd: fos-agents root
bun "$(git rev-parse --show-toplevel)/career-os/scripts/study-topic-recommender/manage_reading_sources.ts" validate
bun test ./career-os/scripts/study-topic-recommender ./career-os/scripts/career-workspace
bunx tsc --noEmit --pretty false
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py career-os/.claude/skills/study-topic-recommender
git diff --check
```

```bash
# cwd: fos-agents root
~/.claude/scripts/korean-style-check.sh career-os/.claude/skills/study-topic-recommender/SKILL.md career-os/.claude/skills/study-topic-recommender/references/source-management.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/ADR-013-외부-읽을거리는-전체-수집-후-모델이-선별한다.md career-os/docs/adr/ADR-107-비공개-커리어-산출물은-홈서버-파일-release로-동기화한다.md career-os/tasks/plan110-morning-study-history/phase-01.md career-os/tasks/plan110-morning-study-history/phase-02.md career-os/tasks/plan110-morning-study-history/phase-03.md
python3 ~/.claude/scripts/check-readability.py career-os/.claude/skills/study-topic-recommender/SKILL.md career-os/.claude/skills/study-topic-recommender/references/source-management.md career-os/docs/prd.md career-os/docs/flow.md career-os/docs/code-architecture.md career-os/docs/data-schema.md career-os/docs/adr/ADR-013-외부-읽을거리는-전체-수집-후-모델이-선별한다.md career-os/docs/adr/ADR-107-비공개-커리어-산출물은-홈서버-파일-release로-동기화한다.md career-os/tasks/plan110-morning-study-history/phase-01.md career-os/tasks/plan110-morning-study-history/phase-02.md career-os/tasks/plan110-morning-study-history/phase-03.md
```

세 Atom feed는 HTTP 200을 반환하고 feed title이 설정 title과 일치해야 한다.

## 의도 메모

- 사용자가 직접 고른 채널은 강한 선호 신호지만 개별 영상의 추천 가치는 별도로 판단한다.
- Atom feed를 기본으로 사용하면 채널 HTML 구조 변경이 일일 수집에 미치는 영향을 줄일 수 있다.
- 외부 저장소나 API key 없이 기존 수집기와 홈서버 release만 재사용한다.

## Blocked 조건

- 세 channel ID의 Atom feed title이 채널명과 일치하지 않으면 `PHASE_BLOCKED: YouTube 채널 식별 실패`로 끝낸다.
