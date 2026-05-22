# Phase 07 — 기존 skill 연결 검증 + TossPlace 샘플 end-to-end 리허설

## 목표

TossPlace fixture를 이용해 application agent MVP 흐름이 끊기지 않는지 검증한다.

## 리허설 범위

1. `posting.md` fixture 확인
2. `application-package-writer` 실행
3. `application-reviewer` 실행
4. revise 필요 시 한 번 이상 수정 루프 확인
5. `daily-application-digest` 실행
6. study/interview 후속 액션이 기존 skill로 자연스럽게 연결되는지 확인

## 기존 skill 연결 검증

- `/position-recommender`: 후보 큐 source로 사용 가능
- `/study-topic-recommender`: gap 기반 study 후보 추천 가능
- `/study-pack-writer`: 공개 가능한 기술 학습 자료만 발행 가능
- `/interview-asset-writer`: 공고 기반 면접 질문/답변 asset 생성 가능
- `/interview-prep-analyzer`: 제출 후 daily drill로 연결 가능
- `/candidate-baseline-suggester`: 누적 결과에서 candidate-profile 개선 후보 제안 가능

## 검증 기준

- TossPlace sample application directory에 `posting.md`, `fit-analysis.md`, `application-package.md`, `review.md`가 모두 있다.
- ledger 상태가 end-to-end 흐름에 맞게 전이된다.
- 실제 제출 자동화가 수행되지 않는다.
- `sources/fos-study/`에는 회사/지원 전략이 포함된 문서가 생성되지 않는다.
- daily digest가 사용자 승인 필요 항목과 다음 액션을 분리한다.

## 완료 기준

- plan029 MVP가 TossPlace fixture에서 동작한다.
- 남은 확장 작업은 submission assistant, cron 등록, multi-source expansion으로 분리되어 있다.
