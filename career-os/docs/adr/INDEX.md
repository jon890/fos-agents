# ADR INDEX — career-os

개별 ADR 파일 조망 표. 새 ADR은 새 파일(`docs/adr/ADR-NNN-slug.md`) + 이 INDEX 행 추가.
작성 규칙은 [`../README.md`](../README.md)의 ADR 작성 규칙을 따른다.

| ADR | 제목 | Status | 파일 |
|---|---|---|---|
| ADR-001 | Daily 파일 선택 전략 | 결정됨 | [ADR-001-daily-파일-선택-전략.md](ADR-001-daily-파일-선택-전략.md) |
| ADR-002 | 학습 진도 추적 | 결정됨 | [ADR-002-학습-진도-추적.md](ADR-002-학습-진도-추적.md) |
| ADR-003 | Baseline 청킹 제거 | 결정됨 | [ADR-003-baseline-청킹-제거.md](ADR-003-baseline-청킹-제거.md) |
| ADR-005 | Study pack 출력 및 발행 정책 | Partially superseded by [[ADR-086]] | [ADR-005-study-pack-출력-및-발행-정책.md](ADR-005-study-pack-출력-및-발행-정책.md) |
| ADR-006 | Study-pack 엔트리포인트와 topic 라우팅 | Partially superseded by ai-nodes ADR-002 (plan013, 2026-05-14) — run_now.sh study-pack 진입점이 /study-pack native skill로 전환. config/study-pack-topics.json 메타데이터는 유지. | [ADR-006-study-pack-엔트리포인트와-topic-라우팅.md](ADR-006-study-pack-엔트리포인트와-topic-라우팅.md) |
| ADR-008 | Generation status notifications | Accepted; PDF scope superseded by [[ADR-059]] | [ADR-008-generation-status-notifications.md](ADR-008-generation-status-notifications.md) |
| ADR-009 | Morning topic reservoir + recommendation pipeline | Partially superseded by [[ADR-062]] | [ADR-009-morning-topic-reservoir-recommendation-pipeline.md](ADR-009-morning-topic-reservoir-recommendation-pipeline.md) |
| ADR-010 | Recommendation scoring + mix targets | Accepted | [ADR-010-recommendation-scoring-mix-targets.md](ADR-010-recommendation-scoring-mix-targets.md) |
| ADR-012 | Morning 추천을 10픽 + 오늘의 3선으로 확장 | Accepted | [ADR-012-morning-추천을-10픽-오늘의-3선으로-확장.md](ADR-012-morning-추천을-10픽-오늘의-3선으로-확장.md) |
| ADR-013 | RSS·Atom discovery 레이어 부착 | Accepted | [ADR-013-rss-atom-discovery-레이어-부착.md](ADR-013-rss-atom-discovery-레이어-부착.md) |
| ADR-014 | Claude usage 전파 패턴 통일 (토큰·비용 회계 복구) | Accepted (2026-05-13 실측 검증 완료). 관련: ADR-023(삭제, git history 보존) 출력 포맷 결정은 사실상 무효화. | [ADR-014-claude-usage-전파-패턴-통일-토큰-비용-회계-복구.md](ADR-014-claude-usage-전파-패턴-통일-토큰-비용-회계-복구.md) |
| ADR-015 | docs/ 피드백 루프 + data/ 위치 정책 | Accepted | [ADR-015-docs-피드백-루프-data-위치-정책.md](ADR-015-docs-피드백-루프-data-위치-정책.md) |
| ADR-016 | config 디렉터리 통합: 관심사별 단일 파일 + JSON 통일 | Partially superseded by [[ADR-027]] (plan017, 2026-05-15) — topics.json이 3 namespace로 재분리 (study-pack-topics / study-pack-candidates / question-bank-topics). 외부 reading source 통합본은 `config/external-reading-sources.json`으로 rename했고, baseline-core-files.json 통합 결정은 유지. | [ADR-016-config-디렉터리-통합-관심사별-단일-파일-json-통일.md](ADR-016-config-디렉터리-통합-관심사별-단일-파일-json-통일.md) |
| ADR-017 | cj-oliveyoung-java-backend-prep 거대 skill 분해 | Accepted | [ADR-017-cj-oliveyoung-java-backend-prep-거대-skill-분해.md](ADR-017-cj-oliveyoung-java-backend-prep-거대-skill-분해.md) |
| ADR-018 | docs/ 운영 정책: 휘발성 vs 영속, learn → ADR 흡수 흐름 | Partially superseded by [[ADR-032]] (2026-05-17, learn 영역 폐기 — hand-off/prep 유지 결정은 살아있음) — 5문서 + docs/data 분리 부분은 ai-nodes ADR-004 (2026-05-18)로 모노레포 격상 (Lifted) | [ADR-018-docs-운영-정책-휘발성-vs-영속-learn-adr-흡수-흐름.md](ADR-018-docs-운영-정책-휘발성-vs-영속-learn-adr-흡수-흐름.md) |
| ADR-019 | career-os: Claude Code skill 폴더와 실행 스크립트 디렉터리 분리 | Accepted | [ADR-019-career-os-claude-code-skill-폴더와-실행-스크립트-디렉터리-분리.md](ADR-019-career-os-claude-code-skill-폴더와-실행-스크립트-디렉터리-분리.md) |
| ADR-020 | 공용 헬퍼 TS(Bun) 마이그레이션: 점진 + _shared/lib·types 단일 위치 | Accepted | [ADR-020-공용-헬퍼-ts-bun-마이그레이션-점진-_shared-lib-types-단일-위치.md](ADR-020-공용-헬퍼-ts-bun-마이그레이션-점진-_shared-lib-types-단일-위치.md) |
| ADR-021 | Discord 알림 openclaw 경유 + 워크스페이스 `.env` 격리 | Archived (2026-06-29, OpenClaw 전환 문서 정리) — .env 워크스페이스 root 격리 결정은 ai-nodes ADR-004 참조 | 삭제됨 |
| ADR-022 | 도메인 헬퍼 TS(Bun) 마이그레이션 | Accepted | [ADR-022-도메인-헬퍼-ts-bun-마이그레이션.md](ADR-022-도메인-헬퍼-ts-bun-마이그레이션.md) |
| ADR-025 | Skills 정리 + 한글화 정책 | 채택됨 | [ADR-025-skills-정리-한글화-정책.md](ADR-025-skills-정리-한글화-정책.md) |
| ADR-026 | study-topic-recommender native 마이그 + Python → TypeScript + replenish/promote/live-coding 흡수 |  | [ADR-026-study-topic-recommender-native-마이그-python-typescript-replenish-promote-live-coding-흡수.md](ADR-026-study-topic-recommender-native-마이그-python-typescript-replenish-promote-live-coding-흡수.md) |
| ADR-027 | knowledge-gap-analyzer → interview-prep-analyzer 통합 native 마이그 + topics.json namespace 분리 |  | [ADR-027-knowledge-gap-analyzer-interview-prep-analyzer-통합-native-마이그-topics-json-namespace-분리.md](ADR-027-knowledge-gap-analyzer-interview-prep-analyzer-통합-native-마이그-topics-json-namespace-분리.md) |
| ADR-028 | candidate-baseline-suggester skill 도입 (Append + 주석 마킹 + audit trail) |  | [ADR-028-candidate-baseline-suggester-skill-도입-append-주석-마킹-audit-trail.md](ADR-028-candidate-baseline-suggester-skill-도입-append-주석-마킹-audit-trail.md) |
| ADR-030 | position-recommender native 마이그 + collect_live_postings ts 활성화 + extract/publish/runner 폐기 |  | [ADR-030-position-recommender-native-마이그-collect_live_postings-ts-활성화-extract-publish-runner-폐기.md](ADR-030-position-recommender-native-마이그-collect_live_postings-ts-활성화-extract-publish-runner-폐기.md) |
| ADR-031 | command-router 디렉터리 일괄 폐기 + invoke_claude_skills.ts + format_cost_summary.ts 폐기 |  | [ADR-031-command-router-디렉터리-일괄-폐기-invoke_claude_skills-ts-format_cost_summary-ts-폐기.md](ADR-031-command-router-디렉터리-일괄-폐기-invoke_claude_skills-ts-format_cost_summary-ts-폐기.md) |
| ADR-032 | learn/ 영역 폐기 — 회고 흐름 chat + ADR/스킬 직접 흡수로 단순화 |  | [ADR-032-learn-영역-폐기-회고-흐름-chat-adr-스킬-직접-흡수로-단순화.md](ADR-032-learn-영역-폐기-회고-흐름-chat-adr-스킬-직접-흡수로-단순화.md) |
| ADR-033 | fos-study source tree를 study artifact 단일 진실원으로 사용 | Accepted | [ADR-033-fos-study-source-tree를-study-artifact-단일-진실원으로-사용.md](ADR-033-fos-study-source-tree를-study-artifact-단일-진실원으로-사용.md) |
| ADR-035 | ts 헬퍼 모듈 분해 컨벤션 (source / transform / render / cli 4 레이어) | Accepted | [ADR-035-ts-헬퍼-모듈-분해-컨벤션-source-transform-render-cli-4-레이어.md](ADR-035-ts-헬퍼-모듈-분해-컨벤션-source-transform-render-cli-4-레이어.md) |
| ADR-036 | position-recommender daily freshness guard + recommendation rotation | Accepted; 신규 후보 강제 회전은 [[ADR-100]]로 superseded; reportDate freshness 검증 책임은 [[ADR-101]]로 스킬 self-check·소비측 이전 | [ADR-036-position-recommender-daily-freshness-guard-recommendation-rotation.md](ADR-036-position-recommender-daily-freshness-guard-recommendation-rotation.md) |
| ADR-037 | application-flow-agent runtime은 policy decision engine 중심 | Accepted | [ADR-037-application-flow-agent-runtime은-policy-decision-engine-중심.md](ADR-037-application-flow-agent-runtime은-policy-decision-engine-중심.md) |
| ADR-038 | application-flow-agent 상태 전이는 skill artifact 검증 뒤에만 수행 | Accepted | [ADR-038-application-flow-agent-상태-전이는-skill-artifact-검증-뒤에만-수행.md](ADR-038-application-flow-agent-상태-전이는-skill-artifact-검증-뒤에만-수행.md) |
| ADR-039 | position-recommender 추천 단위는 개별 active/open 공고 | Accepted | [ADR-039-position-recommender-추천-단위는-개별-active-open-공고.md](ADR-039-position-recommender-추천-단위는-개별-active-open-공고.md) |
| ADR-040 | application-flow-agent native skill 실행은 명시 옵션에서만 수행 | Accepted | [ADR-040-application-flow-agent-native-skill-실행은-명시-옵션에서만-수행.md](ADR-040-application-flow-agent-native-skill-실행은-명시-옵션에서만-수행.md) |
| ADR-041 | application-flow-agent 실행 진행 상황은 명시 옵션으로 Discord에 알린다 | Accepted | [ADR-041-application-flow-agent-실행-진행-상황은-명시-옵션으로-discord에-알린다.md](ADR-041-application-flow-agent-실행-진행-상황은-명시-옵션으로-discord에-알린다.md) |
| ADR-042 | reviewer pass 판정은 사용자 검토 대기 상태로 전환한다 | Accepted | [ADR-042-reviewer-pass-판정은-사용자-검토-대기-상태로-전환한다.md](ADR-042-reviewer-pass-판정은-사용자-검토-대기-상태로-전환한다.md) |
| ADR-044 | 큰 변경은 planning → delegated implementation → main-session verification으로 운영 | Accepted | [ADR-044-큰-변경은-planning-delegated-implementation-main-session-verification으로-운영.md](ADR-044-큰-변경은-planning-delegated-implementation-main-session-verification으로-운영.md) |
| ADR-047 | position-recommender collector를 source adapter 모듈 경계로 승격·확장한다 | Accepted | [ADR-047-position-recommender-collector-adapter를-모듈-경계로-승격한다.md](ADR-047-position-recommender-collector-adapter를-모듈-경계로-승격한다.md) |
| ADR-052 | 지원 우선순위는 회사 순위가 아니라 action stage로 관리한다 | Accepted | [ADR-052-지원-우선순위는-회사-순위가-아니라-action-stage로-관리한다.md](ADR-052-지원-우선순위는-회사-순위가-아니라-action-stage로-관리한다.md) |
| ADR-055 | background worktree는 완료 시 명시적으로 정리한다 | Accepted | [ADR-055-background-worktree는-완료-시-명시적으로-정리한다.md](ADR-055-background-worktree는-완료-시-명시적으로-정리한다.md) |
| ADR-056 | resume package는 Markdown 산출물 계약을 먼저 고정한다 | Accepted | [ADR-056-resume-package는-markdown-산출물-계약을-먼저-고정한다.md](ADR-056-resume-package는-markdown-산출물-계약을-먼저-고정한다.md) |
| ADR-057 | 생성 산출물 품질 계약은 전역 기준이다 | Accepted | [ADR-057-생성-산출물-품질-계약은-전역-기준이다.md](ADR-057-생성-산출물-품질-계약은-전역-기준이다.md) |
| ADR-058 | data cleanup은 private boundary와 retention을 먼저 고정한다 | Accepted | [ADR-058-data-cleanup은-private-boundary와-retention을-먼저-고정한다.md](ADR-058-data-cleanup은-private-boundary와-retention을-먼저-고정한다.md) |
| ADR-059 | plan055 MVP에 HTML/PDF 이력서 export를 포함한다 | Accepted | [ADR-059-plan055-mvp에-html-pdf-이력서-export를-포함한다.md](ADR-059-plan055-mvp에-html-pdf-이력서-export를-포함한다.md) |
| ADR-062 | 포지션별 준비 홈은 루트 private 아래에 둔다 | Accepted | [ADR-062-포지션별-준비-홈은-루트-private-아래에-둔다.md](ADR-062-포지션별-준비-홈은-루트-private-아래에-둔다.md) |
| ADR-063 | 면접 준비 사람용 정본은 단일 prep.md로 관리한다 | Accepted | [ADR-063-면접-준비-사람용-정본은-단일-prep-md로-관리한다.md](ADR-063-면접-준비-사람용-정본은-단일-prep-md로-관리한다.md) |
| ADR-066 | 공개 가능 일반 면접 질문 bank는 public/question-bank에 둔다 | Accepted | [ADR-066-공개-가능-일반-면접-질문-bank는-public-question-bank에-둔다.md](ADR-066-공개-가능-일반-면접-질문-bank는-public-question-bank에-둔다.md) |
| ADR-069 | config는 정책·타깃·예외만 남기고 자산 목록은 파생한다 | Accepted | [ADR-069-config는-정책-타깃-예외만-남기고-자산-목록은-파생한다.md](ADR-069-config는-정책-타깃-예외만-남기고-자산-목록은-파생한다.md) |
| ADR-070 | study topic 후보 풀은 LLM refresh turn이 발굴하고 config에는 active 캐시만 반영한다 | Accepted | [ADR-070-study-topic-후보-풀은-llm-refresh-turn이-발굴하고-config에는-active-캐시만-반영한다.md](ADR-070-study-topic-후보-풀은-llm-refresh-turn이-발굴하고-config에는-active-캐시만-반영한다.md) |
| ADR-071 | study-topic-recommender 자동 실행은 bypassPermissions로 호출한다 | Accepted | [ADR-071-study-topic-recommender-자동-실행은-bypasspermissions로-호출한다.md](ADR-071-study-topic-recommender-자동-실행은-bypasspermissions로-호출한다.md) |
| ADR-072 | daily study cron은 주제 3개만 보내는 lean path로 둔다 | Accepted | [ADR-072-daily-study-cron은-주제-3개만-보내는-lean-path로-둔다.md](ADR-072-daily-study-cron은-주제-3개만-보내는-lean-path로-둔다.md) |
| ADR-073 | daily study 추천은 Discord 버튼으로 초안 생성을 요청할 수 있다 | Accepted | [ADR-073-daily-study-추천은-discord-버튼으로-초안-생성을-요청할-수-있다.md](ADR-073-daily-study-추천은-discord-버튼으로-초안-생성을-요청할-수-있다.md) |
| ADR-074 | position source coverage는 official adapter와 Wanted target discovery를 함께 쓴다 | Accepted | [ADR-074-position-source-coverage는-official-adapter와-wanted-target-discovery를-함께-쓴다.md](ADR-074-position-source-coverage는-official-adapter와-wanted-target-discovery를-함께-쓴다.md) |
| ADR-079 | 포지션 수집은 동적 discovery를 우선하고 개별 공고 URL seed를 제거한다 | Accepted | [ADR-079-포지션-수집은-동적-discovery를-우선하고-개별-공고-url-seed를-제거한다.md](ADR-079-포지션-수집은-동적-discovery를-우선하고-개별-공고-url-seed를-제거한다.md) |
| ADR-080 | position daily HTML 리포트는 template 기반 표시 미러로 둔다 | Accepted | [ADR-080-position-daily-html-리포트는-template-기반-표시-미러로-둔다.md](ADR-080-position-daily-html-리포트는-template-기반-표시-미러로-둔다.md) |
| ADR-085 | career-os skill을 Codex에 심볼릭 링크로 노출한다 | Accepted | [ADR-085-career-os-skill을-codex에-심볼릭-링크로-노출한다.md](ADR-085-career-os-skill을-codex에-심볼릭-링크로-노출한다.md) |
| ADR-086 | skill 출력 정책은 공통 reference로 둔다 | Accepted | [ADR-086-skill-출력-정책은-공통-reference로-둔다.md](ADR-086-skill-출력-정책은-공통-reference로-둔다.md) |
| ADR-087 | skill 트리거는 frontmatter description에 둔다 | Accepted | [ADR-087-skill-트리거는-frontmatter-description에-둔다.md](ADR-087-skill-트리거는-frontmatter-description에-둔다.md) |
| ADR-088 | career-os에서 docs-audit 스킬 심링크를 제거한다 | Accepted | [ADR-088-career-os에서-docs-audit-스킬-심링크를-제거한다.md](ADR-088-career-os에서-docs-audit-스킬-심링크를-제거한다.md) |
| ADR-089 | career-os ADR을 개별 파일로 관리한다 | Accepted | [ADR-089-career-os-adr을-개별-파일로-관리한다.md](ADR-089-career-os-adr을-개별-파일로-관리한다.md) |
| ADR-090 | 검증 회사군을 config JSON 단일 출처로 둔다 | Accepted | [ADR-090-검증-회사군을-json-단일-출처로-둔다.md](ADR-090-검증-회사군을-json-단일-출처로-둔다.md) |
| ADR-091 | career-os 스크립트 root는 위치 기준으로 해석한다 | Accepted | [ADR-091-script-career-os-root-위치-기준-해석.md](ADR-091-script-career-os-root-위치-기준-해석.md) |
| ADR-092 | 면접 준비 flow 재편: 핏 진단과 매일 답변 드릴 분리 | Accepted | [ADR-092-면접-준비-flow-재편-진단-드릴-분리.md](ADR-092-면접-준비-flow-재편-진단-드릴-분리.md) |
| ADR-093 | skill 호출 계약은 에이전트 비종속으로 둔다 | Accepted | [ADR-093-skill-호출-계약은-에이전트-비종속으로-둔다.md](ADR-093-skill-호출-계약은-에이전트-비종속으로-둔다.md) |
| ADR-095 | 회사 업사이드 운영 데이터를 config JSON 단일 출처로 흡수한다 | Accepted; cooldown 흡수는 [[ADR-109]]로 superseded | [ADR-095-회사-업사이드-운영데이터-config-흡수.md](ADR-095-회사-업사이드-운영데이터-config-흡수.md) |
| ADR-096 | job-fit-analyzer를 의사결정·전략 중심으로 재정의한다 | Accepted | [ADR-096-job-fit-analyzer-의사결정-전략-재정의.md](ADR-096-job-fit-analyzer-의사결정-전략-재정의.md) |
| ADR-097 | question-bank 정본을 public으로 1원화하고 개인 질문은 private에 둔다 | Accepted | [ADR-097-question-bank-정본-public으로-1원화하고-개인-질문은-private에-둔다.md](ADR-097-question-bank-정본-public으로-1원화하고-개인-질문은-private에-둔다.md) |
| ADR-098 | data-schema는 현재 스키마만 담고 폐기 항목은 ADR로 위임한다 | Accepted | [ADR-098-data-schema는-현재-스키마만-담고-폐기-항목은-adr로-위임한다.md](ADR-098-data-schema는-현재-스키마만-담고-폐기-항목은-adr로-위임한다.md) |
| ADR-099 | position-recommender 수집 설정 외부화 + 후보자 config + 지표 시계열 | Accepted | [ADR-099-position-수집설정-외부화-후보자config-지표시계열.md](ADR-099-position-수집설정-외부화-후보자config-지표시계열.md) |
| ADR-100 | position-recommender 신규 후보 강제 회전 폐기 | Accepted | [ADR-100-position-recommender-신규-후보-강제-회전-폐기.md](ADR-100-position-recommender-신규-후보-강제-회전-폐기.md) |
| ADR-101 | position-recommender 산출물을 표준 출력 JSON으로 단일화하고 소비측이 가공한다 | Accepted; consumer backend parts superseded by [[ADR-102]] | [ADR-101-position-recommender-표준출력-json-단일화-소비측-가공.md](ADR-101-position-recommender-표준출력-json-단일화-소비측-가공.md) |
| ADR-102 | fos-career 웹 대시보드를 폐기하고 파일 기반 피드백 루프로 회귀한다 | Accepted | [ADR-102-fos-career-웹-대시보드를-폐기하고-파일-기반-피드백-루프로-회귀한다.md](ADR-102-fos-career-웹-대시보드를-폐기하고-파일-기반-피드백-루프로-회귀한다.md) |
| ADR-103 | 회사 키워드·AI 랭킹 규칙 단일 출처 | Accepted | [ADR-103-회사-키워드-ai-랭킹-규칙-단일-출처.md](ADR-103-회사-키워드-ai-랭킹-규칙-단일-출처.md) |
| ADR-104 | candidate-profile core/detail 분리 + skill 매핑 | Accepted | [ADR-104-candidate-profile-core-detail-분리-skill-매핑.md](ADR-104-candidate-profile-core-detail-분리-skill-매핑.md) |
| ADR-105 | study-progress ↔ drill 상태 분리 + weak_spots 스키마 정본 | Accepted | [ADR-105-study-progress-drill-상태-분리-weak-spots-스키마-정본.md](ADR-105-study-progress-drill-상태-분리-weak-spots-스키마-정본.md) |
| ADR-106 | topic-file-map 폐기 + 참조 doc 정리 | Accepted | [ADR-106-topic-file-map-폐기-참조-doc-정리.md](ADR-106-topic-file-map-폐기-참조-doc-정리.md) |
| ADR-107 | config/state 구분 기준 + 5버킷 구조로 data/ 해체 | Accepted | [ADR-107-config-state-구분-5버킷-구조로-data-해체.md](ADR-107-config-state-구분-5버킷-구조로-data-해체.md) |
| ADR-108 | ledger를 positions-queue로 이름 변경 (코드 심볼·파일명 포함) | Accepted | [ADR-108-ledger를-positions-queue로-이름-변경-코드-포함.md](ADR-108-ledger를-positions-queue로-이름-변경-코드-포함.md) |
| ADR-109 | 회사 cooldown을 state/company-cooldown.json으로 분리 (ADR-095 cooldown 부분 supersede) | Accepted | [ADR-109-회사-cooldown을-state로-분리.md](ADR-109-회사-cooldown을-state로-분리.md) |
| ADR-110 | frontdoor-queue 폐기 + "승격"→"등록" (ADR-045 supersede) | Accepted | [ADR-110-frontdoor-queue-폐기-승격을-등록으로.md](ADR-110-frontdoor-queue-폐기-승격을-등록으로.md) |
| ADR-111 | 죽은 ADR은 archive 없이 삭제하고 provenance는 두 층으로 보존한다 | Accepted | [ADR-111-죽은-adr은-archive-없이-삭제하고-provenance는-두-층으로-보존한다.md](ADR-111-죽은-adr은-archive-없이-삭제하고-provenance는-두-층으로-보존한다.md) |
