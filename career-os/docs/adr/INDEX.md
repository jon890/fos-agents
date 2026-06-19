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
| ADR-011 | Study topic 자동 보충 (replenishment) | Superseded by plan015 (2026-05-15) — topic-pool-replenisher 폐기. study-topic-recommender가 replenish 흐름 흡수 (plan016, [[ADR-026]]). | [ADR-011-study-topic-자동-보충-replenishment.md](ADR-011-study-topic-자동-보충-replenishment.md) |
| ADR-012 | Morning 추천을 10픽 + 오늘의 3선으로 확장 | Accepted | [ADR-012-morning-추천을-10픽-오늘의-3선으로-확장.md](ADR-012-morning-추천을-10픽-오늘의-3선으로-확장.md) |
| ADR-013 | RSS·Atom discovery 레이어 부착 | Accepted | [ADR-013-rss-atom-discovery-레이어-부착.md](ADR-013-rss-atom-discovery-레이어-부착.md) |
| ADR-014 | Claude usage 전파 패턴 통일 (토큰·비용 회계 복구) | Accepted (2026-05-13 실측 검증 완료). 관련: [[ADR-023]] 출력 포맷 결정은 사실상 무효화. | [ADR-014-claude-usage-전파-패턴-통일-토큰-비용-회계-복구.md](ADR-014-claude-usage-전파-패턴-통일-토큰-비용-회계-복구.md) |
| ADR-015 | docs/ 피드백 루프 + data/ 위치 정책 | Accepted | [ADR-015-docs-피드백-루프-data-위치-정책.md](ADR-015-docs-피드백-루프-data-위치-정책.md) |
| ADR-016 | config 디렉터리 통합: 관심사별 단일 파일 + JSON 통일 | Partially superseded by [[ADR-027]] (plan017, 2026-05-15) — topics.json이 3 namespace로 재분리 (study-pack-topics / study-pack-candidates / question-bank-topics). 외부 reading source 통합본은 `config/external-reading-sources.json`으로 rename했고, baseline-core-files.json 통합 결정은 유지. | [ADR-016-config-디렉터리-통합-관심사별-단일-파일-json-통일.md](ADR-016-config-디렉터리-통합-관심사별-단일-파일-json-통일.md) |
| ADR-017 | cj-oliveyoung-java-backend-prep 거대 skill 분해 | Accepted | [ADR-017-cj-oliveyoung-java-backend-prep-거대-skill-분해.md](ADR-017-cj-oliveyoung-java-backend-prep-거대-skill-분해.md) |
| ADR-018 | docs/ 운영 정책: 휘발성 vs 영속, learn → ADR 흡수 흐름 | Partially superseded by [[ADR-032]] (2026-05-17, learn 영역 폐기 — hand-off/prep 유지 결정은 살아있음) — 5문서 + docs/data 분리 부분은 ai-nodes ADR-004 (2026-05-18)로 모노레포 격상 (Lifted) | [ADR-018-docs-운영-정책-휘발성-vs-영속-learn-adr-흡수-흐름.md](ADR-018-docs-운영-정책-휘발성-vs-영속-learn-adr-흡수-흐름.md) |
| ADR-019 | career-os: Claude Code skill 폴더와 실행 스크립트 디렉터리 분리 | Accepted | [ADR-019-career-os-claude-code-skill-폴더와-실행-스크립트-디렉터리-분리.md](ADR-019-career-os-claude-code-skill-폴더와-실행-스크립트-디렉터리-분리.md) |
| ADR-020 | 공용 헬퍼 TS(Bun) 마이그레이션: 점진 + _shared/lib·types 단일 위치 | Accepted | [ADR-020-공용-헬퍼-ts-bun-마이그레이션-점진-_shared-lib-types-단일-위치.md](ADR-020-공용-헬퍼-ts-bun-마이그레이션-점진-_shared-lib-types-단일-위치.md) |
| ADR-021 | Discord 알림 openclaw 경유 + 워크스페이스 `.env` 격리 | Lifted to ai-nodes ADR-004 (2026-05-18) — .env 워크스페이스 root 격리 부분. Discord 알림 openclaw 부분은 career-os 한정 유지. | [ADR-021-discord-알림-openclaw-경유-워크스페이스-env-격리.md](ADR-021-discord-알림-openclaw-경유-워크스페이스-env-격리.md) |
| ADR-022 | 도메인 헬퍼 TS(Bun) 마이그레이션 | Accepted | [ADR-022-도메인-헬퍼-ts-bun-마이그레이션.md](ADR-022-도메인-헬퍼-ts-bun-마이그레이션.md) |
| ADR-023 | Study-pack 생성: 파일 쓰기 → stdout 캡처 | Deprecated (2026-05-13, 실측 무효) — JSON 출력 폐기 결정이 토큰 회계 누락을 초래. ADR-014가 진짜 원인(extractor usage 전파 미구현)을 진단·복구. Write 도구 사용 금지 핵심 결정만 유지. | [ADR-023-study-pack-생성-파일-쓰기-stdout-캡처.md](ADR-023-study-pack-생성-파일-쓰기-stdout-캡처.md) |
| ADR-025 | Skills 정리 + 한글화 정책 | 채택됨 | [ADR-025-skills-정리-한글화-정책.md](ADR-025-skills-정리-한글화-정책.md) |
| ADR-026 | study-topic-recommender native 마이그 + Python → TypeScript + replenish/promote/live-coding 흡수 |  | [ADR-026-study-topic-recommender-native-마이그-python-typescript-replenish-promote-live-coding-흡수.md](ADR-026-study-topic-recommender-native-마이그-python-typescript-replenish-promote-live-coding-흡수.md) |
| ADR-027 | knowledge-gap-analyzer → interview-prep-analyzer 통합 native 마이그 + topics.json namespace 분리 |  | [ADR-027-knowledge-gap-analyzer-interview-prep-analyzer-통합-native-마이그-topics-json-namespace-분리.md](ADR-027-knowledge-gap-analyzer-interview-prep-analyzer-통합-native-마이그-topics-json-namespace-분리.md) |
| ADR-028 | candidate-baseline-suggester skill 도입 (Append + 주석 마킹 + audit trail) |  | [ADR-028-candidate-baseline-suggester-skill-도입-append-주석-마킹-audit-trail.md](ADR-028-candidate-baseline-suggester-skill-도입-append-주석-마킹-audit-trail.md) |
| ADR-030 | position-recommender native 마이그 + collect_live_postings ts 활성화 + extract/publish/runner 폐기 |  | [ADR-030-position-recommender-native-마이그-collect_live_postings-ts-활성화-extract-publish-runner-폐기.md](ADR-030-position-recommender-native-마이그-collect_live_postings-ts-활성화-extract-publish-runner-폐기.md) |
| ADR-031 | command-router 디렉터리 일괄 폐기 + invoke_claude_skills.ts + format_cost_summary.ts 폐기 |  | [ADR-031-command-router-디렉터리-일괄-폐기-invoke_claude_skills-ts-format_cost_summary-ts-폐기.md](ADR-031-command-router-디렉터리-일괄-폐기-invoke_claude_skills-ts-format_cost_summary-ts-폐기.md) |
| ADR-032 | learn/ 영역 폐기 — 회고 흐름 chat + ADR/스킬 직접 흡수로 단순화 |  | [ADR-032-learn-영역-폐기-회고-흐름-chat-adr-스킬-직접-흡수로-단순화.md](ADR-032-learn-영역-폐기-회고-흐름-chat-adr-스킬-직접-흡수로-단순화.md) |
| ADR-033 | fos-study source tree를 study artifact 단일 진실원으로 사용 | Accepted | [ADR-033-fos-study-source-tree를-study-artifact-단일-진실원으로-사용.md](ADR-033-fos-study-source-tree를-study-artifact-단일-진실원으로-사용.md) |
| ADR-034 | interview-coffeechat-prep 4 mode 일반화 (coffeechat / first-round / final-round / offer-chat) | Accepted | [ADR-034-interview-coffeechat-prep-4-mode-일반화-coffeechat-first-round-final-round-offer-chat.md](ADR-034-interview-coffeechat-prep-4-mode-일반화-coffeechat-first-round-final-round-offer-chat.md) |
| ADR-035 | ts 헬퍼 모듈 분해 컨벤션 (source / transform / render / cli 4 레이어) | Accepted | [ADR-035-ts-헬퍼-모듈-분해-컨벤션-source-transform-render-cli-4-레이어.md](ADR-035-ts-헬퍼-모듈-분해-컨벤션-source-transform-render-cli-4-레이어.md) |
| ADR-036 | position-recommender daily freshness guard + recommendation rotation | Accepted; 신규 후보 강제 회전은 [[ADR-100]]로 superseded; reportDate freshness 검증 책임은 [[ADR-101]]로 스킬 self-check·소비측 이전 | [ADR-036-position-recommender-daily-freshness-guard-recommendation-rotation.md](ADR-036-position-recommender-daily-freshness-guard-recommendation-rotation.md) |
| ADR-037 | application-flow-agent runtime은 policy decision engine 중심 | Accepted | [ADR-037-application-flow-agent-runtime은-policy-decision-engine-중심.md](ADR-037-application-flow-agent-runtime은-policy-decision-engine-중심.md) |
| ADR-038 | application-flow-agent 상태 전이는 skill artifact 검증 뒤에만 수행 | Accepted | [ADR-038-application-flow-agent-상태-전이는-skill-artifact-검증-뒤에만-수행.md](ADR-038-application-flow-agent-상태-전이는-skill-artifact-검증-뒤에만-수행.md) |
| ADR-039 | position-recommender 추천 단위는 개별 active/open 공고 | Accepted | [ADR-039-position-recommender-추천-단위는-개별-active-open-공고.md](ADR-039-position-recommender-추천-단위는-개별-active-open-공고.md) |
| ADR-040 | application-flow-agent native skill 실행은 명시 옵션에서만 수행 | Accepted | [ADR-040-application-flow-agent-native-skill-실행은-명시-옵션에서만-수행.md](ADR-040-application-flow-agent-native-skill-실행은-명시-옵션에서만-수행.md) |
| ADR-041 | application-flow-agent 실행 진행 상황은 명시 옵션으로 Discord에 알린다 | Accepted | [ADR-041-application-flow-agent-실행-진행-상황은-명시-옵션으로-discord에-알린다.md](ADR-041-application-flow-agent-실행-진행-상황은-명시-옵션으로-discord에-알린다.md) |
| ADR-042 | reviewer pass 판정은 사용자 검토 대기 상태로 전환한다 | Accepted | [ADR-042-reviewer-pass-판정은-사용자-검토-대기-상태로-전환한다.md](ADR-042-reviewer-pass-판정은-사용자-검토-대기-상태로-전환한다.md) |
| ADR-043 | position-recommender 공고 수집은 source adapter + active validator로 분리 | Accepted | [ADR-043-position-recommender-공고-수집은-source-adapter-active-validator로-분리.md](ADR-043-position-recommender-공고-수집은-source-adapter-active-validator로-분리.md) |
| ADR-044 | 큰 변경은 planning → delegated implementation → main-session verification으로 운영 | Accepted | [ADR-044-큰-변경은-planning-delegated-implementation-main-session-verification으로-운영.md](ADR-044-큰-변경은-planning-delegated-implementation-main-session-verification으로-운영.md) |
| ADR-045 | 지원 후보 frontdoor queue를 ledger와 분리한다 | Accepted | [ADR-045-지원-후보-frontdoor-queue를-ledger와-분리한다.md](ADR-045-지원-후보-frontdoor-queue를-ledger와-분리한다.md) |
| ADR-046 | fos-career 웹 대시보드를 별도 저장소로 분리한다 | Accepted | [ADR-046-fos-career-웹-대시보드를-별도-저장소로-분리한다.md](ADR-046-fos-career-웹-대시보드를-별도-저장소로-분리한다.md) |
| ADR-047 | position-recommender collector adapter를 모듈 경계로 승격한다 | Accepted | [ADR-047-position-recommender-collector-adapter를-모듈-경계로-승격한다.md](ADR-047-position-recommender-collector-adapter를-모듈-경계로-승격한다.md) |
| ADR-048 | coffeechat 자동화는 폐기하고 면접 준비 기능만 이관한다 | Accepted | [ADR-048-coffeechat-자동화는-폐기하고-면접-준비-기능만-이관한다.md](ADR-048-coffeechat-자동화는-폐기하고-면접-준비-기능만-이관한다.md) |
| ADR-049 | fos-career LLM 채팅은 provider interface 뒤에서 SDK를 교체한다 | Accepted | [ADR-049-fos-career-llm-채팅은-provider-interface-뒤에서-sdk를-교체한다.md](ADR-049-fos-career-llm-채팅은-provider-interface-뒤에서-sdk를-교체한다.md) |
| ADR-050 | fos-career 로그인은 관리자 shell 안의 content 영역으로 렌더링한다 | Accepted | [ADR-050-fos-career-로그인은-관리자-shell-안의-content-영역으로-렌더링한다.md](ADR-050-fos-career-로그인은-관리자-shell-안의-content-영역으로-렌더링한다.md) |
| ADR-051 | target source coverage는 adapter-owned entrypoint로 확장한다 | Accepted | [ADR-051-target-source-coverage는-adapter-owned-entrypoint로-확장한다.md](ADR-051-target-source-coverage는-adapter-owned-entrypoint로-확장한다.md) |
| ADR-052 | 지원 우선순위는 회사 순위가 아니라 action stage로 관리한다 | Accepted | [ADR-052-지원-우선순위는-회사-순위가-아니라-action-stage로-관리한다.md](ADR-052-지원-우선순위는-회사-순위가-아니라-action-stage로-관리한다.md) |
| ADR-053 | priority write action은 pending request bridge로 처리한다 | Accepted | [ADR-053-priority-write-action은-pending-request-bridge로-처리한다.md](ADR-053-priority-write-action은-pending-request-bridge로-처리한다.md) |
| ADR-054 | fos-career의 다음 제품 축은 application workbench다 | Accepted | [ADR-054-fos-career의-다음-제품-축은-application-workbench다.md](ADR-054-fos-career의-다음-제품-축은-application-workbench다.md) |
| ADR-055 | background worktree는 완료 시 명시적으로 정리한다 | Accepted | [ADR-055-background-worktree는-완료-시-명시적으로-정리한다.md](ADR-055-background-worktree는-완료-시-명시적으로-정리한다.md) |
| ADR-056 | resume package는 Markdown 산출물 계약을 먼저 고정한다 | Accepted | [ADR-056-resume-package는-markdown-산출물-계약을-먼저-고정한다.md](ADR-056-resume-package는-markdown-산출물-계약을-먼저-고정한다.md) |
| ADR-057 | 생성 산출물 품질 계약은 전역 기준이다 | Accepted | [ADR-057-생성-산출물-품질-계약은-전역-기준이다.md](ADR-057-생성-산출물-품질-계약은-전역-기준이다.md) |
| ADR-058 | data cleanup은 private boundary와 retention을 먼저 고정한다 | Accepted | [ADR-058-data-cleanup은-private-boundary와-retention을-먼저-고정한다.md](ADR-058-data-cleanup은-private-boundary와-retention을-먼저-고정한다.md) |
| ADR-059 | plan055 MVP에 HTML/PDF 이력서 export를 포함한다 | Accepted | [ADR-059-plan055-mvp에-html-pdf-이력서-export를-포함한다.md](ADR-059-plan055-mvp에-html-pdf-이력서-export를-포함한다.md) |
| ADR-060 | 공고 상태 액션은 사용자 버튼과 pending request로 처리한다 | Accepted | [ADR-060-공고-상태-액션은-사용자-버튼과-pending-request로-처리한다.md](ADR-060-공고-상태-액션은-사용자-버튼과-pending-request로-처리한다.md) |
| ADR-061 | 면접 준비 dashboard는 skill request gateway로 실행을 분리한다 | Accepted | [ADR-061-면접-준비-dashboard는-skill-request-gateway로-실행을-분리한다.md](ADR-061-면접-준비-dashboard는-skill-request-gateway로-실행을-분리한다.md) |
| ADR-062 | 포지션별 준비 홈은 루트 private 아래에 둔다 | Accepted | [ADR-062-포지션별-준비-홈은-루트-private-아래에-둔다.md](ADR-062-포지션별-준비-홈은-루트-private-아래에-둔다.md) |
| ADR-063 | 면접 준비 사람용 정본은 단일 prep.md로 관리한다 | Accepted | [ADR-063-면접-준비-사람용-정본은-단일-prep-md로-관리한다.md](ADR-063-면접-준비-사람용-정본은-단일-prep-md로-관리한다.md) |
| ADR-064 | fos-career 범용 채팅은 제거하고 목적별 요청 UI로 통일한다 | Accepted | [ADR-064-fos-career-범용-채팅은-제거하고-목적별-요청-ui로-통일한다.md](ADR-064-fos-career-범용-채팅은-제거하고-목적별-요청-ui로-통일한다.md) |
| ADR-065 | 면접 답변 피드백은 career context LLM evaluator로 처리한다 | Accepted | [ADR-065-면접-답변-피드백은-career-context-llm-evaluator로-처리한다.md](ADR-065-면접-답변-피드백은-career-context-llm-evaluator로-처리한다.md) |
| ADR-066 | 공개 가능 일반 면접 질문 bank는 public/question-bank에 둔다 | Accepted | [ADR-066-공개-가능-일반-면접-질문-bank는-public-question-bank에-둔다.md](ADR-066-공개-가능-일반-면접-질문-bank는-public-question-bank에-둔다.md) |
| ADR-067 | coffeechat 자동화 tombstone도 제거하고 ADR-only history로 둔다 | Accepted | [ADR-067-coffeechat-자동화-tombstone도-제거하고-adr-only-history로-둔다.md](ADR-067-coffeechat-자동화-tombstone도-제거하고-adr-only-history로-둔다.md) |
| ADR-068 | 질문 bank 보강은 dashboard request gateway로 연결한다 | Accepted | [ADR-068-질문-bank-보강은-dashboard-request-gateway로-연결한다.md](ADR-068-질문-bank-보강은-dashboard-request-gateway로-연결한다.md) |
| ADR-069 | config는 정책·타깃·예외만 남기고 자산 목록은 파생한다 | Accepted | [ADR-069-config는-정책-타깃-예외만-남기고-자산-목록은-파생한다.md](ADR-069-config는-정책-타깃-예외만-남기고-자산-목록은-파생한다.md) |
| ADR-070 | study topic 후보 풀은 LLM refresh turn이 발굴하고 config에는 active 캐시만 반영한다 | Accepted | [ADR-070-study-topic-후보-풀은-llm-refresh-turn이-발굴하고-config에는-active-캐시만-반영한다.md](ADR-070-study-topic-후보-풀은-llm-refresh-turn이-발굴하고-config에는-active-캐시만-반영한다.md) |
| ADR-071 | study-topic-recommender 자동 실행은 bypassPermissions로 호출한다 | Accepted | [ADR-071-study-topic-recommender-자동-실행은-bypasspermissions로-호출한다.md](ADR-071-study-topic-recommender-자동-실행은-bypasspermissions로-호출한다.md) |
| ADR-072 | daily study cron은 주제 3개만 보내는 lean path로 둔다 | Accepted | [ADR-072-daily-study-cron은-주제-3개만-보내는-lean-path로-둔다.md](ADR-072-daily-study-cron은-주제-3개만-보내는-lean-path로-둔다.md) |
| ADR-073 | daily study 추천은 Discord 버튼으로 초안 생성을 요청할 수 있다 | Accepted | [ADR-073-daily-study-추천은-discord-버튼으로-초안-생성을-요청할-수-있다.md](ADR-073-daily-study-추천은-discord-버튼으로-초안-생성을-요청할-수-있다.md) |
| ADR-074 | position source coverage는 official adapter와 Wanted target discovery를 함께 쓴다 | Accepted | [ADR-074-position-source-coverage는-official-adapter와-wanted-target-discovery를-함께-쓴다.md](ADR-074-position-source-coverage는-official-adapter와-wanted-target-discovery를-함께-쓴다.md) |
| ADR-075 | position daily runner는 TS를 정본으로 하고 sh는 shim으로 둔다 | Superseded by [[ADR-101]] — daily runner 폐기, cron·backend가 SKILL 직접 호출 | [ADR-075-position-daily-runner는-ts를-정본으로-하고-sh는-shim으로-둔다.md](ADR-075-position-daily-runner는-ts를-정본으로-하고-sh는-shim으로-둔다.md) |
| ADR-077 | position daily runner는 Claude 무출력 hang을 실패로 처리한다 | Accepted | [ADR-077-position-daily-runner는-claude-무출력-hang을-실패로-처리한다.md](ADR-077-position-daily-runner는-claude-무출력-hang을-실패로-처리한다.md) |
| ADR-078 | 포지션 추천 freshness는 frontdoor와 priority 갱신까지 포함한다 | Accepted | [ADR-078-포지션-추천-freshness는-frontdoor와-priority-갱신까지-포함한다.md](ADR-078-포지션-추천-freshness는-frontdoor와-priority-갱신까지-포함한다.md) |
| ADR-079 | 포지션 수집은 동적 discovery를 우선하고 개별 공고 URL seed를 제거한다 | Accepted | [ADR-079-포지션-수집은-동적-discovery를-우선하고-개별-공고-url-seed를-제거한다.md](ADR-079-포지션-수집은-동적-discovery를-우선하고-개별-공고-url-seed를-제거한다.md) |
| ADR-080 | position daily HTML 리포트는 template 기반 표시 미러로 둔다 | Accepted | [ADR-080-position-daily-html-리포트는-template-기반-표시-미러로-둔다.md](ADR-080-position-daily-html-리포트는-template-기반-표시-미러로-둔다.md) |
| ADR-081 | 지원 후보 상태와 background outbox는 fos-career DB를 정본으로 둔다 | Accepted | [ADR-081-지원-후보-상태와-background-outbox는-fos-career-db를-정본으로-둔다.md](ADR-081-지원-후보-상태와-background-outbox는-fos-career-db를-정본으로-둔다.md) |
| ADR-082 | fos-career 모바일 UX는 하단 네비게이션과 전체 공고 탐색을 분리한다 | Accepted | [ADR-082-fos-career-모바일-ux는-하단-네비게이션과-전체-공고-탐색을-분리한다.md](ADR-082-fos-career-모바일-ux는-하단-네비게이션과-전체-공고-탐색을-분리한다.md) |
| ADR-083 | source registry와 collection run은 fos-career DB가 정본이다 | Accepted | [ADR-083-source-registry와-collection-run은-fos-career-db가-정본이다.md](ADR-083-source-registry와-collection-run은-fos-career-db가-정본이다.md) |
| ADR-084 | 수집 공고 lifecycle 검증과 자동 상태 전이는 fos-career DB 이벤트로 남긴다 | Accepted | [ADR-084-수집-공고-lifecycle-검증과-자동-상태-전이는-fos-career-db-이벤트로-남긴다.md](ADR-084-수집-공고-lifecycle-검증과-자동-상태-전이는-fos-career-db-이벤트로-남긴다.md) |
| ADR-085 | career-os skill을 Codex에 심볼릭 링크로 노출한다 | Accepted | [ADR-085-career-os-skill을-codex에-심볼릭-링크로-노출한다.md](ADR-085-career-os-skill을-codex에-심볼릭-링크로-노출한다.md) |
| ADR-086 | skill 출력 정책은 공통 reference로 둔다 | Accepted | [ADR-086-skill-출력-정책은-공통-reference로-둔다.md](ADR-086-skill-출력-정책은-공통-reference로-둔다.md) |
| ADR-087 | skill 트리거는 frontmatter description에 둔다 | Accepted | [ADR-087-skill-트리거는-frontmatter-description에-둔다.md](ADR-087-skill-트리거는-frontmatter-description에-둔다.md) |
| ADR-088 | career-os에서 docs-audit 스킬 심링크를 제거한다 | Accepted | [ADR-088-career-os에서-docs-audit-스킬-심링크를-제거한다.md](ADR-088-career-os에서-docs-audit-스킬-심링크를-제거한다.md) |
| ADR-089 | career-os ADR을 개별 파일로 관리한다 | Accepted | [ADR-089-career-os-adr을-개별-파일로-관리한다.md](ADR-089-career-os-adr을-개별-파일로-관리한다.md) |
| ADR-090 | 검증 회사군을 config JSON 단일 출처로 둔다 | Accepted | [ADR-090-검증-회사군을-json-단일-출처로-둔다.md](ADR-090-검증-회사군을-json-단일-출처로-둔다.md) |
| ADR-091 | career-os 스크립트 root는 위치 기준으로 해석한다 | Accepted | [ADR-091-script-career-os-root-위치-기준-해석.md](ADR-091-script-career-os-root-위치-기준-해석.md) |
| ADR-092 | 면접 준비 flow 재편: 핏 진단과 매일 답변 드릴 분리 | Accepted | [ADR-092-면접-준비-flow-재편-진단-드릴-분리.md](ADR-092-면접-준비-flow-재편-진단-드릴-분리.md) |
| ADR-093 | skill 호출 계약은 에이전트 비종속으로 둔다 | Accepted | [ADR-093-skill-호출-계약은-에이전트-비종속으로-둔다.md](ADR-093-skill-호출-계약은-에이전트-비종속으로-둔다.md) |
| ADR-094 | 포지션 추천 산출물을 JSON 정본으로 전환한다 | Accepted | [ADR-094-포지션-추천-산출물-json-정본-전환.md](ADR-094-포지션-추천-산출물-json-정본-전환.md) |
| ADR-095 | 회사 업사이드 운영 데이터를 config JSON 단일 출처로 흡수한다 | Accepted | [ADR-095-회사-업사이드-운영데이터-config-흡수.md](ADR-095-회사-업사이드-운영데이터-config-흡수.md) |
| ADR-096 | job-fit-analyzer를 의사결정·전략 중심으로 재정의한다 | Accepted | [ADR-096-job-fit-analyzer-의사결정-전략-재정의.md](ADR-096-job-fit-analyzer-의사결정-전략-재정의.md) |
| ADR-097 | question-bank 정본을 public으로 1원화하고 개인 질문은 private에 둔다 | Accepted | [ADR-097-question-bank-정본-public으로-1원화하고-개인-질문은-private에-둔다.md](ADR-097-question-bank-정본-public으로-1원화하고-개인-질문은-private에-둔다.md) |
| ADR-098 | data-schema는 현재 스키마만 담고 폐기 항목은 ADR로 위임한다 | Accepted | [ADR-098-data-schema는-현재-스키마만-담고-폐기-항목은-adr로-위임한다.md](ADR-098-data-schema는-현재-스키마만-담고-폐기-항목은-adr로-위임한다.md) |
| ADR-099 | position-recommender 수집 설정 외부화 + 후보자 config + 지표 시계열 | Accepted | [ADR-099-position-수집설정-외부화-후보자config-지표시계열.md](ADR-099-position-수집설정-외부화-후보자config-지표시계열.md) |
| ADR-100 | position-recommender 신규 후보 강제 회전 폐기 | Accepted | [ADR-100-position-recommender-신규-후보-강제-회전-폐기.md](ADR-100-position-recommender-신규-후보-강제-회전-폐기.md) |
| ADR-101 | position-recommender 산출물을 표준 출력 JSON으로 단일화하고 소비측이 가공한다 | Accepted | [ADR-101-position-recommender-표준출력-json-단일화-소비측-가공.md](ADR-101-position-recommender-표준출력-json-단일화-소비측-가공.md) |
